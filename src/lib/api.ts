import { NextResponse } from "next/server";
import { AuthError } from "./auth";
import { prisma } from "./prisma";
import { ZodError } from "zod";

// Uniform JSON helpers + a single error funnel so handlers stay tiny and never
// leak stack traces / internal details to clients.
export const ok = (data: unknown, init?: ResponseInit) => NextResponse.json(data, init);
export const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export function handleError(err: unknown): NextResponse {
  if (err instanceof AuthError) return bad("Unauthorized", 401);
  if (err instanceof ZodError) return NextResponse.json({ error: "Validation failed", issues: err.issues }, { status: 422 });
  console.error("[api] unhandled error:", err);
  return bad("Internal server error", 500);
}

// Fire-and-forget audit log. Failures here must never break the request.
export async function audit(userId: string | null, action: string, entity?: string, entityId?: string, metadata?: object) {
  try {
    await prisma.auditLog.create({ data: { userId, action, entity, entityId, metadata: metadata as any } });
  } catch (e) {
    console.error("[audit] failed:", e);
  }
}
