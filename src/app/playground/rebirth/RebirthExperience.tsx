"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  decodeRebirthSeed,
  drawRebirth,
  encodeRebirthSeed,
  restoreRebirth,
  type RebirthResult,
} from "@/lib/rebirth/engine";
import type { RebirthData, RebirthMode } from "@/lib/rebirth/types";
import {
  buildDailyScene,
  countryFlag,
  countryFlagUrl,
  locationClimate,
  locationName,
  locationPopulation,
} from "@/lib/rebirth/scene";
import RebirthMap from "./RebirthMap";

const integer = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("ko-KR", { notation: "compact", maximumFractionDigits: 1 });
const money = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });
const MIN_SCENE_LOADING_MS = 700;
// 마지막 굴림 이후 이만큼 조용해야 AI 문장을 요청한다. 연타 구간은 통째로 건너뛴다.
const SCENE_SETTLE_MS = 1200;
// 문단 영역이 화면에 들어오기 직전부터 요청을 시작해, 스크롤 도중 빈 자리가 보이지 않게 한다.
const SCENE_VIEW_MARGIN = "0px 0px 160px 0px";

function chanceLabel(probability: number) {
  if (probability <= 0) return "계산 불가";
  const oneIn = 1 / probability;
  if (oneIn < 10_000) return `약 ${integer.format(oneIn)}분의 1`;
  return `약 ${compact.format(oneIn)}분의 1`;
}

function welfareLabel(type: string) {
  if (type === "income") return "소득";
  if (type === "consumption") return "소비";
  return "생활수준";
}

