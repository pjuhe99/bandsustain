import QuoteForm from "@/components/admin/QuoteForm";
import { createQuote } from "../actions";

export const dynamic = "force-dynamic";

export default function NewQuotePage() {
  return (
    <div>
      <h1 className="font-display font-black uppercase text-3xl mb-8">새 인용문</h1>
      <QuoteForm action={createQuote} submitLabel="저장" />
    </div>
  );
}
