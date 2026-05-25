import { NextRequest, NextResponse } from "next/server";

// Lightweight route guard: redirects unauthenticated users away from app
// pages. Full cryptographic verification happens server-side in requireUser();
// here we only gate on cookie presence to keep the edge middleware fast.
const PROTECTED = ["/dashboard", "/transactions", "/rules", "/income-statement", "/balance-sheet", "/assets", "/settings"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get("ledgerlite_session")?.value);
  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));

  if (isProtected && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if ((pathname === "/login" || pathname === "/register") && hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"] };
