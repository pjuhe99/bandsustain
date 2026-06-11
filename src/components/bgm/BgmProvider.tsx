"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { BGM_TRACKS, type BgmTrack } from "@/lib/bgm";

type BgmContextValue = {
  /** 재생을 한 번이라도 시작했는지 (미니 플레이어 바 노출 여부) */
  started: boolean;
  playing: boolean;
  currentTitle: string;
  /** 현재 곡 커버 URL (없는 곡은 null — UI 가 로고 폴백) */
  currentCover: string | null;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  stop: () => void;
};

const BgmContext = createContext<BgmContextValue | null>(null);

export function useBgm(): BgmContextValue {
  const ctx = useContext(BgmContext);
  if (!ctx) throw new Error("useBgm must be used within BgmProvider");
  return ctx;
}

function shuffle(tracks: BgmTrack[]): BgmTrack[] {
  const arr = [...tracks];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 직전에 듣던 곡 기억용. 곡이 5곡뿐이라 균등 셔플로도 1/5 확률로 같은 곡으로
// 또 시작하게 되는데, 그 체감이 커서 시작 곡에서만 직전 곡을 피한다.
const LAST_SRC_KEY = "bgm:last-src";

function readLastSrc(): string | null {
  try {
    return localStorage.getItem(LAST_SRC_KEY);
  } catch {
    return null;
  }
}

export default function BgmProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // 셔플 결과는 첫 toggle() 시점에 채운다 (렌더 중 Math.random 금지 — hydration 안전).
  const playlistRef = useRef<BgmTrack[]>(BGM_TRACKS);
  // 현재 곡 위치의 소스 오브 트루스. state 가 아니라 ref 인 이유: ended/error/
  // Media Session 콜백이 렌더 사이클 밖에서 연달아 호출돼도 stale closure 없이
  // 항상 최신 위치 기준으로 진행하기 위해. 렌더에는 currentTitle 만 노출한다.
  const indexRef = useRef(0);
  const errorStreakRef = useRef(0);
  const [started, setStarted] = useState(false);
  // playing 은 audio 엘리먼트의 play/pause 이벤트로만 갱신한다 (엘리먼트가
  // 소스 오브 트루스). OS 의 외부 일시정지(이어폰 분리, 오디오 포커스 상실)도
  // 이 경로로 자연히 반영된다.
  const [playing, setPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<BgmTrack | null>(null);

  const playAt = useCallback((i: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const n = playlistRef.current.length;
    const wrapped = ((i % n) + n) % n;
    indexRef.current = wrapped;
    setCurrentTrack(playlistRef.current[wrapped]);
    try {
      localStorage.setItem(LAST_SRC_KEY, playlistRef.current[wrapped].src);
    } catch {
      // 프라이빗 모드 등 — 시작 곡 다양성만 잃고 재생엔 영향 없음
    }
    audio.src = playlistRef.current[wrapped].src;
    // 로드 실패 skip 은 error 이벤트 핸들러 담당. 여기 rejection 은
    // autoplay 거부 등 — paused 상태로 두면 된다.
    audio.play().catch(() => {});
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load(); // src 제거를 미디어 엘리먼트에 실제 반영 (리소스 해제)
    }
    // load() 는 미디어 로드 알고리즘 규칙상 큐에 대기 중인 미디어 이벤트
    // 태스크(방금 pause() 가 큐잉한 pause 이벤트 포함)를 제거한다.
    // 이벤트에만 의존하면 playing 이 true 로 고착되므로 여기서 직접 내린다.
    setPlaying(false);
    indexRef.current = 0;
    setCurrentTrack(null);
    setStarted(false);
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!started) {
      const shuffled = shuffle(BGM_TRACKS);
      const lastSrc = readLastSrc();
      if (shuffled.length > 1 && shuffled[0].src === lastSrc) {
        const j = 1 + Math.floor(Math.random() * (shuffled.length - 1));
        [shuffled[0], shuffled[j]] = [shuffled[j], shuffled[0]];
      }
      playlistRef.current = shuffled;
      errorStreakRef.current = 0;
      setStarted(true);
      playAt(0);
      return;
    }
    if (audio.paused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [started, playAt]);

  const next = useCallback(() => {
    if (!started) return;
    playAt(indexRef.current + 1);
  }, [started, playAt]);

  const prev = useCallback(() => {
    if (!started) return;
    playAt(indexRef.current - 1);
  }, [started, playAt]);

  // 오디오 이벤트 배선 — deps 가 전부 안정 콜백이라 마운트 1회.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onPlaying = () => {
      errorStreakRef.current = 0;
    };
    const onEnded = () => {
      errorStreakRef.current = 0;
      playAt(indexRef.current + 1);
    };
    const onError = () => {
      errorStreakRef.current += 1;
      // 전곡 연속 실패 = 자산/네트워크가 전부 깨진 상태. 무한 skip 루프를
      // 멈추고 초기 상태로 복귀 (플로팅 버튼으로 재시도 가능).
      if (errorStreakRef.current >= playlistRef.current.length) {
        stop();
        return;
      }
      playAt(indexRef.current + 1);
    };
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [playAt, stop]);

  const currentTitle = currentTrack?.title ?? "";
  const currentCover = currentTrack?.cover ?? null;

  // Media Session: 잠금화면/OS 미디어 컨트롤 연동 (미지원 브라우저는 무시)
  useEffect(() => {
    if (!started || !("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTitle,
      artist: "bandsustain",
      artwork: currentCover
        ? [{ src: currentCover, sizes: "256x256", type: "image/jpeg" }]
        : [],
    });
    navigator.mediaSession.playbackState = playing ? "playing" : "paused";
    navigator.mediaSession.setActionHandler("play", toggle);
    navigator.mediaSession.setActionHandler("pause", toggle);
    navigator.mediaSession.setActionHandler("previoustrack", prev);
    navigator.mediaSession.setActionHandler("nexttrack", next);
    return () => {
      navigator.mediaSession.playbackState = "none";
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("previoustrack", null);
      navigator.mediaSession.setActionHandler("nexttrack", null);
    };
  }, [started, currentTitle, currentCover, playing, toggle, prev, next]);

  const value = useMemo<BgmContextValue>(
    () => ({ started, playing, currentTitle, currentCover, toggle, next, prev, stop }),
    [started, playing, currentTitle, currentCover, toggle, next, prev, stop],
  );

  return (
    <BgmContext.Provider value={value}>
      {children}
      <audio ref={audioRef} preload="none" />
    </BgmContext.Provider>
  );
}
