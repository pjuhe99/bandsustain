# Yeongmin Bot Cap Fallback Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the session-cap and daily-cap fallback messages of the Yeongmin playground bot editable from the admin page, with the existing hardcoded strings remaining as the implicit defaults when admin leaves the inputs blank.

**Architecture:** Mirror the existing `long_input_fallback_reply` pattern end-to-end — add two `TEXT NULL` columns to `yeongmin_settings`, plumb them through the `yeongminBot` lib helpers and the admin settings route, consume them in the playground chat route via `clampReply(value?.trim() || HARDCODED_DEFAULT, ...)`, and surface two new textareas in the existing prompt-edit admin page that uses a single shared save flow.

**Tech Stack:** Next.js App Router (route handlers + React Server/Client Components), TypeScript, mysql2-backed lib helpers, OpenAI chat completions (unchanged), `tsx --test`, MariaDB via `/var/www/html/_______site_BANDSUSTAIN/.db_credentials`, PM2 process `bandsustain`.

---

## Pre-flight Notes for the Implementer

1. **Working tree state.** Before starting Task 1, the bandsustain working tree contains uncommitted WIP from a separate "영민봇 notes leak / name modal" fix (`src/components/yeongmin/ChatRoom.tsx`, `src/lib/yeongminBot.ts`, plus new untracked `src/lib/yeongminPrompt.ts` and its test). Do **not** stage or commit those files inside this plan's commits — restrict every `git add` to the exact paths each task lists. The Yeongmin WIP touches `yeongminBot.ts` but only in the prompt-extraction area (around `VoiceCorpusEntry`); this plan's additions are in disjoint regions (settings type, row mapping, column map), so they layer cleanly.
2. **Single-branch repo.** bandsustain uses a single `main` branch (per `CLAUDE.md` §10). No dev/prod fork. Do **not** push or build in any task — the final commit is staged for review and the user will explicitly request the push/build/restart.
3. **Test command.** `pnpm exec tsx --test src/lib/<file>.test.ts` (matches existing `yeongminBotLimits.test.ts` / `yeongminBotContext.test.ts` convention).
4. **DB access.** DEV-only environment: run mysql against the credentials in `/var/www/html/_______site_BANDSUSTAIN/.db_credentials` (`DB_PASS`, not `DB_PASSWORD`, per [[reference-db-credentials]] convention).
5. **Design rules.** All new UI must follow `CLAUDE.md` §6 — Tailwind utilities only, no rounded corners, no shadow, no auto dark mode, blue accent forbidden in cap-message section (no accent role).

---

## File Structure

### New Files

- `db/schema/014_yeongmin_bot_cap_fallbacks.sql`
  Idempotent `ALTER TABLE` adding `session_cap_fallback_reply` and `daily_cap_fallback_reply` (`TEXT NULL`) to `yeongmin_settings`.
- `src/lib/yeongminBotFallbackSelect.ts`
  Tiny pure helper `selectCapFallbackReply(adminValue, hardcodedDefault, limitOptions)` that encodes the "trim & fall back to default, then clamp" rule used by both cap branches. Pure, easy to unit-test, keeps the chat route uncluttered.
- `src/lib/yeongminBotFallbackSelect.test.ts`
  Covers null, empty, whitespace-only, normal, and overflowing admin values.

### Modified Files

- `src/lib/yeongminBot.ts`
  Add `sessionCapFallbackReply` / `dailyCapFallbackReply` fields to `YeongminSettings`, `SettingsRow`, `rowToSettings`, `UpdatableSettings`, and `COLUMN_MAP`. Pure-additive — keep all other lines untouched.
- `src/app/api/admin/yeongmin-bot/settings/route.ts`
  Register the two new keys in `STRING_KEYS` and include them in the `GET` response JSON.
- `src/app/api/playground/kim-yeongmin-bot/chat/route.ts`
  Replace the two `replyJson(FALLBACK_SESSION_CAP, …)` / `replyJson(FALLBACK_DAILY_CAP, …)` calls with `replyJson(selectCapFallbackReply(...), …)`. Keep the `FALLBACK_*` constants as the hardcoded defaults.
