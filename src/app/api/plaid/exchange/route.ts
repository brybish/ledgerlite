import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { exchangePublicToken } from "@/lib/plaid";
import { ok, bad, handleError, audit } from "@/lib/api";
import { z } from "zod";
const schema = z.object({ publicToken: z.string().min(10) });
export async function POST(req: NextRequest) {
  try {
    const u = await requireUser(req);
    const { publicToken } = schema.parse(await req.json());
    const { institutionId } = await exchangePublicToken(u.id, publicToken);
    await audit(u.id, "plaid.link", "institutions", institutionId);
    return ok({ institutionId });
  } catch (err) { return handleError(err); }
}
