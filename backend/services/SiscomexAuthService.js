import axios from "axios";
import { mensagemParaCodigo } from "../utils/siscomexErrors.js";
import { getHttpsAgent } from "../utils/getHttpsAgent.js";
import { pool } from "../db/pool.js";
import { decrypt } from "../utils/crypto.js";

/** @returns {Promise<{ pfx: Buffer, passphrase: string } | { keyPem: string, certPem: string } | null>} */
export async function obterCertificado(userId) {
  const { rows } = await pool.query(
    `SELECT pfx_enc, passphrase_enc, key_pem_enc, cert_pem_enc FROM credenciais WHERE user_id = $1 AND tipo = 'A1'`,
    [userId]
  );
  const row = rows[0];
  if (!row) return null;
  if (row.pfx_enc) {
    return { pfx: Buffer.from(decrypt(row.pfx_enc), "base64"), passphrase: decrypt(row.passphrase_enc) };
  }
  if (row.key_pem_enc) {
    return { keyPem: decrypt(row.key_pem_enc), certPem: decrypt(row.cert_pem_enc) };
  }
  return null;
}

/** @returns {Promise<{ clientId: string, clientSecret: string, roleType: string } | null>} */
export async function obterChaveAcesso(userId) {
  const { rows } = await pool.query(
    `SELECT client_id_enc, client_secret_enc, role_type FROM credenciais WHERE user_id = $1 AND tipo = 'CHAVE'`,
    [userId]
  );
  const row = rows[0];
  if (!row) return null;
  return { clientId: decrypt(row.client_id_enc), clientSecret: decrypt(row.client_secret_enc), roleType: row.role_type };
}

/**
 * jwt = apenas o token (sem "Bearer ") para checar expiração.
 * authorizationHeader = valor exato para o header Authorization (como em set-token), exigido pelo CCT (PUCX-ER0201).
 */
/** @type {Map<string, { jwt: string, authorizationHeader: string, csrf: string, autenticadoEm: number }>} */
const sessaoPorUsuario = new Map();

/**
 * Horário da última autenticação bem-sucedida na plataforma (por usuário interno).
 * Não é limpo em limparSessao — usado para calcular espera antes de novo POST em 422 PLAT-ER2033.
 */
/** @type {Map<string, number>} */
const ultimaAutenticacaoPlataformaMs = new Map();

/** Evita várias chamadas POST /autenticar em paralelo (PLAT-ER2033). */
/** @type {Map<string, Promise<void>>} */
const autenticarEmAndamento = new Map();

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function getEnv() {
  const baseUrl = process.env.BASE_URL?.replace(/\/$/, "") ?? "";
  const authPath = process.env.SISCOMEX_AUTH_PATH ?? "/portal/api/autenticar";
  const authChavePath =
    process.env.SISCOMEX_AUTH_CHAVE_PATH ?? "/portal/api/autenticar/chave-acesso";
  const timeout = Number(process.env.SISCOMEX_REQUEST_TIMEOUT_MS) || 60000;
  const marginSec = Number(process.env.SISCOMEX_JWT_REFRESH_MARGIN_SEC) || 120;
  return { baseUrl, authPath, authChavePath, timeout, marginSec };
}

function urlAutenticar() {
  const { baseUrl, authPath } = getEnv();
  return `${baseUrl}${authPath.startsWith("/") ? "" : "/"}${authPath}`;
}

function urlAutenticarChave() {
  const { baseUrl, authChavePath } = getEnv();
  return `${baseUrl}${authChavePath.startsWith("/") ? "" : "/"}${authChavePath}`;
}

/**
 * O header set-token costuma vir como "Bearer eyJ..." ou só o JWT.
 * Armazenar sempre o JWT puro evita "Bearer Bearer ..." no Authorization (PUCX-ER0201).
 */
export function normalizarJwtPortal(valor) {
  if (valor == null) return "";
  let t = String(valor).trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim();
  }
  if (t.toLowerCase().startsWith("bearer ")) {
    t = t.slice(7).trim();
  }
  return t;
}

function normalizarCsrf(valor) {
  if (valor == null) return "";
  return String(valor).trim();
}

function decodificarPayloadJwt(token) {
  try {
    const raw = normalizarJwtPortal(token);
    const parts = raw.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return payload;
  } catch {
    return null;
  }
}

/**
 * Se o JWT tiver `exp`, usa-o. Se não tiver (comum no Portal), reutiliza o token por um período
 * usando o horário da última autenticação bem-sucedida — evita POST /autenticar a cada request (PLAT-ER2033).
 */
function jwtExpiradoOuProximo(token, autenticadoEm) {
  const payload = decodificarPayloadJwt(token);
  const agora = Math.floor(Date.now() / 1000);
  const { marginSec } = getEnv();

  if (payload?.exp) {
    return payload.exp - marginSec <= agora;
  }

  const maxSemExpMs = Number(process.env.SISCOMEX_JWT_SEM_EXP_MS) || 50 * 60 * 1000;
  if (typeof autenticadoEm === "number" && Date.now() - autenticadoEm < maxSemExpMs) {
    return false;
  }
  return true;
}

function normalizarHeader(headers, nome) {
  const lower = nome.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower && v != null) return String(v);
  }
  return null;
}

function extrairCodigoErro(data) {
  if (data && typeof data === "object" && typeof data.code === "string") {
    return data.code;
  }
  return null;
}

