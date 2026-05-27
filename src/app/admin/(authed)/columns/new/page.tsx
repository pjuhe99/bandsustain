import { getAllTopicsForAdmin } from "@/lib/columns";
import ColumnForm from "@/components/admin/ColumnForm";
import { createPost } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewColumnPage() {
  const topics = await getAllTopicsForAdmin();
  return (
    <div>
      <h1 className="font-display font-black uppercase text-3xl mb-8">새 글</h1>
      <ColumnForm topics={topics} action={createPost} submitLabel="저장" />
    </div>
  );
}
