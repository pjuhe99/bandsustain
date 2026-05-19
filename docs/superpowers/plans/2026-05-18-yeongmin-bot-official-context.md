# Yeongmin Bot Official Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Yeongmin bot selectively inject site-backed `live`, `members`, `songs`, and `news` context into chat completions, while treating `news` as playful editorial rather than hard fact.

**Architecture:** Add a focused server-only helper that classifies the latest user message and formats only the relevant Bandsustain data into a compact context block. Keep the existing Yeongmin prompt builder intact, and wire the new helper into the chat route so the OpenAI call receives `base prompt + optional official context`.

**Tech Stack:** Next.js App Router route handlers, TypeScript, mysql2-backed lib helpers, OpenAI chat completions, `tsx --test`, ESLint

---

## File Structure

### New Files

- `src/lib/yeongminBotContext.ts`
  Builds selective official context for Yeongmin bot prompts from `live`, `members`, `songs`, and `news`.
- `src/lib/yeongminBotContext.test.ts`
  Covers message classification and context formatting, especially the `news` caution rule.

### Modified Files

- `src/app/api/playground/kim-yeongmin-bot/chat/route.ts`
  Calls the official context helper and appends the returned block to the system prompt before the OpenAI request.
- `src/lib/news.ts`
  Reuse or tighten excerpt formatting so news summaries stay short and predictable for prompt injection.

## Task 1: Build And Test The Official Context Helper

**Files:**
- Create: `src/lib/yeongminBotContext.ts`
- Create: `src/lib/yeongminBotContext.test.ts`
- Modify: `src/lib/news.ts` (only if the existing excerpt helper needs cleanup for stable prompt snippets)

- [ ] **Step 1: Write the failing helper tests**

Create `src/lib/yeongminBotContext.test.ts` with focused tests for classification and rendering. Keep classification functions exported so they can be tested without touching the database.

```ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyOfficialContextNeeds,
  formatOfficialContext,
  type OfficialContextData,
} from "./yeongminBotContext";

test("classifyOfficialContextNeeds detects live questions", () => {
  const needs = classifyOfficialContextNeeds("다음 공연 언제야?");
  assert.equal(needs.live, true);
  assert.equal(needs.members, false);
  assert.equal(needs.songs, false);
  assert.equal(needs.news, false);
});

test("classifyOfficialContextNeeds detects mixed member and song questions", () => {
  const needs = classifyOfficialContextNeeds("김영민이랑 대표곡 좀 알려줘");
  assert.equal(needs.live, false);
  assert.equal(needs.members, true);
  assert.equal(needs.songs, true);
  assert.equal(needs.news, false);
});

test("classifyOfficialContextNeeds detects news questions", () => {
  const needs = classifyOfficialContextNeeds("최근 뉴스 본 거 진짜야?");
  assert.equal(needs.news, true);
});

test("classifyOfficialContextNeeds ignores generic chat", () => {
  const needs = classifyOfficialContextNeeds("오늘 기분이 좀 이상하네");
  assert.deepEqual(needs, {
    live: false,
    members: false,
    songs: false,
    news: false,
  });
});

test("formatOfficialContext includes caution text for news", () => {
  const context = formatOfficialContext({
    live: [],
    members: [],
    songs: [],
    news: [
      {
        headline: "기타 대신 코드 잡았다",
        date: "2026-04-24",
        category: "Business",
        summary: "장난과 과장이 섞인 기사 톤 예시",
      },
    ],
  });

  assert.match(context ?? "", /Official Bandsustain Context/);
  assert.match(context ?? "", /playful, fictional, or exaggerated editorial writing/i);
  assert.match(context ?? "", /기타 대신 코드 잡았다/);
});

test("formatOfficialContext returns null when there is no relevant data", () => {
  const context = formatOfficialContext({
    live: [],
    members: [],
    songs: [],
    news: [],
  });

  assert.equal(context, null);
});
```

- [ ] **Step 2: Run the helper tests to verify they fail**

