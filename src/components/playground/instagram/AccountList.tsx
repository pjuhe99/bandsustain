"use client";
import { useMemo, useState } from "react";
import { buttonClasses } from "@/components/Button";
import { followDayCount, formatKoreanDate } from "@/lib/playground/instagram/followDays";
import type { AccountRelation } from "@/lib/playground/instagram/types";

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

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? accounts.filter((a) => a.username.includes(q)) : [...accounts];
    const date = (a: AccountRelation) => primaryDate(a, tab) ?? "";
    const days = (a: AccountRelation) => {
      const d = primaryDate(a, tab);
      return d ? (followDayCount(d) ?? -1) : -1;
    };
    switch (sort) {
      case "recent":
        filtered.sort((a, b) => date(b).localeCompare(date(a)));
        break;
      case "oldest":
        filtered.sort((a, b) => date(a).localeCompare(date(b)));
        break;
      case "name":
        filtered.sort((a, b) => a.username.localeCompare(b.username));
        break;
      case "daysDesc":
        filtered.sort((a, b) => days(b) - days(a));
        break;
      case "daysAsc":
        filtered.sort((a, b) => days(a) - days(b));
        break;
    }
    return filtered;
  }, [accounts, query, sort, tab]);

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

      {visible.length === 0 && (
        <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">표시할 계정이 없어요.</p>
      )}

      <ul className="divide-y divide-[var(--color-border)] border border-[var(--color-border)]">
        {visible.slice(0, limit).map((a) => (
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
            {a.isFollowing && (
              <DateLine label="내가 팔로우한 날" iso={a.followingSince} raw={a.followingSinceRaw} />
            )}
            {a.isFollower && (
              <DateLine label="나를 팔로우한 날" iso={a.followerSince} raw={a.followerSinceRaw} />
            )}
          </li>
        ))}
      </ul>

      {visible.length > limit && (
        <button type="button" className={buttonClasses("secondary", "w-full")} onClick={() => setLimit(limit + PAGE)}>
          더 보기 ({(visible.length - limit).toLocaleString()}개 남음)
        </button>
      )}
    </div>
  );
}
