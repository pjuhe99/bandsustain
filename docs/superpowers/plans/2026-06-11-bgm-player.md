# BGM 플레이어 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nav 음표 버튼으로 BGM을 재생하고, 하단 미니 플레이어 바(모바일 알약형 / PC 우하단 위젯)로 컨트롤한다. 페이지 이동 간 재생 유지.

**Architecture:** `BgmProvider`(React Context + 단일 `<audio>`)가 셔플/루프/에러 skip/Media Session을 담당하고, Nav 버튼과 `BgmMiniPlayer`가 컨텍스트를 소비한다. `SiteChrome`에서 Provider가 full-bleed 분기까지 감싸 클라이언트 네비게이션 간 언마운트를 막는다. 음원은 `public/bgm/`에 커밋된 정적 mp3.

**Tech Stack:** Next.js 16 App Router, React Context, Tailwind, ffmpeg(일회성 변환). 서버/DB/vhost 변경 없음.

**스펙:** `docs/superpowers/specs/2026-06-11-bgm-player-design.md`

---

## 작업 환경 규칙 (모든 태스크 공통)

- 작업 디렉토리: `/root/bandsustain-dev/public_html/bandsustain` (dev 브랜치)
- **git/pnpm 명령은 반드시 `sudo -u ec2-user`로 실행** (root로 실행하면 root 소유 파일이 생겨 이후 ec2-user 빌드/머지가 EACCES로 깨짐)
- root로 파일을 생성했다면 커밋 전 `chown ec2-user:ec2-user`로 보정
- 이 레포에는 자동화 테스트 인프라가 없음 (스펙에서 수동 검증으로 확정). 태스크별 검증은 `sudo -u ec2-user pnpm exec tsc --noEmit`(타입체크), 최종 검증은 `pnpm build` + DEV 브라우저 확인
- **운영 배포 금지.** dev push 후 멈추고 사용자 확인 요청

---

### Task 1: 음원 변환 및 `public/bgm/` 배치

**Files:**
- Create: `public/bgm/isekai.mp3`, `public/bgm/kkumgyeol.mp3`, `public/bgm/shine-is-mine.mp3`, `public/bgm/singing.mp3`, `public/bgm/byeolkkum.mp3`

원본은 PROD 사이트 루트 `/var/www/html/_______site_BANDSUSTAIN/asset/musicplayer/` (읽기만 함, 수정 금지).

- [ ] **Step 1: 디렉토리 생성 + mp3 3곡 복사(리네임)**

```bash
APP=/root/bandsustain-dev/public_html/bandsustain
SRC="/var/www/html/_______site_BANDSUSTAIN/asset/musicplayer"
mkdir -p "$APP/public/bgm"
cp "$SRC/이세계로 초대할게.mp3" "$APP/public/bgm/isekai.mp3"
cp "$SRC/꿈결에서.mp3"          "$APP/public/bgm/kkumgyeol.mp3"
cp "$SRC/Shine is Mine.mp3"     "$APP/public/bgm/shine-is-mine.mp3"
```

- [ ] **Step 2: WAV 2곡을 192kbps mp3로 변환**

```bash
ffmpeg -y -i "$SRC/Singing.wav" -codec:a libmp3lame -b:a 192k "$APP/public/bgm/singing.mp3"
ffmpeg -y -i "$SRC/별꿈.wav"    -codec:a libmp3lame -b:a 192k "$APP/public/bgm/byeolkkum.mp3"
```

- [ ] **Step 3: 결과 검증 (5파일, 총 ~26MB, 각 곡 재생 길이 원본과 일치)**

```bash
ls -la "$APP/public/bgm/" && du -sh "$APP/public/bgm/"
for f in "$APP/public/bgm/"*.mp3; do ffprobe -v error -show_entries format=duration -of csv=p=0 "$f" | xargs printf "%s: %.0fs\n" "$(basename "$f")"; done
```

Expected: isekai 194s, kkumgyeol 257s, shine-is-mine 178s, singing 173s, byeolkkum 277s (±1s)

- [ ] **Step 4: 소유권 보정 후 커밋**