Run:

```powershell
node .\node_modules\tsx\dist\cli.mjs --test .\src\lib\yeongminBotContext.test.ts
```

Expected:

- FAIL because `src/lib/yeongminBotContext.ts` does not exist yet
- Or FAIL because the exported functions are not implemented

- [ ] **Step 3: Implement the minimal helper**

Create `src/lib/yeongminBotContext.ts` with a small public surface and internal formatters.

```ts
import "server-only";

import { excerpt, formatNewsDate, getPublishedNews } from "./news";
import { formatLiveDateWithYear, getUpcomingEvents } from "./live";
import { getPublishedMembers } from "./members";
import { getPublishedSongs } from "./songs";

export type OfficialContextNeeds = {
  live: boolean;
  members: boolean;
  songs: boolean;
  news: boolean;
};

export type OfficialContextData = {
  live: Array<{
    eventDate: string;
    venue: string;
    city: string;
    ticketUrl: string | null;
    videoUrl: string | null;
  }>;
  members: Array<{
    nameKr: string;
    nameEn: string;
    position: string;
    favoriteArtist: string | null;
    favoriteSong: string | null;
  }>;
  songs: Array<{
    title: string;
    category: string;
    releasedAt: string;
    hasListenUrl: boolean;
  }>;
  news: Array<{
    headline: string;
    date: string;
    category: string;
    summary: string;
  }>;
};

const LIVE_KEYWORDS = ["공연", "라이브", "live", "일정", "언제", "어디", "venue", "ticket"];
const MEMBER_KEYWORDS = ["멤버", "member", "누구", "보컬", "기타", "드럼", "베이스", "김영민"];
const SONG_KEYWORDS = ["곡", "노래", "song", "songs", "듣기", "발매", "싱글", "앨범", "추천곡"];
const NEWS_KEYWORDS = ["뉴스", "소식", "기사", "news", "최근"];

function includesAnyKeyword(message: string, keywords: string[]): boolean {
  const lowered = message.toLowerCase();
  return keywords.some((keyword) => lowered.includes(keyword.toLowerCase()));
}

export function classifyOfficialContextNeeds(message: string): OfficialContextNeeds {
  return {
    live: includesAnyKeyword(message, LIVE_KEYWORDS),
    members: includesAnyKeyword(message, MEMBER_KEYWORDS),
    songs: includesAnyKeyword(message, SONG_KEYWORDS),
    news: includesAnyKeyword(message, NEWS_KEYWORDS),
  };
}

export function formatOfficialContext(data: OfficialContextData): string | null {
  const sections: string[] = [];

  if (data.live.length > 0) {
    sections.push(
      [
        "### Upcoming Live",
        ...data.live.map((event) => {
          const suffix =
            event.ticketUrl ? "ticket link available" : event.videoUrl ? "video link available" : "link unavailable";
          return `- ${formatLiveDateWithYear(event.eventDate)} / ${event.city} / ${event.venue} / ${suffix}`;
        }),
      ].join("\n"),
    );
  }

  if (data.members.length > 0) {
    sections.push(
      [
        "### Members",
        ...data.members.map((member) => {
          const taste = member.favoriteArtist ? ` / likes ${member.favoriteArtist}` : "";
          return `- ${member.nameKr} (${member.nameEn}) - ${member.position}${taste}`;
        }),
      ].join("\n"),
    );
  }

  if (data.songs.length > 0) {
    sections.push(
      [
        "### Songs",
        ...data.songs.map((song) => {
          const suffix = song.hasListenUrl ? "listen link available" : "listen link unavailable";
          return `- ${song.title} - ${song.category} - ${song.releasedAt} - ${suffix}`;
        }),
      ].join("\n"),
    );
  }

  if (data.news.length > 0) {
    sections.push(
      [
        "### News",
        ...data.news.map((item) => `- ${item.date} / ${item.category} / ${item.headline} / ${item.summary}`),
      ].join("\n"),
    );
  }

  if (sections.length === 0) return null;

  return [
    "## Official Bandsustain Context",
    "Use this context only when it is relevant to the user's question.",
    "Members, songs, and live data should be treated as official site-backed factual information.",
    "News items are site content but may include playful, fictional, or exaggerated editorial writing.",
    "Do not treat news alone as hard fact when answering schedule, member, or release questions.",
    "",
    ...sections,
  ].join("\n");
}

export async function buildYeongminOfficialContext(message: string): Promise<string | null> {
  const needs = classifyOfficialContextNeeds(message);
  if (!needs.live && !needs.members && !needs.songs && !needs.news) {
    return null;
  }

  const [live, members, songs, news] = await Promise.all([
    needs.live ? getUpcomingEvents() : Promise.resolve([]),
    needs.members ? getPublishedMembers() : Promise.resolve([]),
    needs.songs ? getPublishedSongs() : Promise.resolve([]),
    needs.news ? getPublishedNews() : Promise.resolve([]),
  ]);

  return formatOfficialContext({
    live: live.map((event) => ({
      eventDate: event.eventDate,
      venue: event.venue,
      city: event.city,
      ticketUrl: event.ticketUrl,
      videoUrl: event.videoUrl,
    })),
    members: members.map((member) => ({
      nameKr: member.nameKr,
      nameEn: member.nameEn,
      position: member.position,
      favoriteArtist: member.favoriteArtist,
      favoriteSong: member.favoriteSong,
    })),
    songs: songs.map((song) => ({
      title: song.title,
      category: song.category,
      releasedAt: song.releasedAt.toISOString().slice(0, 10),
      hasListenUrl: Boolean(song.listenUrl),
    })),
    news: news.map((item) => ({
      headline: item.headline,
      date: formatNewsDate(item.date),
      category: item.category,
      summary: excerpt(item.body, 90),
    })),
  });
}
```

