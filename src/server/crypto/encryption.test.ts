import { randomBytes } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret, readEncryptionKey } from "./encryption";

describe("credential encryption", () => {
  const originalInstanceSecret = process.env.AFLOAT_INSTANCE_SECRET;
  const originalEncryptionKey = process.env.ENCRYPTION_KEY;

  afterEach(() => {
    process.env.AFLOAT_INSTANCE_SECRET = originalInstanceSecret;
    process.env.ENCRYPTION_KEY = originalEncryptionKey;
  });

  it("round trips a secret without storing it as plaintext", () => {
    const key = randomBytes(32);
    const encrypted = encryptSecret("app-password", key);

    expect(encrypted).not.toContain("app-password");
    expect(decryptSecret(encrypted, key)).toBe("app-password");
  });

  it("prefers an instance secret derived key over the legacy encryption key", () => {
    process.env.AFLOAT_INSTANCE_SECRET = Buffer.alloc(32, 2).toString("base64");
    process.env.ENCRYPTION_KEY = Buffer.alloc(32, 3).toString("base64");

    expect(readEncryptionKey()).toEqual(readEncryptionKey());
    expect(readEncryptionKey()).not.toEqual(Buffer.alloc(32, 3));
  });
});