```bash
chown -R ec2-user:ec2-user "$APP/public/bgm"
cd "$APP" && sudo -u ec2-user git add public/bgm && sudo -u ec2-user git commit -m "feat(bgm): add 5 bgm tracks (wav transcoded to 192k mp3)"
```

---

### Task 2: 플레이리스트 매니페스트

**Files:**
- Create: `src/lib/bgm.ts`

- [ ] **Step 1: 매니페스트 작성**

```ts
export type BgmTrack = {
  src: string;
  title: string;
};

export const BGM_TRACKS: BgmTrack[] = [
  { src: "/bgm/isekai.mp3", title: "이세계로 초대할게" },
  { src: "/bgm/kkumgyeol.mp3", title: "꿈결에서" },
  { src: "/bgm/shine-is-mine.mp3", title: "Shine is Mine" },
  { src: "/bgm/singing.mp3", title: "Singing" },
  { src: "/bgm/byeolkkum.mp3", title: "별꿈" },
];
```

- [ ] **Step 2: 타입체크 후 커밋**

```bash
cd /root/bandsustain-dev/public_html/bandsustain
sudo -u ec2-user pnpm exec tsc --noEmit
sudo -u ec2-user git add src/lib/bgm.ts && sudo -u ec2-user git commit -m "feat(bgm): playlist manifest"
```

---

### Task 3: BgmProvider (Context + 오디오 엔진)

**Files:**
- Create: `src/components/bgm/BgmProvider.tsx`

설계 결정 (코드에 반영됨, 임의 변경 금지):
- **셔플은 첫 재생 시점에** 수행한다. useState 초기값에서 `Math.random()`을 쓰면 SSR/클라이언트 hydration mismatch가 난다.
- effect deps는 원시값(`index`)과 안정 ref만 사용한다 (매 렌더 새 객체를 deps에 넣으면 state 리셋 버그 — 이 서버에서 실제 사고 이력 있음).
- `error` 이벤트 시 다음 곡으로 skip하되, 연속 실패가 곡 수에 도달하면 정지 (무한 루프 방지).

- [ ] **Step 1: Provider 작성**

```tsx
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
```

- [ ] **Step 2: 타입체크 후 커밋**

```bash
cd /root/bandsustain-dev/public_html/bandsustain
sudo -u ec2-user pnpm exec tsc --noEmit
sudo -u ec2-user git add src/components/bgm/BgmProvider.tsx && sudo -u ec2-user git commit -m "feat(bgm): BgmProvider context + audio engine (shuffle/loop/skip/media-session)"
```

---

### Task 4: BgmMiniPlayer (하단 바 UI)

**Files:**
- Create: `src/components/bgm/BgmMiniPlayer.tsx`

설계 결정:
- z-index는 `z-40` — 모바일 메뉴 오버레이(z-50)·LyricsModal(z-60)보다 아래.
- 모바일: 하단 중앙 알약형 풀폭(좌우 16px 여백). PC(sm+): 우하단 고정폭 위젯.
- 아이콘은 전부 **인라인 SVG** (유니코드 글리프 금지 — 모바일 폰트 누락 footgun).
- `started`가 false면 null 반환.

- [ ] **Step 1: 컴포넌트 작성**

