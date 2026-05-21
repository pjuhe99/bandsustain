import Link from "next/link";
import Image from "next/image";
import { getAllMembersForAdmin } from "@/lib/members";
import { getAllMemberPinsForAdmin } from "@/lib/playground/memberPins";
import { createPinAction, deletePinAction, swapPinOrderAction, lookupLayoutAction } from "./actions";
import { NewPinForm } from "./NewPinForm";

export const dynamic = "force-dynamic";

export default async function PedalboardPinsListPage() {
  const [pins, members] = await Promise.all([
    getAllMemberPinsForAdmin(),
    getAllMembersForAdmin(),
  ]);
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display font-black uppercase text-3xl">Pedalboard Pins</h1>
      </div>

      <section className="mb-10 border border-[var(--color-border)] p-4 md:p-6">
        <h2 className="font-semibold text-lg mb-4">신규 등록</h2>
        <NewPinForm
          members={members}
          createAction={createPinAction}
          lookupAction={lookupLayoutAction}
        />
      </section>

      <section>
        <h2 className="font-semibold text-lg mb-4">목록 ({pins.length}개, pin_order 오름차순)</h2>
        <div className="overflow-x-auto"><table className="w-full min-w-[960px] text-sm">
          <thead className="text-left text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
            <tr>
              <th className="py-2 w-16">정렬</th>
              <th className="py-2 w-16">사진</th>
              <th className="py-2 w-40">멤버</th>
              <th className="py-2 w-20">layout</th>
              <th className="py-2 w-48">보드</th>
              <th className="py-2">제목</th>
              <th className="py-2">캡션</th>
              <th className="py-2 w-32 text-right">동작</th>
            </tr>
          </thead>
          <tbody>
            {pins.map((p, i) => {
              const isFirst = i === 0;
              const isLast = i === pins.length - 1;
              const titleShown = p.override_title?.trim() || p.layout_title;
              return (
                <tr key={p.pin_id} className="border-b border-[var(--color-border)]">
                  <td className="py-3">
                    <form className="inline-flex items-center gap-1" action={async () => {
                      "use server";
                      await swapPinOrderAction(p.pin_id, "up");
                    }}>
                      <button type="submit" disabled={isFirst} className="px-2 py-1 text-xs border border-[var(--color-border)] disabled:opacity-30">▲</button>
                    </form>
                    <form className="inline-flex items-center gap-1 ml-1" action={async () => {
                      "use server";
                      await swapPinOrderAction(p.pin_id, "down");
                    }}>
                      <button type="submit" disabled={isLast} className="px-2 py-1 text-xs border border-[var(--color-border)] disabled:opacity-30">▼</button>
                    </form>
                  </td>
                  <td className="py-3">
                    <div className="relative w-12 h-12 bg-[var(--color-bg-muted)]">
                      <Image src={p.member_photo_url} alt={p.member_name_kr} fill className="object-cover" sizes="48px" />
                    </div>
                  </td>
                  <td className="py-3">
                    <div className="font-medium">{p.member_name_kr}{!p.member_published && <span className="ml-1 text-xs text-[var(--color-text-muted)]">(비공개)</span>}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">{p.member_position}</div>
                  </td>
                  <td className="py-3 tabular-nums">
                    <Link href={`/playground/p/${p.share_token}`} target="_blank" className="underline">
                      #{p.layout_id}
                    </Link>
                  </td>
                  <td className="py-3 text-[var(--color-text-muted)]">{p.board_brand} {p.board_name}</td>
                  <td className="py-3">{titleShown}</td>
                  <td className="py-3 text-[var(--color-text-muted)]">{p.caption ?? ""}</td>
                  <td className="py-3 text-right">
                    <Link href={`/admin/pedalboard-pins/${p.pin_id}`} className="ml-2 px-2 py-1 text-xs border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-muted)]">편집</Link>
                    <form className="inline-block ml-1" action={async () => {
                      "use server";
                      await deletePinAction(p.pin_id);
                    }}>
                      <button type="submit" className="px-2 py-1 text-xs border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-muted)]">삭제</button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {pins.length === 0 && (
              <tr><td colSpan={8} className="py-6 text-center text-[var(--color-text-muted)]">등록된 핀이 없습니다.</td></tr>
            )}
          </tbody>
        </table></div>
      </section>
    </div>
  );
}
