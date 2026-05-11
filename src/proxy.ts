import { NextRequest, NextResponse } from "next/server";
import { logPageView } from "@/lib/analytics";

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

function adminGate(req: NextRequest, pathname: string): NextResponse {
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

// Apache mod_security2 (OWASP CRS) strips `Next-Router-Prefetch` from inbound
// requests, so the cleanest server-side prefetch signal never reaches us.
// `Sec-Purpose: prefetch` does survive (browser-emitted, standard) so we still
// catch some. Anything that slips past gets absorbed by the 5-minute
// (visitor, path) DB unique index in lib/analytics.ts.
function isPrefetch(req: NextRequest): boolean {
  if (req.headers.get("next-router-prefetch")) return true;
  if (req.headers.get("next-router-segment-prefetch")) return true;
  if (req.headers.get("purpose") === "prefetch") return true;
  const secPurpose = req.headers.get("sec-purpose");
  if (secPurpose && secPurpose.includes("prefetch")) return true;
  return false;
}

function trackAnalytics(req: NextRequest, pathname: string): void {
  if (isPrefetch(req)) return;

  const ua = req.headers.get("user-agent") || "";
  const ip =
    (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "")
      .split(",")[0]
      .trim() || "0.0.0.0";
  const referrer = req.headers.get("referer");
  const country = req.headers.get("cf-ipcountry");

  // Fire-and-forget: never block the response on logging
  logPageView({ path: pathname, ua, ip, referrer, country }).catch(() => {});
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/admin")) {
    return adminGate(req, pathname);
  }

  trackAnalytics(req, pathname);
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Admin auth gate
    "/admin/:path*",
    // Public-page analytics tracking (admin/api/internals excluded)
    "/((?!api|admin|_next|favicon|icon|robots|sitemap|uploads).*)",
  ],
};
