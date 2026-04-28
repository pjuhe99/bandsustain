import Link from "next/link";
import Image from "next/image";
import { getAllSongsForAdmin } from "@/lib/songs";
import PublishedToggle from "@/components/admin/PublishedToggle";
import { togglePublishedSong } from "./actions";

export const dynamic = "force-dynamic";

export default async function SongsListPage() {
  const songs = await getAllSongsForAdmin();
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display font-black uppercase text-3xl">Songs</h1>
        <Link
          href="/admin/songs/new"
          className="px-5 py-2 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] hover:bg-transparent hover:text-[var(--color-text)] transition-colors"
        >
          + 새로 추가
        </Link>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
        <thead className="text-left text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
          <tr>
            <th className="py-2 w-16">아트워크</th>
            <th className="py-2">제목</th>
            <th className="py-2 w-32">카테고리</th>
            <th className="py-2 w-32">발매일</th>
            <th className="py-2 w-24">공개</th>
            <th className="py-2 w-20 text-right">동작</th>
          </tr>
        </thead>
        <tbody>
          {songs.map((s) => (
            <tr key={s.id} className="border-b border-[var(--color-border)]">
              <td className="py-3">
                <div className="relative w-12 h-12 bg-[var(--color-bg-muted)]">
                  <Image src={s.artworkUrl} alt={s.title} fill className="object-cover" sizes="48px" />
                </div>
              </td>
              <td className="py-3 font-medium">{s.title}</td>
              <td className="py-3 text-[var(--color-text-muted)]">{s.category}</td>
              <td className="py-3 text-[var(--color-text-muted)] tabular-nums">
                {s.releasedAt.toISOString().slice(0, 10)}
              </td>
              <td className="py-3">
                <PublishedToggle
                  published={s.published}
                  toggleAction={async () => {
                    "use server";
                    await togglePublishedSong(s.id);
                  }}
                />
              </td>
              <td className="py-3 text-right">
                <Link href={`/admin/songs/${s.id}`} className="px-2 py-1 text-xs border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-muted)]">편집</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  );
}
