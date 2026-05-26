import Link from "next/link";

const tabs = [
  { href: "/admin/band-name/words", label: "Words" },
  { href: "/admin/band-name/patterns", label: "Patterns" },
  { href: "/admin/band-name/pairs", label: "Pairs" },
  { href: "/admin/band-name/blocked-names", label: "Blocked Names" },
];

export default function BandNameAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="flex flex-wrap gap-4 mb-8 border-b border-[var(--color-border)] pb-3">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} className="text-sm uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
            {t.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
