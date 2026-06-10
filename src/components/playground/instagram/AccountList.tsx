"use client";
import { useEffect, useMemo, useState } from "react";
import { buttonClasses } from "@/components/Button";
import { followDayCount, formatKoreanDate } from "@/lib/playground/instagram/followDays";
import type { AccountRelation } from "@/lib/playground/instagram/types";
import type { BloomFilter } from "@/lib/playground/instagram/bloom";
import {
  classify,
  loadCelebrityFilter,
  loadOverrides,
  saveOverride,
  type CelebrityOverrides,
} from "@/lib/playground/instagram/celebrity";

export type TabKey = "notFollowingMeBack" | "iDoNotFollowBack" | "mutuals" | "followers" | "following";
type SortKey = "recent" | "oldest" | "name" | "daysDesc" | "daysAsc";

const PAGE = 50;

const SORTS: { key: SortKey; label: string }[] = [
  { key: "recent", label: "최근 팔로우한 순" },
  { key: "oldest", label: "오래 팔로우한 순" },
  { key: "name", label: "사용자명순" },
  { key: "daysDesc", label: "경과 일수 많은 순" },
  { key: "daysAsc", label: "경과 일수 적은 순" },
];

// 탭별 대표 날짜: 팔로워/내가 맞팔 안 함 탭은 상대가 나를 팔로우한 날, 그 외는 내가 팔로우한 날 우선
function primaryDate(a: AccountRelation, tab: TabKey): string | null {
  if (tab === "followers" || tab === "iDoNotFollowBack") return a.followerSince;
  return a.followingSince ?? a.followerSince;
}

function DateLine({ label, iso, raw }: { label: string; iso: string | null; raw: string | null }) {
  if (!iso) {
    return (
      <p className="text-xs text-[var(--color-text-muted)]">
        {label} · {raw ? `날짜 확인 불가 (${raw})` : "팔로우 날짜 확인 불가"}
      </p>
    );
  }
  const days = followDayCount(iso);
  return (
    <p className="text-xs text-[var(--color-text-muted)]">
      {label} {formatKoreanDate(iso)}
      {days !== null && (
        <>
          {" "}· <span className="font-semibold text-[var(--color-text)]">{days.toLocaleString()}일째</span>
        </>
      )}
    </p>
  );
}

export default function AccountList({ accounts, tab }: { accounts: AccountRelation[]; tab: TabKey }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [limit, setLimit] = useState(PAGE);

  const [filter, setFilter] = useState<BloomFilter | null | undefined>(undefined);
  const [overrides, setOverrides] = useState<CelebrityOverrides>({});
  const [excludeCelebs, setExcludeCelebs] = useState(false);
  useEffect(() => {
    let alive = true;
    loadCelebrityFilter().then((f) => {
      if (!alive) return;
      setFilter(f);
      setOverrides(loadOverrides());
    });
    return () => {
      alive = false;
    };
  }, []);
  const celebrityEnabled = filter !== null && filter !== undefined;

  const { rows, celebCount } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q ? accounts.filter((a) => a.username.includes(q)) : accounts;
    const decorated = base.map((a) => {
      const d = primaryDate(a, tab);
      return {
        a,
        dateKey: d,
        daysKey: d ? followDayCount(d) : null,
        verdict: celebrityEnabled ? classify(a.username, filter ?? null, overrides) : ("person" as const),
      };
    });
    const nullLast = (cmp: (x: (typeof decorated)[number], y: (typeof decorated)[number]) => number) =>
      (x: (typeof decorated)[number], y: (typeof decorated)[number]) => {
        const xn = x.dateKey === null, yn = y.dateKey === null;
        if (xn && yn) return 0;
        if (xn) return 1;
        if (yn) return -1;
        return cmp(x, y);
      };
    switch (sort) {
      case "recent": decorated.sort(nullLast((x, y) => y.dateKey!.localeCompare(x.dateKey!))); break;
      case "oldest": decorated.sort(nullLast((x, y) => x.dateKey!.localeCompare(y.dateKey!))); break;
      case "name": decorated.sort((x, y) => x.a.username.localeCompare(y.a.username)); break;
      case "daysDesc": decorated.sort(nullLast((x, y) => (y.daysKey ?? 0) - (x.daysKey ?? 0))); break;
      case "daysAsc": decorated.sort(nullLast((x, y) => (x.daysKey ?? 0) - (y.daysKey ?? 0))); break;
    }
    const celebCount = decorated.filter((d) => d.verdict === "celebrity").length;
    const rows = excludeCelebs ? decorated.filter((d) => d.verdict !== "celebrity") : decorated;
    return { rows, celebCount };
  }, [accounts, query, sort, tab, filter, overrides, celebrityEnabled, excludeCelebs]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 md:flex-row">
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(PAGE);
          }}
          placeholder="사용자명 검색"
          className="w-full border border-[var(--color-border)] px-3 py-2 text-sm"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="border border-[var(--color-border)] px-3 py-2 text-sm"
          aria-label="정렬"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {celebrityEnabled && (
        <div className="space-y-1">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={excludeCelebs}
              onChange={(e) => setExcludeCelebs(e.target.checked)}
            />
            유명인·브랜드 제외 ({celebCount.toLocaleString()})
          </label>
          <p className="text-xs text-[var(--color-text-muted)]">
            위키백과 등재 기준 자동 추정이라 누락·오판이 있을 수 있어요. 배지를 눌러 직접 고칠 수 있어요.
          </p>
        </div>
      )}

      {rows.length === 0 && (
        <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">표시할 계정이 없어요.</p>
      )}

      <ul className="divide-y divide-[var(--color-border)] border border-[var(--color-border)]">
        {rows.slice(0, limit).map(({ a, verdict }) => (
          <li key={a.username} className="space-y-1 p-4">
            <div className="flex items-center justify-between gap-2">
              <a
                href={a.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate font-semibold underline-offset-4 hover:underline"
              >
                @{a.username}
              </a>
              <a
                href={a.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClasses("secondary", "shrink-0 px-3 py-1.5 text-xs normal-case tracking-normal")}
              >
                인스타그램에서 보기
              </a>
            </div>
            {celebrityEnabled &&
              (verdict === "celebrity" ? (
                <button
                  type="button"
                  onClick={() => setOverrides(saveOverride(a.username, "person"))}
                  className="text-xs text-[var(--color-accent)]"
                  title="누르면 일반인으로 표시"
                  aria-label={`${a.username} 유명인 추정 해제`}
                >
                  ⭐ 유명인·브랜드 추정 ✕
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setOverrides(saveOverride(a.username, "celebrity"))}
                  className="text-xs text-[var(--color-text-muted)] underline underline-offset-2"
                  aria-label={`${a.username} 유명인으로 표시`}
                >
                  유명인으로 표시
                </button>
              ))}
            {a.isFollowing && (
              <DateLine label="내가 팔로우한 날" iso={a.followingSince} raw={a.followingSinceRaw} />
            )}
            {a.isFollower && (
              <DateLine label="나를 팔로우한 날" iso={a.followerSince} raw={a.followerSinceRaw} />
            )}
          </li>
        ))}
      </ul>

      {rows.length > limit && (
        <button type="button" className={buttonClasses("secondary", "w-full")} onClick={() => setLimit(limit + PAGE)}>
          더 보기 ({(rows.length - limit).toLocaleString()}개 남음)
        </button>
      )}
    </div>
  );
}
