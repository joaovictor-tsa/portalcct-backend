import { pool } from "../db/pool.js";
import { SiscomexConsultaService } from "./SiscomexConsultaService.js";
import { gerarPdfConsulta } from "../utils/gerarPdfConsulta.js";
import { enviarEmailChegada, enviarEmailRecepcionado } from "./emailService.js";
import { recintos, unidades } from "../utils/tabelasApoio.js";
import { estaRecepcionada, temChegada, todasPartesRecepcionadas } from "../utils/statusConsulta.js";

/**
 * Garante que exista um item pendente na fila para este documento.
 * Identificação é pelo documento (número) — não por usuário: se qualquer colaborador
 * já colocou esse número na fila, uma nova consulta (do mesmo ou de outro colaborador)
 * não cria duplicata, só reaproveita o item existente.
 * O e-mail de disparo é o cadastrado no usuário que originou o item (não é digitado manualmente).
 */
function normalizarArray(resultado) {
  if (Array.isArray(resultado)) return resultado;
  if (Array.isArray(resultado?.resultado)) return resultado.resultado;
  return [];
}

export async function garantirNaFila({ userId, tipo, numero }) {
  const numeroTrim = String(numero).trim().toUpperCase();

  const existente = await pool.query(
    `SELECT * FROM fila_consultas WHERE upper(numero) = $1 AND status = 'pendente'`,
    [numeroTrim]
  );
  if (existente.rows[0]) return existente.rows[0];

  const u = await pool.query(`SELECT email FROM users WHERE id = $1`, [userId]);
  const email = u.rows[0]?.email;
  if (!email) return null;

  try {
    const { rows } = await pool.query(
      `INSERT INTO fila_consultas (user_id, tipo, numero, email_destino) VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, tipo, numeroTrim, email]
    );
    return rows[0];
  } catch (e) {
    if (e.code === "23505") {
      const r2 = await pool.query(
        `SELECT * FROM fila_consultas WHERE upper(numero) = $1 AND status = 'pendente'`,
        [numeroTrim]
      );
      return r2.rows[0] ?? null;
    }
    throw e;
  }
}

/**
 * Extrai o dataHoraChegadaEfetiva da viagem associada ao documento consultado.
 * Vem em ISO com offset (ex: "2026-07-24T10:34-03:00") — já traz o fuso embutido.
 */
function obterDataHoraChegada(resultado) {
  const arr = normalizarArray(resultado);
  const viagem = arr?.[0]?.viagensAssociadas?.find((v) => v?.dataHoraChegadaEfetiva);
  return viagem?.dataHoraChegadaEfetiva ?? null;
}

/**
 * Extrai o dataHoraSituacaoAtual da parte em estoque cuja situacaoAtual é "Recepcionada".
 * Já vem formatado em pt-BR (ex: "24/07/2026 21:30:44"), então não precisa reformatar.
 */
function obterDataHoraRecepcao(resultado) {
  const arr = normalizarArray(resultado);
  const partes = (arr?.[0]?.partesEstoque ?? []).filter(
    (p) => p?.situacaoAtual?.toLowerCase() === "recepcionada"
  );
  if (!partes.length) return null;

  const parseDataPtBr = (str) => {
    const [dataParte, horaParte] = str.split(" ");
    const [dia, mes, ano] = dataParte.split("/").map(Number);
    const [h, m, s] = (horaParte || "00:00:00").split(":").map(Number);
    return new Date(ano, mes - 1, dia, h, m, s || 0);
  };

  return partes.reduce((maisRecente, atual) =>
    !maisRecente || parseDataPtBr(atual.dataHoraSituacaoAtual) > parseDataPtBr(maisRecente.dataHoraSituacaoAtual)
      ? atual
      : maisRecente
  , null)?.dataHoraSituacaoAtual ?? null;
}
/**
 * Formata a data ISO (com offset) de chegada para o padrão pt-BR (dd/mm/aaaa hh:mm),
 * sempre no fuso de São Paulo, independente do fuso do servidor.
 */
function formatarDataChegada(isoComOffset) {
  if (!isoComOffset) return null;
  const data = new Date(isoComOffset);
  if (Number.isNaN(data.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(data);
}

async function dispararEmailERecepcionar(item, resultado) {
  const pdfBuffer = gerarPdfConsulta(resultado, recintos, unidades);
  const dataRecepcao = obterDataHoraRecepcao(resultado);
  await enviarEmailRecepcionado({
    destinatario: item.email_destino,
    tipo: item.tipo,
    numero: item.numero,
    pdfBuffer,
    dataRecepcao,
  });
  await pool.query(
    `UPDATE fila_consultas SET status = 'recepcionada', ultima_consulta_em = now() WHERE id = $1`,
    [item.id]
  );
  console.log(`[Fila] ${item.tipo} ${item.numero} recepcionada — e-mail enviado para ${item.email_destino}.`);
}

async function dispararEmailChegada(item, resultado) {
  const pdfBuffer = gerarPdfConsulta(resultado, recintos, unidades);
  const dataChegada = formatarDataChegada(obterDataHoraChegada(resultado));
  await enviarEmailChegada({
    destinatario: item.email_destino,
    tipo: item.tipo,
    numero: item.numero,
    pdfBuffer,
    dataChegada,
  });
  await pool.query(
    `UPDATE fila_consultas SET chegada_notificada_em = now(), ultima_consulta_em = now() WHERE id = $1`,
    [item.id]
  );
  console.log(`[Fila] ${item.tipo} ${item.numero} chegou — e-mail de chegada enviado para ${item.email_destino}. Continua na fila até recepcionar.`);
}

/**
 * Aplica o resultado de uma consulta a um item da fila:
 * - Se já está recepcionada: dispara o e-mail final e encerra o monitoramento (sai da fila).
 * - Se a viagem já chegou mas ainda não recepcionou: dispara (uma única vez) o e-mail de
 *   chegada e MANTÉM o item na fila, continuando a monitorar até recepcionar.
 * - Se ainda não chegou: não faz nada aqui (quem chama decide se incrementa tentativas).
 * @returns {boolean} true se o item foi resolvido (recepcionado / saiu da fila)
 */
async function processarResultado(item, resultado) {
  const arr = normalizarArray(resultado);

  if (estaRecepcionada(arr) && todasPartesRecepcionadas(arr)) {
    await dispararEmailERecepcionar(item, resultado);
    return true;
  }

  if (temChegada(arr) && !item.chegada_notificada_em) {
    await dispararEmailChegada(item, resultado);
  }

  return false;
}

/**
 * Chamado a partir de uma consulta manual (de qualquer colaborador): se existir um item
 * pendente correspondente a esse documento na fila, aplica o resultado na hora — dispara
 * e-mail de chegada e/ou de recepcionada conforme o caso — em vez de esperar o próximo
 * ciclo do job (até 10 min depois).
 */
export async function resolverSeNaFila({ numero, resultado }) {
  const numeroTrim = String(numero).trim();
  const { rows } = await pool.query(
    `SELECT * FROM fila_consultas WHERE numero = $1 AND status = 'pendente'`,
    [numeroTrim]
  );
  const item = rows[0];
  if (!item) return;
  await processarResultado(item, resultado);
}

async function processarItem(item) {
  try {
    const consultar =
      item.tipo === "MAWB" ? SiscomexConsultaService.consultarMAWB : SiscomexConsultaService.consultarHAWB;
    const resultado = await consultar(item.numero, item.user_id, {});

    const resolvido = await processarResultado(item, resultado);
    if (resolvido) return;

    await pool.query(
      `UPDATE fila_consultas SET tentativas = tentativas + 1, ultima_consulta_em = now(), ultimo_erro = NULL WHERE id = $1`,
      [item.id]
    );
  } catch (e) {
    const maxTentativas = Number(process.env.FILA_MAX_TENTATIVAS_ERRO) || 20;
    const novasTentativas = item.tentativas + 1;
    await pool.query(
      `UPDATE fila_consultas SET tentativas = $2, ultima_consulta_em = now(), ultimo_erro = $3,
        status = CASE WHEN $2 >= $4 THEN 'erro' ELSE 'pendente' END WHERE id = $1`,
      [item.id, novasTentativas, String(e.message).slice(0, 500), maxTentativas]
    );
    console.error(`[Fila] erro ao consultar ${item.tipo} ${item.numero}:`, e.message);
  }
}

export async function processarFila() {
  const { rows: pendentes } = await pool.query(`SELECT * FROM fila_consultas WHERE status = 'pendente'`);
  for (const item of pendentes) {
    await processarItem(item);
  }
}