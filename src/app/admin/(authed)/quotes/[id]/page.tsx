import { notFound } from "next/navigation";
import { getQuoteById } from "@/lib/quotes";
import QuoteForm from "@/components/admin/QuoteForm";
import { updateQuote } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditQuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) notFound();
  const quote = await getQuoteById(numId);
  if (!quote) notFound();

  const action = updateQuote.bind(null, numId);
  return (
    <div>
      <h1 className="font-display font-black uppercase text-3xl mb-8">인용문 편집</h1>
      <QuoteForm quote={quote} action={action} submitLabel="저장" />
    </div>
  );
}
