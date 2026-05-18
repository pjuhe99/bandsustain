# Yeongmin Bot Official Context Design

## Goal

영민봇이 답변할 때 `bandsustain.com`의 공식 데이터를 참고할 수 있게 한다.  
1차 범위는 `live`, `members`, `songs`, `news` 4개 리소스다.

핵심 목표는 두 가지다.

- 사용자가 공연 일정, 멤버, 곡, 사이트 뉴스에 대해 물었을 때 영민봇이 사이트 기반 정보를 참고해 더 정확하게 답한다.
- 토큰 낭비를 막기 위해 필요한 데이터만, 필요한 밀도로 주입한다.

## Scope

포함:

- 영민봇 채팅 API에 질문 분류 로직 추가
- 질문 분류 결과에 따라 사이트 데이터 조회
- 조회 결과를 짧은 `official context` 텍스트로 조립
- 기존 system prompt 뒤에 `official context`를 추가해 OpenAI 호출
- `news`는 사실 정보가 아니라 유머/설정성 기사일 수 있다는 별도 규칙 추가

제외:

- 어드민 설정 UI 추가
- 크롤링 또는 외부 HTTP 호출
- 벡터 검색/임베딩
- 2단계 LLM tool use

## Data Policy

리소스별 처리 원칙은 아래와 같다.

### Members

- `published` 멤버 전부 사용
- 사실 정보로 취급
- `nameKr`, `nameEn`, `position`, `favoriteArtist`, `favoriteSong` 정도만 주입

### Songs

- `published` 곡 전부 사용
- 사실 정보로 취급
- `title`, `category`, `releasedAt`, `listenUrl` 존재 여부 정도만 주입
- `lyrics`는 길고 토큰 비용이 크므로 주입하지 않음

### Live

- `published` 공연 정보를 사용
- 사실 정보로 취급
- 예정 공연은 전부 주입
- 지난 공연은 직접 관련 질문일 때만 최근 일부만 주입
- 공연 관련 답변은 `live`를 최우선 근거로 삼음

### News

- `published` 뉴스 목록을 사용
- 사이트에 게시된 공식 콘텐츠이지만, 사실 보장 데이터로 취급하지 않음
- 헤드라인, 날짜, 카테고리, 짧은 요약만 주입
- 본문 전문은 주입하지 않음
- 뉴스만 근거일 경우 단정적으로 말하지 않음

## Recommended Approach

### Option A

모든 리소스를 모든 요청에 항상 주입한다.

- 장점: 구현 단순
- 단점: 토큰 낭비가 크고 말투 품질이 흐려질 가능성이 높음

### Option B

질문을 분류하고 관련 리소스만 주입한다.

- 장점: 토큰 효율이 좋고 정확도와 응답 품질의 균형이 가장 좋음
- 단점: 분류 로직이 필요함

### Option C

모델이 먼저 필요한 데이터 타입을 판단하고 2차 조회한다.

- 장점: 유연함
- 단점: 구조가 과하고 복잡하며 현재 범위에 비해 비용이 큼

채택:

- **Option B**

## Architecture

### New Helper

신규 파일:

- `src/lib/yeongminBotContext.ts`

책임:

- 마지막 사용자 메시지를 기준으로 질문을 분류
- 관련 리소스 데이터를 읽음
- `official context` 문자열을 조립

예상 public 함수:

```ts
export async function buildYeongminOfficialContext(
  latestUserMessage: string,
): Promise<string | null>
```

### Existing Chat Route

수정 대상:

- `src/app/api/playground/kim-yeongmin-bot/chat/route.ts`

변경:

- 마지막 사용자 메시지 추출
- `buildYeongminOfficialContext(latestUserMessage)` 호출
- 기존 `assemblePrompt(settings)` 결과 뒤에 공식 context를 이어붙임

구조 예시:

```ts
const basePrompt = assemblePrompt(settings);
const officialContext = await buildYeongminOfficialContext(latestMessage);
const systemPrompt = officialContext
  ? `${basePrompt}\n\n${officialContext}`
  : basePrompt;
```

## Classification Rules

완전한 NLP가 아니라 가벼운 키워드 분류로 시작한다.

### Live Keywords

- 공연
- 라이브
- live
- 일정
- 언제
- 어디
- venue
- ticket

### Member Keywords

- 멤버
- member
- 누구
- 보컬
- 기타
- 드럼
- 베이스
- 김영민

### Song Keywords

- 곡
- 노래
- song
- songs
- 듣기
- 발매
- 싱글
- 앨범
- 추천곡

### News Keywords

