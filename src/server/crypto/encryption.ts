import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

import {
  deriveInstanceKey,
  getDevelopmentInstanceSecret
} from "@/server/crypto/instance-secret";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

export function encryptSecret(value: string, key = readEncryptionKey()): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv, tag, encrypted].map((part) => part.toString("base64")).join(".");
}

export function decryptSecret(value: string, key = readEncryptionKey()): string {
  const [iv, tag, encrypted] = value.split(".").map((part) => Buffer.from(part, "base64"));
  if (!iv || !tag || !encrypted) {
    throw new Error("Encrypted secret is malformed.");
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function readEncryptionKey(): Buffer {
  const instanceKey = deriveInstanceKey("afloat/credential-encryption");
  if (instanceKey) {
    return instanceKey;
  }

  const legacyRaw = process.env.ENCRYPTION_KEY;
  if (legacyRaw) {
    const legacyKey = Buffer.from(legacyRaw, "base64");
    if (legacyKey.length !== 32) {
      throw new Error("ENCRYPTION_KEY must decode to 32 bytes.");
    }
    return legacyKey;
  }

  if (process.env.NODE_ENV !== "production") {
    return Buffer.from(
      deriveDevelopmentEncryptionKey()
    );
  }

  throw new Error("AFLOAT_INSTANCE_SECRET is required for credential encryption.");
}

function deriveDevelopmentEncryptionKey(): Buffer {
  const secret = getDevelopmentInstanceSecret();
  return Buffer.from(hkdfSync("sha256", secret, "afloat-v1", "afloat/credential-encryption", 32));
}
