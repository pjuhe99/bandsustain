"use client";
import { useState, useEffect, useRef } from "react";
import { BoardCanvas } from "@/components/playground/pedalboard/BoardCanvas";
import { PedalSearchSheet, type PedalRow } from "@/components/playground/pedalboard/PedalSearchSheet";
import { SelectedInspector } from "@/components/playground/pedalboard/SelectedInspector";
import { TopBar } from "@/components/playground/pedalboard/TopBar";
import { ShareSheet } from "@/components/playground/pedalboard/ShareSheet";
import type { Layout, LayoutItem } from "@/lib/playground/layoutSerializer";
import type { Visibility } from "@/lib/playground/visibility";

interface Props {
  layoutId: number;
  shareToken: string;
  initialTitle: string;
  initialVisibility: Visibility;
  initialBoard: Layout["board"];
  initialItems: LayoutItem[];
}

export function EditorClient(props: Props) {
  const [title, setTitle] = useState(props.initialTitle);
  const [visibility, setVisibility] = useState<Visibility>(props.initialVisibility);
  const [items, setItems] = useState<LayoutItem[]>(props.initialItems);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const nextLocalId = useRef(-1);

  function add(p: PedalRow) {
    const board = props.initialBoard;
    const x = Math.max(0, (board.width_in - p.width_in) / 2);
    const y = Math.max(0, (board.height_in - p.height_in) / 2);
    setItems((arr) => [...arr, {
      kind: "catalog", id: p.id, x, y, rot: 0, z: arr.length,
      brand: p.brand_name, name: p.name,
      width_in: p.width_in, height_in: p.height_in,
      image_filename: p.image_filename,
    }]);
    setDirty(true);
  }

  function move(id: number, x: number, y: number) {
    setItems((arr) => arr.map((it) => (it.id === id ? { ...it, x, y } : it)));
    setDirty(true);
  }

  function rotateOne(id: number, next: number) {
    setItems((arr) => arr.map((it) => (it.id === id ? { ...it, rot: next as 0 | 90 | 180 | 270 } : it)));
    setDirty(true);
  }

  function deleteOne(id: number) {
    setItems((arr) => arr.filter((it) => it.id !== id));
    if (selectedId === id) setSelectedId(null);
    setDirty(true);
  }

  function bumpZ(id: number, delta: 1 | -1) {
    setItems((arr) => {
      const idx = arr.findIndex((it) => it.id === id);
      if (idx < 0) return arr;
      const next = [...arr];
      const target = next[idx];
      const swapIdx = idx + delta;
      if (swapIdx < 0 || swapIdx >= next.length) return arr;
      next[idx] = { ...next[swapIdx], z: target.z };
      next[swapIdx] = { ...target, z: next[idx].z + delta };
      return next;
    });
    setDirty(true);
  }

  function onTitle(next: string) { setTitle(next); setDirty(true); }
  function onVisibility(v: Visibility) { setVisibility(v); setDirty(true); }

  // debounced auto-save
  useEffect(() => {
    if (!dirty) return;
    const handle = setTimeout(async () => {
      const body = {
        title, visibility, board: props.initialBoard,
        items: items.map((it) => ({
          catalog_pedal_id: it.id, x: it.x, y: it.y, rot: it.rot, z: it.z,
          brand: it.brand, name: it.name, width_in: it.width_in, height_in: it.height_in,
          image_filename: it.image_filename,
        })),
      };
      let attempt = 0;
      while (true) {
        attempt += 1;
        const res = await fetch(`/api/playground/layouts/${props.layoutId}/snapshot`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          setDirty(false);
          const d = new Date();
          const pad = (n: number) => String(n).padStart(2, "0");
          setSavedAt(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
          break;
        }
        if (attempt >= 2) {
          alert("저장 실패 — 다시 시도");
          break;
        }
        await new Promise((r) => setTimeout(r, 5000));
      }
    }, 1000);
    return () => clearTimeout(handle);
  }, [dirty, title, visibility, items, props.initialBoard, props.layoutId]);

  const selected = items.find((it) => it.id === selectedId) ?? null;

  void nextLocalId; // placeholder for future custom pedal support

  return (
    <div>
      <TopBar title={title} dirty={dirty} savedAt={savedAt}
        onTitleChange={onTitle} onShareClick={() => setShareOpen(true)} />
      <main className="lg:mr-[360px] pb-[50vh] lg:pb-0 p-3">
        <BoardCanvas board={props.initialBoard} items={items}
          selectedId={selectedId} onSelect={setSelectedId} onMove={move} />
      </main>
      <PedalSearchSheet onAdd={add} />
      <SelectedInspector item={selected} onRotate={rotateOne} onDelete={deleteOne} onZ={bumpZ} />
      {shareOpen && (
        <ShareSheet shareToken={props.shareToken} visibility={visibility}
          onVisibilityChange={onVisibility} onClose={() => setShareOpen(false)} />
      )}
    </div>
  );
}