```tsx
"use client";

import { useBgm } from "./BgmProvider";

function PrevIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
      <path d="M6 6h2v12H6zM20 6l-10 6 10 6V6z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6" aria-hidden="true">
      <path d="M8 5v14l11-7L8 5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6" aria-hidden="true">
      <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
    </svg>
  );
}

function NextIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
      <path d="M16 6h2v12h-2zM4 6l10 6-10 6V6z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="w-4 h-4"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export default function BgmMiniPlayer() {
  const { started, playing, currentTitle, toggle, next, prev, stop } = useBgm();

  if (!started) return null;

  return (
    <div className="fixed z-40 bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:w-80">
      <div className="flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)]/85 backdrop-blur-md shadow-lg pl-4 pr-2 py-2">
        <span className="flex-1 min-w-0 truncate text-sm font-medium">{currentTitle}</span>
        <button
          onClick={prev}
          aria-label="이전 곡"
          className="w-8 h-8 flex items-center justify-center text-[var(--color-text)] hover:text-[var(--color-accent)]"
        >
          <PrevIcon />
        </button>
        <button
          onClick={toggle}
          aria-label={playing ? "일시정지" : "재생"}
          className="w-9 h-9 flex items-center justify-center text-[var(--color-text)] hover:text-[var(--color-accent)]"
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button
          onClick={next}
          aria-label="다음 곡"
          className="w-8 h-8 flex items-center justify-center text-[var(--color-text)] hover:text-[var(--color-accent)]"
        >
          <NextIcon />
        </button>
        <button
          onClick={stop}
          aria-label="플레이어 닫기"
          className="w-8 h-8 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 타입체크 후 커밋**

```bash
cd /root/bandsustain-dev/public_html/bandsustain
sudo -u ec2-user pnpm exec tsc --noEmit
sudo -u ec2-user git add src/components/bgm/BgmMiniPlayer.tsx && sudo -u ec2-user git commit -m "feat(bgm): mini player bar (mobile pill / desktop widget)"
```

---

### Task 5: Nav 음표 버튼

**Files:**
- Modify: `src/components/Nav.tsx`

설계 결정:
- 데스크톱·모바일 모두 헤더 우측에 항상 노출. 우측 영역을 `flex items-center` 컨테이너로 묶어 데스크톱 nav 링크 → 음표 버튼 → 모바일 햄버거 순으로 배치.
- 재생 중이면 아이콘이 accent 색 + 우상단 점 표시.
- 음표 아이콘은 인라인 SVG (lucide `music` 모양).

- [ ] **Step 1: import 추가**

`Nav.tsx` 상단 import 블록에 추가:

```tsx
import { useBgm } from "./bgm/BgmProvider";
```

- [ ] **Step 2: 컴포넌트에서 useBgm 호출**

`const [open, setOpen] = useState(false);` 바로 아래에 추가:

```tsx
const { toggle: toggleBgm, playing: bgmPlaying } = useBgm();
```

- [ ] **Step 3: 헤더 우측 재구성**

기존 (데스크톱 nav와 햄버거 버튼이 형제로 나열):

```tsx
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="hover:underline underline-offset-4 decoration-2"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <button
            className="md:hidden w-8 h-8 flex flex-col items-center justify-center gap-1.5"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
          >
            <span className="block w-6 h-[2px] bg-[var(--color-text)]" />
            <span className="block w-6 h-[2px] bg-[var(--color-text)]" />
            <span className="block w-6 h-[2px] bg-[var(--color-text)]" />
          </button>
