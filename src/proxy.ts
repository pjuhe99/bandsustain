import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "bs_admin";

// Edge runtime constraint: this proxy cannot use src/lib/auth.ts
// because that module imports node:crypto + bcryptjs + server-only,
// which Edge runtime does not provide. Instead, this is a 1st-stage
// gate that only verifies cookie presence + format. Real HMAC validation
// happens at the page/layout level via readSession() (Node runtime).
// A user with a forged cookie passes this gate but is rejected by the
// (authed) layout's readSession() call.

function looksLikeToken(t: string | undefined): boolean {
  if (!t) return false;
  const parts = t.split(".");
  if (parts.length !== 2) return false;
  return parts[0].length > 0 && parts[1].length > 0;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/admin/login")
    || pathname === "/admin/logout"
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!looksLikeToken(token)) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
