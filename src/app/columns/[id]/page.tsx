import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import Markdown from "@/components/Markdown";
import ColumnViewPing from "@/components/ColumnViewPing";
import ColumnComments, { type PublicComment } from "@/components/ColumnComments";
import { getPublishedPostById, getVisibleComments } from "@/lib/columns";
import { excerptFromMarkdown, formatColumnDate, timeAgo } from "@/lib/columnsFormat";
import { buildColumnArticleSchema, buildPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) return {};
  const post = await getPublishedPostById(numId);
  if (!post) return {};
  const description = post.excerpt || excerptFromMarkdown(post.body, 200);
  return buildPageMetadata({
    title: `${post.title} - 칼럼`,
    path: `/columns/${post.id}`,
    description,
    keywords: ["서스테인 칼럼", post.topicTitle, post.title],
    ogImage: post.heroImage || "/slides/hero-a7f3c1e2.jpg",
    type: "article",
  });
}

export default async function ColumnDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) notFound();
  const post = await getPublishedPostById(numId);
  if (!post) notFound();

  const rawComments = await getVisibleComments(numId);
  const now = new Date();
  const comments: PublicComment[] = rawComments.map((c) => ({
    id: c.id,
    nickname: c.nickname,
    ipMasked: c.ipMasked,
    body: c.body,
    when: timeAgo(c.createdAt, now),
    hasPassword: c.hasPassword,
  }));

  return (
    <article className="max-w-3xl mx-auto px-6 md:px-12 py-16 md:py-24">
      <JsonLd data={buildColumnArticleSchema(post)} />
      <ColumnViewPing id={post.id} />

      <nav className="text-sm text-[var(--color-text-muted)] mb-8">
        <Link href="/" className="underline underline-offset-4">Home</Link>
        <span className="mx-2">›</span>
        <Link href="/columns" className="underline underline-offset-4">칼럼</Link>
        <span className="mx-2">›</span>
        <Link href={`/columns?topic=${post.topicId}`} className="underline underline-offset-4">
          {post.topicTitle}
        </Link>
      </nav>

      <p className="text-xs uppercase tracking-widest text-[var(--color-text-muted)] mb-4">
        {post.topicTitle}
        {post.authorName ? ` · ${post.authorName}` : ""} · {formatColumnDate(post.publishedAt ?? post.createdAt)} · 조회 {post.viewCount}
      </p>
      <h1 className="font-display font-black uppercase tracking-tight leading-[1.05] text-3xl md:text-5xl mb-10 md:mb-12">
        {post.title}
      </h1>

      {post.heroImage && (
        <figure className="relative aspect-[3/2] bg-[var(--color-bg-muted)] mb-12 md:mb-16 overflow-hidden">
          <Image
            src={post.heroImage}
            alt={post.title}
            fill
            priority
            sizes="(min-width:768px) 768px, 100vw"
            className="object-cover"
          />
        </figure>
      )}

      <Markdown>{post.body}</Markdown>

      <ColumnComments postId={post.id} comments={comments} />

      <nav className="mt-12 pt-6 border-t border-[var(--color-border)]">
        <Link href="/columns" className="text-sm underline underline-offset-4">← 칼럼 목록</Link>
      </nav>
    </article>
  );
}
