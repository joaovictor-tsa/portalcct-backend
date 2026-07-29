import nodemailer from "nodemailer";
import { pool } from "../db/pool.js";

async function obterConfigSmtp() {
  const { rows } = await pool.query(
    `SELECT chave, valor FROM configuracoes WHERE chave IN ('smtp_host','smtp_port','smtp_user','smtp_pass','smtp_from')`
  );
  const mapa = Object.fromEntries(rows.map((r) => [r.chave, r.valor]));
  return {
    host: mapa.smtp_host || process.env.SMTP_HOST,
    port: Number(mapa.smtp_port || process.env.SMTP_PORT) || 587,
    user: mapa.smtp_user || process.env.SMTP_USER,
    pass: mapa.smtp_pass || process.env.SMTP_PASS,
    from: mapa.smtp_from || process.env.SMTP_FROM,
  };
}

async function enviarEmail({ destinatario, assunto, texto, html, numero, pdfBuffer }) {
  const cfg = await obterConfigSmtp();
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
  });

  const anexos = pdfBuffer
    ? [{ filename: `consulta_${numero}.pdf`, content: pdfBuffer, contentType: "application/pdf" }]
    : undefined;

  await transporter.sendMail({
    from: cfg.from,
    to: destinatario,
    subject: assunto,
    text: texto,
    html,
    attachments: anexos,
  });
}

/** Disparado quando a viagem já tem chegada efetiva, mas a carga ainda não foi recepcionada. */
export async function enviarEmailChegada({ destinatario, tipo, numero, pdfBuffer, dataChegada }) {
  const linhaData = dataChegada ? ` em ${dataChegada}` : "";
  await enviarEmail({
    destinatario,
    numero,
    pdfBuffer,
    assunto: `Carga chegou — ${tipo} ${numero}`,
    texto: `A aeronave referente ao ${tipo} ${numero} já pousou (chegada confirmada)${linhaData}. A carga ainda está em processo de recepção — você será avisado novamente assim que for recepcionada. Segue em anexo o relatório da consulta.`,
  });
}

/** Disparado quando a situação atual vira RECEPCIONADA — encerra o monitoramento desse item. */
export async function enviarEmailRecepcionado({ destinatario, tipo, numero, pdfBuffer, dataRecepcao }) {
  const linhaData = dataRecepcao ? ` em ${dataRecepcao}` : "";
  await enviarEmail({
    destinatario,
    numero,
    pdfBuffer,
    assunto: `Carga recepcionada — ${tipo} ${numero}`,
    texto: `A carga referente ao ${tipo} ${numero} foi recepcionada${linhaData}. Segue em anexo o relatório da consulta.`,
  });
}

export async function enviarEmailResetSenha({ destinatario, link }) {
  await enviarEmail({
    destinatario,
    assunto: "Redefinição de senha",
    texto: `Recebemos uma solicitação para redefinir sua senha. Acesse o link abaixo (válido por 30 minutos): ${link}\n\nSe você não pediu isso, pode ignorar este e-mail.`,
    html: `
      <p>Olá,</p>
      <p>Recebemos uma solicitação para redefinir sua senha. Clique no link abaixo (válido por 30 minutos):</p>
      <p><a href="${link}">${link}</a></p>
      <p>Se você não pediu isso, pode ignorar este e-mail.</p>
    `,
  });
}