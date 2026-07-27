import https from "https";

/**
 * Agente HTTPS com mTLS para requisições ao Siscomex.
 * Aceita PKCS#12 (pfx + senha) ou PEM já extraído (Windows / AES incompatível com OpenSSL em modo PFX).
 *
 * @param {{ pfx?: Buffer, passphrase?: string, keyPem?: string, certPem?: string }} cred
 * @returns {https.Agent}
 */
export function getHttpsAgent(cred) {
  if (cred.keyPem && cred.certPem) {
    return new https.Agent({
      key: cred.keyPem,
      cert: cred.certPem,
      rejectUnauthorized: true,
    });
  }
  if (cred.pfx?.length && cred.passphrase != null) {
    return new https.Agent({
      pfx: cred.pfx,
      passphrase: String(cred.passphrase),
      rejectUnauthorized: true,
    });
  }
  throw new Error("Credencial TLS incompleta (pfx ou PEM).");
}
