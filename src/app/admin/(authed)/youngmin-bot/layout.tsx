"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const subItems = [
  { href: "/admin/youngmin-bot", label: "Dashboard" },
  { href: "/admin/youngmin-bot/prompt", label: "Prompt" },
  { href: "/admin/youngmin-bot/api-key", label: "API Key" },
  { href: "/admin/youngmin-bot/profile", label: "Profile" },
];

export default function YoungminBotLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display font-black uppercase text-2xl md:text-3xl">
        Kim Young-min Bot
      </h1>
      <nav className="flex flex-wrap gap-x-5 gap-y-2 border-b border-[var(--color-border)] pb-3">
        {subItems.map((it) => {
          const active = pathname === it.href;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={
                "text-sm uppercase tracking-wider " +
                (active
                  ? "text-[var(--color-text)] underline underline-offset-4"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]")
              }
            >
              {it.label}
            </Link>
          );
        })}
      </nav>
      <div>{children}</div>
    </div>
  );
}
