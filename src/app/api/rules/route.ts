import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, handleError, audit } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { ruleSchema } from "@/lib/validation";

export async function GET(req: NextRequest) {
  try {
    const u = await requireUser(req);
    const rules = await prisma.categorizationRule.findMany({
      where: { userId: u.id, deletedAt: null },
      orderBy: { priority: "asc" },
      include: { category: true },
    });
    return ok({ items: rules });
  } catch (err) { return handleError(err); }
}

export async function POST(req: NextRequest) {
  try {
    const u = await requireUser(req);
    const body = ruleSchema.parse(await req.json());
    const rule = await prisma.categorizationRule.create({ data: { ...body, userId: u.id } });
    await audit(u.id, "rule.create", "categorization_rules", rule.id);
    return ok(rule);
  } catch (err) { return handleError(err); }
}
