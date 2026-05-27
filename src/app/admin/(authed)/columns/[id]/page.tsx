import { notFound } from "next/navigation";
import { getPostByIdForAdmin, getAllTopicsForAdmin } from "@/lib/columns";
import ColumnForm from "@/components/admin/ColumnForm";
import { updatePost } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditColumnPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) notFound();
  const [post, topics] = await Promise.all([
    getPostByIdForAdmin(numId),
    getAllTopicsForAdmin(),
  ]);
  if (!post) notFound();
  const action = updatePost.bind(null, numId);
  return (
    <div>
      <h1 className="font-display font-black uppercase text-3xl mb-8">글 편집</h1>
      <ColumnForm post={post} topics={topics} action={action} submitLabel="저장" />
    </div>
  );
}