- `src/app/admin/(authed)/yeongmin-bot/prompt/page.tsx`
  Extend the existing single-state-single-save form with the two new textareas under section 10. Reuse the existing [저장] button and PATCH call.

---

## Task 1: Add DB columns

**Files:**
- Create: `db/schema/014_yeongmin_bot_cap_fallbacks.sql`

- [ ] **Step 1: Write the migration file**

Create `db/schema/014_yeongmin_bot_cap_fallbacks.sql`:

```sql
-- 014_yeongmin_bot_cap_fallbacks.sql
-- Make the session-cap and daily-cap fallback messages editable from admin.
-- NULL means "use the hardcoded default in chat/route.ts".
-- Manual run: mysql -h $DB_HOST -u $DB_USER -p $DB_NAME < db/schema/014_yeongmin_bot_cap_fallbacks.sql

ALTER TABLE yeongmin_settings
  ADD COLUMN session_cap_fallback_reply TEXT NULL AFTER long_input_fallback_reply,
  ADD COLUMN daily_cap_fallback_reply   TEXT NULL AFTER session_cap_fallback_reply;
```

- [ ] **Step 2: Apply the migration against the DB**

Read DB password from `/var/www/html/_______site_BANDSUSTAIN/.db_credentials`, then apply:

```bash
set -a; source /var/www/html/_______site_BANDSUSTAIN/.db_credentials; set +a
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" \
  < /root/bandsustain/public_html/bandsustain/db/schema/014_yeongmin_bot_cap_fallbacks.sql
```

Expected: no output (silent success). If it errors with "Duplicate column name", the migration is already applied — that is fine.

- [ ] **Step 3: Verify the columns exist**

```bash
set -a; source /var/www/html/_______site_BANDSUSTAIN/.db_credentials; set +a
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e \
  "SHOW COLUMNS FROM yeongmin_settings LIKE '%_cap_fallback_reply';"
```

Expected: two rows — `session_cap_fallback_reply` and `daily_cap_fallback_reply`, both `text`, `YES` (Null), `NULL` default.

- [ ] **Step 4: Commit the migration only**

```bash
cd /root/bandsustain/public_html/bandsustain
git add db/schema/014_yeongmin_bot_cap_fallbacks.sql
git commit -m "$(cat <<'EOF'
db(yeongmin): add session/daily cap fallback reply columns

NULL means "use the hardcoded default in chat/route.ts".

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add the pure fallback-select helper + tests

**Files:**
- Create: `src/lib/yeongminBotFallbackSelect.ts`
- Create: `src/lib/yeongminBotFallbackSelect.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/yeongminBotFallbackSelect.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { selectCapFallbackReply } from "./yeongminBotFallbackSelect";

const limits = { outputMaxChars: 200, outputMaxLines: 6 };

test("selectCapFallbackReply falls back to default when admin value is null", () => {
  assert.equal(
    selectCapFallbackReply(null, "기본\n문구", limits),
    "기본\n문구",
  );
});

test("selectCapFallbackReply falls back to default when admin value is empty", () => {
  assert.equal(
    selectCapFallbackReply("", "기본\n문구", limits),
    "기본\n문구",
  );
});

test("selectCapFallbackReply falls back to default when admin value is whitespace only", () => {
  assert.equal(
    selectCapFallbackReply("   \n  ", "기본\n문구", limits),
    "기본\n문구",
  );
});

test("selectCapFallbackReply uses admin value when present and within limits", () => {
  assert.equal(
    selectCapFallbackReply("운영자 메시지\n잘 가", "기본", limits),
    "운영자 메시지\n잘 가",
  );
});

