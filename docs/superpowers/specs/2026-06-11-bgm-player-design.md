# BGM 플레이어 설계

날짜: 2026-06-11
상태: 승인됨

## 목적

bandsustain.com 전역에서 배경음악을 들을 수 있는 미니 플레이어. Nav 바의 음표
아이콘 버튼으로 재생을 시작하면 하단에 작은 플레이어 바가 나타난다. 사이트
콘텐츠를 방해하지 않는 위젯 수준의 존재감을 유지한다.

## 확정된 UX 결정

- **버튼 위치**: Nav 바 우측에 음표 아이콘 버튼. 클릭 시 재생 시작/일시정지 토글.
  재생 중에는 아이콘에 활성 표시.
- **재생 방식**: 마운트 시 Fisher-Yates 셔플로 순서 결정, 전곡 루프.
  이전/일시정지/다음(⏮ ⏯ ⏭) 컨트롤 제공.
- **재생 유지**: 클라이언트 네비게이션으로 페이지를 이동해도 끊김 없이 재생 유지.
  (전체 새로고침/이탈 시 정지는 허용 — 브라우저 한계)
- **곡 제목**: 플레이어 바에 한글 곡 제목 표시 (길면 ellipsis).
- **플레이어 바 레이아웃**:
  - 모바일: 하단 중앙 알약형 바 (둥근 모서리 + backdrop-blur). iOS 잠금화면
    미니 플레이어 느낌. 제목 + ⏮ ⏯ ⏭ + 닫기(X).
  - PC: 우하단 작은 위젯, 동일 구성.
  - X 클릭 시 정지 + 바 숨김. Nav 버튼으로 다시 시작 가능.
- 바는 재생을 한 번이라도 시작하기 전까지는 렌더링하지 않는다.

## 음원

원본: PROD 사이트 루트 `asset/musicplayer/` (mp3 3곡 + WAV 2곡, 총 145MB).

- WAV 2곡(`Singing.wav` 50MB, `별꿈.wav` 80MB)은 ffmpeg로 192kbps mp3 변환.
- 5곡 전체를 ASCII 슬러그로 리네임해 레포 `public/bgm/`에 커밋 (~30–35MB).
  git pull만으로 DEV/PROD 배포 — vhost/SELinux/수동 동기화 불필요.
- 한글 제목은 매니페스트에서 매핑 (URL에 한글 미사용).

| 파일 (슬러그) | 제목 |
|---|---|
| `isekai.mp3` | 이세계로 초대할게 |
| `kkumgyeol.mp3` | 꿈결에서 |
| `shine-is-mine.mp3` | Shine is Mine |
| `singing.mp3` | Singing |
| `byeolkkum.mp3` | 별꿈 |

기각한 대안: Apache Alias `/bgm` → git 외부 asset 디렉토리. vhost 수정 2곳 +
SELinux + DEV/PROD 수동 동기화 비용 대비 이점 없음 (변환하면 용량이 충분히 작음).

## 아키텍처

모두 클라이언트 컴포넌트. 서버/DB 변경 없음.

### `src/lib/bgm.ts`
플레이리스트 매니페스트: `{ src: "/bgm/<slug>.mp3", title: string }[]` 정적 배열.

### `src/components/bgm/BgmProvider.tsx`
React Context + 단일 `<audio>` 엘리먼트 소유.

- 상태: 셔플된 플레이리스트, 현재 인덱스, `playing`, `started`(바 노출 여부).
- `ended` 이벤트 → 다음 곡 자동 진행, 마지막 곡 다음은 처음으로 (전곡 루프).
- `error` 이벤트 → 해당 곡 skip하고 다음 곡.
- `preload="none"` — 재생 전 불필요한 다운로드 방지.
- Media Session API: 곡 제목 메타데이터 + play/pause/previoustrack/nexttrack
  핸들러 등록 (잠금화면/OS 미디어 컨트롤 연동). 미지원 브라우저는 무시.
- 노출 API: `toggle()`, `next()`, `prev()`, `stop()`(정지+바 숨김),
  `playing`, `started`, `currentTitle`.

### Nav 음표 버튼 (`Nav.tsx` 수정)
- 우측에 음표 아이콘 버튼 추가. **인라인 SVG 사용** — 유니코드 글리프(♪) 금지
  (모바일 폰트 누락 footgun, [[feedback_unicode_hamburger_mobile]]).
- `useBgm().toggle()` 호출. 재생 중 활성 표시(색상/점).

### `src/components/bgm/BgmMiniPlayer.tsx`
`started`가 true일 때만 렌더링되는 fixed 바.

- 모바일(`< sm`): 하단 중앙, 알약형, backdrop-blur, 제목(ellipsis) + ⏮ ⏯ ⏭ + X.
- PC(`sm+`): 우하단 고정 소형 위젯, 동일 구성.
- Tailwind로 스타일링, 기존 디자인 토큰/색상 따름.

### 배치 (`SiteChrome.tsx` 수정)
`BgmProvider`가 Nav + children + Footer + `BgmMiniPlayer`를 감싼다.
layout 레벨이라 클라이언트 네비게이션 간 언마운트 없음 → 재생 유지.
full-bleed 라우트(페달보드 에디터)에서는 Provider/오디오는 유지하되
Nav가 없으므로 바 UI만 숨김(오디오는 계속).

## 에러 처리

- 곡 로드 실패: skip 후 다음 곡. 전곡 실패 시 정지 상태로 바만 유지.
- 자동재생 정책: 항상 사용자 클릭으로 시작하므로 비해당.

## 테스트

수동 검증 (DEV https://dev.bandsustain.com):
- 재생/일시정지/이전/다음/닫기 동작
- 곡 종료 시 자동 다음 곡, 마지막 곡 후 루프
- 페이지 이동 중 재생 유지
- 모바일 뷰포트 바 레이아웃 / PC 위젯 레이아웃
- 모바일 실기기에서 잠금화면 미디어 컨트롤(Media Session) 확인

레포에 기존 자동화 테스트 인프라 없음 — E2E 추가는 범위 외 (YAGNI).

## 배포

표준 플로우: dev 커밋/푸시 + `pnpm build` + `pm2 restart bandsustain-dev` →
DEV 확인 요청에서 정지. 운영 반영은 사용자 명시 요청 시에만.
DB/vhost/cron 변경 없음.
