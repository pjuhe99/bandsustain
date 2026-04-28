import MemberForm from "@/components/admin/MemberForm";
import { createMember } from "../actions";

export const dynamic = "force-dynamic";

export default function NewMemberPage() {
  return (
    <div>
      <h1 className="font-display font-black uppercase text-3xl mb-8">새 멤버</h1>
      <MemberForm action={createMember} submitLabel="저장" />
    </div>
  );
}
