import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, handleError, audit } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { assetSchema } from "@/lib/validation";

export async function GET(req: NextRequest) {
  try {
    const u = await requireUser(req);
    return ok({ items: await prisma.asset.findMany({ where: { userId: u.id, deletedAt: null }, orderBy: { createdAt: "desc" } }) });
  } catch (err) { return handleError(err); }
}
export async function POST(req: NextRequest) {
  try {
    const u = await requireUser(req);
    const b = assetSchema.parse(await req.json());
    const asset = await prisma.asset.create({
      data: { ...b, userId: u.id, acquisitionDate: b.acquisitionDate ? new Date(b.acquisitionDate) : undefined },
    });
    await audit(u.id, "asset.create", "assets", asset.id);
    return ok(asset);
  } catch (err) { return handleError(err); }
}
