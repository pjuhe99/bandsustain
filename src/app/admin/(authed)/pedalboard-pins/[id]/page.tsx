import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAllMembersForAdmin } from "@/lib/members";
import { getMemberPinByIdForAdmin } from "@/lib/playground/memberPins";
import { updatePinAction, deletePinAction } from "../actions";
import { EditPinForm } from "./EditPinForm";

export const dynamic = "force-dynamic";

export default async function EditPedalboardPinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pinId = Number(id);
  if (!Number.isFinite(pinId) || pinId <= 0) notFound();
  const [pin, members] = await Promise.all([
    getMemberPinByIdForAdmin(pinId),
    getAllMembersForAdmin(),
  ]);
  if (!pin) notFound();

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display font-black uppercase text-3xl">핀 편집</h1>
        <Link href="/admin/pedalboard-pins" className="text-sm underline">← 목록</Link>
      </div>

      <section className="mb-8 border border-[var(--color-border)] p-4">
        <h2 className="font-semibold text-sm uppercase tracking-wider mb-3 text-[var(--color-text-muted)]">원본 layout</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-y-2 text-sm">
          <div><dt className="inline text-[var(--color-text-muted)]">layout id: </dt><dd className="inline">#{pin.layout_id}</dd></div>
          <div><dt className="inline text-[var(--color-text-muted)]">제목: </dt><dd className="inline">{pin.layout_title}</dd></div>
          <div><dt className="inline text-[var(--color-text-muted)]">보드: </dt><dd className="inline">{pin.board_brand} {pin.board_name}</dd></div>
          <div><dt className="inline text-[var(--color-text-muted)]">share: </dt>
            <dd className="inline"><Link href={`/playground/p/${pin.share_token}`} target="_blank" className="underline">열기</Link></dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">layout id 는 변경할 수 없습니다. 다른 layout을 핀하려면 이 핀을 삭제하고 새로 등록하세요.</p>
      </section>

      <EditPinForm pin={pin} members={members} updateAction={updatePinAction} />

      <section className="mt-12 border-t border-[var(--color-border)] pt-6">
        <form action={async () => {
          "use server";
          await deletePinAction(pin.pin_id);
          redirect("/admin/pedalboard-pins");
        }}>
          <button type="submit" className="px-4 py-2 text-sm font-semibold uppercase tracking-wider border border-red-700 text-red-700 hover:bg-red-700 hover:text-white transition-colors">
            이 핀 삭제
          </button>
        </form>
      </section>
    </div>
  );
}
