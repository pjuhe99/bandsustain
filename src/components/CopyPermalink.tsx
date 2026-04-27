"use client";

import { useState } from "react";

type Props = {
  quoteId: number;
};

export default function CopyPermalink({ quoteId }: Props) {
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    const url = `${window.location.origin}/quote#q${quoteId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API 거부됨 — 조용히 실패
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Copy permalink to this quote"
      className="text-xs uppercase tracking-[0.08em] text-[var(--color-text-muted)] hover:text-[var(--color-text)] opacity-60 active:opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 md:transition-opacity"
    >
      {copied ? "copied" : "#"}
    </button>
  );
}
