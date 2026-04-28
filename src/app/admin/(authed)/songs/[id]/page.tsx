import { notFound } from "next/navigation";
import { getSongById } from "@/lib/songs";
import SongForm from "@/components/admin/SongForm";
import { updateSong } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditSongPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) notFound();
  const song = await getSongById(numId);
  if (!song) notFound();

  const action = updateSong.bind(null, numId);
  return (
    <div>
      <h1 className="font-display font-black uppercase text-3xl mb-8">곡 편집</h1>
      <SongForm song={song} action={action} submitLabel="저장" />
    </div>
  );
}
