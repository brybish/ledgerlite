import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, bad, handleError, audit } from "@/lib/api";
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

// Create a top-level category (class required) or a subcategory (parentId given,
// class inherited from the parent — one level deep only).
const schema = z.object({
  name: z.string().min(1).max(80),
  class: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]).optional(),
  subgroup: z.string().max(40).optional(),
  parentId: z.string().cuid().optional(),
});
export async function POST(req: NextRequest) {
  try {
    const u = await requireUser(req);
    const b = schema.parse(await req.json());

    let klass = b.class;
    let parentId: string | null = b.parentId ?? null;
    if (parentId) {
      const parent = await prisma.category.findFirst({ where: { id: parentId, userId: u.id, deletedAt: null } });
      if (!parent) return bad("Parent category not found.", 404);
      if (parent.parentId) return bad("Subcategories can only be one level deep.", 422);
      klass = parent.class; // inherit
    }
    if (!klass) return bad("A top-level category needs a type (class).", 422);

    const cat = await prisma.category.create({
      data: { name: b.name, class: klass, subgroup: b.subgroup, parentId, userId: u.id, system: false },
    });
    await audit(u.id, "category.create", "transaction_categories", cat.id);
    return ok(cat);
  } catch (err) { return handleError(err); }
}
