"use client";

import { useEffect } from "react";

export default function LyricsModal({
  open,
  onClose,
  title,
  lyrics,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  lyrics: string;
}) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <div
      aria-hidden={!open}
      onClick={onClose}
      className={`fixed inset-0 z-[60] md:flex md:items-center md:justify-center transition-opacity duration-200 motion-reduce:transition-none ${
        open
          ? "opacity-100 pointer-events-auto"
          : "opacity-0 pointer-events-none"
      }`}
    >
      <div className="absolute inset-0 bg-black/40 hidden md:block" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Lyrics: ${title}`}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full h-full md:w-auto md:h-auto md:max-w-2xl md:max-h-[85vh] bg-[var(--color-bg)] flex flex-col"
      >
        <header className="flex items-center justify-between h-[72px] px-6 md:px-8 border-b border-[var(--color-border)] shrink-0">
          <h2 className="font-display font-bold text-xl md:text-2xl uppercase tracking-tight truncate pr-4">
            {title}
          </h2>
          <button
            aria-label="Close lyrics"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-3xl leading-none shrink-0"
          >
            ×
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 md:px-8 py-8">
          <p className="whitespace-pre-wrap text-base md:text-lg leading-[1.7]">
            {lyrics}
          </p>
        </div>
      </div>
    </div>
  );
}
