import { notFound } from "next/navigation";
import RehearsalStudioForm from "@/components/admin/RehearsalStudioForm";
import { getStudioById } from "@/lib/playground/rehearsal/studios";
import { listRegions } from "@/lib/playground/rehearsal/regions";
import { updateRehearsalStudio } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditRehearsalStudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) notFound();
  const [studio, regions] = await Promise.all([getStudioById(numId), listRegions()]);
  if (!studio) notFound();
  const action = updateRehearsalStudio.bind(null, numId);
  return (
    <div>
      <h1 className="font-display font-black uppercase text-3xl mb-8">합주실 편집</h1>
      <RehearsalStudioForm studio={studio}
        regions={regions.map((r) => ({ id: r.id, displayName: r.displayName }))}
        action={action} submitLabel="저장" />
    </div>
  );
}
