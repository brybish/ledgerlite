import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { createLinkToken } from "@/lib/plaid";
import { ok, handleError } from "@/lib/api";
export async function POST(req: NextRequest) {
  try {
    const u = await requireUser(req);
    return ok({ linkToken: await createLinkToken(u.id) });
  } catch (err) { return handleError(err); }
}
