"use client";
import { useEffect, useRef } from "react";

// Fires once on mount to register a view. Server route handles cookie dedup,
// so SSR/prefetch never inflates the count.
export default function ColumnViewPing({ id }: { id: number }) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    fetch(`/api/columns/${id}/view`, { method: "POST", keepalive: true }).catch(() => {});
  }, [id]);
  return null;
}
