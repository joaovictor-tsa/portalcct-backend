import axios from "axios";
import { getHttpsAgent } from "../utils/getHttpsAgent.js";
import {
  normalizarJwtPortal,
  obterCertificado,
  obterChaveAcesso,
  SiscomexAuthService,
} from "./SiscomexAuthService.js";
import {
  extrairCodigosErro,
  formatarErroSiscomex,
  mensagemErroHttpConsulta,
} from "../utils/siscomexErrors.js";

function getEnv() {
  const baseUrl = process.env.BASE_URL?.replace(/\/$/, "") ?? "";
  const mawbPath = process.env.SISCOMEX_MAWB_PATH ?? "";
  const hawbPath = process.env.SISCOMEX_HAWB_PATH ?? "";
  const resumoPath = process.env.SISCOMEX_RESUMO_PATH ?? "";
  const mawbMethod = (process.env.SISCOMEX_MAWB_METHOD || "GET").toUpperCase();
  const hawbMethod = (process.env.SISCOMEX_HAWB_METHOD || "GET").toUpperCase();
  const resumoMethod = (process.env.SISCOMEX_RESUMO_METHOD || "GET").toUpperCase();
  const timeout = Number(process.env.SISCOMEX_REQUEST_TIMEOUT_MS) || 60000;
  const numeroParamMawb =
    process.env.SISCOMEX_NUMERO_PARAM_MAWB ||
    process.env.SISCOMEX_NUMERO_PARAM ||
    "numeroConhecimento";
  const numeroParamHawb =
    process.env.SISCOMEX_NUMERO_PARAM_HAWB ||
    process.env.SISCOMEX_NUMERO_PARAM ||
    "numeroConhecimento";
  const numeroParamResumo =
    process.env.SISCOMEX_NUMERO_PARAM_RESUMO ||
    process.env.SISCOMEX_NUMERO_PARAM ||
    "numeroConhecimento";
  return {
    baseUrl,
    mawbPath,
    hawbPath,
    resumoPath,
    mawbMethod,
    hawbMethod,
    resumoMethod,
    timeout,
    numeroParamMawb,
    numeroParamHawb,
    numeroParamResumo,
  };
}

