"use client";
import { useRef, useEffect, useState } from "react";
import Image from "next/image";
import { snapTo025 } from "@/lib/playground/snap";
import { PedalPiece } from "./PedalPiece";
import type { Layout, LayoutItem } from "@/lib/playground/layoutSerializer";

interface Props {
  board: Layout["board"];
  items: LayoutItem[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onMove: (id: number, x: number, y: number) => void;
}

export function BoardCanvas({ board, items, selectedId, onSelect, onMove }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pxPerIn, setPxPerIn] = useState(40);
  const dragRef = useRef<{ id: number; offsetX: number; offsetY: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const recompute = () => setPxPerIn(el.clientWidth / board.width_in);
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [board.width_in]);

  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const xIn = (e.clientX - rect.left) / pxPerIn - d.offsetX;
    const yIn = (e.clientY - rect.top) / pxPerIn - d.offsetY;
    onMove(d.id, snapTo025(xIn), snapTo025(yIn));
  }

  function onPointerUp(e: React.PointerEvent) {
    if (dragRef.current) {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
      dragRef.current = null;
    }
  }

  return (
    <div ref={ref}
      className="relative w-full mx-auto"
      style={{ aspectRatio: `${board.width_in} / ${board.height_in}`, maxWidth: "min(100%, 920px)" }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={(e) => { if (e.target === e.currentTarget) onSelect(null); }}>
      {board.image_filename && (
        <Image src={`/playground/images/pedalboards/${board.image_filename}`}
          alt={`${board.brand} ${board.name}`} fill className="object-contain pointer-events-none" sizes="100vw" />
      )}
      {items.map((it) => (
        <PedalPiece key={it.id} {...{
          x: it.x, y: it.y, rot: it.rot, widthIn: it.width_in, heightIn: it.height_in,
          imageFilename: it.image_filename, brand: it.brand, name: it.name,
          selected: selectedId === it.id, pxPerIn,
        }} onPointerDown={(e) => {
          e.preventDefault();
          onSelect(it.id);
          const rect = ref.current!.getBoundingClientRect();
          dragRef.current = {
            id: it.id,
            offsetX: (e.clientX - rect.left) / pxPerIn - it.x,
            offsetY: (e.clientY - rect.top) / pxPerIn - it.y,
          };
          (e.currentTarget as Element).setPointerCapture(e.pointerId);
        }} />
      ))}
    </div>
  );
}
