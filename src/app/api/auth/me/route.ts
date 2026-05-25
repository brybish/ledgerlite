import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, handleError } from "@/lib/api";
export async function GET(req: NextRequest) {
  try {
    const u = await requireUser(req);
    return ok({ id: u.id, email: u.email, name: u.name, role: u.role });
  } catch (err) { return handleError(err); }
}
