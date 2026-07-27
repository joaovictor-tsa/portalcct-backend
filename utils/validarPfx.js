import tls from "tls";
import { extrairPemDoPkcs12Forge } from "./pfxForge.js";

/**
 * Tenta abrir o .pfx com OpenSSL (Node). Se falhar (comum em PFX do Windows com AES),
 * usa node-forge e valida com PEM (key + cert).
 * @returns {{ pfx: Buffer, passphrase: string } | { keyPem: string, certPem: string }}
 */
export function validarPfxCertificado(pfxBuffer, passphrase) {
  const pass = String(passphrase);
  try {
    tls.createSecureContext({
      pfx: pfxBuffer,
      passphrase: pass,
    });
    return { pfx: pfxBuffer, passphrase: pass };
  } catch (eTls) {
    let pem;
    try {
      pem = extrairPemDoPkcs12Forge(pfxBuffer, pass);
    } catch (eForge) {
      throw eForge;
    }
    try {
      tls.createSecureContext({
        key: pem.keyPem,
        cert: pem.certPem,
      });
    } catch {
      throw eTls;
    }
    return { keyPem: pem.keyPem, certPem: pem.certPem };
  }
}

function textoErroCompleto(err) {
  const partes = [];
  let e = err;
  let depth = 0;
  while (e && depth < 8) {
    if (e.message) partes.push(String(e.message));
    if (e.code) partes.push(String(e.code));
    e = e.cause;
    depth += 1;
  }
  return partes.join(" ");
}

/**
 * @param {unknown} err
 * @returns {string | null} Mensagem amigável ou null se não for erro típico de PFX/TLS
 */
export function mensagemErroPfx(err) {
  const texto = textoErroCompleto(err);
  if (
    /unsupported pkcs12|pkcs12|bad decrypt|bad password|mac verify|invalid password|pkcs8|pem routines|asn\.1|pkcs#12|chave privada não encontrada|certificado não encontrado/i.test(
      texto
    ) ||
    /ERR_OSSL/i.test(texto) ||
    /SSL alert number 48|decryption failed/i.test(texto)
  ) {
    return (
      "O arquivo .pfx não pôde ser aberto: verifique se a senha está correta (a mesma da exportação do certificado) " +
      "e se o arquivo é um PKCS#12 válido. Se necessário, exporte novamente o certificado A1 como .pfx/.p12."
    );
  }
  return null;
}