export class SiscomexAuthService {
  /**
   * @param {string} userId
   * @returns {Promise<void>}
   */
  static async autenticar(userId) {
    const atual = sessaoPorUsuario.get(userId);
    if (atual && !jwtExpiradoOuProximo(atual.jwt, atual.autenticadoEm)) {
      return;
    }

    const emFila = autenticarEmAndamento.get(userId);
    if (emFila) {
      await emFila;
      const depois = sessaoPorUsuario.get(userId);
      if (depois && !jwtExpiradoOuProximo(depois.jwt, depois.autenticadoEm)) {
        return;
      }
    }

    const exec = this._executarPostAutenticar(userId);
    autenticarEmAndamento.set(userId, exec);
    try {
      await exec;
    } finally {
      autenticarEmAndamento.delete(userId);
    }
  }

  static async _executarPostAutenticar(userId) {
    const { timeout } = getEnv();

    const chave = await obterChaveAcesso(userId);
    const usarChave =
      chave &&
      String(chave.clientId || "").trim() &&
      String(chave.clientSecret || "").trim() &&
      String(chave.roleType || "").trim();

    const url = usarChave ? urlAutenticarChave() : urlAutenticar();

    const config = {
      timeout,
      headers: {
        "Role-Type": (usarChave ? chave.roleType : process.env.SISCOMEX_ROLE_TYPE) || "TRANSPORT",
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      validateStatus: () => true,
    };

    if (usarChave) {
      config.headers["Client-Id"] = String(chave.clientId).trim();
      config.headers["Client-Secret"] = String(chave.clientSecret).trim();
    } else {
      const cred = await obterCertificado(userId);
      if (!cred) {
        const err = new Error(
          "Nenhuma credencial informada. Envie o certificado A1 (.pfx) ou configure Chave de Acesso antes de consultar."
        );
        err.code = "CERT_MISSING";
        throw err;
      }
      config.httpsAgent = getHttpsAgent(cred);
    }

    const postAutenticar = () => axios.post(url, {}, config);

    let response = await postAutenticar();

    if (response.status === 422 && extrairCodigoErro(response.data) === "PLAT-ER2033") {
      const last = ultimaAutenticacaoPlataformaMs.get(userId);
      const decorrido = last != null ? Date.now() - last : null;
      const esperaMs =
        decorrido != null
          ? Math.max(0, 61000 - decorrido)
          : Number(process.env.SISCOMEX_PLAT_2033_WAIT_MS) || 61000;
      const waitFinal = Math.min(esperaMs + 500, 65000);
      console.warn(
        `[Siscomex] PLAT-ER2033: aguardando ${waitFinal}ms antes de repetir POST /autenticar (usuário ${userId}).`
      );
      await sleep(waitFinal);
      response = await postAutenticar();
    }

    const setToken =
      normalizarHeader(response.headers, "set-token") ??
      normalizarHeader(response.headers, "Set-Token");
    const csrf =
      normalizarHeader(response.headers, "x-csrf-token") ??
      normalizarHeader(response.headers, "X-CSRF-Token");

    if (response.status >= 400 || !setToken || !csrf) {
      const codigo = extrairCodigoErro(response.data);
      const msgBase = `Falha na autenticação Siscomex (HTTP ${response.status}).`;
      const hint = codigo ? mensagemParaCodigo(codigo) : null;
      const err = new Error(hint || msgBase);
      err.status = response.status;
      err.data = response.data;
      err.codigoSiscomex = codigo;
      err.codigosSiscomex = codigo ? [codigo] : undefined;
      throw err;
    }

    const agora = Date.now();
    ultimaAutenticacaoPlataformaMs.set(userId, agora);
    const authorizationHeader = String(setToken).trim();
    sessaoPorUsuario.set(userId, {
      jwt: normalizarJwtPortal(setToken),
      authorizationHeader,
      csrf: normalizarCsrf(csrf),
      autenticadoEm: agora,
    });
  }

  /**
   * @param {string} userId
   * @returns {Promise<{ jwt: string, authorizationHeader: string, csrf: string }>}
   */
  static async getTokenValido(userId) {
    let s = sessaoPorUsuario.get(userId);
    if (!s || jwtExpiradoOuProximo(s.jwt, s.autenticadoEm)) {
      await this.autenticar(userId);
      s = sessaoPorUsuario.get(userId);
    }
    if (!s) throw new Error("Sessão Siscomex indisponível após autenticação.");
    const authHeader =
      s.authorizationHeader ??
      `Bearer ${normalizarJwtPortal(s.jwt)}`;
    return {
      jwt: normalizarJwtPortal(s.jwt),
      authorizationHeader: authHeader,
      csrf: normalizarCsrf(s.csrf),
    };
  }

  /**
   * @param {string} userId
   * @param {import('axios').AxiosResponse['headers']|Record<string, unknown>} headers
   */
  static atualizarCsrf(userId, headers) {
    const h = headers || {};
    const novo =
      normalizarHeader(h, "x-csrf-token") ?? normalizarHeader(h, "X-CSRF-Token");
    if (!novo) return;
    const atual = sessaoPorUsuario.get(userId);
    if (atual) {
      sessaoPorUsuario.set(userId, { ...atual, csrf: normalizarCsrf(novo) });
    }
  }

  static limparSessao(userId) {
    sessaoPorUsuario.delete(userId);
  }
}
