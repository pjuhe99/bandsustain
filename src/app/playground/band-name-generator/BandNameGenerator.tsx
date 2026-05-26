"use client";

import { useEffect, useRef, useState } from "react";
import { generateBandNames } from "@/lib/bandName/generate";
import {
  defaultInput,
  languageOptions,
  moodOptions,
  sceneOptions,
  weirdnessLabels,
  weirdnessLevels,
} from "@/lib/bandName/options";
import type {
  BandNameInput,
  GeneratedBandName,
  LanguageStyle,
  Mood,
  Scene,
  Weirdness,
} from "@/lib/bandName/types";
import BandNameShareSheet from "./BandNameShareSheet";

const LOADING_MS = 2000;

const pillBase =
  "px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-2";

function pillClass(active: boolean): string {
  return active
    ? `${pillBase} border border-[var(--color-text)] bg-[var(--color-text)] text-[var(--color-bg)]`
    : `${pillBase} border border-[var(--color-text)] bg-transparent text-[var(--color-text)] hover:bg-[var(--color-bg-muted)]`;
}

// 이름 길이에 따라 카드 제목 폰트 크기를 단계적으로 조정한다. 짧은 이름은 크게,
// 긴 한글 이름은 한두 단계 줄여 카드 안에서 읽기 좋게 (임팩트는 유지).
function nameSizeClass(name: string): string {
  const len = name.length;
  if (len <= 6) return "text-3xl md:text-[2.5rem]";
  if (len <= 9) return "text-[1.7rem] md:text-[2.125rem]";
  return "text-2xl md:text-3xl";
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display font-bold text-lg md:text-xl text-[var(--color-text)] mb-4">
      {children}
    </h2>
  );
}

