"use client";
import { useEffect, useState } from "react";
import Image from "next/image";

export interface PedalRow {
  id: number; brand_name: string; name: string;
  width_in: number; height_in: number; image_filename: string | null;
}
interface BrandRow { id: number; name: string }

export function PedalSearchSheet({ onAdd }: { onAdd: (p: PedalRow) => void }) {
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [pedals, setPedals] = useState<PedalRow[]>([]);
  const [q, setQ] = useState("");
  const [brandId, setBrandId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/playground/pedals/brands");
      if (res.ok) setBrands((await res.json()).items);
    })();
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      const url = new URL("/api/playground/pedals", window.location.origin);
      if (q.trim()) url.searchParams.set("q", q.trim());
      if (brandId) url.searchParams.set("brand_id", String(brandId));
      url.searchParams.set("limit", "50");
      const res = await fetch(url.toString());
      if (res.ok) setPedals((await res.json()).items);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q, brandId]);

  return (
    <aside className="fixed bottom-0 left-0 right-0 h-[50vh] lg:h-auto lg:top-[var(--editor-topbar-h)] lg:bottom-0 lg:left-auto lg:right-0 lg:w-[360px] z-20
                       bg-[var(--color-bg)] border-t lg:border-t-0 lg:border-l border-[var(--color-border-strong)] flex flex-col">
      <div className="p-3 border-b border-[var(--color-border)] sticky top-0 bg-[var(--color-bg)]">
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="페달 이름·브랜드"
          className="w-full border border-[var(--color-border-strong)] rounded-none px-3 py-2 text-sm" />
        <div className="flex gap-1.5 overflow-x-auto mt-2 pb-1 -mx-1 px-1">
          <button onClick={() => setBrandId(null)}
            className={`whitespace-nowrap px-3 py-1 text-xs border border-[var(--color-border-strong)] ${brandId === null ? "bg-[var(--color-text)] text-[var(--color-bg)]" : ""}`}>
            전체
          </button>
          {brands.map((b) => (
            <button key={b.id} onClick={() => setBrandId(b.id === brandId ? null : b.id)}
              className={`whitespace-nowrap px-3 py-1 text-xs border border-[var(--color-border-strong)] ${brandId === b.id ? "bg-[var(--color-text)] text-[var(--color-bg)]" : ""}`}>
              {b.name}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {loading && <p className="text-xs text-[var(--color-text-muted)]">불러오는 중…</p>}
        {!loading && pedals.length === 0 && (
          <p className="text-xs text-[var(--color-text-muted)]">검색 결과 없음.</p>
        )}
        <ul className="grid grid-cols-2 gap-2">
          {pedals.map((p) => (
            <li key={p.id}>
              <button onClick={() => onAdd(p)} className="text-left w-full">
                <div className="aspect-square bg-[var(--color-bg-muted)] relative overflow-hidden">
                  {p.image_filename && (
                    <Image src={`/playground/images/pedals/${p.image_filename}`} alt={`${p.brand_name} ${p.name}`}
                      fill sizes="50vw" className="object-contain" />
                  )}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mt-1">{p.brand_name}</div>
                <div className="text-xs font-semibold leading-tight">{p.name}</div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
