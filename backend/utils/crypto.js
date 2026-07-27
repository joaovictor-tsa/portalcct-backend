import crypto from "crypto";

const ALGO = "aes-256-gcm";

function getKey() {
  const key = Buffer.from(process.env.CERT_ENCRYPTION_KEY, "base64");
  if (key.length !== 32) throw new Error("CERT_ENCRYPTION_KEY inválida (precisa de 32 bytes).");
  return key;
}

export function encrypt(text) {
  if (text == null) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(String(text), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decrypt(payload) {
  if (payload == null) return null;
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const enc = raw.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
