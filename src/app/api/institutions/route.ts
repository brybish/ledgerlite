import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, handleError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

// GET /api/institutions — connected banks plus their accounts (balances in
// cents). Used by Settings to show linked institutions and offer per-bank sync.
// The encrypted access token is never selected/returned.
export async function GET(req: NextRequest) {
  try {
    const u = await requireUser(req);
    const items = await prisma.institution.findMany({
      where: { userId: u.id, deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        createdAt: true,
        bankAccounts: {
          where: { deletedAt: null },
          select: { id: true, name: true, mask: true, type: true, currentBalance: true, isoCurrency: true },
        },
      },
    });
    return ok({ items });
  } catch (err) {
    return handleError(err);
  }
}
