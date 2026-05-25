import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { syncTransactions } from "@/lib/plaid";
import { ok, bad, handleError, audit } from "@/lib/api";
import { z } from "zod";
const schema = z.object({ institutionId: z.string().cuid() });
// "Download Transactions" endpoint. Date-range narrowing is applied at query
// time on the Transactions page; sync itself pulls the full delta from Plaid.
export async function POST(req: NextRequest) {
  try {
    const u = await requireUser(req);
    const { institutionId } = schema.parse(await req.json());
    const result = await syncTransactions(u.id, institutionId);
    await audit(u.id, "plaid.sync", "institutions", institutionId, result);
    return ok(result);
  } catch (err) { return handleError(err); }
}
