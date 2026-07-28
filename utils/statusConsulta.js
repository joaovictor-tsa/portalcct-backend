export function extrairSituacaoAtual(resultado) {
  return resultado?.[0]?.partesEstoque?.[0]?.situacaoAtual ?? null;
}

export function estaRecepcionada(resultado) {
  const situacao = extrairSituacaoAtual(resultado);
  const alvo = process.env.SISCOMEX_STATUS_RECEPCIONADA || "RECEPCIONADA";
  return String(situacao ?? "").trim().toUpperCase() === alvo.trim().toUpperCase();
}

export function extrairPartesRecepcionadas(resultado) {
  const alvo = (process.env.SISCOMEX_STATUS_RECEPCIONADA || "RECEPCIONADA").trim().toUpperCase();
  return (resultado?.[0]?.partesEstoque ?? []).filter(
    (p) => String(p?.situacaoAtual ?? "").trim().toUpperCase() === alvo
  );
}

export function volumesRecepcionados(resultado) {
  return extrairPartesRecepcionadas(resultado).reduce(
    (soma, p) => soma + (Number(p?.quantidadeVolumesEstoque) || 0),
    0
  );
}

export function volumesTotaisConhecimento(resultado) {
  return Number(resultado?.[0]?.quantidadeVolumesConhecimento) || 0;
}

export function todasPartesRecepcionadas(resultado) {
  const total = volumesTotaisConhecimento(resultado);
  if (!total) return false;
  return volumesRecepcionados(resultado) >= total;
}

export function documentoEncontrado(resultado) {
  return Array.isArray(resultado) && resultado.length > 0 && resultado[0] != null;
}

export function extrairChegada(resultado) {
  return resultado?.[0]?.viagensAssociadas?.[0]?.dataHoraChegadaEfetiva ?? null;
}

export function temChegada(resultado) {
  return Boolean(extrairChegada(resultado));
}