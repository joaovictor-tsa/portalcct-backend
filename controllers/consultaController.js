import { SiscomexConsultaService } from "../services/SiscomexConsultaService.js";
import { garantirNaFila, resolverSeNaFila } from "../services/filaConsultaService.js";
import { estaRecepcionada, documentoEncontrado, todasPartesRecepcionadas } from "../utils/statusConsulta.js";
import {
  extrairCodigosErro,
  formatarErroSiscomex,
  sanitizarCorpoErro,
} from "../utils/siscomexErrors.js";
import { mensagemErroPfx } from "../utils/validarPfx.js";

/**
 * Efeito colateral "fire-and-forget": nunca deve atrasar nem afetar a resposta da consulta
 * (o resultado retornado ao colaborador é sempre o mesmo, independente disso).
 * Só age quando a resposta traz um documento identificável — resposta vazia/documento não
 * encontrado nunca entra na fila. Qualquer erro aqui só é logado, nunca propagado ao cliente.
 */
function sincronizarFila({ userId, tipo, numero, data }) {
  if (!documentoEncontrado(data)) return;

  if (todasPartesRecepcionadas(data)) {
    resolverSeNaFila({ numero, resultado: data }).catch((e) =>
      console.error(`[Fila] falha ao resolver item pendente (${tipo} ${numero}):`, e.message)
    );
  } else {
    // garante que o documento está na fila e, na sequência, já atualiza o registro
    // (tentativas/última consulta) sem esperar o próximo ciclo do job.
    garantirNaFila({ userId, tipo, numero })
      .then(() => resolverSeNaFila({ numero, resultado: data }))
      .catch((e) =>
        console.error(`[Fila] falha ao enfileirar automaticamente (${tipo} ${numero}):`, e.message)
      );
  }
}

function responderErroCertificado(res, e) {
  const msg = mensagemErroPfx(e);
  if (msg) {
    return res.status(400).json({
      erro: msg,
      tecnico: process.env.NODE_ENV === "development" ? String(e?.message) : undefined,
    });
  }
  return null;
}

function responderErro(res, e) {
  const codigos = e.codigosSiscomex ?? extrairCodigosErro(e.data);
  const hint = formatarErroSiscomex(codigos);
  const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 502;
  return res.status(status).json({
    erro: e.message || "Erro na consulta.",
    detalhe: hint || undefined,
    codigos: codigos.length ? codigos : undefined,
    corpo: sanitizarCorpoErro(e.data),
  });
}

export async function consultarMawb(req, res) {
  try {
    const { numero, cnpjResponsavel, dataEmissao } = req.body ?? {};
    if (!numero || String(numero).trim() === "") {
      return res.status(400).json({
        erro: "Informe o número do conhecimento (MAWB / número conforme API).",
      });
    }
    const data = await SiscomexConsultaService.consultarMAWB(
      String(numero).trim(),
      req.userId,
      { cnpjResponsavel, dataEmissao }
    );
    sincronizarFila({ userId: req.userId, tipo: "MAWB", numero: String(numero).trim(), data });
    return res.json({ resultado: data });
  } catch (e) {
    if (e.code === "CERT_MISSING") {
      return res.status(400).json({ erro: e.message });
    }
    const cert = responderErroCertificado(res, e);
    if (cert) return cert;
    console.error(e);
    return responderErro(res, e);
  }
}

export async function consultarHawb(req, res) {
  try {
    const { numero, cnpjResponsavel, dataEmissao } = req.body ?? {};
    if (!numero || String(numero).trim() === "") {
      return res.status(400).json({
        erro: "Informe o número do conhecimento (HAWB / número conforme API).",
      });
    }
    const data = await SiscomexConsultaService.consultarHAWB(
      String(numero).trim(),
      req.userId,
      { cnpjResponsavel, dataEmissao }
    );
    sincronizarFila({ userId: req.userId, tipo: "HAWB", numero: String(numero).trim(), data });
    return res.json({ resultado: data });
  } catch (e) {
    if (e.code === "CERT_MISSING") {
      return res.status(400).json({ erro: e.message });
    }
    const cert = responderErroCertificado(res, e);
    if (cert) return cert;
    console.error(e);
    return responderErro(res, e);
  }
}

export async function consultarResumo(req, res) {
  try {
    const { numero, cnpjResponsavel, dataEmissao } = req.body ?? {};
    if (!numero || String(numero).trim() === "") {
      return res.status(400).json({
        erro: "Informe o número do conhecimento (conforme API).",
      });
    }
    const data = await SiscomexConsultaService.consultarResumoConhecimentos(
      String(numero).trim(),
      req.userId,
      { cnpjResponsavel, dataEmissao }
    );
    return res.json({ resultado: data });
  } catch (e) {
    if (e.code === "CERT_MISSING") {
      return res.status(400).json({ erro: e.message });
    }
    const cert = responderErroCertificado(res, e);
    if (cert) return cert;
    console.error(e);
    return responderErro(res, e);
  }
}
