import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buildPageMetadata } from "@/lib/seo";
import { buttonClasses } from "@/components/Button";
import { isInstagramFollowEnabled } from "@/lib/playground/instagram/flag";
import { HOF_PAGE_SIZE } from "@/lib/playground/instagram/config";
import { followDayCount, formatKoreanDate } from "@/lib/playground/instagram/followDays";
import { listVisibleHof } from "@/lib/playground/instagram/hofDb";

const description =
  "서스테인을 가장 오래 팔로우한 팬은 누구일까요? 인스타그램 데이터 파일 하나로 팔로우 기간을 확인하고 명예의 전당에 도전하세요. 겸사겸사 나를 맞팔하지 않는 계정도 확인할 수 있어요.";

export const metadata: Metadata = buildPageMetadata({
  title: "서스테인 팔로우 명예의 전당",
  description,
  path: "/playground/instagram-follow",
  ogImage: "/slides/hero-b4d9e516.jpg",
});

export const dynamic = "force-dynamic";

export default async function InstagramFollowPage({
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
    <section className="max-w-3xl mx-auto px-6 md:px-12 py-12 md:py-20 page-fade-in">
      <nav className="mb-8 flex items-center gap-2 text-xs uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
        <Link href="/playground" className="underline underline-offset-4 hover:text-[var(--color-text)]">
          Playground
        </Link>
        <span aria-hidden>›</span>
        <span className="text-[var(--color-text)]">서스테인 팔로우 명예의 전당</span>
      </nav>

      <header className="mb-10 md:mb-14">
        <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-accent)] font-semibold mb-4">
          팬 랭킹
        </p>
        <h1 className="font-display font-black uppercase tracking-tight text-4xl md:text-6xl leading-[1.05]">
          서스테인 팔로우
          <br />
          명예의 전당
        </h1>
        <p className="mt-6 text-xl md:text-2xl font-display font-bold text-[var(--color-text)]">
          서스테인을 가장 오래 팔로우한 사람은 누구일까요?
        </p>
        <p className="mt-3 text-lg text-[var(--color-text-muted)] leading-relaxed">{description}</p>
      </header>

      <div className="mx-auto max-w-xl space-y-8">
        <div className="space-y-3 border-2 border-[var(--color-accent)] p-5 text-center">
          <p className="text-sm">
            인스타그램 데이터 파일 하나면 내 팔로우 시작일을 확인하고 랭킹에 등록할 수 있어요.
            <br />
            로그인도, 비밀번호도 필요 없어요.
          </p>
          <Link href="/playground/instagram-follow/analyze" className={buttonClasses("accent", "w-full")}>
            내 팔로우 기간 확인하고 등록하기
          </Link>
          <p className="text-xs text-[var(--color-text-muted)]">
            분석 결과에서 나를 맞팔하지 않는 계정도 함께 확인할 수 있어요.
          </p>
        </div>

        <p className="text-sm text-[var(--color-text-muted)]">
          @band_sustain을 가장 오래 팔로우한 순서예요. 총{" "}
          <span className="font-semibold text-[var(--color-text)]">{total.toLocaleString()}명</span>이 등록했어요.
        </p>

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
      </div>
    </section>
  );
}
