import SongForm from "@/components/admin/SongForm";
import { createSong } from "../actions";

export const dynamic = "force-dynamic";

export default function NewSongPage() {
  return (
    <div>
      <h1 className="font-display font-black uppercase text-3xl mb-8">새 곡</h1>
      <SongForm action={createSong} submitLabel="저장" />
    </div>
  );
}
