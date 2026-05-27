import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getVisibleTopics, getPublishedPosts } from "@/lib/columns";
import { excerptFromMarkdown, formatColumnDate } from "@/lib/columnsFormat";
import { buildPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

const description =
  "밴드 서스테인 멤버들이 연재하는 칼럼. 주제별로 멤버들의 글과 이야기를 만나보세요.";

export const metadata: Metadata = buildPageMetadata({
  title: "칼럼",
  path: "/columns",
  description,
  keywords: ["서스테인 칼럼", "밴드 서스테인 칼럼", "Band Sustain column"],
  ogImage: "/slides/hero-a7f3c1e2.jpg",
});

export default async function ColumnsPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string }>;
}) {
  const sp = await searchParams;
  const topicNum = sp.topic ? Number(sp.topic) : NaN;
  const activeTopic = Number.isInteger(topicNum) ? topicNum : undefined;

  const [topics, posts] = await Promise.all([
    getVisibleTopics(),
    getPublishedPosts({ topicId: activeTopic }),
  ]);

  return (
    <section className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24">
      <header className="mb-10 md:mb-14">
        <h1 className="font-display font-black uppercase tracking-tight text-4xl md:text-6xl mb-6">
          Column
        </h1>
        <p className="text-lg md:text-xl text-[var(--color-text-muted)] leading-[1.5]">
          멤버들이 연재하는 이야기
        </p>
      </header>

      {topics.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-12">
          <ChipLink href="/columns" active={activeTopic === undefined} label="전체" />
          {topics.map((t) => (
            <ChipLink
              key={t.id}
              href={`/columns?topic=${t.id}`}
              active={activeTopic === t.id}
              label={t.title}
            />
          ))}
        </div>
      )}

      {posts.length === 0 ? (
        <p className="text-[var(--color-text-muted)]">아직 글이 없습니다.</p>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
          {posts.map((p) => (
            <li key={p.id}>
              <Link href={`/columns/${p.id}`} className="group block">
                <div className="relative aspect-[3/2] bg-[var(--color-bg-muted)] mb-4 overflow-hidden flex items-center justify-center text-[var(--color-text-muted)] text-sm">
                  {p.heroImage ? (
                    <Image
                      src={p.heroImage}
                      alt={p.title}
                      fill
                      sizes="(min-width:1024px) 33vw, (min-width:768px) 50vw, 100vw"
                      className="object-cover"
                    />
                  ) : (
                    <span className="font-display uppercase tracking-widest px-4 text-center">
                      {p.topicTitle}
                    </span>
                  )}
                </div>
                <p className="text-xs uppercase tracking-widest text-[var(--color-text-muted)] mb-2">
                  {p.topicTitle}
                  {p.authorName ? ` · ${p.authorName}` : ""} · {formatColumnDate(p.publishedAt ?? p.createdAt)}
                </p>
                <h2 className="font-display font-bold text-xl md:text-2xl tracking-tight mb-2 group-hover:underline underline-offset-4 decoration-2">
                  {p.title}
                </h2>
                <p className="text-[var(--color-text-muted)] text-sm leading-[1.6] mb-3">
                  {p.excerpt || excerptFromMarkdown(p.body, 120)}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] tabular-nums">
                  조회 {p.viewCount} · 댓글 {p.commentCount}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ChipLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={
        "px-5 py-2 text-sm font-medium border border-[var(--color-text)] transition-colors " +
        (active
          ? "bg-[var(--color-text)] text-[var(--color-bg)]"
          : "bg-transparent text-[var(--color-text)] hover:bg-[var(--color-bg-muted)]")
      }
    >
      {label}
    </Link>
  );
}
