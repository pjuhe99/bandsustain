import type { Metadata } from "next";
import Link from "next/link";
import { getPool } from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import { getOwnerToken } from "@/lib/playground/playgroundCookies";
import { LayoutGrid, type LayoutCard } from "@/components/playground/pedalboard/LayoutGrid";
import { buildPageMetadata } from "@/lib/seo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = buildPageMetadata({
  title: "내 페달보드",
  path: "/playground/pedalboard-planner/me",
  description: "내가 만든 페달보드 레이아웃",
  ogImage: "/slides/hero-b4d9e516.jpg",
});

async function loadMine(owner: string): Promise<LayoutCard[]> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT l.id, l.title, l.share_token, l.visibility, l.updated_at,
            b.image_filename AS board_image_filename, b.name AS board_name, br.name AS board_brand
       FROM playground_layouts l
       LEFT JOIN playground_boards b ON b.id = l.catalog_board_id
       LEFT JOIN playground_board_brands br ON br.id = b.brand_id
      WHERE l.owner_token = ? ORDER BY l.updated_at DESC LIMIT 50`, [owner]);
  return rows as unknown as LayoutCard[];
}

export default async function Page() {
  const owner = await getOwnerToken();
  const items = owner ? await loadMine(owner) : [];
  return (
    <section className="max-w-7xl mx-auto px-6 md:px-12 py-12">
      <header className="mb-8 md:flex md:items-end md:justify-between md:gap-8">
        <h1 className="font-display font-black uppercase tracking-tight text-3xl md:text-5xl">내 페달보드</h1>
        <nav className="mt-5 md:mt-0 flex flex-wrap gap-3 md:shrink-0">
          <Link href="/playground/pedalboard-planner"
            className="inline-flex items-center px-5 py-2.5 text-sm font-semibold uppercase tracking-wider border border-[var(--color-border-strong)] hover:bg-[var(--color-text)] hover:text-[var(--color-bg)] transition-colors">
            보드 고르기
          </Link>
          <Link href="/playground/pedalboard-planner/gallery"
            className="inline-flex items-center px-5 py-2.5 text-sm font-semibold uppercase tracking-wider border border-[var(--color-border-strong)] hover:bg-[var(--color-text)] hover:text-[var(--color-bg)] transition-colors">
            갤러리
          </Link>
        </nav>
      </header>
      <LayoutGrid items={items}
        hrefBuilder={(it) => `/playground/pedalboard-planner/edit/${it.id}`}
        emptyMessage="아직 만든 보드가 없습니다 — 보드를 골라 시작해보세요." />
    </section>
  );
}
