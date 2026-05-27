"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { buttonClasses } from "@/components/Button";
import { QUESTIONS, type SoundVector, type Track } from "@/lib/soundTaste/data";
import {
  calculateUserProfile,
  createTestResult,
  type TestResult,
} from "@/lib/soundTaste/engine";
import SoundTasteShareSheet from "./SoundTasteShareSheet";

type TestStep = "intro" | "question" | "analyzing" | "result";
type Answers = Record<string, string>; // questionId -> optionId

const SELECT_FEEDBACK_MS = 200;
const ANALYZING_MS = 1000;

// optionId -> vector 빠른 조회용 룩업 (데이터는 정적이라 모듈 로드 시 1회 구성).
const OPTION_VECTORS: Record<string, SoundVector> = {};
for (const q of QUESTIONS) {
  for (const o of q.options) OPTION_VECTORS[o.id] = o.vector;
}

function youtubeSearchUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

export default function SoundTasteTest() {
  const [step, setStep] = useState<TestStep>("intro");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  // 선택 직후 짧은 피드백을 위해 방금 고른 option 을 잠깐 기억한다.
  const [pendingOptionId, setPendingOptionId] = useState<string | null>(null);

  const lockRef = useRef(false); // 선택 피드백 동안 중복 클릭 차단
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 마지막 문항 제출 후 분석 화면을 잠깐 보여주고 결과로 전환.
  useEffect(() => {
    if (step !== "analyzing") return;
    const t = setTimeout(() => setStep("result"), ANALYZING_MS);
    return () => clearTimeout(t);
  }, [step]);

  useEffect(() => {
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, []);

  const result: TestResult | null = useMemo(() => {
    const vectors = QUESTIONS.map((q) => OPTION_VECTORS[answers[q.id]]).filter(
      (v): v is SoundVector => Boolean(v),
    );
    if (vectors.length !== QUESTIONS.length) return null;
    return createTestResult(calculateUserProfile(vectors));
  }, [answers]);

  function startTest() {
    setAnswers({});
    setCurrentIndex(0);
    setPendingOptionId(null);
    lockRef.current = false;
    setStep("question");
  }

  function handleSelect(optionId: string) {
    if (lockRef.current) return;
    lockRef.current = true;

    const question = QUESTIONS[currentIndex];
    setAnswers((prev) => ({ ...prev, [question.id]: optionId }));
    setPendingOptionId(optionId);

    advanceTimer.current = setTimeout(() => {
      setPendingOptionId(null);
      lockRef.current = false;
      setCurrentIndex((index) => {
        if (index >= QUESTIONS.length - 1) {
          setStep("analyzing");
          return index;
        }
        return index + 1;
      });
    }, SELECT_FEEDBACK_MS);
  }

  function handleBack() {
    if (lockRef.current) return;
    if (currentIndex === 0) {
      setStep("intro");
      return;
    }
    setCurrentIndex((index) => Math.max(index - 1, 0));
  }

  function restart() {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    lockRef.current = false;
    setPendingOptionId(null);
    setAnswers({});
    setCurrentIndex(0);
    setStep("intro");
  }

  if (step === "intro") return <Intro onStart={startTest} />;
  if (step === "analyzing") return <Analyzing />;
  if (step === "result" && result) return <Result result={result} onRestart={restart} />;

  return (
    <Question
      index={currentIndex}
      selectedOptionId={answers[QUESTIONS[currentIndex].id] ?? null}
      pendingOptionId={pendingOptionId}
      onSelect={handleSelect}
      onBack={handleBack}
    />
  );
}

function Intro({ onStart }: { onStart: () => void }) {
  return (
    <div className="page-fade-in max-w-2xl">
      <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-accent)] font-semibold mb-4">
        취향 실험
      </p>
      <h1 className="font-display font-black tracking-tight text-3xl md:text-5xl leading-[1.12]">
        내 귀는 어떤 밴드 사운드에 반응할까?
      </h1>
      <p className="mt-6 text-lg text-[var(--color-text-muted)] leading-relaxed break-keep">
        장르 이름 대신, 마음이 끌리는 장면과 소리를 골라보세요. 16개의 선택 끝에
        당신과 닮은 밴드 음악을 추천해드려요.
      </p>
      <p className="mt-6 inline-flex items-center gap-2 text-sm text-[var(--color-text-muted)] border border-[var(--color-border)] px-3 py-1.5">
        <span aria-hidden>⏱️</span> 약 2분 · 16문항
      </p>
      <div className="mt-10">
        <button type="button" onClick={onStart} className={buttonClasses("primary")}>
          테스트 시작하기
        </button>
      </div>
    </div>
  );
}