```

변경 후:

```tsx
          <div className="flex items-center gap-4 md:gap-8">
            <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
              {navLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="hover:underline underline-offset-4 decoration-2"
                >
                  {l.label}
                </Link>
              ))}
            </nav>

            <button
              onClick={toggleBgm}
              aria-label={bgmPlaying ? "배경음악 일시정지" : "배경음악 재생"}
              className={`relative w-8 h-8 flex items-center justify-center ${
                bgmPlaying
                  ? "text-[var(--color-accent)]"
                  : "text-[var(--color-text)] hover:text-[var(--color-accent)]"
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5"
                aria-hidden="true"
              >
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
              {bgmPlaying && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" />
              )}
            </button>

            <button
              className="md:hidden w-8 h-8 flex flex-col items-center justify-center gap-1.5"
              aria-label="Open menu"
              onClick={() => setOpen(true)}
            >
              <span className="block w-6 h-[2px] bg-[var(--color-text)]" />
              <span className="block w-6 h-[2px] bg-[var(--color-text)]" />
              <span className="block w-6 h-[2px] bg-[var(--color-text)]" />
            </button>
          </div>
```

- [ ] **Step 4: 타입체크 후 커밋**

```bash
cd /root/bandsustain-dev/public_html/bandsustain
sudo -u ec2-user pnpm exec tsc --noEmit
sudo -u ec2-user git add src/components/Nav.tsx && sudo -u ec2-user git commit -m "feat(bgm): music note toggle button in nav"
```

주의: 이 시점에서 Nav가 `useBgm`을 호출하므로, Task 6(SiteChrome에 Provider 배치) 전까지는
런타임에서 "useBgm must be used within BgmProvider" 에러가 난다. Task 5와 6은 연달아 진행하고,
브라우저 확인은 Task 6 이후에 한다 (타입체크는 통과함).

---

### Task 6: SiteChrome 통합

**Files:**
- Modify: `src/components/SiteChrome.tsx`

설계 결정: **BgmProvider가 full-bleed 분기까지 포함해 전체를 감싼다.** full-bleed 분기를
Provider 밖에 두면 페달보드 에디터 진입 시 Provider가 언마운트되어 음악이 끊긴다.
full-bleed 라우트에서는 바 UI만 숨긴다 (Nav가 없으니 음표 버튼도 없음 — 오디오는 유지).

- [ ] **Step 1: SiteChrome 전체 교체**

```tsx
"use client";

import { usePathname } from "next/navigation";
import Footer from "./Footer";
import Nav from "./Nav";
import BgmProvider from "./bgm/BgmProvider";
import BgmMiniPlayer from "./bgm/BgmMiniPlayer";

// Routes that need a full-bleed canvas (no site nav, no site footer).
// The editor needs the viewport top-to-bottom for the fixed right panel
// and the in-canvas TopBar; the surrounding chrome would clip both.
const FULL_BLEED = [/^\/playground\/pedalboard-planner\/edit\//];

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const path = usePathname() ?? "";
  const fullBleed = FULL_BLEED.some((re) => re.test(path));
  // BgmProvider 는 full-bleed 여부와 무관하게 항상 마운트 상태를 유지해야
  // 라우트 전환 시 BGM 이 끊기지 않는다. 분기는 Provider 안쪽에서만.
  return (
    <BgmProvider>
      {fullBleed ? (
        <main className="flex-1 flex flex-col">{children}</main>
      ) : (
        <>
          <Nav />
          <main className="flex-1">{children}</main>
          <Footer />
          <BgmMiniPlayer />
        </>
      )}
    </BgmProvider>
  );
}
```

- [ ] **Step 2: 타입체크 후 커밋**

```bash
cd /root/bandsustain-dev/public_html/bandsustain
sudo -u ec2-user pnpm exec tsc --noEmit
sudo -u ec2-user git add src/components/SiteChrome.tsx && sudo -u ec2-user git commit -m "feat(bgm): mount BgmProvider + mini player in SiteChrome"
```

---

### Task 7: 빌드 · DEV 반영 · 검증

- [ ] **Step 1: 빌드**

```bash
cd /root/bandsustain-dev/public_html/bandsustain
sudo -u ec2-user pnpm build
```

Expected: 빌드 성공 (lint/type 에러 0). 실패 시 원인 수정 후 재빌드.

- [ ] **Step 2: DEV PM2 재시작**

```bash
sudo -u ec2-user pm2 restart bandsustain-dev
```

- [ ] **Step 3: HTTP smoke**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://dev.bandsustain.com/
curl -s -o /dev/null -w "%{http_code} %{size_download}\n" https://dev.bandsustain.com/bgm/isekai.mp3
curl -s -o /dev/null -w "%{http_code}\n" -H "Range: bytes=0-1023" https://dev.bandsustain.com/bgm/byeolkkum.mp3
```

Expected: `200` / `200 7777800` / `206` (range 지원)

- [ ] **Step 4: dev push**

```bash
cd /root/bandsustain-dev/public_html/bandsustain
sudo -u ec2-user git push origin dev
```

- [ ] **Step 5: ⛔ 멈춤 — 사용자에게 DEV 확인 요청**

사용자에게 https://dev.bandsustain.com 에서 수동 검증 요청:
- Nav 음표 버튼 클릭 → 재생 시작 + 하단 바 노출 + 버튼 활성 표시
- ⏮ ⏯ ⏭ / X(정지+숨김) 동작, X 후 음표 버튼으로 재시작
- 곡 끝나면 자동 다음 곡
- 페이지 이동(예: 홈 → Members) 중 재생 유지
- 모바일 뷰포트: 하단 알약 바 / PC: 우하단 위젯
- 모바일 실기기: 잠금화면 미디어 컨트롤에 곡 제목·이전/다음 표시
- 페달보드 에디터 진입 시 음악 유지(바는 숨김), 나오면 바 복귀

**운영 반영은 사용자가 명시적으로 요청한 경우에만** (main 머지 → prod pull → prod build → pm2 restart bandsustain).