function splitScene(scene: string) {
  const sentences = scene.match(/[^.!?…。]+[.!?…。]+/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [];
  if (sentences.length < 3) return [scene];
  const midpoint = Math.ceil(sentences.length / 2);
  return [sentences.slice(0, midpoint).join(" "), sentences.slice(midpoint).join(" ")];
}

function CountryFlag({ iso2, countryName }: { iso2: string; countryName: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  const url = countryFlagUrl(iso2);
  if (!url || imageFailed) {
    return <span aria-label={`${countryName} 국기`} className="mr-3 text-3xl">{countryFlag(iso2)}</span>;
  }
  return <Image src={url} alt={`${countryName} 국기`} width={48} height={36} onError={() => setImageFailed(true)} className="mr-3 inline-block h-8 w-11 rounded-sm border border-black/10 object-cover align-[-0.12em] shadow-sm" />;
}

function ResultCard({ result, onShare, scene, sceneStatus, sceneRef, sceneFallback, shareBusy }: { result: RebirthResult; onShare: () => void; scene: string; sceneStatus: "idle" | "loading" | "ready"; sceneRef: (node: HTMLElement | null) => void; sceneFallback: boolean; shareBusy: boolean }) {
  const topPercent = Math.max(1, 101 - result.percentile);
  const globalTopPercent = Math.max(1, 101 - result.globalPercentile);
  const place = locationName(result);
  const climate = locationClimate(result);
  const population = locationPopulation(result);

  return (
    <article className="border-2 border-[var(--color-border-strong)] bg-white p-6 md:p-8 rebirth-result-in" aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-accent)]">당신의 새로운 출발점</p>
          <h2 className="mt-3 font-display text-3xl font-black leading-tight md:text-5xl">
            <CountryFlag iso2={result.country.iso2} countryName={result.country.nameKo} />{place}, {result.country.nameKo}
          </h2>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">{result.country.name}</p>
        </div>
        <button type="button" onClick={onShare} disabled={shareBusy} className="border border-[var(--color-border-strong)] px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] transition-colors hover:bg-black hover:text-white disabled:cursor-wait disabled:opacity-45">
          {shareBusy ? "문구 준비 중…" : "결과 공유"}
        </button>
      </div>

      <div className="mt-8 grid gap-px bg-[var(--color-border)] border border-[var(--color-border)] sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white p-5">
          <p className="text-xs text-[var(--color-text-muted)]">태어난 곳</p>
          <p className="mt-2 font-display text-xl font-black">{place}</p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            {result.city
              ? `${result.city.capital ? "수도 · " : ""}인구 ${compact.format(population)}명`
              : result.settlement
                ? `국가 내 해당 유형 인구 약 ${compact.format(population)}명`
                : `국가 내 도시 외 인구 약 ${compact.format(population)}명`}
          </p>
        </div>
        <div className="bg-white p-5">
          <p className="text-xs text-[var(--color-text-muted)]">기후</p>
          <p className="mt-2 font-display text-xl font-black">{climate?.label ?? "지역별로 다양"}</p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">{climate?.description ?? "같은 나라 안에서도 기후가 크게 다를 수 있어요"}</p>
        </div>
        <div className="bg-white p-5">
          <p className="text-xs text-[var(--color-text-muted)]">가정의 전국 경제 위치</p>
          <p className="mt-2 font-display text-2xl font-black">상위 {topPercent}%</p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">전 세계 기준 상위 {globalTopPercent}%</p>
        </div>
        <div className="bg-white p-5">
          <p className="text-xs text-[var(--color-text-muted)]">월 1인당 {welfareLabel(result.welfareType)}</p>
          <p className="mt-2 font-display text-2xl font-black">${money.format(result.monthlyWelfarePpp)}</p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">2021 PPP 국제달러 환산</p>
        </div>
      </div>

      <section ref={sceneRef} className="mt-6 bg-[var(--color-bg-muted)] p-5 md:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)]">당신의 새로운 하루</p>
        {sceneStatus === "loading" ? (
          <div className="mt-5 flex items-center gap-4" role="status" aria-live="polite">
            <span className="relative flex h-11 w-11 shrink-0 items-center justify-center" aria-hidden>
              <span className="absolute inset-0 rounded-full border-2 border-[var(--color-accent)]/20" />
              <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--color-accent)] motion-reduce:animate-none animate-spin" />
              <span className="h-2 w-2 rounded-full bg-[var(--color-accent)] motion-reduce:animate-none animate-ping" />
            </span>
            <span>
              <strong className="block font-display text-lg">새로운 하루를 그리는 중</strong>
              <span className="mt-1 block text-sm text-[var(--color-text-muted)]">그 지역의 공기와 생활 리듬을 한 장면으로 엮고 있어요.</span>
            </span>
          </div>
        ) : sceneStatus === "idle" ? (
          <div className="mt-5 flex items-center gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center" aria-hidden>
              <span className="h-2 w-2 rounded-full bg-[var(--color-accent)]/40" />
            </span>
            <span>
              <strong className="block font-display text-lg text-[var(--color-text-muted)]">새로운 하루를 그릴 준비 완료</strong>
              <span className="mt-1 block text-sm text-[var(--color-text-muted)]">이 결과가 정해지면 이곳에 하루의 장면이 나타나요.</span>
            </span>
          </div>
        ) : (
          <div className="mt-4 space-y-4 font-display text-lg font-bold leading-relaxed md:text-xl">
            {splitScene(scene).map((paragraph, index, paragraphs) => (
              <p key={`${index}-${paragraph.slice(0, 24)}`}>
                {index === 0 ? "“" : ""}{paragraph}{index === paragraphs.length - 1 ? "”" : ""}
              </p>
            ))}
          </div>
        )}
        {sceneFallback && <p className="mt-4 text-xs text-[var(--color-text-muted)]">AI 장면을 준비하지 못해, 이곳의 기본 하루를 보여드려요. 잠시 뒤 다시 태어나면 새 장면을 만들어요.</p>}
      </section>

      <p className="mt-5 text-xs leading-relaxed text-[var(--color-text-muted)]">이 조합의 확률: {chanceLabel(result.combinedProbability)}</p>
    </article>
  );
}

