import LiveForm from "@/components/admin/LiveForm";
import { createLive } from "../actions";

export const dynamic = "force-dynamic";

export default function NewLiveEventPage() {
  return (
    <div>
      <h1 className="font-display font-black uppercase text-3xl mb-8">새 공연 등록</h1>
      <LiveForm action={createLive} submitLabel="저장" />
    </div>
  );
}
