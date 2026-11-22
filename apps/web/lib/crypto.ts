import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

// Cifra dados pessoais sensíveis (CPF, chave Pix) antes de gravar no banco — AES-256-GCM.
// Formato gravado: [versão 1 byte][IV 12][TAG 16][conteúdo]. A chave fica só na Vercel/.env (PII_ENCRYPTION_KEY, 32 bytes base64).
// ATENÇÃO: perder a chave = perder acesso a CPFs e chaves Pix já gravados. Guarde uma cópia segura.

const VERSION = 1;

function key(): Buffer {
  const b64 = process.env.PII_ENCRYPTION_KEY;
  if (b64) {
    const k = Buffer.from(b64, "base64");
    if (k.length !== 32) throw new Error("PII_ENCRYPTION_KEY precisa ter 32 bytes em base64");
    return k;
  }
  if (process.env.NODE_ENV === "production") throw new Error("PII_ENCRYPTION_KEY ausente em produção");
  return createHash("sha256").update("leonidaplay-dev-pii-key-nao-usar-em-producao").digest();
}

export function encrypt(plain: string): Uint8Array<ArrayBuffer> {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const out = Buffer.concat([Buffer.from([VERSION]), iv, cipher.getAuthTag(), ct]);
  return new Uint8Array(out);
}

export function decrypt(data: Uint8Array): string {
  const buf = Buffer.from(data);
  if (buf[0] !== VERSION) throw new Error(`crypto: versão desconhecida ${buf[0]}`);
  const decipher = createDecipheriv("aes-256-gcm", key(), buf.subarray(1, 13));
  decipher.setAuthTag(buf.subarray(13, 29));
  return Buffer.concat([decipher.update(buf.subarray(29)), decipher.final()]).toString("utf8");
}

/** Impressão digital determinística (para checar CPF duplicado sem decifrar). */
export const fingerprint = (value: string) => createHmac("sha256", key()).update(`fp:${value}`).digest("hex");
