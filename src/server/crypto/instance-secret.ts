import { hkdfSync, randomBytes } from "node:crypto";

const INSTANCE_SECRET_MIN_BYTES = 32;
let developmentInstanceSecret: Buffer | null = null;

export function readInstanceSecret(): Buffer | null {
  const raw = process.env.AFLOAT_INSTANCE_SECRET;
  if (!raw) {
    return null;
  }

  const secret = decodeSecret(raw, "AFLOAT_INSTANCE_SECRET");
  if (secret.length < INSTANCE_SECRET_MIN_BYTES) {
    throw new Error("AFLOAT_INSTANCE_SECRET must decode to at least 32 bytes.");
  }
  return secret;
}

export function deriveInstanceKey(info: string, length = 32): Buffer | null {
  const secret = readInstanceSecret();
  if (!secret) {
    return null;
  }
  return Buffer.from(hkdfSync("sha256", secret, "afloat-v1", info, length));
}

export function deriveRequiredInstanceKey(info: string, length = 32): Buffer {
  const key = deriveInstanceKey(info, length);
  if (!key) {
    throw new Error("AFLOAT_INSTANCE_SECRET is required.");
  }
  return key;
}

export function getDevelopmentInstanceSecret(): Buffer {
  if (!developmentInstanceSecret) {
    developmentInstanceSecret = randomBytes(32);
    console.warn(
      "AFLOAT_INSTANCE_SECRET is missing. Using an in-memory development secret; sessions and encrypted credentials will not survive restart."
    );
  }
  return developmentInstanceSecret;
}

export function decodeSecret(raw: string, name: string): Buffer {
  const trimmed = raw.trim();
  const base64 = Buffer.from(trimmed, "base64");
  if (base64.length >= INSTANCE_SECRET_MIN_BYTES) {
    return base64;
  }

  const utf8 = Buffer.from(trimmed, "utf8");
  if (utf8.length >= INSTANCE_SECRET_MIN_BYTES) {
    return utf8;
  }

  throw new Error(`${name} must be base64 or text with at least 32 bytes of entropy.`);
}
