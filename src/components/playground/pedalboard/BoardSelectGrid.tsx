"use client";
import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface BoardRow {
  id: number; brand_name: string; name: string;
  width_in: number; height_in: number; image_filename: string | null;
}
interface BrandRow { id: number; name: string }

export function BoardSelectGrid({ initialBrands, initialBoards }: {
  initialBrands: BrandRow[]; initialBoards: BoardRow[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [brandId, setBrandId] = useState<number | null>(null);
  const [boards, setBoards] = useState<BoardRow[]>(initialBoards);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const handle = setTimeout(async () => {
      setLoading(true);
      const url = new URL("/api/playground/boards", window.location.origin);
      if (q.trim()) url.searchParams.set("q", q.trim());
      if (brandId) url.searchParams.set("brand_id", String(brandId));
      url.searchParams.set("limit", "50");
      const res = await fetch(url.toString());
      if (res.ok) {
        const j = await res.json();
        setBoards(j.items);
      }
      setLoading(false);
    }, 250);
    return () => clearTimeout(handle);
  }, [q, brandId]);

  function pick(id: number) {
    startTransition(async () => {
      const res = await fetch("/api/playground/layouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ catalog_board_id: id }),
      });
      if (!res.ok) return alert("새 레이아웃 생성 실패");
      const j = await res.json();
      router.push(`/playground/pedalboard-planner/edit/${j.id}`);
    });
  }

  return (
    <section className="max-w-7xl mx-auto px-6 md:px-12 py-12 md:py-16">
      <header className="mb-8">
        <h1 className="font-display font-black uppercase tracking-tight text-3xl md:text-5xl">Pedalboard Planner</h1>
        <p className="mt-3 text-sm md:text-base text-[var(--color-text-muted)]">시작할 보드를 고르세요.</p>
        <nav className="mt-4 flex gap-4 text-xs uppercase tracking-wider">
          <Link href="/playground/pedalboard-planner/me" className="underline">내 보드</Link>
          <Link href="/playground/pedalboard-planner/gallery" className="underline">갤러리</Link>
        </nav>
      </header>

      <input
        value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="보드 이름·브랜드 검색"
        className="w-full border border-[var(--color-border-strong)] rounded-none px-4 py-3 text-base mb-3"
      />

      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 -mx-6 px-6">
        <button onClick={() => setBrandId(null)}
          className={`whitespace-nowrap px-4 py-1.5 text-sm border border-[var(--color-border-strong)] ${brandId === null ? "bg-[var(--color-text)] text-[var(--color-bg)]" : "bg-transparent"}`}>
          전체
        </button>
        {initialBrands.map((b) => (
          <button key={b.id} onClick={() => setBrandId(b.id === brandId ? null : b.id)}
            className={`whitespace-nowrap px-4 py-1.5 text-sm border border-[var(--color-border-strong)] ${brandId === b.id ? "bg-[var(--color-text)] text-[var(--color-bg)]" : "bg-transparent"}`}>
            {b.name}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-[var(--color-text-muted)] mb-4">불러오는 중…</p>}
      {!loading && boards.length === 0 && (
        <p className="text-sm text-[var(--color-text-muted)]">검색 결과 없음. 다른 키워드/브랜드를 시도해보세요.</p>
      )}

      <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {boards.map((b) => (
          <li key={b.id}>
            <button onClick={() => pick(b.id)} disabled={isPending} className="text-left w-full disabled:opacity-50">
              <div className="aspect-[3/1] bg-[var(--color-bg-muted)] relative overflow-hidden">
                {b.image_filename && (
                  <Image src={`/playground/images/pedalboards/${b.image_filename}`}
                    alt={`${b.brand_name} ${b.name}`} fill className="object-contain"
                    sizes="(max-width: 768px) 50vw, 25vw" />
                )}
              </div>
              <div className="mt-2 text-xs uppercase tracking-wider text-[var(--color-text-muted)]">{b.brand_name}</div>
              <div className="font-semibold text-base md:text-lg">{b.name}</div>
              <div className="text-xs text-[var(--color-text-muted)]">{b.width_in}&quot; × {b.height_in}&quot;</div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
