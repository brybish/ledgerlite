import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { prisma } from "./prisma";

const COOKIE = "ledgerlite_session";
const ALG = "HS256";

function secret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error("JWT_SECRET must be set and >= 32 chars.");
  return new TextEncoder().encode(s);
}

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 12);
}
export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

export interface SessionClaims { sub: string; email: string; role: string }

export async function issueSession(claims: SessionClaims): Promise<string> {
  return new SignJWT({ email: claims.email, role: claims.role })
    .setProtectedHeader({ alg: ALG })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
}

// Set the session as an httpOnly, SameSite=Lax cookie (mitigates CSRF + XSS
// token theft). `secure` is on in production so it is only sent over HTTPS.
export function setSessionCookie(token: string) {
  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}
export function clearSessionCookie() {
  cookies().set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

// Verify a token string and return claims, or null.
export async function verifySession(token?: string): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return { sub: payload.sub as string, email: payload.email as string, role: payload.role as string };
  } catch {
    return null;
  }
}

// Resolve the current user from a request (used by API route handlers).
// Throws a 401-style error if unauthenticated. Always re-checks the DB so a
// deleted/disabled user cannot keep using a valid-looking token.
export async function requireUser(req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value;
  const claims = await verifySession(token);
  if (!claims) throw new AuthError("Unauthorized");
  const user = await prisma.user.findUnique({ where: { id: claims.sub } });
  if (!user) throw new AuthError("Unauthorized");
  return user;
}

export class AuthError extends Error {}
