// src/app/playground/mbti-band-casting/MbtiBandCasting.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BUDGETS, EXPERIENCES, GENRES, MBTI_PROFILES, POSITIONS,
  SOUND_PREFERENCES, STAGE_PREFERENCES,
} from "@/lib/mbtiCasting/data";
import { recommendBandCasting, type BandCastingInput, type BandCastingResult } from "@/lib/mbtiCasting/engine";
import { buildNameGenQuery } from "@/lib/mbtiCasting/nameGenLink";
import type {
  BudgetId, ExperienceId, GenreId, MbtiId, SoundPreferenceId, StagePreferenceId,
} from "@/lib/mbtiCasting/types";
import CastingShareSheet from "./CastingShareSheet";

const TOTAL_STEPS = 5;
const LOADING_MS = 1200;
const MBTI_LIST = Object.keys(MBTI_PROFILES) as MbtiId[];
const GENRE_LIST = Object.values(GENRES);

const STAGE_QUESTION = "무대에서 어떤 순간에 가장 끌리나요?";
const SOUND_QUESTION = "어떤 소리가 가장 좋나요?";

function cardClass(active: boolean): string {
  return `text-left p-4 md:p-5 border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-2 ${
    active
      ? "border-[var(--color-text)] bg-[var(--color-text)] text-[var(--color-bg)]"
      : "border-[var(--color-border)] bg-transparent text-[var(--color-text)] hover:border-[var(--color-text)]"
  }`;
}

function StepHeading({ step, title, sub }: { step: number; title: string; sub?: string }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold tracking-[0.1em] text-[var(--color-text-muted)] mb-2">
        {step} / {TOTAL_STEPS}
      </p>
      <h2 className="font-display font-bold text-xl md:text-2xl text-[var(--color-text)]">{title}</h2>
      {sub && <p className="mt-2 text-sm text-[var(--color-text-muted)]">{sub}</p>}
    </div>
  );
}

