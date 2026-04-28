"use client";
import { useTransition } from "react";

export default function PublishedToggle({
  published,
  toggleAction,
}: {
  published: boolean;
  toggleAction: () => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => toggleAction())}
      className={
        "px-3 py-1 text-xs uppercase tracking-wider border " +
        (published
          ? "bg-[var(--color-text)] text-[var(--color-bg)] border-[var(--color-text)]"
          : "bg-transparent text-[var(--color-text-muted)] border-[var(--color-border)]")
      }
    >
      {published ? "공개" : "비공개"}
    </button>
  );
}
