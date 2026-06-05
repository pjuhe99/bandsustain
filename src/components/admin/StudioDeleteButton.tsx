"use client";

export default function StudioDeleteButton({ name, action }: { name: string; action: () => Promise<void> }) {
  return (
    <form action={action} onSubmit={(e) => { if (!confirm(`'${name}' 합주실을 삭제할까요? 방 정보도 함께 삭제됩니다.`)) e.preventDefault(); }} className="inline">
      <button type="submit" className="px-2 py-1 text-xs border border-red-300 text-red-600 hover:bg-red-50">삭제</button>
    </form>
  );
}
