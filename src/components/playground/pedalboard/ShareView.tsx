"use client";

import { useState } from "react";
import Image from "next/image";
import type { Layout } from "@/lib/playground/layoutSerializer";

export function ShareView({ layout }: { layout: Layout }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selected = selectedIndex !== null ? layout.items[selectedIndex] ?? null : null;

  return (
    <section className="max-w-5xl mx-auto px-6 md:px-12 py-12 pb-32">
      <header className="mb-6">
        <h1 className="font-display font-black text-3xl md:text-5xl">{layout.title}</h1>
        <div className="mt-2 text-sm text-[var(--color-text-muted)]">
          {layout.board.brand} {layout.board.name} · {layout.board.width_in}{'"'} × {layout.board.height_in}{'"'}
        </div>
      </header>
      <div
        className="relative w-full"
        style={{ aspectRatio: `${layout.board.width_in} / ${layout.board.height_in}` }}
        onClick={(e) => { if (e.target === e.currentTarget) setSelectedIndex(null); }}
      >
        {layout.board.image_filename && (
          <Image src={`/playground/images/pedalboards/${layout.board.image_filename}`}
            alt={`${layout.board.brand} ${layout.board.name}`} fill className="object-contain pointer-events-none" sizes="100vw" />
        )}
        {layout.items.map((it, i) => {
          const wPct = (it.width_in / layout.board.width_in) * 100;
          const hPct = (it.height_in / layout.board.height_in) * 100;
          const xPct = (it.x / layout.board.width_in) * 100;
          const yPct = (it.y / layout.board.height_in) * 100;
          const isSelected = selectedIndex === i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setSelectedIndex(isSelected ? null : i)}
              style={{
                position: "absolute",
                left: `${xPct}%`, top: `${yPct}%`,
                width: `${wPct}%`, height: `${hPct}%`,
                transform: `rotate(${it.rot}deg)`, transformOrigin: "center center",
                background: "transparent",
                border: isSelected ? "2px solid #2563FF" : "none",
                padding: 0,
                cursor: "pointer",
              }}
              aria-label={`${it.brand} ${it.name}`}
              aria-pressed={isSelected}
            >
              {it.image_filename && (
                <Image src={`/playground/images/pedals/${it.image_filename}`} alt={`${it.brand} ${it.name}`}
                  fill className="object-contain pointer-events-none" sizes="200px" />
              )}
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="fixed inset-x-0 bottom-0 z-[45] bg-[var(--color-bg)] border-t border-[var(--color-border-strong)] px-4 md:px-6 py-3 flex items-center gap-3">
          <div className="relative w-12 h-12 md:w-14 md:h-14 shrink-0 bg-[var(--color-bg-muted)]">
            {selected.image_filename && (
              <Image src={`/playground/images/pedals/${selected.image_filename}`} alt="" fill className="object-contain" sizes="56px" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">{selected.brand}</div>
            <div className="text-sm md:text-base font-semibold truncate">{selected.name}</div>
            <div className="text-[10px] text-[var(--color-text-muted)]">
              {selected.width_in}{'"'} × {selected.height_in}{'"'}{selected.rot ? ` · ${selected.rot}° 회전` : ""}
            </div>
          </div>
          <button
            onClick={() => setSelectedIndex(null)}
            aria-label="닫기"
            className="px-3 py-2 text-xs uppercase tracking-wider border border-[var(--color-border-strong)] shrink-0"
          >
            닫기
          </button>
        </div>
      )}
    </section>
  );
}