export default function RebirthExperience() {
  const [data, setData] = useState<RebirthData | null>(null);
  const [mode, setMode] = useState<RebirthMode>("births");
  const [result, setResult] = useState<RebirthResult | null>(null);
  const [history, setHistory] = useState<RebirthResult[]>([]);
  const [rolling, setRolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [aiScene, setAiScene] = useState<{ key: string; text: string } | null>(null);
  const [sceneLoading, setSceneLoading] = useState(false);
  const [sceneFallback, setSceneFallback] = useState(false);
  // AI 문장을 실제로 요청하기로 확정한 결과. 두 게이트를 모두 통과해야 채워진다.
  const [sceneTarget, setSceneTarget] = useState<RebirthResult | null>(null);
  // 굴림이 멎은 뒤 SCENE_SETTLE_MS 가 지난 결과의 seed. 연타 중에는 계속 null 로 되돌아간다.
  const [settledSeed, setSettledSeed] = useState<string | null>(null);
  // 게이트를 건너뛰는 seed. 공유 링크 복원과 `결과 공유` 버튼이 채운다.
  const [bypassSeed, setBypassSeed] = useState<string | null>(null);
  const [sceneInView, setSceneInView] = useState(false);
  const [sceneNode, setSceneNode] = useState<HTMLElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resultSeed = useMemo(() => (result ? encodeRebirthSeed(result) : null), [result]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/playground/rebirth/rebirth-data-v1.json", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("데이터를 불러오지 못했습니다.");
        return response.json() as Promise<RebirthData>;
      })
      .then((loaded) => {
        setData(loaded);
        const seed = decodeRebirthSeed(new URLSearchParams(window.location.search).get("r"));
        const sharedResult = seed ? restoreRebirth(loaded, seed) : null;
        if (sharedResult) {
          setMode(sharedResult.mode);
          setResult(sharedResult);
          setHistory([sharedResult]);
          setSceneFallback(false);
          // 공유 링크의 본체는 그 문장이다. 뷰포트·안정화 게이트를 건너뛴다.
          setBypassSeed(encodeRebirthSeed(sharedResult));
        }
      })
      .catch((reason: unknown) => {
        if ((reason as { name?: string }).name !== "AbortError") setError("환생 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
      });
    return () => {
      controller.abort();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  // 결과가 바뀌면 진행 중이던 요청을 버리고(sceneTarget 해제) 안정화 타이머를 다시 잰다.
  useEffect(() => {
    setSceneTarget(null);
    setSettledSeed(null);
    setSceneLoading(false);
    if (!result) return;
    const seed = encodeRebirthSeed(result);
    const settleTimer = window.setTimeout(() => setSettledSeed(seed), SCENE_SETTLE_MS);
    return () => window.clearTimeout(settleTimer);
  }, [result]);

  // 문단 영역이 실제로 화면에 들어왔는지 관찰한다.
  useEffect(() => {
    if (!sceneNode) return;
    if (typeof IntersectionObserver === "undefined") {
      setSceneInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (entry) setSceneInView(entry.isIntersecting);
      },
      { rootMargin: SCENE_VIEW_MARGIN },
    );
    observer.observe(sceneNode);
    return () => observer.disconnect();
  }, [sceneNode]);

  // 두 게이트를 모두 통과했을 때만 생성 대상으로 확정한다.
  useEffect(() => {
    if (!result || !resultSeed || sceneTarget === result) return;
    // 다음 굴림이 이미 진행 중이면 곧 버려질 결과다. 요청하지 않는다.
    if (bypassSeed === resultSeed || (!rolling && settledSeed === resultSeed && sceneInView)) setSceneTarget(result);
  }, [result, resultSeed, sceneTarget, bypassSeed, settledSeed, sceneInView, rolling]);

  useEffect(() => {
    const result = sceneTarget;
    if (!result) return;
    const controller = new AbortController();
    const key = encodeRebirthSeed(result);
    const climate = locationClimate(result);
    setSceneLoading(true);
    const startedAt = performance.now();
    const body = JSON.stringify({
      seed: key,
      country: result.country.nameKo,
      city: locationName(result),
      settlementType: result.city ? "city" : result.settlement?.kind ?? "outside",
      climate: climate?.label ?? "지역별로 다른 기후",
      population: locationPopulation(result),
      topPercent: Math.max(1, 101 - result.percentile),
      welfareType: result.welfareType === "income" ? "income" : result.welfareType === "consumption" ? "consumption" : "living",
    });

    async function requestScene() {
      const response = await fetch("/api/playground/rebirth/scene", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body,
      });
      if (response.ok) {
        const payload = await response.json() as { scene?: unknown };
        if (typeof payload.scene === "string" && payload.scene.trim()) return payload.scene.trim();
      }
      return null;
    }

    requestScene()
      .then((scene) => {
        if (controller.signal.aborted) return;
        if (scene) setAiScene({ key, text: scene });
        else {
          setAiScene(null);
          setSceneFallback(true);
        }
      })
      .catch((reason: unknown) => {
        if ((reason as { name?: string }).name !== "AbortError" && !controller.signal.aborted) {
          setAiScene(null);
          setSceneFallback(true);
        }
      })
      .finally(async () => {
        const remaining = Math.max(0, MIN_SCENE_LOADING_MS - (performance.now() - startedAt));
        if (remaining) await new Promise<void>((resolve) => window.setTimeout(resolve, remaining));
        if (!controller.signal.aborted) setSceneLoading(false);
      });
    return () => controller.abort();
  }, [sceneTarget]);

  const summary = useMemo(() => {
    if (!data) return null;
    return {
      primary: mode === "births" ? data.totals.births : data.totals.population,
      label: mode === "births" ? "2026년 전 세계 출생아" : "2026년 전 세계 인구",
    };
  }, [data, mode]);

  function roll() {
    if (!data || rolling) return;
    setRolling(true);
    setNotice(null);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    timer.current = setTimeout(() => {
      const next = drawRebirth(data, mode);
      setResult(next);
      setAiScene(null);
      setSceneFallback(false);
      if (next) {
        setHistory((previous) => [next, ...previous].slice(0, 6));
        const url = new URL(window.location.href);
        url.searchParams.set("r", encodeRebirthSeed(next));
        window.history.replaceState(null, "", url);
      }
      setRolling(false);
    }, reduceMotion ? 0 : 850);
  }

  async function share() {
    if (!result) return;
    const seed = encodeRebirthSeed(result);
    if (aiScene?.key !== seed && !sceneFallback) {
      // 아직 생성이 시작되지 않았다면 여기서 곧바로 트리거한다.
      setBypassSeed(seed);
      setNotice("공유 문구를 준비하고 있어요. 잠시 후 다시 눌러주세요.");
      return;
    }
    const url = new URL(`/playground/rebirth/share/${seed}`, window.location.origin);
    const text = `다시 태어난다면 나는 ${locationName(result)}, ${result.country.nameKo}의 상위 ${Math.max(1, 101 - result.percentile)}% 가정에서 태어납니다.`;
    try {
      if (navigator.share) await navigator.share({ title: "다시 태어난다면", text, url: url.toString() });
      else {
        await navigator.clipboard.writeText(url.toString());
        setNotice("결과 링크를 복사했습니다.");
      }
    } catch (reason) {
      if ((reason as { name?: string }).name !== "AbortError") setNotice("공유하지 못했습니다. 다시 시도해주세요.");
    }
  }

  return (
    <div className="space-y-8">
      <section className="border border-[var(--color-border)] p-5 md:p-7">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">추첨 기준</p>
            <div className="mt-3 inline-flex border border-[var(--color-border-strong)] p-1" role="group" aria-label="추첨 기준 선택">
              {(["births", "population"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={mode === option}
                  onClick={() => setMode(option)}
                  disabled={rolling}
                  className={`px-4 py-2 text-sm font-bold transition-colors ${mode === option ? "bg-black text-white" : "hover:bg-[var(--color-bg-muted)]"}`}
                >
                  {option === "births" ? "출생아 기준" : "현재 인구 기준"}
                </button>
              ))}
            </div>
          </div>
          {summary && (
            <div className="text-left md:text-right">
              <p className="text-xs text-[var(--color-text-muted)]">{summary.label}</p>
              <p className="mt-1 font-display text-2xl font-black">{compact.format(summary.primary)}명</p>
            </div>
          )}
        </div>
      </section>

      <RebirthMap result={result} />

      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={roll}
          disabled={!data || rolling || Boolean(error)}
          className="min-w-60 bg-[var(--color-accent)] px-8 py-4 font-display text-lg font-black text-white transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {rolling ? "새 삶을 정하는 중…" : result ? "다시 태어나기" : "새 삶 시작하기"}
        </button>
        {!data && !error && <p className="text-xs text-[var(--color-text-muted)]">12,000여 개 도시의 운명을 불러오는 중…</p>}
        {error && <p className="text-sm text-red-700">{error}</p>}
        {notice && <p className="text-sm text-[var(--color-accent)]" role="status">{notice}</p>}
      </div>

      {result && (
        <ResultCard
          result={result}
          onShare={share}
          scene={aiScene?.key === resultSeed ? aiScene.text : buildDailyScene(result)}
          sceneStatus={sceneLoading ? "loading" : aiScene?.key === resultSeed || sceneFallback ? "ready" : "idle"}
          sceneRef={setSceneNode}
          sceneFallback={sceneFallback}
          shareBusy={sceneTarget === result && aiScene?.key !== resultSeed && !sceneFallback}
        />
      )}

      {history.length > 1 && (
        <section>
          <h2 className="font-display text-xl font-black">이전 생들</h2>
          <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {history.slice(1).map((past, index) => (
              <li key={`${encodeRebirthSeed(past)}-${index}`} className="border border-[var(--color-border)] p-4 text-sm">
                <strong>{locationName(past)}, {past.country.nameKo}</strong>
                <span className="mt-1 block text-xs text-[var(--color-text-muted)]">상위 {Math.max(1, 101 - past.percentile)}% · 월 ${money.format(past.monthlyWelfarePpp)} PPP</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {data && (
        <details className="border-t border-[var(--color-border)] pt-6 text-sm text-[var(--color-text-muted)]">
          <summary className="cursor-pointer font-bold text-[var(--color-text)]">어떻게 계산했나요? 데이터와 한계 보기</summary>
          <div className="mt-5 grid gap-8 md:grid-cols-2">
            <div>
              <h3 className="font-bold text-[var(--color-text)]">계산 방식</h3>
              <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed">
                {data.methodology.map((item) => <li key={item}>{item}</li>)}
              </ul>
              <p className="mt-4 leading-relaxed">UN 도시 데이터에 이름과 좌표가 있는 곳은 도시로 표시합니다. 나머지 인구는 UN의 도시화 정도(Level 2)에 따라 교외·준도시, 준밀집 소도시, 밀집 소도시, 마을, 분산 농촌, 외딴 농촌으로 나눕니다. 이 여섯 유형은 국가 단위 인구 집계이므로 특정 마을 이름이나 정확한 좌표를 뜻하지 않습니다. 국가 내 출생 지역 분포는 지역별 출생 자료가 부족해 인구 비례를 사용합니다.</p>
              {result && (
                <div className="mt-4 space-y-3 leading-relaxed">
                  <p><strong className="text-[var(--color-text)]">데이터 성격:</strong>{" "}{result.incomeQuality === "survey" ? `${result.incomeYear}년 세계은행 조사 분포를 바탕으로 한 추정입니다.` : "직접 조사 분포가 없어 국가 GDP로 만든 모델 추정입니다."}</p>
                  <p>GDP는 개인이 실제로 버는 돈이 아닙니다. 이 결과의 금액은 가정의 1인당 {welfareLabel(result.welfareType)} 수준을 비교하기 위한 통계적 시뮬레이션입니다.{result.city && " 도시 GDP 보정이 포함되어 모델 추정치로 읽어야 합니다."}</p>
                  <p>전 세계 경제 위치는 이 결과의 PPP 생활수준을 각 국가의 100분위 분포와 비교하고, 국가 인구로 가중한 추정치입니다. 국가마다 조사 연도와 소득·소비 기준이 달라 정확한 세계 소득 순위가 아닌 비교 지표로 읽어야 합니다.</p>
                  <p>기후 정보는 좌표가 있는 도시만 위도에 따른 넓은 기후대를 안내합니다. 국가 단위 정착지 유형은 위치를 특정할 수 없어 ‘지역별로 다양’으로 표시합니다. ‘당신의 새로운 하루’는 통계 결과에 맞춘 창작 문구입니다.</p>
                </div>
              )}
            </div>
            <div>
              <h3 className="font-bold text-[var(--color-text)]">공식 원본</h3>
              <ul className="mt-3 space-y-3">
                {data.sources.map((source) => (
                  <li key={source.id}>
                    <a href={source.url} target="_blank" rel="noreferrer" className="font-semibold text-[var(--color-accent)] underline underline-offset-4">{source.title}</a>
                    <span className="block text-xs">{source.referenceYear}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs">데이터 버전 {data.version} · {integer.format(data.totals.countries)}개 국가/지역 · {integer.format(data.totals.cities)}개 도시</p>
            </div>
          </div>
        </details>
      )}
    </div>
  );
}