test("selectCapFallbackReply clamps overly long admin value", () => {
  const tight = { outputMaxChars: 8, outputMaxLines: 2 };
  assert.equal(
    selectCapFallbackReply("12345678901234\n5678\n9012", "default", tight),
    "12345678",
  );
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

```bash
cd /root/bandsustain/public_html/bandsustain
pnpm exec tsx --test src/lib/yeongminBotFallbackSelect.test.ts
```

Expected: FAIL — `Cannot find module './yeongminBotFallbackSelect'`.

- [ ] **Step 3: Write the helper**

Create `src/lib/yeongminBotFallbackSelect.ts`:

```ts
import { clampReply, type OutputLimitOptions } from "./yeongminBotLimits";

export function selectCapFallbackReply(
  adminValue: string | null | undefined,
  hardcodedDefault: string,
  limits: OutputLimitOptions,
): string {
  const trimmed = typeof adminValue === "string" ? adminValue.trim() : "";
  const chosen = trimmed.length > 0 ? trimmed : hardcodedDefault;
  return clampReply(chosen, limits);
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

```bash
pnpm exec tsx --test src/lib/yeongminBotFallbackSelect.test.ts
```

Expected: PASS — `# pass 5`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/yeongminBotFallbackSelect.ts src/lib/yeongminBotFallbackSelect.test.ts
git commit -m "$(cat <<'EOF'
feat(yeongmin): add selectCapFallbackReply helper

Pure rule: trim admin value, fall back to hardcoded default if blank,
then clampReply. Same shape as longInputFallbackReply handling in
chat/route.ts but isolated for unit testing.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Extend the settings type / row mapping / column map

**Files:**
- Modify: `src/lib/yeongminBot.ts`

Note: this file currently has uncommitted WIP edits from a separate task. Do not stage anything other than your additions — use `git add -p` if needed.

- [ ] **Step 1: Add the two fields to `YeongminSettings`**

In `src/lib/yeongminBot.ts`, locate the existing `longInputFallbackReply: string | null;` line in the `YeongminSettings` type and add two new fields right after it:

```ts
export type YeongminSettings = {
  id: 1;
  apiKeyEncrypted: string | null;
  modelName: string;
  inputRatePer1mUsd: number;
  outputRatePer1mUsd: number;
  dailyTokenCap: number;
  sessionMsgCap: number;
  inputCharLimit: number;
  longInputFallbackReply: string | null;
  sessionCapFallbackReply: string | null;
  dailyCapFallbackReply: string | null;
  outputMaxChars: number;
  outputMaxLines: number;
  // ... rest unchanged
```

- [ ] **Step 2: Add the two columns to `SettingsRow`**

In the same file, add after `long_input_fallback_reply: string | null;`:

```ts
type SettingsRow = RowDataPacket & {
  // ... existing fields
  long_input_fallback_reply: string | null;
  session_cap_fallback_reply: string | null;
  daily_cap_fallback_reply: string | null;
  output_max_chars: number;
  // ... rest unchanged
```

- [ ] **Step 3: Extend `rowToSettings`**

In `rowToSettings`, add the two mappings right after the `longInputFallbackReply` line:

```ts
function rowToSettings(r: SettingsRow): YeongminSettings {
  return {
    id: 1,
    // ... existing fields
    longInputFallbackReply: r.long_input_fallback_reply,
    sessionCapFallbackReply: r.session_cap_fallback_reply,
    dailyCapFallbackReply: r.daily_cap_fallback_reply,
    outputMaxChars: r.output_max_chars,
    // ... rest unchanged
```

- [ ] **Step 4: Extend `UpdatableSettings`**

In the `UpdatableSettings` type, add the two new optional fields right after `longInputFallbackReply`:

```ts
export type UpdatableSettings = Partial<{
  // ... existing fields
  longInputFallbackReply: string;
  sessionCapFallbackReply: string;
  dailyCapFallbackReply: string;
  outputMaxChars: number;
  // ... rest unchanged
}>;
```

(Note: `Partial` already allows `undefined`; the columns themselves accept `NULL` via the DB. Writing an empty string from admin is what triggers the "fall back to default" path at read time — by design.)

- [ ] **Step 5: Extend `COLUMN_MAP`**

In the `COLUMN_MAP` constant, add the two mappings right after `longInputFallbackReply`:

```ts
const COLUMN_MAP: Record<keyof UpdatableSettings, string> = {
  // ... existing entries
  longInputFallbackReply: "long_input_fallback_reply",
  sessionCapFallbackReply: "session_cap_fallback_reply",
  dailyCapFallbackReply: "daily_cap_fallback_reply",
  outputMaxChars: "output_max_chars",
  // ... rest unchanged
};
```

- [ ] **Step 6: Type-check the file**

```bash
cd /root/bandsustain/public_html/bandsustain
pnpm exec tsc --noEmit
```

Expected: exit 0 (no type errors).

- [ ] **Step 7: Commit only the lines you added (not the unrelated WIP)**

```bash
git add -p src/lib/yeongminBot.ts
# In the interactive prompts, only stage your additions related to
# sessionCapFallbackReply / dailyCapFallbackReply. Skip any other hunks.
git status --short  # confirm only the intended hunks are staged
git commit -m "$(cat <<'EOF'
feat(yeongmin): plumb cap fallback fields through settings lib

Add sessionCapFallbackReply / dailyCapFallbackReply to YeongminSettings,
SettingsRow, rowToSettings, UpdatableSettings, and COLUMN_MAP — purely
additive, no behavior change yet.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

If `git add -p` proves hard to do cleanly because of the WIP, stop and ask the user how to proceed — do not commit unrelated WIP under this plan's task.

---

## Task 4: Wire the chat route to consume admin-controlled fallbacks

**Files:**
- Modify: `src/app/api/playground/kim-yeongmin-bot/chat/route.ts`

- [ ] **Step 1: Import the helper**

At the top of `src/app/api/playground/kim-yeongmin-bot/chat/route.ts`, alongside the existing import from `@/lib/yeongminBotLimits`:

```ts
import { clampReply, isInputTooLong } from "@/lib/yeongminBotLimits";
import { selectCapFallbackReply } from "@/lib/yeongminBotFallbackSelect";
```

- [ ] **Step 2: Replace the session-cap branch**

Locate the existing session-cap block (currently around lines 108–119):

```ts
  // Session cap (rolling 24h)
  const sessionCount = await countSessionMessagesLast24h(sessionId);
  if (sessionCount >= settings.sessionMsgCap) {
    return replyJson(
      FALLBACK_SESSION_CAP,
      sessionId,
      isNewSession,
      0,
      false,
      true,
      true,
    );
  }
```

Replace the `FALLBACK_SESSION_CAP` argument with the selector call:

```ts
  // Session cap (rolling 24h)
  const sessionCount = await countSessionMessagesLast24h(sessionId);
  if (sessionCount >= settings.sessionMsgCap) {
    return replyJson(
      selectCapFallbackReply(settings.sessionCapFallbackReply, FALLBACK_SESSION_CAP, {
        outputMaxChars: settings.outputMaxChars,
        outputMaxLines: settings.outputMaxLines,
      }),
      sessionId,
      isNewSession,
      0,
      false,
      true,
      true,
    );
  }
```

- [ ] **Step 3: Replace the daily-cap branch**

Locate the existing daily-cap block (currently around lines 122–133):

```ts
  // Daily token cap
  const todayTokens = await sumTodayTokens();
  if (todayTokens >= settings.dailyTokenCap) {
    return replyJson(
      FALLBACK_DAILY_CAP,
      sessionId,
      isNewSession,
      settings.sessionMsgCap - sessionCount,
      true,
      false,
      true,
    );
  }
```

Replace the `FALLBACK_DAILY_CAP` argument with the selector call:

```ts
  // Daily token cap
  const todayTokens = await sumTodayTokens();
  if (todayTokens >= settings.dailyTokenCap) {
    return replyJson(
      selectCapFallbackReply(settings.dailyCapFallbackReply, FALLBACK_DAILY_CAP, {
        outputMaxChars: settings.outputMaxChars,
        outputMaxLines: settings.outputMaxLines,
      }),
      sessionId,
      isNewSession,
      settings.sessionMsgCap - sessionCount,
      true,
      false,
      true,
    );
  }
```

Leave `FALLBACK_SESSION_CAP` and `FALLBACK_DAILY_CAP` constants in place — they are still referenced as the second argument to the helper.

Do **not** touch the `FALLBACK_OPENAI_ERROR` / `FALLBACK_NOT_CONFIGURED` / `longInputFallbackReply` branches — those are out of scope.

- [ ] **Step 4: Type-check**

```bash
pnpm exec tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/playground/kim-yeongmin-bot/chat/route.ts
git commit -m "$(cat <<'EOF'
feat(yeongmin): use admin-controlled cap fallback messages

Both session-cap and daily-cap branches now read the admin-edited
message via selectCapFallbackReply; the existing FALLBACK_* constants
remain as the implicit defaults when admin leaves the field blank.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Expose the new fields through the admin settings API

**Files:**
- Modify: `src/app/api/admin/yeongmin-bot/settings/route.ts`

- [ ] **Step 1: Add the two keys to `STRING_KEYS`**

Locate the `STRING_KEYS` Set declaration near the top of the file and add the two new entries right after `longInputFallbackReply`:

```ts
const STRING_KEYS = new Set<keyof UpdatableSettings>([
  "modelName",
  "longInputFallbackReply",
  "sessionCapFallbackReply",
  "dailyCapFallbackReply",
  "sectionIdentity",
  // ... rest unchanged
]);
```

- [ ] **Step 2: Add the two fields to the `GET` response**

Locate the `GET` function's `NextResponse.json({ ... })` block and add the two fields right after `longInputFallbackReply`:

```ts
  return NextResponse.json({
    modelName: s.modelName,
    inputRatePer1mUsd: s.inputRatePer1mUsd,
    outputRatePer1mUsd: s.outputRatePer1mUsd,
    dailyTokenCap: s.dailyTokenCap,
    sessionMsgCap: s.sessionMsgCap,
    inputCharLimit: s.inputCharLimit,
    longInputFallbackReply: s.longInputFallbackReply,
    sessionCapFallbackReply: s.sessionCapFallbackReply,
    dailyCapFallbackReply: s.dailyCapFallbackReply,
    outputMaxChars: s.outputMaxChars,
    // ... rest unchanged
  });
```

No `PATCH` changes — `STRING_KEYS` membership is what gates write access, and that's already done.

- [ ] **Step 3: Type-check**

```bash
pnpm exec tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/yeongmin-bot/settings/route.ts
git commit -m "$(cat <<'EOF'
feat(admin): expose cap fallback fields in yeongmin settings API

GET returns sessionCapFallbackReply / dailyCapFallbackReply, and PATCH
validates them via the existing STRING_KEYS string-type check.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Admin UI — add two textareas under the prompt editor

**Files:**
- Modify: `src/app/admin/(authed)/yeongmin-bot/prompt/page.tsx`

- [ ] **Step 1: Extend the editor state shape**

At the top of `src/app/admin/(authed)/yeongmin-bot/prompt/page.tsx`, extend the `Sections` type with two new keys:

```ts
type Sections = {
  sectionIdentity: string;
  sectionRole: string;
  sectionTone: string;
  sectionPersonality: string;
  sectionKnowledge: string;
  sectionLikes: string;
  sectionDislikes: string;
  sectionForbidden: string;
  sectionUnknownHandling: string;
  sectionExamples: string;
  sessionCapFallbackReply: string;
  dailyCapFallbackReply: string;
};
```

These join the same state object so the single `save()` PATCHes everything in one shot.

- [ ] **Step 2: Initialize the new fields from the GET response**

Locate the `useEffect` that fetches `/api/admin/yeongmin-bot/settings` and add the two new fields to the `s: Sections = { ... }` object (after `sectionExamples`):

```ts
        const s: Sections = {
          sectionIdentity: data.sectionIdentity ?? "",
          sectionRole: data.sectionRole ?? "",
          sectionTone: data.sectionTone ?? "",
          sectionPersonality: data.sectionPersonality ?? "",
          sectionKnowledge: data.sectionKnowledge ?? "",
          sectionLikes: data.sectionLikes ?? "",
          sectionDislikes: data.sectionDislikes ?? "",
          sectionForbidden: data.sectionForbidden ?? "",
          sectionUnknownHandling: data.sectionUnknownHandling ?? "",
          sectionExamples: data.sectionExamples ?? "",
          sessionCapFallbackReply: data.sessionCapFallbackReply ?? "",
          dailyCapFallbackReply: data.dailyCapFallbackReply ?? "",
        };
```

- [ ] **Step 3: Keep `assemblePreview` untouched**

`assemblePreview(s: Sections)` iterates over `SECTION_LABELS`, which is the curated list of prompt sections only. Do not add the two new keys to `SECTION_LABELS` — they are NOT part of the system prompt and should not show up in [머지 미리보기]. The compiler will not complain because `assemblePreview` only reads keys it explicitly references.

- [ ] **Step 4: Render the two textareas at the bottom of the form**

After the `{SECTION_LABELS.map(...)}` block but before the button row, add a "한도 메시지" section:

```tsx
      {SECTION_LABELS.map(({ key, label }) => (
        <div key={key} className="flex flex-col gap-2">
          <label className="text-sm font-semibold">{label}</label>
          <textarea
            value={sections[key]}
            onChange={(e) => setSections({ ...sections, [key]: e.target.value })}
            rows={key === "sectionExamples" ? 14 : 6}
            className="w-full resize-y border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2 text-sm font-mono"
          />
        </div>
      ))}

      <div className="flex flex-col gap-4 border-t border-[var(--color-border)] pt-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm uppercase tracking-wider text-[var(--color-text-muted)]">
            한도 메시지
          </h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            비워두면 기본 응답이 사용됩니다. 입력값은 영민봇 출력 한도(문자·줄 수)
            안에서 자동으로 잘립니다.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold">세션 한도 도달 시</label>
          <textarea
            value={sections.sessionCapFallbackReply}
            onChange={(e) =>
              setSections({ ...sections, sessionCapFallbackReply: e.target.value })
            }
            rows={4}
            placeholder="아\n오늘은 너랑 좀 떠들었네\n내일 또 와라"
            className="w-full resize-y border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2 text-sm font-mono"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold">일일 토큰 한도 도달 시</label>
          <textarea
            value={sections.dailyCapFallbackReply}
            onChange={(e) =>
              setSections({ ...sections, dailyCapFallbackReply: e.target.value })
            }
            rows={4}
            placeholder="흠\n오늘 다 같이 너무 떠들었는지\n머리가 좀 식어야겠다\n내일 보자"
            className="w-full resize-y border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2 text-sm font-mono"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {/* existing save / preview button row stays unchanged */}
```

The existing `save()` already PATCHes `JSON.stringify(sections)`, so the two new fields ride along automatically.

- [ ] **Step 5: Sanity-check the page in `pnpm dev`**

```bash
cd /root/bandsustain/public_html/bandsustain
pnpm dev
```

In a separate terminal, hit the page (or rely on the user's manual verification later). Confirm:

- Page still loads (no 500)
- Two new textareas appear under "한도 메시지" with the existing FALLBACK strings as placeholder text
- Filling them in and clicking [저장] returns 200 (network tab) and "저장됨: HH:MM:SS" appears

Stop `pnpm dev` (Ctrl-C) before moving on.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/\(authed\)/yeongmin-bot/prompt/page.tsx
git commit -m "$(cat <<'EOF'
feat(admin): add cap fallback message editors to prompt page

Two new textareas under the prompt-section list, riding the existing
single-save PATCH. Kept out of [머지 미리보기] because these are not
part of the system prompt.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Roundtrip integration check + final verification

**Files:**
- (No new files. This task is verification + push gate.)

- [ ] **Step 1: Run all yeongmin lib tests**

```bash
cd /root/bandsustain/public_html/bandsustain
pnpm exec tsx --test src/lib/yeongmin*.test.ts
```

Expected: every yeongmin* test suite (limits, context, fallback-select, delay, userName, chatState, prompt) PASSes. The new `yeongminBotFallbackSelect.test.ts` reports `# pass 5`.

- [ ] **Step 2: Full type-check + lint**

```bash
pnpm exec tsc --noEmit
pnpm exec eslint src/lib/yeongminBotFallbackSelect.ts \
                 src/lib/yeongminBot.ts \
                 src/app/api/playground/kim-yeongmin-bot/chat/route.ts \
                 src/app/api/admin/yeongmin-bot/settings/route.ts \
                 src/app/admin/\(authed\)/yeongmin-bot/prompt/page.tsx
```

Expected: both exit 0.

- [ ] **Step 3: Manual end-to-end smoke (DEV)**

The implementer should walk through this manually with `pnpm dev` running, **OR** report this step as "needs user verification" if they cannot exercise a browser:

1. Open `/admin/yeongmin-bot/prompt` (after admin login) — confirm the two textareas appear and load empty (DB has NULL).
2. Save with both blank → close & reopen the page → confirm they remain empty.
3. Trigger session cap in the playground:
   - Open `/playground/kim-yeongmin-bot`, enter a name, send messages until the next reply is the **hardcoded** session-cap text (matches `FALLBACK_SESSION_CAP`).
4. Back in admin, set `세션 한도 도달 시` to a clearly different short Korean string, e.g. `테스트 한도 메시지`, save.
5. Clear the chat cookie (or use an incognito window — the cookie is `bs_yeongmin_sid`, HttpOnly). Re-trigger the session cap → the new admin-set string should appear instead.
6. Repeat the same flow for daily cap (temporarily set `daily_token_cap` low via direct DB UPDATE if needed, then revert).

If any of these fail, fix and add notes here. If you cannot run this smoke (no browser session), stop and report exactly what was verified vs. left for the user.

- [ ] **Step 4: Status check before handoff**

```bash
cd /root/bandsustain/public_html/bandsustain
git log --oneline origin/main..HEAD
git status --short
```

Expected:
- The `git log` output shows exactly the commits created by this plan (db migration, fallback select helper, settings lib plumbing, chat route, admin settings API, admin UI). Counts may differ if you batched any commits — that's fine, as long as no out-of-scope commits sneak in.
- `git status --short` should still show the pre-existing WIP modifications to `ChatRoom.tsx` / `yeongminBot.ts` / `yeongminPrompt.ts` (untracked) — these are NOT part of this plan and must remain unstaged.

- [ ] **Step 5: STOP and hand off**

Do **not** push, build, or restart PM2. Tell the user:

> Local commits ready on `main`. DB migration applied to bandsustain (single-env). Manual smoke: <list what you verified>. Awaiting your explicit go-ahead before `git push origin main` / `pnpm build` / `pm2 restart bandsustain`.

Wait for the user to confirm before any deploy action.

---

## Out of Scope (Do Not Add)

- Editing `FALLBACK_OPENAI_ERROR` / `FALLBACK_NOT_CONFIGURED` — kept hardcoded for operational debuggability.
- Adding a new admin sidebar item or splitting the prompt page.
- Markdown / HTML rendering of the fallback messages — they remain plain text in the chat bubble.
- Trigger-timing changes (e.g., proactively appending the goodbye to the N-th bot reply).
- Touching the pre-existing uncommitted WIP (yeongminPrompt.ts extraction, ChatRoom.tsx name modal fix). Those belong to a separate workstream.
