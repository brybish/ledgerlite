import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, handleError } from "@/lib/api";
import { buildBalanceSheet } from "@/server/accounting/balance-sheet";

export async function GET(req: NextRequest) {
  try {
    const u = await requireUser(req);
    const asOf = req.nextUrl.searchParams.get("asOf");
    return ok(await buildBalanceSheet(u.id, asOf ? new Date(asOf) : new Date()));
  } catch (err) { return handleError(err); }
}
