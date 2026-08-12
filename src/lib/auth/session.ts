import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { RoleCode } from "@/lib/constants";

/**
 * Stateless session management.
 *
 * A signed JWT in an httpOnly cookie. The payload carries only what routing and
 * UI gating need — user id and role code. No email, no name, no PII, nothing
 * sensitive: the cookie is signed, not encrypted, so anyone holding it can read
 * its contents. Everything else is loaded from the database by the DAL.
 */

const SESSION_COOKIE = "saawariya_session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export type SessionPayload = {
  userId: string;
  role: RoleCode;
  expiresAt: number;
};

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET is missing or too short (needs 32+ characters). " +
        "Run `npm run setup`, which creates .env from .env.example.",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function encryptSession(
  payload: Omit<SessionPayload, "expiresAt"> & { expiresAt: number },
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecretKey());
}

export async function decryptSession(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });

    if (
      typeof payload.userId !== "string" ||
      typeof payload.role !== "string"
    ) {
      return null;
    }

    return {
      userId: payload.userId,
      role: payload.role as RoleCode,
      expiresAt: Number(payload.expiresAt ?? 0),
    };
  } catch {
    // Expired, tampered with, or signed by a different secret. All are just
    // "no valid session" — never surface the reason to the caller.
    return null;
  }
}

export async function createSession(
  userId: string,
  role: RoleCode,
): Promise<void> {
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const token = await encryptSession({ userId, role, expiresAt });
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true, // unreadable from client-side JavaScript (XSS mitigation)
    secure: process.env.NODE_ENV === "production", // http on localhost, https in production
    sameSite: "lax", // blocks the cookie on cross-site POSTs (CSRF mitigation)
    expires: new Date(expiresAt),
    path: "/",
  });
}

export async function getSessionToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value;
}

export async function getSession(): Promise<SessionPayload | null> {
  return decryptSession(await getSessionToken());
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