- [ ] **Step 4: Tighten the news summary helper if needed**

If `src/lib/news.ts` still returns broken punctuation or an overly long suffix, replace the current `excerpt()` implementation with a deterministic ASCII-safe version.

```ts
export function excerpt(body: string, max: number): string {
  const flat = body.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 3).trimEnd()}...`;
}
```

- [ ] **Step 5: Run helper tests to verify they pass**

Run:

```powershell
node .\node_modules\tsx\dist\cli.mjs --test .\src\lib\yeongminBotContext.test.ts
```

Expected:

- PASS
- No import or type-resolution errors

- [ ] **Step 6: Commit the helper**

```powershell
git add src/lib/yeongminBotContext.ts src/lib/yeongminBotContext.test.ts src/lib/news.ts
git commit -m "feat: add yeongmin bot official context helper"
```

## Task 2: Wire Official Context Into The Chat Route

**Files:**
- Modify: `src/app/api/playground/kim-yeongmin-bot/chat/route.ts`
- Reuse: `src/lib/yeongminBot.ts`
- Reuse: `src/lib/yeongminBotContext.ts`

- [ ] **Step 1: Add a failing route-level test harness note**

Because there is no existing route test setup in this repo, create a tiny reproducible verification script snippet in your working notes before editing the route. Use this exact message shape later for manual validation.

```json
{
  "messages": [
    { "role": "user", "content": "다음 공연 언제야?" }
  ]
}
```

The failure condition before wiring is:

- The OpenAI request receives only `assemblePrompt(settings)` with no appended `Official Bandsustain Context`

- [ ] **Step 2: Update the route to append official context**

Modify `src/app/api/playground/kim-yeongmin-bot/chat/route.ts`:

```ts
import { buildYeongminOfficialContext } from "@/lib/yeongminBotContext";
```

Then replace the current prompt build:

```ts
const client = new OpenAI({ apiKey, timeout: 45_000 });
const latestUserMessage = history[history.length - 1]?.content ?? "";
const basePrompt = assemblePrompt(settings);
const officialContext = await buildYeongminOfficialContext(latestUserMessage);
const systemPrompt = officialContext
  ? `${basePrompt}\n\n${officialContext}`
  : basePrompt;
