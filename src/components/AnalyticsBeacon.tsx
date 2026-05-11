"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const SESSION_FLAG = "bs_session_started";

// Hydration-driven beacon: fires once per page render on the real client.
// Bots without JS, prefetch RSC fetches, and Apache-stripped headers all
// become irrelevant — only actually-rendered page views generate a row.
//
// Referrer is sent only on the first beacon of a tab (sessionStorage flag),
// because document.referrer doesn't change on Next.js client-side
// navigation, so without this guard a Google-referred user clicking
// internal Links would credit every subsequent page to Google.
export default function AnalyticsBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    if (pathname.startsWith("/admin") || pathname.startsWith("/api")) return;

    let referrer = "";
    try {
      const isFirst = !window.sessionStorage.getItem(SESSION_FLAG);
      if (isFirst) {
        referrer = document.referrer || "";
        window.sessionStorage.setItem(SESSION_FLAG, "1");
      }
    } catch {
      // sessionStorage may be blocked (privacy mode, sandboxed iframes) —
      // fall through with empty referrer
    }

    const body = JSON.stringify({ path: pathname, referrer });

    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      try {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon("/api/analytics/log", blob);
        return;
      } catch {
        // fall through to fetch
      }
    }

    fetch("/api/analytics/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return null;
}
