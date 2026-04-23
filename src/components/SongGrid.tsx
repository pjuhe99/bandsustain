import type { Song } from "@/data/songs";
import SongCard from "./SongCard";

export default function SongGrid({ items }: { items: Song[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">
      {items.map((song) => (
        <SongCard key={song.id} song={song} />
      ))}
    </div>
  );
}
