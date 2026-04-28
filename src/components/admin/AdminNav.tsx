"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/members", label: "Members" },
  { href: "/admin/songs", label: "Songs" },
  { href: "/admin/news", label: "News" },
  { href: "/admin/quotes", label: "Quotes" },
];

export default function AdminNav() {
  const pathname = usePathname();
  return (
    <aside className="w-56 shrink-0 border-r border-[var(--color-border)] py-8 px-6">
      <p className="font-display font-black uppercase text-lg mb-6">Admin</p>
      <nav className="flex flex-col gap-3 mb-8">
        {items.map((it) => {
          const active = pathname === it.href || (it.href !== "/admin" && pathname.startsWith(it.href));
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
      <form action="/admin/logout" method="post">
        <button
          type="submit"
          className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          Logout
        </button>
      </form>
    </aside>
  );
}
