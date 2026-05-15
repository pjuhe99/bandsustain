import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { loadCreds } from "./creds";

const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer {
  const c = loadCreds();
  const hex = c.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("ENCRYPTION_KEY missing or not 64-hex characters");
  }
  return Buffer.from(hex, "hex");
}

export function encryptApiKey(plain: string): string {
  if (!plain) throw new Error("encryptApiKey: empty input");
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, ct, tag]).toString("base64");
}

export function decryptApiKey(stored: string): string {
  if (!stored) throw new Error("decryptApiKey: empty input");
  const key = getKey();
  const buf = Buffer.from(stored, "base64");
  if (buf.length < IV_LEN + TAG_LEN) {
    throw new Error("decryptApiKey: stored value too short");
  }
  const iv = buf.subarray(0, IV_LEN);
  const ct = buf.subarray(IV_LEN, buf.length - TAG_LEN);
  const tag = buf.subarray(buf.length - TAG_LEN);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

export function maskApiKey(plain: string): string {
  if (!plain || plain.length < 8) return "(invalid)";
  const tail = plain.slice(-4);
  return `${plain.slice(0, 3)}...${tail}`;
}
