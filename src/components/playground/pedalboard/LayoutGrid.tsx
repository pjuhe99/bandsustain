import Link from "next/link";
import { BoardThumbnail } from "./BoardThumbnail";
import type { ThumbData } from "@/lib/playground/thumbnail";

export interface LayoutCard {
  id: number; title: string; share_token: string;
  visibility: "private" | "unlisted" | "public";
  updated_at: Date;
  board_image_filename: string | null;
  board_brand: string | null; board_name: string | null;
  thumb: ThumbData | null;
}

export function LayoutGrid({ items, hrefBuilder, emptyMessage }: {
  items: LayoutCard[];
  hrefBuilder: (it: LayoutCard) => string;
  emptyMessage: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-[var(--color-text-muted)]">{emptyMessage}</p>;
  }
  return (
    <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
      {items.map((it) => (
        <li key={it.id}>
          <Link href={hrefBuilder(it)} className="block">
            <div className="aspect-[3/1] bg-[var(--color-bg-muted)] relative overflow-hidden">
              <BoardThumbnail thumb={it.thumb} fallbackImage={it.board_image_filename}
                alt={`${it.board_brand ?? ""} ${it.board_name ?? ""}`} />
            </div>
            <div className="mt-2 text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
              {it.board_brand} {it.board_name}
            </div>
            <div className="font-semibold text-base truncate">{it.title}</div>
            <div className="text-[10px] text-[var(--color-text-muted)]">{new Date(it.updated_at).toLocaleString("ko-KR")} · {it.visibility}</div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
