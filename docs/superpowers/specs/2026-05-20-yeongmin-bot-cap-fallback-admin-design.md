# Yeongmin Bot Cap Fallback Admin Design

## Goal

영민봇이 세션 메시지 한도(`session_msg_cap`) 또는 일일 토큰 한도(`daily_token_cap`)에 도달했을 때 사용자에게 보내는 마지막 메시지를 관리자페이지에서 자유롭게 편집할 수 있게 한다.

현재는 두 메시지가 `src/app/api/playground/kim-yeongmin-bot/chat/route.ts` 상수로 하드코딩되어 있어 운영자가 톤/안내를 바꾸려면 배포가 필요하다. 이미 같은 성격의 `long_input_fallback_reply` 가 admin 제어 가능한 패턴으로 구현되어 있으므로 그 패턴을 그대로 확장한다.

## Scope

포함:

- `yeongmin_settings` 테이블에 `session_cap_fallback_reply`, `daily_cap_fallback_reply` 두 컬럼 추가 (`TEXT NULL`)
- 채팅 API 가 한도 도달 시 admin 값이 있으면 그것을, 없으면 기존 하드코딩 기본값을 사용
- `clampReply` 를 admin 입력에도 동일하게 적용 (출력 길이 제어 일관성 유지)
- Admin settings GET/PATCH API 에 두 필드 매핑 추가
- `/admin/(authed)/yeongmin-bot/prompt` 페이지 하단에 "한도 메시지" 섹션 추가 (textarea 2개 + 저장)

제외:

- 트리거 시점 변경 (지금 그대로: 사용자가 N+1번째 메시지를 보냈을 때 응답으로 노출)
- `FALLBACK_OPENAI_ERROR` / `FALLBACK_NOT_CONFIGURED` admin 제어 (디버깅 명확성 우선, 하드코딩 유지)
- 신규 admin 라우트 또는 사이드바 항목 추가

## Behavior

### 트리거 (변경 없음)

- 사용자가 메시지를 전송하면 `POST /api/playground/kim-yeongmin-bot/chat` 진입
- `countSessionMessagesLast24h(sessionId) >= settings.sessionMsgCap` → session cap fallback 응답 후 `sessionLimitReached: true`
- `sumTodayTokens() >= settings.dailyTokenCap` → daily cap fallback 응답 후 `dailyLimitReached: true`
- 응답을 받은 ChatRoom 컴포넌트는 `setDisabled(true)` 로 입력창을 잠금 (기존 그대로)

### Fallback 선택 규칙

기존 `longInputFallbackReply` 와 동일한 패턴:

```ts
const sessionCapReply = clampReply(
  settings.sessionCapFallbackReply?.trim() || FALLBACK_SESSION_CAP,
  { outputMaxChars: settings.outputMaxChars, outputMaxLines: settings.outputMaxLines },
);
```

- DB 값이 `NULL` 이거나 trim 후 빈 문자열 → 기존 하드코딩 default (`FALLBACK_SESSION_CAP` / `FALLBACK_DAILY_CAP`) 사용
- DB 값이 있으면 `clampReply` 거쳐서 응답 (admin 이 너무 길게 써도 영민봇 톤 깨지지 않게)

이 규칙으로 admin 이 실수로 빈 칸 저장해도 봇이 무응답이 되는 사고를 막는다.

## Data Model

마이그레이션 파일: `db/schema/014_yeongmin_bot_cap_fallbacks.sql`

```sql
ALTER TABLE yeongmin_settings
  ADD COLUMN session_cap_fallback_reply TEXT NULL AFTER long_input_fallback_reply,
  ADD COLUMN daily_cap_fallback_reply   TEXT NULL AFTER session_cap_fallback_reply;
```

기본값은 두지 않는다 (`NULL`). 기존 하드코딩 문구가 코드 측 기본값이므로 DB 기본값을 박아두면 코드와 두 곳을 동기화해야 하는 부담만 생긴다.

## Code Touch Points

### `src/lib/yeongminBot.ts`

`YeongminSettings`, `SettingsRow`, `rowToSettings`, `UpdatableSettings`, `updateSettings` 의 column-key 매핑에 각각 추가:

- `sessionCapFallbackReply: string | null` ↔ `session_cap_fallback_reply`
- `dailyCapFallbackReply: string | null` ↔ `daily_cap_fallback_reply`

기존 `longInputFallbackReply` 가 등장하는 모든 자리에 동일한 형태로 동행.

### `src/app/api/admin/yeongmin-bot/settings/route.ts`

- `STRING_KEYS` Set 에 `sessionCapFallbackReply`, `dailyCapFallbackReply` 추가
- `GET` 응답 JSON 에 두 필드 포함

`UpdatableSettings` 가 lib 에서 export 되고 있고, route 의 STRING_KEYS 가 그 키들의 부분집합이라는 점을 유지한다.

### `src/app/api/playground/kim-yeongmin-bot/chat/route.ts`

