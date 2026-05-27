import { getAllMembersForAdmin } from "@/lib/members";
import TopicForm from "@/components/admin/TopicForm";
import { createTopic } from "../../actions";

export const dynamic = "force-dynamic";

export default async function NewTopicPage() {
  const members = await getAllMembersForAdmin();
  const options = members.map((m) => ({ id: m.id, label: `${m.nameKr} (${m.nameEn})` }));
  return (
    <div>
      <h1 className="font-display font-black uppercase text-3xl mb-8">새 주제</h1>
      <TopicForm members={options} action={createTopic} submitLabel="저장" />
    </div>
  );
}
