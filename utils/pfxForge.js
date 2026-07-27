import forge from "node-forge";

/**
 * Abre PKCS#12 com algoritmos que o OpenSSL do Node às vezes não aceita no modo PFX
 * (ex.: exportação recente do Windows / AES). Retorna PEM para usar em https.Agent.
 */
export function extrairPemDoPkcs12Forge(pfxBuffer, passphrase) {
  const der = forge.util.createBuffer(pfxBuffer.toString("binary"));
  const asn1 = forge.asn1.fromDer(der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, passphrase);

  let privateKey = null;
  const shrouded = p12.getBags({
    bagType: forge.pki.oids.pkcs8ShroudedKeyBag,
  });
  const shroudedList = shrouded[forge.pki.oids.pkcs8ShroudedKeyBag];
  if (shroudedList?.length && shroudedList[0].key) {
    privateKey = shroudedList[0].key;
  }
  if (!privateKey) {
    const plain = p12.getBags({ bagType: forge.pki.oids.keyBag });
    const plainList = plain[forge.pki.oids.keyBag];
    if (plainList?.length && plainList[0].key) {
      privateKey = plainList[0].key;
    }
  }
  if (!privateKey) {
    throw new Error("Chave privada não encontrada no PKCS#12.");
  }

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const certList = certBags[forge.pki.oids.certBag];
  if (!certList?.length) {
    throw new Error("Certificado não encontrado no PKCS#12.");
  }

  let certPem = "";
  for (const bag of certList) {
    if (bag.cert) {
      certPem += forge.pki.certificateToPem(bag.cert);
    }
  }

  return {
    keyPem: forge.pki.privateKeyToPem(privateKey),
    certPem,
  };
}
