import { notFound } from "next/navigation";
import { getLiveEvent } from "@/lib/live";
import LiveForm from "@/components/admin/LiveForm";
import { updateLive } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditLiveEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) notFound();
  const item = await getLiveEvent(numId);
  if (!item) notFound();

  const action = updateLive.bind(null, numId);
  return (
    <div>
      <h1 className="font-display font-black uppercase text-3xl mb-8">공연 편집</h1>
      <LiveForm item={item} action={action} submitLabel="저장" />
    </div>
  );
}