- 뉴스
- 소식
- 기사
- news
- 최근

### Fallback Rule

- 어떤 키워드도 안 걸리면 context 주입 안 함
- 다중 매치면 관련 섹션을 함께 주입
- 공연 일정처럼 high-confidence factual 질문은 `live`를 우선

## Context Shape

최종 프롬프트에 들어갈 블록은 아래 구조를 따른다.

```text
## Official Bandsustain Context
Use this context only when it is relevant to the user's question.
Members, songs, and live data should be treated as official site-backed factual information.
News items are site content but may include playful, fictional, or exaggerated editorial writing.
Do not treat news alone as hard fact when answering schedule, member, or release questions.

### Upcoming Live
- 2026-06-01 / Seoul / Club A

### Members
- 김영민 (Yeongmin Kim) — Song writer / Vocal / Guitar

### Songs
- Shine is mine — Single — 2026-05-01 — listen link available

### News
- 2026-04-24 / Business / “...” / humorous editorial article
```

## Formatting Rules Per Resource

### Live

- 날짜, 도시, 공연장 위주
- `ticketUrl` 또는 `videoUrl` 존재 여부는 짧게만 표기
- 예정 공연과 지난 공연을 섞어 넣지 않음

### Members

- 한 줄당 한 명
- 포지션 중심
- 취향 정보는 있으면 보조로만 표기

### Songs

- 한 줄당 한 곡
- 제목, 분류, 발매일
- 링크는 `available` 정도만 표기

### News

- 헤드라인 + 날짜 + 카테고리 + 1문장 이하 요약
- 요약은 본문 앞부분 일부를 짧게 잘라 만든다
- 각 뉴스 항목은 암묵적으로 factual source가 아니라 editorial source라는 취급

## Prompt Behavior Rules

기존 영민봇 프롬프트에 더해 아래 동작을 보장한다.

- `live`, `members`, `songs`와 충돌하는 내용은 사이트 context를 우선한다.
- `news`만 근거인 경우 확정 어조를 피한다.
- 사용자가 “이 뉴스 진짜냐”라고 물으면 유머/설정 가능성을 같이 언급한다.
- 사이트에 없는 공연 일정, 멤버 정보, 발매 일정을 지어내지 않는다.
- 정보가 없으면 `LIVE`, `NEWS`, `SONGS`, `MEMBERS`를 보라고 유도한다.

## Implementation Plan Shape

예상 변경 파일:

- `src/lib/yeongminBotContext.ts` 신규
- `src/app/api/playground/kim-yeongmin-bot/chat/route.ts` 수정
- 필요시 `src/lib/news.ts`의 `excerpt()` 재사용 또는 보조 formatter 추가

## Testing

### Unit-ish Verification

- 공연 질문 시 `Upcoming Live` 블록이 들어가는지
- 멤버 질문 시 `Members` 블록이 들어가는지
- 곡 질문 시 `Songs` 블록이 들어가는지
- 뉴스 질문 시 `News` 블록과 caution 문구가 들어가는지
- 일반 잡담엔 context가 비어 있는지

### Manual Chat Scenarios

1. `다음 공연 언제야?`
2. `서스테인 멤버 누구야?`
3. `대표곡 뭐 있어?`
4. `최근 뉴스 봤는데 그거 진짜야?`
5. `기타 페달 추천해줘`

기대 결과:

- 1, 2, 3은 사이트 데이터 반영
- 4는 뉴스가 유머/설정일 수 있음을 언급
- 5는 불필요한 context 주입 없이 기존 캐릭터 답변 유지

## Risks

### Over-injection

질문과 무관한 데이터까지 많이 붙으면 말투 품질이 흐려질 수 있다.  
대응: 키워드 분류 후 관련 섹션만 주입한다.

### News Misread As Fact

뉴스가 사실처럼 소비될 수 있다.  
대응: system prompt와 context header 모두에 caution을 명시한다.

### Prompt Bloat

공개 데이터가 늘어나면 prompt가 커질 수 있다.  
대응: 현재는 members/songs/live 전부, news는 요약만 주입하되, 추후 데이터가 커지면 어드민 설정으로 상한을 추가한다.

## Decision Summary

- 공연 / 멤버 / 곡 / 뉴스 4종 자동 참조
- `members`, `songs`, `live`는 구조화된 공식 데이터로 취급
- `news`는 사이트 콘텐츠이지만 장난/설정성 editorial로 취급
- 질문 분류 기반 selective injection 채택
- 길이가 긴 뉴스 본문은 주입하지 않고 짧게 요약