export default function MbtiBandCasting() {
  const [step, setStep] = useState(1);
  const [mbti, setMbti] = useState<MbtiId | null>(null);
  const [genre, setGenre] = useState<GenreId | null>(null);
  const [stage, setStage] = useState<StagePreferenceId | null>(null);
  const [sound, setSound] = useState<SoundPreferenceId | null>(null);
  const [experience, setExperience] = useState<ExperienceId | null>(null);
  const [budget, setBudget] = useState<BudgetId | null>(null);
  const [result, setResult] = useState<BandCastingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const progress = ((step - 1) / TOTAL_STEPS) * 100;

  const reset = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setStep(1);
    setMbti(null); setGenre(null); setStage(null); setSound(null);
    setExperience(null); setBudget(null);
    setResult(null); setLoading(false); setSharing(false);
  };

  const finish = () => {
    if (!mbti || !genre || !stage || !sound || !experience || !budget) return;
    const input: BandCastingInput = {
      mbti, genre, stagePreference: stage, soundPreference: sound, experience, budget,
    };
    setLoading(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setResult(recommendBandCasting(input));
      setLoading(false);
      timeoutRef.current = null;
    }, LOADING_MS);
  };

  // 결과 화면 ---------------------------------------------------------------
  if (loading) {
    return (
      <div className="border-t border-[var(--color-border)] pt-12" aria-live="polite">
        <p className="font-display font-bold text-2xl md:text-3xl mb-6">캐스팅 중…</p>
        <div className="h-1 w-full bg-[var(--color-border)] overflow-hidden" role="progressbar" aria-label="캐스팅 중">
          <div className="h-full bg-[var(--color-accent)] bandname-progress" />
        </div>
        <p className="mt-4 text-sm text-[var(--color-text-muted)]">당신에게 어울리는 무대 자리를 찾는 중이에요.</p>
      </div>
    );
  }

  if (result) {
    const input = result.input;
    const primary = POSITIONS[result.primaryPosition];
    const secondary = POSITIONS[result.secondaryPosition];
    const nameGenHref = `/playground/band-name-generator?${buildNameGenQuery(input.genre, result.moodTags)}`;
    return (
      <div className="page-fade-in">
        <div className="bandname-pop border border-[var(--color-text)] p-6 md:p-8">
          {/* 뱃지 */}
          <div className="flex flex-wrap gap-2 mb-6">
            <span className="px-3 py-1 text-xs uppercase tracking-[0.06em] font-semibold bg-[var(--color-text)] text-[var(--color-bg)]">
              {input.mbti}
            </span>
            <span className="px-3 py-1 text-xs uppercase tracking-[0.06em] font-medium border border-[var(--color-border)] text-[var(--color-text-muted)]">
              {GENRES[input.genre].label}
            </span>
          </div>

          {/* 포지션 + 타이틀 */}
          <div className="flex items-center gap-3 text-[var(--color-text-muted)] mb-2">
            <span className="text-3xl" aria-hidden>{primary.icon}</span>
            <span className="text-sm uppercase tracking-[0.1em]">{primary.englishLabel}</span>
          </div>
          <h2 className="font-display font-black text-3xl md:text-4xl leading-tight break-keep [overflow-wrap:anywhere]">
            {result.title}
          </h2>
          <p className="mt-4 text-base md:text-lg text-[var(--color-text)] leading-relaxed">
            {result.description}
          </p>

          {/* 무드 태그 */}
          <div className="mt-5 flex flex-wrap gap-1.5">
            {result.moodTags.map((tag) => (
              <span key={tag} className="px-2.5 py-1 text-[11px] uppercase tracking-[0.06em] font-medium border border-[var(--color-border)] text-[var(--color-text-muted)]">
                {tag}
              </span>
            ))}
          </div>

          {/* 함께 잘 맞는 포지션 */}
          <p className="mt-6 text-sm text-[var(--color-text-muted)]">
            함께 잘 맞는 포지션: <span className="text-[var(--color-text)] font-medium">{secondary.icon} {secondary.label}</span>
          </p>
        </div>

        {/* 커버곡 */}
        <div className="mt-8">
          <h3 className="font-display font-bold text-lg md:text-xl mb-4">추천 커버곡</h3>
          <ul className="grid grid-cols-1 gap-3">
            {result.songs.map((song) => (
              <li key={song.id} className="border border-[var(--color-border)] p-4 flex flex-col gap-1.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display font-bold text-base break-keep [overflow-wrap:anywhere]">{song.title}</p>
                    <p className="text-sm text-[var(--color-text-muted)] break-keep [overflow-wrap:anywhere]">{song.artist}</p>
                  </div>
                  <span className="shrink-0 px-2 py-1 text-[11px] uppercase tracking-[0.06em] border border-[var(--color-border)] text-[var(--color-text-muted)]">
                    {song.difficultyLabel}
                  </span>
                </div>
                <p className="text-sm text-[var(--color-text)] leading-relaxed">{song.reason}</p>
              </li>
            ))}
          </ul>
        </div>

        {/* 첫 장비 */}
        <div className="mt-8">
          <h3 className="font-display font-bold text-lg md:text-xl mb-4">첫 장비 추천</h3>
          <ul className="grid grid-cols-1 gap-3">
            {result.gear.items.map((item, i) => (
              <li key={`${item.category}-${i}`} className="border border-[var(--color-border)] p-4">
                <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)] mb-1">{item.category}</p>
                <p className="font-display font-bold text-base break-keep [overflow-wrap:anywhere]">{item.name}</p>
                <p className="mt-1 text-sm text-[var(--color-text)] leading-relaxed">{item.reason}</p>
              </li>
            ))}
          </ul>
          {result.gear.genreTip && (
            <p className="mt-3 text-sm text-[var(--color-text)] leading-relaxed">
              <span className="font-medium">장르 팁 — </span>{result.gear.genreTip}
            </p>
          )}
          <p className="mt-3 text-xs text-[var(--color-text-muted)] leading-relaxed">{result.gear.notice}</p>
        </div>

        {/* 면책 */}
        <p className="mt-8 text-xs text-[var(--color-text-muted)] leading-relaxed border-t border-[var(--color-border)] pt-5">
          {result.disclaimer}
        </p>

        {/* CTA */}
        <div className="mt-8 flex flex-col sm:flex-row flex-wrap gap-3">
          <Link
            href={nameGenHref}
            className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold uppercase tracking-wider bg-[var(--color-accent)] text-[var(--color-accent-ink)] border border-[var(--color-accent)] hover:opacity-90 transition-opacity"
          >
            이 캐릭터로 밴드 이름 만들기
          </Link>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold uppercase tracking-wider bg-transparent text-[var(--color-text)] border border-[var(--color-text)] hover:bg-[var(--color-text)] hover:text-[var(--color-bg)] transition-colors"
          >
            다시 캐스팅하기
          </button>
          <button
            type="button"
            onClick={() => setSharing(true)}
            className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] hover:opacity-90 transition-opacity"
          >
            결과 공유하기
          </button>
        </div>

        {sharing && <CastingShareSheet input={input} result={result} onClose={() => setSharing(false)} />}
      </div>
    );
  }

  // 마법사 화면 -------------------------------------------------------------
  return (
    <div>
      <div className="h-1 w-full bg-[var(--color-border)] overflow-hidden mb-8" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={TOTAL_STEPS} aria-label="진행 단계">
        <div className="h-full bg-[var(--color-accent)] transition-[width] duration-300" style={{ width: `${progress}%` }} />
      </div>

      <div className="border border-[var(--color-border-strong)] p-6 md:p-8">
        {step === 1 && (
          <fieldset>
            <StepHeading step={1} title="당신의 MBTI는 무엇인가요?" sub="몰라도 괜찮아요. 가장 끌리는 유형을 골라보세요." />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {MBTI_LIST.map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={mbti === id}
                  onClick={() => { setMbti(id); setStep(2); }}
                  className={`py-3 font-display font-bold text-base border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-2 ${
                    mbti === id
                      ? "border-[var(--color-text)] bg-[var(--color-text)] text-[var(--color-bg)]"
                      : "border-[var(--color-border)] bg-transparent text-[var(--color-text)] hover:border-[var(--color-text)]"
                  }`}
                >
                  {id}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {step === 2 && (
          <fieldset>
            <StepHeading step={2} title="어떤 무대의 사운드가 끌리나요?" />
            <div className="grid grid-cols-1 sm:grid-cols-2 auto-rows-fr gap-3">
              {GENRE_LIST.map((g) => (
                <button key={g.id} type="button" aria-pressed={genre === g.id} onClick={() => { setGenre(g.id); setStep(3); }} className={cardClass(genre === g.id)}>
                  <span className="block font-display font-bold text-base md:text-lg leading-snug">{g.label}</span>
                  <span className={`mt-1 block text-sm leading-relaxed ${genre === g.id ? "text-[var(--color-bg)]/70" : "text-[var(--color-text-muted)]"}`}>
                    {g.shortDescription}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {step === 3 && (
          <fieldset>
            <StepHeading step={3} title={STAGE_QUESTION} />
            <div className="grid grid-cols-1 auto-rows-fr gap-3">
              {STAGE_PREFERENCES.map((opt) => (
                <button key={opt.id} type="button" aria-pressed={stage === opt.id} onClick={() => { setStage(opt.id); setStep(4); }} className={cardClass(stage === opt.id)}>
                  <span className="block font-medium text-base leading-snug">{opt.label}</span>
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {step === 4 && (
          <fieldset>
            <StepHeading step={4} title={SOUND_QUESTION} />
            <div className="grid grid-cols-1 auto-rows-fr gap-3">
              {SOUND_PREFERENCES.map((opt) => (
                <button key={opt.id} type="button" aria-pressed={sound === opt.id} onClick={() => { setSound(opt.id); setStep(5); }} className={cardClass(sound === opt.id)}>
                  <span className="block font-medium text-base leading-snug">{opt.label}</span>
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {step === 5 && (
          <div>
            <fieldset className="mb-8">
              <StepHeading step={5} title="연주 경험과 예산을 알려주세요" sub="장비 추천에만 쓰여요." />
              <p className="text-sm font-semibold text-[var(--color-text)] mb-3">연주 경험</p>
              <div className="grid grid-cols-1 auto-rows-fr gap-2.5">
                {EXPERIENCES.map((opt) => (
                  <button key={opt.id} type="button" aria-pressed={experience === opt.id} onClick={() => setExperience(opt.id)} className={cardClass(experience === opt.id)}>
                    <span className="block font-medium text-base leading-snug">{opt.label}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <p className="text-sm font-semibold text-[var(--color-text)] mb-3">예산</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 auto-rows-fr gap-2.5">
                {BUDGETS.map((opt) => (
                  <button key={opt.id} type="button" aria-pressed={budget === opt.id} onClick={() => setBudget(opt.id)} className={cardClass(budget === opt.id)}>
                    <span className="block font-medium text-base leading-snug">{opt.label}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        )}
      </div>

      {/* 네비게이션 */}
      <div className="mt-6 flex items-center gap-3">
        {step > 1 && (
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold uppercase tracking-wider bg-transparent text-[var(--color-text)] border border-[var(--color-text)] hover:bg-[var(--color-text)] hover:text-[var(--color-bg)] transition-colors"
          >
            이전
          </button>
        )}
        {step === TOTAL_STEPS && (
          <button
            type="button"
            onClick={finish}
            disabled={!experience || !budget}
            className="inline-flex items-center justify-center px-10 py-3 text-sm font-semibold uppercase tracking-wider bg-[var(--color-accent)] text-[var(--color-accent-ink)] border border-[var(--color-accent)] hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
          >
            내 밴드 캐릭터 보기
          </button>
        )}
      </div>
    </div>
  );
}
