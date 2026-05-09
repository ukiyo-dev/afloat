import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  deriveInstanceKey,
  getDevelopmentInstanceSecret
} from "@/server/crypto/instance-secret";

export const OWNER_SESSION_COOKIE = "afloat_owner_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

interface SessionPayload {
  ownerId: string;
  exp: number;
}

export class AuthenticationError extends Error {
  constructor(message = "Authentication is required.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export function createOwnerSessionToken(input: {
  ownerId: string;
  secret: string;
  now?: Date;
  maxAgeSeconds?: number;
}): string {
  const now = input.now ?? new Date();
  const payload: SessionPayload = {
    ownerId: input.ownerId,
    exp: Math.floor(now.getTime() / 1000) + (input.maxAgeSeconds ?? SESSION_MAX_AGE_SECONDS)
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signSessionPayload(encodedPayload, input.secret);
  return `${encodedPayload}.${signature}`;
}

export function verifyOwnerSessionToken(
  token: string | undefined,
  secret: string,
  now = new Date()
): string | null {
  if (!token) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signSessionPayload(encodedPayload, secret);
  if (!safeEqual(signature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as Partial<SessionPayload>;
    if (typeof payload.ownerId !== "string" || typeof payload.exp !== "number") {
      return null;
    }
    if (payload.exp <= Math.floor(now.getTime() / 1000)) {
      return null;
    }
    return payload.ownerId;
  } catch {
    return null;
  }
}

export async function getAuthenticatedOwnerId(): Promise<string | null> {
  if (!hasAuthSecret()) {
    return null;
  }
  const secret = readAuthSecret();
  const cookieStore = await cookies();
  return verifyOwnerSessionToken(cookieStore.get(OWNER_SESSION_COOKIE)?.value, secret);
}

export async function requireAuthenticatedOwnerId(): Promise<string> {
  const ownerId = await getAuthenticatedOwnerId();
  if (!ownerId) {
    throw new AuthenticationError();
  }
  return ownerId;
}

export async function requirePageAuthentication(): Promise<string> {
  const ownerId = await getAuthenticatedOwnerId();
  if (!ownerId) {
    redirect("/login");
  }
  return ownerId;
}

export async function signInOwner(password: string): Promise<void> {
  const expectedPassword = readOwnerPassword();
  if (!safeEqual(password, expectedPassword)) {
    throw new AuthenticationError("Password is invalid.");
  }

  const [{ db }, { ensureLocalOwner }] = await Promise.all([
    import("@/server/db/client"),
    import("@/server/db/owners")
  ]);
  const ownerId = await ensureLocalOwner(db);
  const cookieStore = await cookies();
  cookieStore.set(OWNER_SESSION_COOKIE, createOwnerSessionToken({ ownerId, secret: readAuthSecret() }), {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE_SECONDS,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });
}

export async function signOutOwner(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(OWNER_SESSION_COOKIE);
}

export function isAuthenticationConfigured(): boolean {
  return Boolean(process.env.AFLOAT_OWNER_PASSWORD && hasAuthSecret());
}

export function readAuthSecret(): string {
  const instanceKey = deriveInstanceKey("afloat/auth-session");
  if (instanceKey) {
    return instanceKey.toString("base64url");
  }

  const legacySecret = process.env.AUTH_SECRET;
  if (legacySecret) {
    return legacySecret;
  }

  if (process.env.NODE_ENV !== "production") {
    return getDevelopmentInstanceSecret().toString("base64url");
  }

  throw new Error("AFLOAT_INSTANCE_SECRET is required for owner sessions.");
}

function readOwnerPassword(): string {
  const password = process.env.AFLOAT_OWNER_PASSWORD;
  if (!password) {
    throw new Error("AFLOAT_OWNER_PASSWORD is required for owner login.");
  }
  return password;
}

function signSessionPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function hasAuthSecret(): boolean {
  return Boolean(process.env.AFLOAT_INSTANCE_SECRET || process.env.AUTH_SECRET || process.env.NODE_ENV !== "production");
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}
