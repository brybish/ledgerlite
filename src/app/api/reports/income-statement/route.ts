import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, handleError } from "@/lib/api";
import { buildIncomeStatement } from "@/server/accounting/income-statement";

export async function GET(req: NextRequest) {
  try {
    const u = await requireUser(req);
    const sp = req.nextUrl.searchParams;
    const start = sp.get("start") ? new Date(sp.get("start")!) : undefined;
    const end = sp.get("end") ? new Date(sp.get("end")!) : undefined;
    return ok(await buildIncomeStatement(u.id, { start, end }));
  } catch (err) { return handleError(err); }
}