export function Question({
  index,
  selectedOptionId,
  pendingOptionId,
  onSelect,
  onBack,
}: {
  index: number;
  selectedOptionId: string | null;
  pendingOptionId: string | null;
  onSelect: (optionId: string) => void;
  onBack: () => void;
}) {
  const question = QUESTIONS[index];
  const total = QUESTIONS.length;
  const progress = Math.round(((index + 1) / total) * 100);

  return (
    <div key={question.id} className="page-fade-in">
      <div className="mb-8">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.1em] text-[var(--color-text-muted)] mb-2">
          <span>
            {index + 1} / {total}
          </span>
          <button
            type="button"
            onClick={onBack}
            className="underline underline-offset-4 hover:text-[var(--color-text)] transition-colors"
          >
            이전
          </button>
        </div>
        <div
          className="h-1.5 w-full bg-[var(--color-bg-muted)] overflow-hidden"
          role="progressbar"
          aria-valuenow={index + 1}
          aria-valuemin={1}
          aria-valuemax={total}
        >
          <div
            className="h-full bg-[var(--color-accent)] transition-[width] duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <h2 className="font-display font-bold text-2xl md:text-3xl leading-snug break-keep mb-8">
        {question.prompt}
      </h2>

      <ul className="flex flex-col gap-3">
        {question.options.map((option) => {
          const isSelected = option.id === selectedOptionId;
          const isPending = option.id === pendingOptionId;
          return (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => onSelect(option.id)}
                aria-pressed={isSelected}
                className={[
                  "w-full text-left flex items-start gap-3 border px-4 py-4 md:px-5 md:py-4 transition-all duration-150",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-2",
                  isPending
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-ink)] scale-[0.99]"
                    : isSelected
                      ? "border-[var(--color-text)] bg-[var(--color-bg-muted)]"
                      : "border-[var(--color-border)] hover:border-[var(--color-text)] hover:bg-[var(--color-bg-muted)] active:scale-[0.99]",
                ].join(" ")}
              >
                {option.emoji && (
                  <span className="text-xl leading-none shrink-0" aria-hidden>
                    {option.emoji}
                  </span>
                )}
                <span className="text-base md:text-lg leading-relaxed break-keep">
                  {option.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Analyzing() {
  return (
    <div className="page-fade-in min-h-[50vh] flex flex-col items-center justify-center text-center">
      <div className="flex items-center gap-2 mb-6" aria-hidden>
        <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-accent)] animate-bounce [animation-delay:-0.3s]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-accent)] animate-bounce [animation-delay:-0.15s]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-accent)] animate-bounce" />
      </div>
      <p className="font-display font-bold text-xl md:text-2xl">
        당신의 사운드를 조율하고 있어요...
      </p>
      <p className="mt-3 text-[var(--color-text-muted)]">
        기타 톤과 리듬, 감정의 온도를 살펴보는 중
      </p>
    </div>
  );
}

