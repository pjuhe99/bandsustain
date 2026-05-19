"use client";

import { useEffect, useRef, useState } from "react";
import { buildUserNameContext, normalizeUserNameInput } from "@/lib/yeongminUserName";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";

type Msg = {
  role: "user" | "assistant";
  content: string;
  phase: "setup" | "chat";
};

type ChatResponse = {
  reply: string;
  sessionRemaining: number;
  dailyLimitReached: boolean;
  sessionLimitReached: boolean;
};

const INITIAL_NAME_PROMPT: Msg = {
  role: "assistant",
  phase: "setup",
  content: "이름부터 먼저 알려줘.\n편하게 부를 수 있게.",
};

type Props = { profileImagePath: string | null };

export default function ChatRoom({ profileImagePath }: Props) {
  const [messages, setMessages] = useState<Msg[]>([INITIAL_NAME_PROMPT]);
  const [userName, setUserName] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, sending]);

  function resetChat() {
    setMessages([INITIAL_NAME_PROMPT]);
    setUserName(null);
    setInput("");
    setSending(false);
    setDisabled(false);
    textareaRef.current?.focus();
  }

  async function send() {
    const text = input.trim();
    if (!text || sending || disabled) return;

    if (!userName) {
      const normalized = normalizeUserNameInput(text);
      if (!normalized) return;
      const nameContext = buildUserNameContext(normalized);
      if (!nameContext) return;

      setUserName(nameContext.preferredName);
      setMessages((prev) => [
        ...prev,
        { role: "user", phase: "setup", content: normalized },
        {
          role: "assistant",
          phase: "setup",
          content: `${nameContext.casualName}아,\n오케이.\n이제 말해봐.`,
        },
      ]);
      setInput("");
      textareaRef.current?.focus();
      return;
    }

    const next: Msg[] = [...messages, { role: "user", phase: "chat", content: text }];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const res = await fetch("/api/playground/kim-yeongmin-bot/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userName,
          messages: next
            .filter((m) => m.phase === "chat")
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = (await res.json()) as ChatResponse;
      setMessages((prev) => [...prev, { role: "assistant", phase: "chat", content: data.reply }]);
      if (data.sessionLimitReached || data.dailyLimitReached) {
        setDisabled(true);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", phase: "chat", content: "지금은 연결이 좀 꼬였네.\n한 번만 다시 말해줘." },
      ]);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  const placeholder = disabled
    ? "오늘은 여기까지."
    : userName
      ? "메시지 입력..."
      : "이름 입력...";

  return (
    <div className="mx-auto flex h-[calc(100vh-72px-72px)] w-full max-w-2xl flex-col md:h-[calc(100vh-72px-100px)]">
      <div className="flex items-center justify-end border-b border-[var(--color-border)] px-4 py-2 md:px-6">
        <button
          onClick={resetChat}
          className="border border-[var(--color-border-strong)] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-text)] transition-colors hover:bg-[var(--color-text)] hover:text-[var(--color-bg)]"
        >
          새 대화
        </button>
      </div>
      <div
        ref={scrollRef}
        className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4 md:px-6"
      >
        {messages.map((m, i) => (
          <MessageBubble
            key={i}
            role={m.role}
            content={m.content}
            profileImagePath={profileImagePath}
          />
        ))}
        {sending && <TypingIndicator profileImagePath={profileImagePath} />}
      </div>
      <div className="flex items-end gap-2 border-t border-[var(--color-border)] px-4 py-3 md:px-6">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2 text-[15px] focus:outline-none focus:ring-1 focus:ring-[var(--color-text)] disabled:opacity-50"
        />
        <button
          onClick={() => void send()}
          disabled={sending || disabled || !input.trim()}
          className="border border-[var(--color-text)] bg-[var(--color-text)] px-4 py-2 text-sm font-semibold uppercase tracking-wider text-[var(--color-bg)] transition-colors hover:bg-transparent hover:text-[var(--color-text)] disabled:opacity-40"
        >
          전송
        </button>
      </div>
    </div>
  );
}
