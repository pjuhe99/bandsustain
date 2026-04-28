import NewsForm from "@/components/admin/NewsForm";
import { createNews } from "../actions";

export const dynamic = "force-dynamic";

export default function NewNewsPage() {
  return (
    <div>
      <h1 className="font-display font-black uppercase text-3xl mb-8">새 글</h1>
      <NewsForm action={createNews} submitLabel="저장" />
    </div>
  );
}
