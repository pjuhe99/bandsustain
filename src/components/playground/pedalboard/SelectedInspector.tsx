"use client";
import type { LayoutItem } from "@/lib/playground/layoutSerializer";
import { rotateLeft, rotateRight } from "@/lib/playground/rotate";

interface Props {
  item: LayoutItem | null;
  onRotate: (id: number, next: number) => void;
  onDelete: (id: number) => void;
  onZ: (id: number, delta: 1 | -1) => void;
}

export function SelectedInspector({ item, onRotate, onDelete, onZ }: Props) {
  if (!item) return null;
  return (
    <div className="fixed left-0 right-0 bottom-[50vh] lg:bottom-0 lg:right-[360px] z-10
                     bg-[var(--color-bg)] border-t border-[var(--color-border-strong)] px-3 py-2 flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">{item.brand}</div>
        <div className="text-sm font-semibold truncate">{item.name}</div>
        <div className="text-[10px] text-[var(--color-text-muted)]">{item.width_in}{'"'} × {item.height_in}{'"'} · {item.rot}°</div>
      </div>
      <button onClick={() => onRotate(item.id, rotateLeft(item.rot))}
        className="px-3 py-2 text-xs uppercase tracking-wider border border-[var(--color-border-strong)]" aria-label="좌로 회전">↺</button>
      <button onClick={() => onRotate(item.id, rotateRight(item.rot))}
        className="px-3 py-2 text-xs uppercase tracking-wider border border-[var(--color-border-strong)]" aria-label="우로 회전">↻</button>
      <button onClick={() => onZ(item.id, -1)} className="px-2 py-2 text-xs border border-[var(--color-border-strong)]" aria-label="뒤로">⬇</button>
      <button onClick={() => onZ(item.id, 1)} className="px-2 py-2 text-xs border border-[var(--color-border-strong)]" aria-label="앞으로">⬆</button>
      <button onClick={() => onDelete(item.id)} className="px-3 py-2 text-xs uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)]">삭제</button>
    </div>
  );
}
