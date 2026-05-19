"use client";

import { useEffect, useRef, useState } from "react";
import { remainingDelayMs } from "@/lib/yeongminDelay";
import { shouldShowNameModal } from "@/lib/yeongminChatState";
import { buildUserNameContext, normalizeUserNameInput } from "@/lib/yeongminUserName";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";

type Msg = {
  role: "user" | "assistant";
  content: string;
};

type ChatResponse = {
  reply: string;
  sessionRemaining: number;
  dailyLimitReached: boolean;
  sessionLimitReached: boolean;
  isFallback: boolean;
};

const INITIAL_CHAT_PROMPT: Msg = {
  role: "assistant",
  content: "아\n뭐 물어보고 싶은 거 있으면 해라\n근데 너무 진지한 건 곤란하다",
};

const FALLBACK_TYPING_MS = 2000;

type Props = { profileImagePath: string | null };

export default function ChatRoom({ profileImagePath }: Props) {
  const [messages, setMessages] = useState<Msg[]>([INITIAL_CHAT_PROMPT]);
  const [userName, setUserName] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [nameError, setNameError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, sending]);

  useEffect(() => {
    if (shouldShowNameModal(userName)) {
      nameInputRef.current?.focus();
      return;
    }
    textareaRef.current?.focus();
  }, [userName]);

  function resetChat() {
    setMessages([INITIAL_CHAT_PROMPT]);
    setUserName(null);
    setNameInput("");
    setInput("");
    setSending(false);
    setDisabled(false);
    setNameError("");
  }

  function submitName() {
    const normalized = normalizeUserNameInput(nameInput);
    if (!normalized) {
      setNameError("이름을 짧게 다시 입력해줘.");
      return;
    }
    const nameContext = buildUserNameContext(normalized);
    if (!nameContext) {
      setNameError("이름을 다시 입력해줘.");
      return;
    }
    setUserName(nameContext.preferredName);
    setNameInput("");
    setNameError("");
  }

  async function send() {
    const text = input.trim();
    if (!text || sending || disabled || shouldShowNameModal(userName)) return;

    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setSending(true);
    const startedAt = Date.now();
    try {
      const res = await fetch("/api/playground/kim-yeongmin-bot/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userName,
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = (await res.json()) as ChatResponse;
      if (data.isFallback) {
        const waitMs = remainingDelayMs(Date.now() - startedAt, FALLBACK_TYPING_MS);
        if (waitMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, waitMs));
        }
      }
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      if (data.sessionLimitReached || data.dailyLimitReached) {
        setDisabled(true);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "지금은 연결이 좀 꼬였네.\n한 번만 다시 말해줘." },
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

  function onNameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      submitName();
    }
  }

  const modalOpen = shouldShowNameModal(userName);

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
          placeholder={disabled ? "오늘은 여기까지." : "메시지 입력..."}
          disabled={disabled || modalOpen}
          rows={1}
          className="flex-1 resize-none border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2 text-[15px] focus:outline-none focus:ring-1 focus:ring-[var(--color-text)] disabled:opacity-50"
        />
        <button
          onClick={() => void send()}
          disabled={sending || disabled || modalOpen || !input.trim()}
          className="border border-[var(--color-text)] bg-[var(--color-text)] px-4 py-2 text-sm font-semibold uppercase tracking-wider text-[var(--color-bg)] transition-colors hover:bg-transparent hover:text-[var(--color-text)] disabled:opacity-40"
        >
          전송
        </button>
      </div>

      {modalOpen && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
            <h2 className="font-display text-lg font-bold">이름 먼저 알려줘</h2>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              대화 중에 자연스럽게 부를 수 있게, 편한 이름 하나만 적어줘.
            </p>
            <input
              ref={nameInputRef}
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={onNameKeyDown}
              placeholder="예: 김예빈 / 예빈"
              className="mt-4 w-full border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-text)]"
            />
            {nameError && <p className="mt-2 text-sm text-red-600">{nameError}</p>}
            <div className="mt-4 flex justify-end">
              <button
                onClick={submitName}
                disabled={!nameInput.trim()}
                className="border border-[var(--color-text)] bg-[var(--color-text)] px-4 py-2 text-sm font-semibold uppercase tracking-wider text-[var(--color-bg)] transition-colors hover:bg-transparent hover:text-[var(--color-text)] disabled:opacity-40"
              >
                시작
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
