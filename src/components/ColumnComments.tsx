"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type PublicComment = {
  id: number;
  nickname: string;
  ipMasked: string;
  body: string;
  when: string;
  hasPassword: boolean;
};

export default function ColumnComments({
  postId,
  comments,
}: {
  postId: number;
  comments: PublicComment[];
}) {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [body, setBody] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/columns/${postId}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nickname, password, body, website }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "등록에 실패했습니다.");
        return;
      }
      setNickname("");
      setPassword("");
      setBody("");
      router.refresh();
    } catch {
      setError("등록에 실패했습니다.");
    } finally {
      setPending(false);
    }
  }

  async function remove(id: number) {
    const pw = window.prompt("댓글 비밀번호를 입력하세요");
    if (pw === null) return;
    const res = await fetch(`/api/columns/comments/${id}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      window.alert(data.error ?? "삭제에 실패했습니다.");
      return;
    }
    router.refresh();
  }

  return (
    <section className="mt-16 md:mt-20 pt-10 border-t border-[var(--color-border)]">
      <h2 className="font-display font-bold text-xl uppercase tracking-tight mb-6">
        댓글 <span className="text-[var(--color-text-muted)]">{comments.length}</span>
      </h2>

      <ul className="flex flex-col divide-y divide-[var(--color-border)] mb-10">
        {comments.length === 0 && (
          <li className="py-6 text-[var(--color-text-muted)] text-sm">첫 댓글을 남겨보세요.</li>
        )}
        {comments.map((c) => (
          <li key={c.id} className="py-4">
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] mb-1">
              <span className="font-medium text-[var(--color-text)]">{c.nickname}</span>
              <span>({c.ipMasked})</span>
              <span>·</span>
              <span>{c.when}</span>
              {c.hasPassword && (
                <button
                  type="button"
                  onClick={() => remove(c.id)}
                  className="ml-auto underline underline-offset-2 hover:text-[var(--color-text)]"
                >
                  삭제
                </button>
              )}
            </div>
            <p className="text-sm leading-[1.6] whitespace-pre-wrap break-words">{c.body}</p>
          </li>
        ))}
      </ul>

      <form onSubmit={submit} className="flex flex-col gap-3 max-w-2xl">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="닉네임"
            maxLength={40}
            required
            className="border border-[var(--color-border-strong)] px-3 py-2 bg-[var(--color-bg)] text-sm sm:w-40"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호(선택)"
            type="password"
            maxLength={72}
            className="border border-[var(--color-border-strong)] px-3 py-2 bg-[var(--color-bg)] text-sm sm:w-40"
          />
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="댓글을 입력하세요"
          rows={3}
          maxLength={1000}
          required
          className="border border-[var(--color-border-strong)] px-3 py-2 bg-[var(--color-bg)] text-sm"
        />
        {/* honeypot: hidden from humans, bots tend to fill it */}
        <input
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          name="website"
          className="hidden"
        />
        {error && <p className="text-sm text-[var(--color-accent)]">{error}</p>}
        <div>
          <button
            type="submit"
            disabled={pending}
            className="px-6 py-3 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] hover:bg-transparent hover:text-[var(--color-text)] transition-colors disabled:opacity-50"
          >
            {pending ? "등록 중…" : "댓글 등록"}
          </button>
        </div>
      </form>
    </section>
  );
}
