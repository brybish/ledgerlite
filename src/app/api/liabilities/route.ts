import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, handleError, audit } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { liabilitySchema } from "@/lib/validation";

export async function GET(req: NextRequest) {
  try {
    const u = await requireUser(req);
    return ok({ items: await prisma.liability.findMany({ where: { userId: u.id, deletedAt: null }, orderBy: { createdAt: "desc" } }) });
  } catch (err) { return handleError(err); }
}
export async function POST(req: NextRequest) {
  try {
    const u = await requireUser(req);
    const b = liabilitySchema.parse(await req.json());
    const liability = await prisma.liability.create({ data: { ...b, userId: u.id } });
    await audit(u.id, "liability.create", "liabilities", liability.id);
    return ok(liability);
  } catch (err) { return handleError(err); }
}
