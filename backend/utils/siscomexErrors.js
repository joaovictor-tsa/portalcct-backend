const MENSAGENS = {
  "PLAT-ER2001":
    "Erro de plataforma (PLAT-ER2001). Tente novamente ou verifique disponibilidade do Portal Único.",
  "PLAT-ER2033":
    "Intervalo mínimo de 60s entre autenticações na plataforma. O backend reutiliza JWT/CSRF, evita novo login na consulta e pode aguardar automaticamente antes de repetir /autenticar.",
  "PUCX-ER0101":
    "Erro de autenticação ou sessão (PUCX-ER0101). O token pode ter expirado; uma nova autenticação será tentada.",
  "PUCX-ER0201":
    "Formato do Authorization inválido. O backend reenvia o valor exato do header set-token da autenticação; em último caso use SISCOMEX_AUTH_HEADER_SEM_BEARER=1.",
  "CCTA-ER0264":
    "Sem permissão para esta consulta: o certificado/usuário (ex.: CPF no token) não tem perfil ou vínculo para acessar esse conhecimento. Confira cadastro no Portal, perfil CCT Importação (transportador/agente etc.), Role-Type no .env (código do manual, ex. TRANSPORT para Transportador) e se o número pertence à sua operação.",
};

/**
 * Extrai códigos de erro conhecidos do corpo ou headers da resposta Siscomex.
 * @param {unknown} data - Corpo parseado (objeto ou string)
 * @returns {string[]}
 */
export function extrairCodigosErro(data) {
  const codigos = new Set();
  if (data && typeof data === "object") {
    const candidatos = [
      data.codigo,
      data.codigoErro,
      data.code,
      data.erro?.codigo,
      data.error?.code,
    ];
    for (const c of candidatos) {
      if (typeof c === "string" && c.length) codigos.add(c);
    }
    const msg = data.mensagem ?? data.message ?? data.detail;
    if (typeof msg === "string") {
      const m = msg.match(/\b(CCTA-ER\d+|PLAT-ER\d+|PUCX-ER\d+)\b/g);
      if (m) m.forEach((x) => codigos.add(x));
    }
  }
  if (typeof data === "string") {
    const m = data.match(/\b(CCTA-ER\d+|PLAT-ER\d+|PUCX-ER\d+)\b/g);
    if (m) m.forEach((x) => codigos.add(x));
  }
  return [...codigos];
}

export function mensagemParaCodigo(codigo) {
  return MENSAGENS[codigo] ?? null;
}

export function formatarErroSiscomex(codigos) {
  if (!codigos.length) return null;
  const partes = codigos.map((c) => mensagemParaCodigo(c) ?? c);
  return partes.join(" ");
}

function corpoPareceHtml(data) {
  if (typeof data !== "string") return false;
  const s = data.slice(0, 500).toLowerCase();
  return s.includes("<!doctype") || s.includes("<html");
}

/**
 * Mensagem quando o Portal retorna 404/405 com HTML (endpoint errado ou método errado).
 */
export function mensagemErroHttpConsulta(status, data) {
  if (status === 404 && corpoPareceHtml(data)) {
    return (
      "O Portal Único retornou 404 (recurso inexistente). Os valores de SISCOMEX_MAWB_PATH / SISCOMEX_HAWB_PATH " +
      "no .env são apenas exemplos: é obrigatório substituir pelo path, método (GET/POST) e nome do parâmetro " +
      "definidos no manual da API do módulo Transporte para o seu perfil (homologação ou produção)."
    );
  }
  if (status === 405) {
    return (
      "Método HTTP não permitido neste path. Altere SISCOMEX_MAWB_METHOD ou SISCOMEX_HAWB_METHOD (GET/POST) conforme a documentação."
    );
  }
  return null;
}

/** Evita devolver HTML gigante no JSON da API local. */
export function sanitizarCorpoErro(data) {
  if (corpoPareceHtml(data)) {
    return {
      resumo:
        "Resposta HTML omitida (normalmente página 404 do portal). Ajuste BASE_URL, path e método no .env.",
    };
  }
  return data;
}
