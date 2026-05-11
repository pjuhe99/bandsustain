import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "bs_admin";

// Admin auth gate: 1st-stage cookie format check only (real HMAC validation
// runs at the (authed) layout via readSession()). A forged cookie passes this
// gate but is rejected by readSession().
function looksLikeToken(t: string | undefined): boolean {
  if (!t) return false;
  const parts = t.split(".");
  if (parts.length !== 2) return false;
  return parts[0].length > 0 && parts[1].length > 0;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/admin/login") || pathname === "/admin/logout") {
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

// Analytics tracking moved to client-side beacon (components/AnalyticsBeacon
// + api/analytics/log). Proxy is back to admin-only — Apache mod_security2
// stripping `Next-Router-Prefetch` doesn't matter when prefetch RSC fetches
// never execute the page's JS in the first place.
export const config = {
  matcher: ["/admin/:path*"],
};
