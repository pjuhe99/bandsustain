"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// Document-level outbound click tracker. Captures clicks on any external
// <a>; if the link sits inside an element with `data-track-item-type` /
// `data-track-item-id`, those attributes are attached so the click can be
// attributed to a specific song/live event/etc. Internal links and
// non-http(s) protocols (mailto:, javascript:) are ignored.
export default function ClickTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;

    function send(payload: {
      path: string;
      targetUrl: string;
      itemType: string | null;
      itemId: number | null;
    }) {
      const body = JSON.stringify(payload);

      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        try {
          const blob = new Blob([body], { type: "application/json" });
          if (navigator.sendBeacon("/api/analytics/click", blob)) return;
        } catch {
          // fall through to fetch
        }
      }

      fetch("/api/analytics/click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }

    function handleClick(e: MouseEvent) {
      // Only primary-button clicks; ignore right-click etc.
      if (e.button !== 0 && e.type === "click") return;

      let el = e.target as Element | null;
      while (el && el.nodeName !== "A") {
        el = el.parentElement;
      }
      if (!el) return;

      const a = el as HTMLAnchorElement;
      const href = a.href;
      if (!href) return;

      let url: URL;
      try {
        url = new URL(href);
      } catch {
        return;
      }
      if (url.protocol !== "http:" && url.protocol !== "https:") return;

      const host = url.hostname;
      const isExternal = !host.endsWith("bandsustain.com");
      if (!isExternal) return;

      const ctx = a.closest("[data-track-item-type]") as HTMLElement | null;
      const itemType = ctx?.dataset.trackItemType ?? null;
      const itemIdRaw = ctx?.dataset.trackItemId ?? null;
      const itemId = itemIdRaw && /^\d+$/.test(itemIdRaw) ? Number(itemIdRaw) : null;

      send({ path: pathname, targetUrl: href, itemType, itemId });
    }

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [pathname]);

  return null;
}
