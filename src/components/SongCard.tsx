"use client";

import { useState } from "react";
import Image from "next/image";
import type { Song } from "@/data/songs";
import LyricsModal from "./LyricsModal";

export default function SongCard({ song }: { song: Song }) {
  const [lyricsOpen, setLyricsOpen] = useState(false);

  return (
    <>
      <article className="flex flex-col">
        <div className="relative aspect-square bg-[var(--color-bg-muted)] mb-5 flex items-center justify-center text-[var(--color-text-muted)] text-sm">
          {song.artwork ? (
            <Image
              src={song.artwork}
              alt={song.title}
              fill
              sizes="(min-width: 768px) 33vw, 100vw"
              className="object-cover"
            />
          ) : (
            <span>Artwork</span>
          )}
        </div>
        <h3 className="font-semibold text-lg md:text-xl mb-1">{song.title}</h3>
        <p className="text-sm text-[var(--color-text-muted)] mb-4">
          {song.year} · {song.category}
        </p>
        <div className="flex gap-2">
          <a
            href={song.listenUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-5 py-2 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] hover:bg-transparent hover:text-[var(--color-text)] transition-colors"
          >
            Listen
          </a>
          <button
            type="button"
            onClick={() => setLyricsOpen(true)}
            className="inline-flex items-center justify-center px-5 py-2 text-sm font-semibold uppercase tracking-wider bg-transparent text-[var(--color-text)] border border-[var(--color-text)] hover:bg-[var(--color-text)] hover:text-[var(--color-bg)] transition-colors"
          >
            Lyrics
          </button>
        </div>
      </article>

      <LyricsModal
        open={lyricsOpen}
        onClose={() => setLyricsOpen(false)}
        title={song.title}
        lyrics={song.lyrics}
      />
    </>
  );
}