export default function BandNameGenerator() {
  const [scene, setScene] = useState<Scene>(defaultInput.scene);
  const [mood, setMood] = useState<Mood>(defaultInput.mood);
  const [language, setLanguage] = useState<LanguageStyle>(defaultInput.language);
  const [weirdness, setWeirdness] = useState<Weirdness>(defaultInput.weirdness);
  const [results, setResults] = useState<GeneratedBandName[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [sharing, setSharing] = useState<GeneratedBandName | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const generate = () => {
    if (loading) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const input: BandNameInput = { scene, mood, language, weirdness };
    setCopiedIndex(null);
    setSharing(null);
    setResults(null);
    setLoading(true);

    // 살짝 기다리게 해서 "이름을 짓는 중" 느낌을 준다. (생성 자체는 즉시지만
    // 결과를 LOADING_MS 후에 노출.)
    timeoutRef.current = setTimeout(() => {
      setResults(generateBandNames(input));
      setLoading(false);
      timeoutRef.current = null;
    }, LOADING_MS);
  };

  const copy = async (name: string, index: number) => {
    try {
      await navigator.clipboard.writeText(name);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex((cur) => (cur === index ? null : cur)), 1500);
    } catch {
      // 클립보드 거부됨 — 조용히 실패
    }
  };

  return (
    <div>
      {/* 선택 패널 — 한 박스로 묶어 결과 영역과 구분 */}
      <div className="border border-[var(--color-border-strong)] p-6 md:p-8">
        <fieldset className="mb-10">
          <SectionLabel>씬 / 장르</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sceneOptions.map((opt) => {
              const active = scene === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setScene(opt.value)}
                  className={`text-left p-4 md:p-5 border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-2 ${
                    active
                      ? "border-[var(--color-text)] bg-[var(--color-text)] text-[var(--color-bg)]"
                      : "border-[var(--color-border)] bg-transparent text-[var(--color-text)] hover:border-[var(--color-text)]"
                  }`}
                >
                  <span className="block font-display font-bold text-base md:text-lg leading-snug">
                    {opt.label}
                  </span>
                  <span
                    className={`mt-1 block text-sm leading-relaxed ${
                      active ? "text-[var(--color-bg)]/70" : "text-[var(--color-text-muted)]"
                    }`}
                  >
                    {opt.description}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="mb-10">
          <SectionLabel>분위기</SectionLabel>
          <div className="flex flex-wrap gap-2.5">
            {moodOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={mood === opt.value}
                onClick={() => setMood(opt.value)}
                className={pillClass(mood === opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="mb-10">
          <SectionLabel>이름 언어</SectionLabel>
          <div className="flex flex-wrap gap-2.5">
            {languageOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={language === opt.value}
                onClick={() => setLanguage(opt.value)}
                className={pillClass(language === opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <SectionLabel>이상함 정도</SectionLabel>
          <div className="flex gap-2" role="group" aria-label="이상함 정도">
            {weirdnessLevels.map((level) => {
              const active = weirdness === level;
              return (
                <button
                  key={level}
                  type="button"
                  aria-pressed={active}
                  aria-label={`${level}단계 — ${weirdnessLabels[level]}`}
                  onClick={() => setWeirdness(level)}
                  className={`flex-1 py-3 text-base font-semibold border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-2 ${
                    active
                      ? "border-[var(--color-text)] bg-[var(--color-text)] text-[var(--color-bg)]"
                      : "border-[var(--color-border)] bg-transparent text-[var(--color-text)] hover:border-[var(--color-text)]"
                  }`}
                >
                  {level}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-sm text-[var(--color-text-muted)]">
            현재: <span className="text-[var(--color-text)] font-medium">{weirdnessLabels[weirdness]}</span>
          </p>
        </fieldset>
      </div>

      {/* 생성 버튼 */}
      <button
        type="button"
        onClick={generate}
        disabled={loading}
        className="mt-8 inline-flex items-center justify-center w-full md:w-auto px-12 py-4 text-base font-semibold uppercase tracking-wider bg-[var(--color-accent)] text-[var(--color-accent-ink)] border border-[var(--color-accent)] hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-2"
      >
        {loading ? "만드는 중…" : results ? "다시 만들기" : "이름 만들기"}
      </button>

      {/* 로딩 */}
      {loading && (
        <div className="mt-16 border-t border-[var(--color-border)] pt-12" aria-live="polite">
          <p className="font-display font-bold text-2xl md:text-3xl mb-6">이름을 짓는 중…</p>
          <div className="h-1 w-full bg-[var(--color-border)] overflow-hidden" role="progressbar" aria-label="이름 생성 중">
            <div className="h-full bg-[var(--color-accent)] bandname-progress" />
          </div>
          <p className="mt-4 text-sm text-[var(--color-text-muted)]">
            단어를 고르고, 어색한 조합은 걸러내는 중이에요.
          </p>
        </div>
      )}

      {/* 결과 — @container 로 viewport 가 아닌 이 영역의 실제 폭에 반응 */}
      {!loading && results && (
        <div className="mt-16 border-t border-[var(--color-border)] pt-12 @container">
          <h2 className="font-display font-bold text-2xl md:text-3xl mb-8">
            당신의 밴드 이름은…
          </h2>

          {results.length === 0 ? (
            <p className="text-[var(--color-text-muted)]">
              조건에 맞는 이름을 찾지 못했어요. 다시 시도해 주세요.
            </p>
          ) : (
            <ul className="grid grid-cols-1 @md:grid-cols-2 @4xl:grid-cols-3 gap-4 md:gap-6">
              {results.map((r, i) => (
                <li
                  key={`${r.name}-${i}`}
                  style={{ animationDelay: `${i * 70}ms` }}
                  className="bandname-pop border border-[var(--color-text)] p-6 md:p-7 flex flex-col min-w-0"
                >
                  <span className="text-xs font-semibold tracking-[0.1em] text-[var(--color-text-muted)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  <p
                    className={`mt-3 mb-5 font-display font-black leading-[1.15] break-keep [overflow-wrap:anywhere] min-w-0 min-h-[2.3em] flex-1 ${nameSizeClass(
                      r.name,
                    )}`}
                  >
                    {r.name}
                  </p>

                  <div className="flex flex-wrap gap-1.5 mb-5">
                    {r.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 text-[11px] uppercase tracking-[0.06em] font-medium border border-[var(--color-border)] text-[var(--color-text-muted)]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="mt-auto flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => copy(r.name, i)}
                      aria-label={`${r.name} 이름 복사`}
                      className="inline-flex items-center justify-center px-3 py-2 text-xs font-semibold uppercase tracking-wider bg-transparent text-[var(--color-text)] border border-[var(--color-text)] hover:bg-[var(--color-text)] hover:text-[var(--color-bg)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-2"
                    >
                      {copiedIndex === i ? "복사됨" : "이름 복사"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSharing(r)}
                      aria-label={`${r.name} 공유`}
                      className="inline-flex items-center justify-center px-3 py-2 text-xs font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] hover:opacity-90 transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-2"
                    >
                      공유
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {sharing && <BandNameShareSheet result={sharing} onClose={() => setSharing(null)} />}
    </div>
  );
}