export function Result({
  result,
  onRestart,
}: {
  result: TestResult;
  onRestart: () => void;
}) {
  const { mainGenre, subGenres, distantGenre, tags, recommendedTracks, discoveryTracks } =
    result;
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <div className="page-fade-in">
      {/* 1~2. 결과 타입명 + 설명 + 취향 태그 (장르 gradient 를 포인트로) */}
      <div className="overflow-hidden border border-[var(--color-border)]">
        <div
          className={`bg-gradient-to-br ${mainGenre.visual.gradient} px-6 py-10 md:py-12 flex flex-col items-center text-center`}
        >
          <span className="text-5xl md:text-6xl drop-shadow-sm" aria-hidden>
            {mainGenre.visual.icon}
          </span>
        </div>
        <div className="px-6 py-8 md:px-8 md:py-10">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-muted)] font-semibold mb-3">
            당신의 사운드 타입
          </p>
          <h1 className="font-display font-black text-2xl md:text-4xl leading-tight break-keep">
            {mainGenre.resultTitle}
          </h1>
          <p className="mt-4 text-base md:text-lg text-[var(--color-text-muted)] leading-relaxed break-keep">
            {mainGenre.description}
          </p>
          {tags.length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <li
                  key={tag}
                  className="text-sm border border-[var(--color-text)] px-3 py-1 font-medium"
                >
                  #{tag}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 3. 가장 잘 맞는 사운드 (메인 장르) */}
      <section className="mt-12">
        <SectionLabel>당신에게 가장 가까운 사운드</SectionLabel>
        <div className="flex items-center gap-4 border border-[var(--color-text)] px-5 py-5 mt-3">
          <span
            className={`shrink-0 w-12 h-12 flex items-center justify-center text-2xl bg-gradient-to-br ${mainGenre.visual.gradient}`}
            aria-hidden
          >
            {mainGenre.visual.icon}
          </span>
          <span className="font-display font-bold text-xl md:text-2xl break-keep">
            {mainGenre.name}
          </span>
        </div>
      </section>

      {/* 4. 함께 잘 맞는 서브 장르 2개 */}
      <section className="mt-8">
        <SectionLabel>함께 잘 맞을 가능성이 높은 장르</SectionLabel>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          {subGenres.map((genre) => (
            <li
              key={genre.id}
              className="flex items-center gap-3 border border-[var(--color-border)] px-4 py-4"
            >
              <span
                className={`shrink-0 w-9 h-9 flex items-center justify-center text-lg bg-gradient-to-br ${genre.visual.gradient}`}
                aria-hidden
              >
                {genre.visual.icon}
              </span>
              <span className="font-medium break-keep">{genre.name}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 5. 추천 플레이리스트 3곡 */}
      <section className="mt-12">
        <SectionLabel>당신의 귀를 위한 추천곡</SectionLabel>
        <ul className="flex flex-col gap-3 mt-3">
          {recommendedTracks.map((track, i) => (
            <TrackCard key={track.id} track={track} index={i + 1} />
          ))}
        </ul>
      </section>

      {/* 6. 반대편 사운드 (거리 있는 장르) — 메인보다 차분한 톤 */}
      <section className="mt-12 border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-5 py-6 md:px-6">
        <SectionLabel>반대편 사운드도 궁금하다면</SectionLabel>
        <p className="mt-2 text-sm text-[var(--color-text-muted)] leading-relaxed break-keep">
          지금의 취향과는 조금 거리가 있지만, 새롭게 들어보면 의외로 재미있을지도
          몰라요.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <span className="shrink-0 w-9 h-9 flex items-center justify-center text-lg border border-[var(--color-border)]" aria-hidden>
            {distantGenre.visual.icon}
          </span>
          <span className="font-display font-bold text-lg break-keep">
            {distantGenre.name}
          </span>
        </div>
        <ul className="flex flex-col gap-3 mt-4">
          {discoveryTracks.map((track) => (
            <TrackCard key={track.id} track={track} muted />
          ))}
        </ul>
      </section>

      {/* 7. 공유 / 다시 테스트하기 */}
      <div className="mt-12 flex flex-col sm:flex-row gap-3 justify-center">
        <button
          type="button"
          onClick={() => setShareOpen(true)}
          className={buttonClasses("accent")}
        >
          결과 공유하기
        </button>
        <button type="button" onClick={onRestart} className={buttonClasses("secondary")}>
          다시 테스트하기
        </button>
      </div>

      {shareOpen && (
        <SoundTasteShareSheet result={result} onClose={() => setShareOpen(false)} />
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-muted)] font-semibold">
      {children}
    </h2>
  );
}

function TrackCard({
  track,
  index,
  muted = false,
}: {
  track: Track;
  index?: number;
  muted?: boolean;
}) {
  return (
    <li
      className={`flex items-start gap-3 border px-4 py-4 ${
        muted
          ? "border-[var(--color-border)] bg-[var(--color-bg)]"
          : "border-[var(--color-border)]"
      }`}
    >
      {typeof index === "number" && (
        <span className="shrink-0 font-display font-black text-xl text-[var(--color-text-muted)] w-6 text-center">
          {index}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="font-bold break-keep">
          {track.artist}
          <span className="text-[var(--color-text-muted)] font-normal"> — {track.title}</span>
        </p>
        <p className="mt-1 text-sm text-[var(--color-text-muted)] leading-relaxed break-keep">
          {track.reason}
        </p>
      </div>
      <a
        href={youtubeSearchUrl(track.searchQuery)}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 self-center text-xs whitespace-nowrap border border-[var(--color-border)] px-3 py-1.5 hover:border-[var(--color-text)] hover:bg-[var(--color-bg-muted)] transition-colors"
      >
        들어보기 ↗
      </a>
    </li>
  );
}
