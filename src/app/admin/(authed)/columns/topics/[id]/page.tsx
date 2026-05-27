import { notFound } from "next/navigation";
import { getTopicById } from "@/lib/columns";
import { getAllMembersForAdmin } from "@/lib/members";
import TopicForm from "@/components/admin/TopicForm";
import { updateTopic } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditTopicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) notFound();
  const [topic, members] = await Promise.all([
    getTopicById(numId),
    getAllMembersForAdmin(),
  ]);
  if (!topic) notFound();
  const options = members.map((m) => ({ id: m.id, label: `${m.nameKr} (${m.nameEn})` }));
  const action = updateTopic.bind(null, numId);
  return (
    <div>
      <h1 className="font-display font-black uppercase text-3xl mb-8">주제 편집</h1>
      <TopicForm topic={topic} members={options} action={action} submitLabel="저장" />
    </div>
  );
}
