"use client";
import { useTransition } from "react";

export default function ConfirmActionButton({
  action,
  label,
  confirm,
}: {
  action: () => Promise<void>;
  label: string;
  confirm: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (window.confirm(confirm)) startTransition(() => action());
      }}
      className="px-2 py-1 text-xs border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-muted)] disabled:opacity-50"
    >
      {label}
    </button>
  );
}
