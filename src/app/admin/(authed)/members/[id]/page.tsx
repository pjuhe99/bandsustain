import { notFound } from "next/navigation";
import { getMemberById } from "@/lib/members";
import MemberForm from "@/components/admin/MemberForm";
import { updateMember } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) notFound();
  const member = await getMemberById(numId);
  if (!member) notFound();

  const action = updateMember.bind(null, numId);
  return (
    <div>
      <h1 className="font-display font-black uppercase text-3xl mb-8">멤버 편집</h1>
      <MemberForm member={member} action={action} submitLabel="저장" />
    </div>
  );
}
