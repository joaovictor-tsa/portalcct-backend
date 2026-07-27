/**
 * Mostra como o .env está montando as URLs (apenas fora de produção ou com DEBUG_SISCOMEX=1).
 * Útil para comparar com o manual da API.
 */
export function siscomexConfig(req, res) {
  if (process.env.NODE_ENV === "production" && process.env.DEBUG_SISCOMEX !== "1") {
    return res.status(404).json({ erro: "Indisponível." });
  }
  const baseUrl = process.env.BASE_URL?.replace(/\/$/, "") ?? "";
  const npMawb =
    process.env.SISCOMEX_NUMERO_PARAM_MAWB ||
    process.env.SISCOMEX_NUMERO_PARAM ||
    "numero";
  const npHawb =
    process.env.SISCOMEX_NUMERO_PARAM_HAWB ||
    process.env.SISCOMEX_NUMERO_PARAM ||
    "numero";
  const mawbPath = process.env.SISCOMEX_MAWB_PATH ?? "";
  const hawbPath = process.env.SISCOMEX_HAWB_PATH ?? "";
  const mawbM = (process.env.SISCOMEX_MAWB_METHOD || "GET").toUpperCase();
  const hawbM = (process.env.SISCOMEX_HAWB_METHOD || "GET").toUpperCase();

  const exemplo = (path, method, np) => {
    if (!path) return "(defina SISCOMEX_*_PATH no .env)";
    const p = path.startsWith("/") ? path : `/${path}`;
    const full = `${baseUrl}${p}`;
    if (method === "GET") {
      return `${full}?${np}=<NUMERO>`;
    }
    return `${full}  (body JSON: { "${np}": "<NUMERO>" })`;
  };

  return res.json({
    baseUrl,
    padraoUrlCct:
      "https://{ambiente}/ccta/{serviço} — ver Manual CCT Importação (Modal Aéreo e Rodoviário)",
    autenticacao: `${baseUrl}${process.env.SISCOMEX_AUTH_PATH ?? "/portal/api/autenticar"}`,
    mawb: {
      path: mawbPath,
      method: mawbM,
      parametroNumero: npMawb,
      exemploChamada: exemplo(mawbPath, mawbM, npMawb),
    },
    hawb: {
      path: hawbPath,
      method: hawbM,
      parametroNumero: npHawb,
      exemploChamada: exemplo(hawbPath, hawbM, npHawb),
    },
  });
}