두 군데:

1. session cap 분기 (현재 `chat/route.ts:108~119`):
   ```ts
   if (sessionCount >= settings.sessionMsgCap) {
     const reply = clampReply(
       settings.sessionCapFallbackReply?.trim() || FALLBACK_SESSION_CAP,
       { outputMaxChars: settings.outputMaxChars, outputMaxLines: settings.outputMaxLines },
     );
     return replyJson(reply, /* ... */);
   }
   ```
2. daily cap 분기 (현재 `chat/route.ts:122~133`): 동일 패턴.

`FALLBACK_SESSION_CAP` / `FALLBACK_DAILY_CAP` 상수는 그대로 둔다 (default 역할).

### `src/app/admin/(authed)/yeongmin-bot/prompt/page.tsx`

기존 프롬프트 편집 페이지 하단에 새 섹션 추가:

```
한도 메시지 (비워두면 기본값 사용)
─────────────────────────────────────────
세션 한도 도달 시
  [ textarea — sessionCapFallbackReply ]

일일 토큰 한도 도달 시
  [ textarea — dailyCapFallbackReply ]

  최대 {outputMaxChars}자 / {outputMaxLines}줄 안에서 잘려서 노출됩니다.

[저장]
```

현재 prompt 페이지는 `Sections` 단일 state 객체와 단일 [저장] 버튼이 모든 필드를 한 번에 PATCH 한다. 그 패턴을 그대로 확장:

- 상단의 `Sections` 타입에 두 신규 필드 추가 (또는 별도 state 두 개로 분리해 같은 save 함수에 합쳐 보내도 됨, 단일 PATCH 한 번)
- 화면 하단(섹션 10 답변 예시 아래)에 두 textarea 추가, [저장] / [미리보기] 버튼은 그대로 1조 유지
- 미리보기 토글은 한도 메시지에는 적용되지 않음 (system prompt 가 아니므로 `assemblePreview` 의 일부가 아님)

CSS 는 bandsustain CLAUDE.md 의 디자인 규칙 — Tailwind 유틸만, 직각 input, underline 링크, 단일 액센트 블루 미사용 — 을 그대로 따른다.

## Validation & Limits

- Admin PATCH 측 validation 은 기존 `STRING_KEYS` 분기에 위임. `typeof v !== "string"` 만 거른다.
- 길이 상한은 강제하지 않는다. `clampReply` 가 응답 시점에 잘라낸다.
- HTML 이스케이프/Markdown 처리는 하지 않는다. 영민봇 응답은 텍스트 그대로 채팅 말풍선에 들어가므로 (기존 동작과 동일) admin 이 평문으로 작성한다.

## Test Plan

### 단위 테스트

신규 또는 보강:

- `clampReply` 가 admin 이 채운 긴 fallback 을 정확히 잘라내는지 (기존 테스트가 cover 하면 추가 불요)
- `getSettings` / `updateSettings` 가 두 신규 컬럼을 정확히 읽고/쓰는지 — 기존 `long_input_fallback_reply` 케이스를 따라 1~2 케이스 추가

### 동작 검증 (수동)

운영 반영 전 DEV 에서:

1. admin → 영민봇 → 프롬프트 탭 → 한도 메시지 두 칸에 짧은 한국어 문구 저장
2. `session_msg_cap` 을 2 로 임시 낮추고 (또는 DB 직접 update) playground 에서 2턴 대화 후 3번째 시도 → 저장한 session cap 문구가 응답으로 나오는지 확인
3. session cap 문구를 빈 칸으로 저장 후 다시 시도 → 기존 하드코딩 default 가 노출되는지 확인
4. daily cap 은 토큰 cap 을 한 자리수로 낮춰 동일 검증

검증 후 사용자 명시 요청 시 main 머지 + PROD pull + build + pm2 restart bandsustain.

## Backward Compatibility

- 마이그레이션은 NULL 허용 컬럼 추가뿐 → 기존 row 영향 없음
- chat route 는 `settings.sessionCapFallbackReply?.trim() || FALLBACK_*` 패턴이라 마이그레이션 안 돈 상태에서도 (예: 일시적 DB 시점 차이) 컬럼이 없으면 lib 측에서 `undefined` 로 들어와 default 로 폴백
- Admin GET 응답 스키마에 두 필드 추가 — 기존 프론트엔드는 미사용 필드 무시
- 기존 admin 사이드바, KPI, 세션 목록, 코퍼스, API 키, 프로필 흐름 변경 없음

## Out of Scope (Future)

- `openai_error` / `not_configured` admin 제어 — 디버깅용 명확한 표식이 더 가치 있어 보류
- 한도 메시지 A/B 또는 시간대별 다른 문구 — 운영 필요 시 별도 spec
- 한도 도달 직전 (`sessionCount === sessionMsgCap - 1` 같은 시점) 미리 한 줄 더 짧게 알리기 — 사용자가 요청하지 않은 추가 UX
