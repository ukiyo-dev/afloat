import { afterEach, describe, expect, it } from "vitest";

import {
  createOwnerSessionToken,
  isAuthenticationConfigured,
  readAuthSecret,
  verifyOwnerSessionToken
} from "@/server/services/auth-service";

describe("owner auth sessions", () => {
  const originalInstanceSecret = process.env.AFLOAT_INSTANCE_SECRET;
  const originalAuthSecret = process.env.AUTH_SECRET;
  const originalPassword = process.env.AFLOAT_OWNER_PASSWORD;

  afterEach(() => {
    process.env.AFLOAT_INSTANCE_SECRET = originalInstanceSecret;
    process.env.AUTH_SECRET = originalAuthSecret;
    process.env.AFLOAT_OWNER_PASSWORD = originalPassword;
  });

  it("verifies a valid owner session token", () => {
    const token = createOwnerSessionToken({
      ownerId: "owner-1",
      secret: "test-secret",
      now: new Date("2026-05-08T00:00:00.000Z"),
      maxAgeSeconds: 60
    });

    expect(
      verifyOwnerSessionToken(token, "test-secret", new Date("2026-05-08T00:00:30.000Z"))
    ).toBe("owner-1");
  });

  it("rejects tampered or expired session tokens", () => {
    const token = createOwnerSessionToken({
      ownerId: "owner-1",
      secret: "test-secret",
      now: new Date("2026-05-08T00:00:00.000Z"),
      maxAgeSeconds: 60
    });

    expect(verifyOwnerSessionToken(`${token}x`, "test-secret")).toBeNull();
    expect(
      verifyOwnerSessionToken(token, "test-secret", new Date("2026-05-08T00:01:01.000Z"))
    ).toBeNull();
  });

  it("uses the instance secret for auth configuration", () => {
    process.env.AFLOAT_INSTANCE_SECRET = Buffer.alloc(32, 4).toString("base64");
    process.env.AUTH_SECRET = "";
    process.env.AFLOAT_OWNER_PASSWORD = "password";

    expect(isAuthenticationConfigured()).toBe(true);
    expect(readAuthSecret()).toBeTruthy();
  });
});