```

Keep the rest of the OpenAI call unchanged:

```ts
const completion = await client.chat.completions.create({
  model: settings.modelName,
  messages: [
    { role: "system", content: systemPrompt },
    ...history,
  ],
  temperature: 0.9,
  max_tokens: 800,
});
```

- [ ] **Step 3: Verify there are no unused imports or dead code issues**

Run:

```powershell
node .\node_modules\eslint\bin\eslint.js .\src\app\api\playground\kim-yeongmin-bot\chat\route.ts .\src\lib\yeongminBotContext.ts .\src\lib\yeongminBotContext.test.ts .\src\lib\news.ts
```

Expected:

- PASS with no output

- [ ] **Step 4: Commit the route wiring**

```powershell
git add src/app/api/playground/kim-yeongmin-bot/chat/route.ts src/lib/yeongminBotContext.ts src/lib/yeongminBotContext.test.ts src/lib/news.ts
git commit -m "feat: inject site context into yeongmin bot chat"
```

## Task 3: Run Manual Verification For All Four Resource Types

**Files:**
- Modify: none required unless a bug is found
- Test: `src/app/api/playground/kim-yeongmin-bot/chat/route.ts`
- Test: `src/lib/yeongminBotContext.ts`

- [ ] **Step 1: Run the helper tests again as a regression check**

Run:

```powershell
node .\node_modules\tsx\dist\cli.mjs --test .\src\lib\yeongminBotContext.test.ts
```

Expected:

- PASS

- [ ] **Step 2: Run lint on the final touched files**

Run:

```powershell
node .\node_modules\eslint\bin\eslint.js .\src\app\api\playground\kim-yeongmin-bot\chat\route.ts .\src\lib\yeongminBotContext.ts .\src\lib\yeongminBotContext.test.ts .\src\lib\news.ts
```

Expected:

- PASS with no output

- [ ] **Step 3: Manually verify the chat behavior with four prompts**

Use the playground UI or a direct POST to the local route and verify the bot behavior with these prompts:

```text
다음 공연 언제야?
서스테인 멤버 누구야?
대표곡 뭐 있어?
최근 뉴스 봤는데 그거 진짜야?
```

Expected:

- 공연 질문: upcoming live data is reflected in the reply
- 멤버 질문: published member list is reflected
- 곡 질문: published songs are reflected
- 뉴스 질문: reply references the news article but also signals that news may be playful/editorial rather than hard fact

- [ ] **Step 4: Verify unrelated chat stays lightweight**

Prompt:

```text
기타 페달 추천해줘
```

Expected:

- No obvious schedule/member/song/news dump
- Reply stays in Yeongmin voice and uses only the base prompt unless a keyword intentionally matched

- [ ] **Step 5: Commit any final fixups**

If manual verification required changes:

```powershell
git add src/app/api/playground/kim-yeongmin-bot/chat/route.ts src/lib/yeongminBotContext.ts src/lib/yeongminBotContext.test.ts src/lib/news.ts
git commit -m "fix: tune yeongmin official context injection"
```

If no additional changes were needed, mark this step complete with no commit.

## Self-Review

### Spec coverage

- Question classification: covered in Task 1
- Selective injection: covered in Task 1 and Task 2
- `live`, `members`, `songs`, `news` support: covered in Task 1 and Task 3
- `news` caution rule: covered in Task 1 formatting and Task 3 manual verification
- No crawling or external fetches: preserved by using existing lib helpers only

### Placeholder scan

- No `TODO` or `TBD`
- Each changed file has an explicit path
- Every code-edit step includes concrete code
- Every verification step includes exact commands and expected outcomes

### Type consistency

- `buildYeongminOfficialContext()` is the only route-facing helper
- `classifyOfficialContextNeeds()` and `formatOfficialContext()` are exported for tests
- `OfficialContextData` property names match the formatter inputs used by the helper
