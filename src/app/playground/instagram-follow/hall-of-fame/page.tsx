import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buildPageMetadata } from "@/lib/seo";
import { isInstagramFollowEnabled } from "@/lib/playground/instagram/flag";
import { HOF_PAGE_SIZE } from "@/lib/playground/instagram/config";
import { followDayCount, formatKoreanDate } from "@/lib/playground/instagram/followDays";
import { listVisibleHof } from "@/lib/playground/instagram/hofDb";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildPageMetadata({
  title: "서스테인 팔로우 명예의 전당",
  description: "@band_sustain을 가장 오래 팔로우한 팬들의 명예의 전당",
  path: "/playground/instagram-follow/hall-of-fame",
  ogImage: "/slides/hero-b4d9e516.jpg",
});

export default async function HallOfFamePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  if (!isInstagramFollowEnabled()) notFound();
  const sp = await searchParams;
  const page = Math.max(1, Math.floor(Number(sp.page) || 1));
  const { items, total } = await listVisibleHof(page, HOF_PAGE_SIZE);
  const offset = (page - 1) * HOF_PAGE_SIZE;
  const lastPage = Math.max(1, Math.ceil(total / HOF_PAGE_SIZE));

  return (
    <section className="max-w-5xl mx-auto px-6 md:px-12 py-12 md:py-20 page-fade-in">
      <nav className="mb-8 flex items-center gap-2 text-xs uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
        <Link href="/playground" className="underline underline-offset-4 hover:text-[var(--color-text)]">
          Playground
        </Link>
        <span aria-hidden>›</span>
        <Link href="/playground/instagram-follow" className="underline underline-offset-4 hover:text-[var(--color-text)]">
          인스타 맞팔 분석기
        </Link>
        <span aria-hidden>›</span>
        <span className="text-[var(--color-text)]">명예의 전당</span>
      </nav>

      <div className="max-w-xl">
        <header className="mb-8 space-y-2">
          <h1 className="font-display text-3xl font-black">서스테인 팔로우 명예의 전당</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            @band_sustain을 가장 오래 팔로우한 순서예요. 총 {total.toLocaleString()}명이 등록했어요.
          </p>
        </header>

        {items.length === 0 ? (
          <p className="py-12 text-center text-sm text-[var(--color-text-muted)]">
            아직 등록된 기록이 없어요. 첫 번째 주인공이 되어보세요!
          </p>
        ) : (
          <ol className="divide-y divide-[var(--color-border)] border border-[var(--color-border)]">
            {items.map((it, i) => {
              const rank = offset + i + 1;
              const days = followDayCount(it.followedAt);
              return (
                <li key={it.id} className="flex items-center gap-4 p-4">
                  <span className="font-display w-10 shrink-0 text-xl font-black">{rank}위</span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{it.nickname}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {formatKoreanDate(it.followedAt) ?? it.followedAt}부터
                      {days !== null && (
                        <>
                          {" "}·{" "}
                          <span className="font-semibold text-[var(--color-text)]">
                            {days.toLocaleString()}일째
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {lastPage > 1 && (
          <nav className="mt-4 flex justify-between text-sm" aria-label="페이지">
            {page > 1 ? (
              <Link href={`?page=${page - 1}`} className="underline underline-offset-4">
                이전
              </Link>
            ) : (
              <span />
            )}
            <span className="text-[var(--color-text-muted)]">
              {page} / {lastPage}
            </span>
            {page < lastPage ? (
              <Link href={`?page=${page + 1}`} className="underline underline-offset-4">
                다음
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}

        <p className="mt-6 text-xs text-[var(--color-text-muted)]">
          명예의 전당 기록은 사용자가 제출한 인스타그램 내보내기 파일을 기준으로 등록됩니다. 닉네임은
          등록자가 직접 입력한 표시명이에요.
        </p>
        <Link
          href="/playground/instagram-follow"
          className="mt-4 block text-center text-sm underline underline-offset-4"
        >
          내 맞팔 현황 분석하러 가기
        </Link>
      </div>
    </section>
  );
}