function montarUrl(path) {
  const { baseUrl } = getEnv();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${p}`;
}

/**
 * Parâmetros opcionais do GET /api/ext/conhecimentos (Swagger): cnpjResponsavel, dataEmissao.
 * Valores do body da requisição local têm prioridade sobre o .env.
 */
function mergeParametrosOpcionaisConhecimento(params, extras = {}) {
  const cnpj =
    extras.cnpjResponsavel ?? process.env.SISCOMEX_CNPJ_RESPONSAVEL ?? "";
  const data =
    extras.dataEmissao ?? process.env.SISCOMEX_DATA_EMISSAO ?? "";
  const digits = String(cnpj).replace(/\D/g, "");
  if (digits.length === 14) {
    params.cnpjResponsavel = digits;
  }
  const d = String(data).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    params.dataEmissao = d;
  }
  return params;
}

async function executarConsulta(userId, path, method, params) {
  const chave = await obterChaveAcesso(userId);
  const usarChave =
    chave &&
    String(chave.clientId || "").trim() &&
    String(chave.clientSecret || "").trim() &&
    String(chave.roleType || "").trim();

  const cred = usarChave ? null : await obterCertificado(userId);
  if (!usarChave && !cred) {
    const err = new Error(
      "Nenhuma credencial informada. Envie o certificado A1 (.pfx) ou configure Chave de Acesso antes de consultar."
    );
    err.code = "CERT_MISSING";
    throw err;
  }

  const { authorizationHeader, csrf } = await SiscomexAuthService.getTokenValido(userId);
  const { timeout } = getEnv();
  const url = montarUrl(path);

  /** Valor integral do set-token; opcionalmente só o JWT (sem "Bearer "). */
  const authorization =
    process.env.SISCOMEX_AUTH_HEADER_SEM_BEARER === "1" ||
    process.env.SISCOMEX_AUTH_HEADER_SEM_BEARER === "true"
      ? normalizarJwtPortal(authorizationHeader)
      : authorizationHeader;

  const config = {
    timeout,
    headers: {
      Authorization: authorization,
      "X-CSRF-Token": csrf,
      Accept: "application/json",
    },
    validateStatus: () => true,
  };
  if (cred) {
    config.httpsAgent = getHttpsAgent(cred);
  }

  let response;
  const m = method === "POST" ? "POST" : "GET";
  const logUrls =
    process.env.SISCOMEX_LOG_URLS === "1" ||
    process.env.SISCOMEX_LOG_URLS === "true";
  if (logUrls) {
    if (m === "GET") {
      const qs = new URLSearchParams(
        Object.fromEntries(
          Object.entries(params ?? {}).map(([k, v]) => [k, String(v)])
        )
      ).toString();
      console.log("[Siscomex]", m, qs ? `${url}?${qs}` : url);
    } else {
      console.log("[Siscomex]", m, url, "body=", params);
    }
  }
  if (m === "POST") {
    response = await axios.post(url, params ?? {}, config);
  } else {
    response = await axios.get(url, { ...config, params: params ?? {} });
  }

  SiscomexAuthService.atualizarCsrf(userId, response.headers);

  const codigos = extrairCodigosErro(response.data);
  const erroNegocio =
    response.status < 400 &&
    codigos.some((c) => c === "PLAT-ER2001" || c === "PUCX-ER0101");

  if (response.status >= 400 || erroNegocio) {
    const extra = formatarErroSiscomex(codigos);
    const httpHint = mensagemErroHttpConsulta(response.status, response.data);
    const err = new Error(
      extra || httpHint || `Erro na consulta Siscomex (HTTP ${response.status}).`
    );
    err.status = response.status;
    err.data = response.data;
    err.codigosSiscomex = codigos;
    throw err;
  }

  return response.data;
}

/**
 * Em 401 / PUCX-ER0101: uma nova tentativa **sem** novo POST /autenticar.
 * Chamar /autenticar de novo dentro de 60s gera PLAT-ER2033; o CSRF costuma vir nos headers da resposta anterior.
 */
async function executarConsultaComRetry(userId, path, method, params, depth = 0) {
  try {
    return await executarConsulta(userId, path, method, params);
  } catch (e) {
    if (depth >= 1) throw e;
    const codigos = e.codigosSiscomex ?? extrairCodigosErro(e.data);
    const recuperavel =
      codigos.includes("PUCX-ER0101") || e.status === 401;
    if (recuperavel) {
      return await executarConsultaComRetry(userId, path, method, params, depth + 1);
    }
    throw e;
  }
}

export class SiscomexConsultaService {
  /**
   * @param {string} numero
   * @param {string} userId
   * @param {{ cnpjResponsavel?: string, dataEmissao?: string }} [extras]
   */
  static async consultarMAWB(numero, userId, extras = {}) {
    const { mawbPath, mawbMethod, numeroParamMawb } = getEnv();
    if (!mawbPath) throw new Error("SISCOMEX_MAWB_PATH não configurado no .env.");
    const n = String(numero).trim();
    const params = mergeParametrosOpcionaisConhecimento(
      { [numeroParamMawb]: n },
      extras
    );
    return executarConsultaComRetry(userId, mawbPath, mawbMethod, params);
  }

  /**
   * @param {string} numero
   * @param {string} userId
   * @param {{ cnpjResponsavel?: string, dataEmissao?: string }} [extras]
   */
  static async consultarHAWB(numero, userId, extras = {}) {
    const { hawbPath, hawbMethod, numeroParamHawb } = getEnv();
    if (!hawbPath) throw new Error("SISCOMEX_HAWB_PATH não configurado no .env.");
    const n = String(numero).trim();
    const params = mergeParametrosOpcionaisConhecimento(
      { [numeroParamHawb]: n },
      extras
    );
    return executarConsultaComRetry(userId, hawbPath, hawbMethod, params);
  }

  /**
   * Endpoint alternativo: GET /api/ext/conhecimentos/resumo
   * @param {string} numero
   * @param {string} userId
   * @param {{ cnpjResponsavel?: string, dataEmissao?: string }} [extras]
   */
  static async consultarResumoConhecimentos(numero, userId, extras = {}) {
    const { resumoPath, resumoMethod, numeroParamResumo } = getEnv();
    const path = resumoPath || "/ccta/api/ext/conhecimentos/resumo";
    const method = resumoMethod || "GET";
    const n = String(numero).trim();
    const params = mergeParametrosOpcionaisConhecimento(
      { [numeroParamResumo]: n },
      extras
    );
    return executarConsultaComRetry(userId, path, method, params);
  }
}
