import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, handleError, audit } from "@/lib/api";
import { applyRulesToUncategorized } from "@/server/accounting/rules-engine";

export async function POST(req: NextRequest) {
  try {
    const u = await requireUser(req);
    const updated = await applyRulesToUncategorized(u.id);
    await audit(u.id, "rule.run", undefined, undefined, { updated });
    return ok({ updated });
  } catch (err) { return handleError(err); }
}
