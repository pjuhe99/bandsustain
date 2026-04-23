"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import Logo from "./Logo";

const navLinks = [
  { href: "/members", label: "Members" },
  { href: "/songs", label: "Our Songs" },
  { href: "/quote", label: "Quote" },
  { href: "/live", label: "Live" },
  { href: "/news", label: "News" },
];

const socialLinks = [
  { href: "https://www.instagram.com/band_sustain", label: "Instagram" },
  { href: "https://www.youtube.com/@bandsustain1453", label: "YouTube" },
  { href: "https://open.spotify.com/artist/3Zp50Xd4MEceDdVsnPO7Fs", label: "Spotify" },
];

export default function Nav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <header className="border-b border-[var(--color-border)] bg-[var(--color-bg)]">
        <div className="max-w-7xl mx-auto px-6 md:px-12 h-[72px] flex items-center justify-between">
          <Link href="/" aria-label="bandsustain — home">
            <Logo className="h-7 md:h-8 w-auto text-[var(--color-text)]" />
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="hover:underline underline-offset-4 decoration-2"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <button
            className="md:hidden w-8 h-8 flex flex-col items-center justify-center gap-1.5"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
          >
            <span className="block w-6 h-[2px] bg-[var(--color-text)]" />
            <span className="block w-6 h-[2px] bg-[var(--color-text)]" />
            <span className="block w-6 h-[2px] bg-[var(--color-text)]" />
          </button>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 bg-[var(--color-bg)] flex flex-col p-6 md:hidden">
          <div className="flex justify-between items-center h-[72px] -mt-6 -mx-6 px-6 border-b border-[var(--color-border)]">
            <Logo className="h-7 w-auto text-[var(--color-text)]" />
            <button
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="w-8 h-8 flex items-center justify-center text-3xl leading-none"
            >
              ×
            </button>
          </div>

          <nav className="flex flex-col gap-1 flex-1 pt-12">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-3xl font-semibold py-3"
                onClick={() => setOpen(false)}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="flex gap-6 pt-6 border-t border-[var(--color-border)] text-sm">
            {socialLinks.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4"
              >
                {s.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
