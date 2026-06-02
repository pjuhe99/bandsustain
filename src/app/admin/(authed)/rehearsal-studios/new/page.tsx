import RehearsalStudioForm from "@/components/admin/RehearsalStudioForm";
import { listRegions } from "@/lib/playground/rehearsal/regions";
import { createRehearsalStudio } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewRehearsalStudioPage() {
  const regions = await listRegions();
  return (
    <div>
      <h1 className="font-display font-black uppercase text-3xl mb-8">새 합주실</h1>
      <RehearsalStudioForm
        regions={regions.map((r) => ({ id: r.id, displayName: r.displayName }))}
        action={createRehearsalStudio} submitLabel="저장" />
    </div>
  );
}
