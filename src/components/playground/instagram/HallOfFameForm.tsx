"use client";
import { useState } from "react";
import Link from "next/link";
import { buttonClasses } from "@/components/Button";
import { validateNickname } from "@/lib/playground/instagram/nickname";
import {
  getOrCreateBrowserToken,
  isRegisteredLocally,
  markRegisteredLocally,
} from "@/lib/playground/instagram/history";

export default function HallOfFameForm({ followedAtIso }: { followedAtIso: string }) {
  const followDate = followedAtIso.slice(0, 10); // "YYYY-MM-DD"
  const [nickname, setNickname] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(
    isRegisteredLocally(followDate) ? "이 브라우저에서 이미 등록한 기록이 있어요." : null,
  );
  const [done, setDone] = useState(false);

  const submit = async () => {
    const nick = validateNickname(nickname);
    if (!nick.ok) {
      setMessage(nick.reason);
      return;
    }
    if (!agreed) {
      setMessage("개인정보 및 운영 정책에 동의해 주세요.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/playground/instagram-follow/hall-of-fame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: nick.value,
          sustainFollowedAt: followDate,
          browserToken: getOrCreateBrowserToken(),
          agreedToPolicy: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        markRegisteredLocally(followDate);
        setDone(true);
        setMessage("찐팬 랭킹에 등록됐어요!");
      } else {
        setMessage(data.message ?? "등록에 실패했어요. 잠시 후 다시 시도해 주세요.");
      }
    } catch {
      setMessage("네트워크 오류가 발생했어요. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  if (done)
    return (
      <div className="space-y-2">
        <p role="status" className="text-sm font-semibold">
          {message}
        </p>
        <Link href="/playground/instagram-follow" className={buttonClasses("secondary", "w-full")}>
          찐팬 랭킹에서 내 순위 보기
        </Link>
      </div>
    );

  return (
    <div className="space-y-3 border-t border-[var(--color-border)] pt-3">
      <label className="block text-sm">
        찐팬 랭킹에 표시할 닉네임
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={20}
          placeholder="2~20자"
          className="mt-1 w-full border border-[var(--color-border)] px-3 py-2 text-sm"
        />
      </label>
      <p className="text-xs text-[var(--color-text-muted)]">
        닉네임은 직접 입력한 표시명이며 인스타그램 사용자명 인증값이 아니에요.
      </p>
      <label className="flex items-start gap-2 text-xs">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5" />
        <span>
          닉네임·팔로우 시작일이 서버에 저장되고 찐팬 랭킹에 공개되는 것에 동의해요. 반복 등록 방지를 위해
          IP를 비식별 해시로만 저장해요.
        </span>
      </label>
      {message && (
        <p role="alert" className="text-xs text-[var(--color-text-muted)]">
          {message}
        </p>
      )}
      <button type="button" className={buttonClasses("accent", "w-full")} onClick={submit} disabled={busy}>
        {busy ? "등록 중…" : "등록하기"}
      </button>
      <p className="text-xs text-[var(--color-text-muted)]">
        찐팬 랭킹 기록은 사용자가 제출한 인스타그램 내보내기 파일을 기준으로 등록됩니다.
      </p>
    </div>
  );
}
