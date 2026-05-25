import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, handleError, audit } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function GET(req: NextRequest) {
  try {
    const u = await requireUser(req);
    const items = await prisma.category.findMany({
      where: { userId: u.id, deletedAt: null },
      orderBy: [{ class: "asc" }, { name: "asc" }],
    });
    return ok({ items });
  } catch (err) { return handleError(err); }
}

const schema = z.object({
  name: z.string().min(1).max(80),
  class: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]),
  subgroup: z.string().max(40).optional(),
});
export async function POST(req: NextRequest) {
  try {
    const u = await requireUser(req);
    const b = schema.parse(await req.json());
    const cat = await prisma.category.create({ data: { ...b, userId: u.id, system: false } });
    await audit(u.id, "category.create", "transaction_categories", cat.id);
    return ok(cat);
  } catch (err) { return handleError(err); }
}
