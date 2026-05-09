import { describe, expect, it } from "vitest";

import { decodeSecret } from "@/server/crypto/instance-secret";

describe("instance secret decoding", () => {
  it("accepts base64 secrets with at least 32 bytes", () => {
    const raw = Buffer.alloc(32, 1).toString("base64");
    expect(decodeSecret(raw, "TEST_SECRET")).toHaveLength(32);
  });

  it("rejects short secrets", () => {
    expect(() => decodeSecret("short", "TEST_SECRET")).toThrow("TEST_SECRET");
  });
});
