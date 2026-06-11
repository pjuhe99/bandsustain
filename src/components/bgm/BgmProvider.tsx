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

export default function BgmProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // 셔플 결과. 렌더 출력에 쓰이는 건 currentTitle뿐이고 그마저 started 이후라
  // ref로 들고 있어도 안전하다 (hydration mismatch 회피).
  const playlistRef = useRef<BgmTrack[]>(BGM_TRACKS);
  const errorStreakRef = useRef(0);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [index, setIndex] = useState(0);

  const playCurrent = useCallback((i: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = playlistRef.current[i].src;
    audio.play().then(
      () => setPlaying(true),
      () => setPlaying(false),
    );
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!started) {
      playlistRef.current = shuffle(BGM_TRACKS);
      errorStreakRef.current = 0;
      setStarted(true);
      setIndex(0);
      playCurrent(0);
      return;
    }
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().then(
        () => setPlaying(true),
        () => setPlaying(false),
      );
    }
  }, [started, playing, playCurrent]);

  const goTo = useCallback(
    (i: number) => {
      const n = playlistRef.current.length;
      const wrapped = ((i % n) + n) % n;
      setIndex(wrapped);
      playCurrent(wrapped);
    },
    [playCurrent],
  );

  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
    }
    setPlaying(false);
    setStarted(false);
    setIndex(0);
  }, []);

  // ended → 다음 곡, error → skip (전곡 연속 실패 시 정지)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => {
      errorStreakRef.current = 0;
      goTo(index + 1);
    };
    const onError = () => {
      errorStreakRef.current += 1;
      if (errorStreakRef.current >= playlistRef.current.length) {
        setPlaying(false);
        return;
      }
      goTo(index + 1);
    };
    const onPlay = () => {
      errorStreakRef.current = 0;
    };
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.addEventListener("playing", onPlay);
    return () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("playing", onPlay);
    };
  }, [goTo, index]);

  const currentTitle = started ? playlistRef.current[index].title : "";

  // Media Session: 잠금화면/OS 미디어 컨트롤 연동 (미지원 브라우저는 무시)
  useEffect(() => {
    if (!started || !("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTitle,
      artist: "bandsustain",
    });
    navigator.mediaSession.setActionHandler("play", toggle);
    navigator.mediaSession.setActionHandler("pause", toggle);
    navigator.mediaSession.setActionHandler("previoustrack", prev);
    navigator.mediaSession.setActionHandler("nexttrack", next);
    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("previoustrack", null);
      navigator.mediaSession.setActionHandler("nexttrack", null);
    };
  }, [started, currentTitle, toggle, prev, next]);

  const value = useMemo<BgmContextValue>(
    () => ({ started, playing, currentTitle, toggle, next, prev, stop }),
    [started, playing, currentTitle, toggle, next, prev, stop],
  );

  return (
    <BgmContext.Provider value={value}>
      {children}
      <audio ref={audioRef} preload="none" />
    </BgmContext.Provider>
  );
}
