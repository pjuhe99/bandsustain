"use client";
import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

export default function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    {},
  );
  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="next" value={next} />
      <label className="flex flex-col gap-2 text-sm font-medium">
        <span className="uppercase tracking-wider text-[var(--color-text-muted)]">ID</span>
        <input
          name="username"
          type="text"
          autoComplete="username"
          required
          className="border border-[var(--color-border-strong)] px-4 py-3 text-base bg-[var(--color-bg)]"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        <span className="uppercase tracking-wider text-[var(--color-text-muted)]">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="border border-[var(--color-border-strong)] px-4 py-3 text-base bg-[var(--color-bg)]"
        />
      </label>
      {state.error && (
        <p className="text-sm text-[var(--color-accent)]">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 inline-flex items-center justify-center px-6 py-3 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] hover:bg-transparent hover:text-[var(--color-text)] transition-colors disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
