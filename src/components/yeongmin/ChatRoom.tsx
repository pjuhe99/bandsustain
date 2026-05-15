"use client";

import { useEffect, useRef, useState } from "react";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";

type Msg = { role: "user" | "assistant"; content: string };

type ChatResponse = {
  reply: string;
  sessionRemaining: number;
  dailyLimitReached: boolean;
  sessionLimitReached: boolean;
};

const INITIAL_GREETING: Msg = {
  role: "assistant",
  content:
    "아\n뭐 물어보고 싶은 거 있으면 해라\n근데 너무 진지한 건 곤란하다",
};

type Props = { profileImagePath: string | null };

export default function ChatRoom({ profileImagePath }: Props) {
  const [messages, setMessages] = useState<Msg[]>([INITIAL_GREETING]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, sending]);

  async function send() {
    const text = input.trim();
    if (!text || sending || disabled) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const res = await fetch("/api/playground/kim-yeongmin-bot/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: next.filter((m) => m.role !== "assistant" || m !== INITIAL_GREETING),
        }),
      });
      const data = (await res.json()) as ChatResponse;
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      if (data.sessionLimitReached || data.dailyLimitReached) {
        setDisabled(true);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "아\n네트워크가 잡혔다 왔다\n한 번 더 해봐" },
      ]);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-72px-72px)] md:h-[calc(100vh-72px-100px)] max-w-2xl mx-auto w-full">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 md:px-6 py-4 flex flex-col gap-3"
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
      <div className="border-t border-[var(--color-border)] px-4 md:px-6 py-3 flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={disabled ? "오늘은 여기까지" : "메시지 입력..."}
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2 text-[15px] focus:outline-none focus:ring-1 focus:ring-[var(--color-text)] disabled:opacity-50"
        />
        <button
          onClick={send}
          disabled={sending || disabled || !input.trim()}
          className="px-4 py-2 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] disabled:opacity-40 hover:bg-transparent hover:text-[var(--color-text)] transition-colors"
        >
          전송
        </button>
      </div>
    </div>
  );
}
