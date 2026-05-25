import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, handleError, audit } from "@/lib/api";
import { prisma } from "@/lib/prisma";

// POST /api/transactions/reset — permanently delete ALL of the user's
// transactions (splits cascade). For starting over after a bad import. This is
// destructive and irreversible; the UI gates it behind an explicit confirmation.
export async function POST(req: NextRequest) {
  try {
    const u = await requireUser(req);
    const res = await prisma.transaction.deleteMany({ where: { userId: u.id } });
    await audit(u.id, "transactions.reset", "transactions", undefined, { deleted: res.count });
    return ok({ deleted: res.count });
  } catch (err) {
    return handleError(err);
  }
}
