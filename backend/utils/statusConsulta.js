export function extrairSituacaoAtual(resultado) {
  return resultado?.[0]?.partesEstoque?.[0]?.situacaoAtual ?? null;
}

export function estaRecepcionada(resultado) {
  const situacao = extrairSituacaoAtual(resultado);
  const alvo = process.env.SISCOMEX_STATUS_RECEPCIONADA || "RECEPCIONADA";
  return String(situacao ?? "").trim().toUpperCase() === alvo.trim().toUpperCase();
}

/**
 * Um documento existe/foi encontrado quando a API retorna um item de verdade —
 * mesmo que ele ainda não tenha partesEstoque (carga que ainda não chegou no recinto,
 * por exemplo). Diferente de resposta vazia ("" ou []), que é "documento não localizado".
 */
export function documentoEncontrado(resultado) {
  return Array.isArray(resultado) && resultado.length > 0 && resultado[0] != null;
}

/**
 * Data/hora de chegada efetiva da viagem associada (aba "Viagem Associada" na tela).
 * Enquanto isso não vier preenchido, o avião ainda não pousou.
 */
export function extrairChegada(resultado) {
  return resultado?.[0]?.viagensAssociadas?.[0]?.dataHoraChegadaEfetiva ?? null;
}

export function temChegada(resultado) {
  return Boolean(extrairChegada(resultado));
}
