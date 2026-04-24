"use client";

import Image from "next/image";
import type { Member } from "@/data/members";

type Props = {
  member: Member;
  isOpen: boolean;
  onToggle: () => void;
};

function buildAriaLabel(m: Member): string {
  return [
    m.nameKr,
    m.nameEn,
    m.position,
    m.favoriteArtist && `Favorite Artist ${m.favoriteArtist}`,
    m.favoriteSong && `Favorite Song ${m.favoriteSong}`,
  ]
    .filter(Boolean)
    .join(", ");
}

export default function MemberCard({ member, isOpen, onToggle }: Props) {
  const hasFav = Boolean(member.favoriteArtist || member.favoriteSong);

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={buildAriaLabel(member)}
      className="relative aspect-square overflow-hidden group block w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
    >
      <span aria-hidden="true" className="contents">
        {/* Photo */}
        <Image
          src={member.photo}
          alt=""
          fill
          sizes="(min-width:768px) 33vw, (min-width:640px) 50vw, 100vw"
          className="object-cover"
        />

        {/* Bottom scrim for name legibility */}
        <span className="absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-black/55 to-transparent pointer-events-none" />

        {/* Name — photo state */}
        <span className="absolute bottom-0 left-0 right-14 p-4 text-white text-left">
          <span className="block font-display font-black uppercase text-lg md:text-xl leading-[1.05] line-clamp-1">
            {member.nameEn}
          </span>
          <span className="block text-xs opacity-90 mt-0.5 line-clamp-1">
            {member.nameKr}
          </span>
        </span>

        {/* Tap badge — mobile only, decorative */}
        <span className="md:hidden absolute top-2 right-2 bg-[var(--color-text)] text-[var(--color-bg)] text-[9px] font-bold uppercase tracking-[0.12em] px-2 py-1">
          Tap
        </span>

        {/* Orange reveal overlay */}
        <span
          data-open={isOpen}
          className="absolute inset-0 bg-[var(--color-accent)] text-[var(--color-accent-ink)] p-4 md:p-5 flex flex-col justify-end text-left opacity-0 transition-opacity duration-200 md:group-hover:opacity-100 group-focus-visible:opacity-100 data-[open=true]:opacity-100"
        >
          <span className="block text-[10px] uppercase tracking-[0.2em] font-bold opacity-90 mb-1.5 line-clamp-1">
            {member.position}
          </span>
          <span className="block font-display font-black uppercase text-lg md:text-2xl leading-[1.05] line-clamp-1">
            {member.nameEn}
          </span>
          <span className="block text-xs md:text-sm opacity-90 mt-0.5 mb-3 line-clamp-1">
            {member.nameKr}
          </span>
          {hasFav && (
            <span className="block border-t border-white/40 pt-2.5 text-xs leading-[1.6]">
              {member.favoriteArtist && (
                <span className="block">
                  <span className="block text-[9px] font-bold uppercase tracking-wider opacity-75">
                    Favorite Artist
                  </span>
                  <span className="block line-clamp-1">{member.favoriteArtist}</span>
                </span>
              )}
              {member.favoriteSong && (
                <span className="block mt-1.5">
                  <span className="block text-[9px] font-bold uppercase tracking-wider opacity-75">
                    Favorite Song
                  </span>
                  <span className="block line-clamp-1">{member.favoriteSong}</span>
                </span>
              )}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}
