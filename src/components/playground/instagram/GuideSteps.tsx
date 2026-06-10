"use client";
import { useState } from "react";
import Image from "next/image";
import { buttonClasses } from "@/components/Button";

type GuideImage = { src: string; width: number; height: number; alt: string };

type GuideStep = {
  emoji: string; // 이미지 없을 때의 폴백
  title: string;
  lines: string[];
  note?: string;
  link?: { label: string; href: string };
  images?: GuideImage[]; // 같은 스텝 내 표시 순서대로
};

const IMG_BASE = "/playground/instagram/guide";

const STEPS: GuideStep[] = [
  {
    emoji: "1️⃣",
    title: "계정 센터 열기",
    lines: [
      "인스타그램 앱에서 내 프로필을 연 뒤",
      "우측 상단 메뉴 → 설정 및 활동 → 계정 센터로 이동해 주세요.",
    ],
    link: { label: "계정 센터 바로가기", href: "https://accountscenter.instagram.com/" },
    note: "버튼이 동작하지 않으면 인스타그램 앱에서 직접 이동해 주세요.",
    images: [
      {
        src: `${IMG_BASE}/step1-1.webp`,
        width: 1088,
        height: 906,
        alt: "설정 및 활동 화면에서 계정 센터 선택",
      },
    ],
  },
  {
    emoji: "2️⃣",
    title: "내 정보 및 권한 선택",
    lines: ["계정 센터에서", "'내 정보 및 권한' → '내 정보 내보내기'를 선택해 주세요."],
    note: "인스타그램 로그인 화면이 표시될 수 있어요.",
    images: [
      {
        src: `${IMG_BASE}/step2-1.webp`,
        width: 1088,
        height: 1547,
        alt: "계정 센터에서 내 정보 및 권한 선택",
      },
      {
        src: `${IMG_BASE}/step2-2.webp`,
        width: 1088,
        height: 1041,
        alt: "내 정보 및 권한에서 내 정보 내보내기 선택",
      },
    ],
  },
  {
    emoji: "3️⃣",
    title: "기기로 내보내기",
    lines: [
      "'내보내기 만들기'를 누른 뒤 분석할 인스타그램 계정을 선택하고",
      "'기기로 내보내기'를 선택해 주세요.",
    ],
    note: "외부 서비스가 아니라 반드시 내 기기로 내려받아 주세요.",
    images: [
      {
        src: `${IMG_BASE}/step3-1.webp`,
        width: 1088,
        height: 994,
        alt: "내 정보 내보내기에서 내보내기 만들기 선택",
      },
      {
        src: `${IMG_BASE}/step3-2.webp`,
        width: 1088,
        height: 973,
        alt: "기기로 내보내기 선택",
      },
    ],
  },
  {
    emoji: "4️⃣",
    title: "필요한 정보만 선택",
    lines: [
      "정보 맞춤 설정에서 '팔로워 및 팔로잉'만 선택해 주세요.",
      "기간은 '전체 기간', 형식은 'HTML'로 설정해 주세요.",
    ],
    note: "JSON이 아니라 HTML 형식으로 내려받아 주세요. 미디어 품질은 기본값이면 충분해요.",
    images: [
      {
        src: `${IMG_BASE}/step4-1.webp`,
        width: 1080,
        height: 2423,
        alt: "내보내기 확인 화면 — 팔로워 및 팔로잉, 전체 기간, HTML 설정 후 내보내기 시작",
      },
    ],
  },
  {
    emoji: "5️⃣",
    title: "파일 내려받기",
    lines: [
      "인스타그램에서 파일 준비가 끝나면 알림이나 이메일이 도착합니다.",
      "파일을 기기에 내려받은 뒤 압축을 풀지 말고 ZIP 파일 그대로 업로드해 주세요.",
    ],
    note: "파일 준비에 수 분 이상 걸릴 수 있어요.",
    images: [
      {
        src: `${IMG_BASE}/step5-1.webp`,
        width: 1080,
        height: 1972,
        alt: "내 정보 내보내기의 다운로드 가능 목록에서 다운로드 선택",
      },
    ],
  },
];

export default function GuideSteps(props: { onDone: () => void; onBackToIntro: () => void }) {
  const [idx, setIdx] = useState(0);
  const step = STEPS[idx];
  const isLast = idx === STEPS.length - 1;

  return (
    <div className="space-y-6">
      <div className="h-1 w-full bg-[var(--color-bg-muted)]">
        <div
          className="h-1 bg-[var(--color-accent)] transition-all"
          style={{ width: `${((idx + 1) / STEPS.length) * 100}%` }}
        />
      </div>
      <p className="text-xs uppercase tracking-widest text-[var(--color-text-muted)]">
        STEP {idx + 1} / {STEPS.length}
      </p>

      <div className="space-y-4 border border-[var(--color-border)] p-6 text-center">
        {!step.images?.length && (
          <p className="text-5xl" aria-hidden>
            {step.emoji}
          </p>
        )}
        <h2 className="font-display text-2xl md:text-3xl font-black">{step.title}</h2>
        {step.lines.map((l) => (
          <p key={l} className="text-sm text-[var(--color-text-muted)]">
            {l}
          </p>
        ))}
        {step.images?.map((img) => (
          <Image
            key={img.src}
            src={img.src}
            width={img.width}
            height={img.height}
            alt={img.alt}
            className="mx-auto w-full max-w-sm rounded border border-[var(--color-border)]"
            sizes="(max-width: 768px) 100vw, 384px"
          />
        ))}
        {step.link && (
          <a
            href={step.link.href}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClasses("secondary", "w-full")}
          >
            {step.link.label}
          </a>
        )}
        {step.note && <p className="text-xs text-[var(--color-text-muted)]">{step.note}</p>}
        <p className="text-xs text-[var(--color-text-muted)]">
          인스타그램 앱 버전에 따라 메뉴 이름이나 위치가 조금 다를 수 있어요.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          className={buttonClasses("secondary")}
          onClick={() => (idx === 0 ? props.onBackToIntro() : setIdx(idx - 1))}
        >
          뒤로
        </button>
        <button
          type="button"
          className="text-sm text-[var(--color-text-muted)] underline underline-offset-4"
          onClick={props.onDone}
        >
          건너뛰기
        </button>
        <button
          type="button"
          className={buttonClasses("accent")}
          onClick={() => (isLast ? props.onDone() : setIdx(idx + 1))}
        >
          {isLast ? "업로드로" : "다음"}
        </button>
      </div>
    </div>
  );
}
