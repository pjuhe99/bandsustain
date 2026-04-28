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
    <aside className="w-full md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-[var(--color-border)] py-4 md:py-8 px-4 md:px-6">
      <div className="flex md:block items-center justify-between md:mb-6">
        <p className="font-display font-black uppercase text-lg md:mb-6">Admin</p>
        <form action="/admin/logout" method="post" className="md:hidden">
          <button
            type="submit"
            className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            Logout
          </button>
        </form>
      </div>
      <nav className="flex md:flex-col flex-row flex-wrap gap-x-4 gap-y-2 md:gap-3 md:mb-8">
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
      <form action="/admin/logout" method="post" className="hidden md:block">
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
