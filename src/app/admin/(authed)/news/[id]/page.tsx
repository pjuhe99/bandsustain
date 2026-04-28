import { notFound } from "next/navigation";
import { getNewsById } from "@/lib/news";
import NewsForm from "@/components/admin/NewsForm";
import { updateNews } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditNewsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) notFound();
  const item = await getNewsById(numId);
  if (!item) notFound();

  const action = updateNews.bind(null, numId);
  return (
    <div>
      <h1 className="font-display font-black uppercase text-3xl mb-8">글 편집</h1>
      <NewsForm item={item} action={action} submitLabel="저장" />
    </div>
  );
}
