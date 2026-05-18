import type { Metadata } from "next";
import MembersGrid from "@/components/MembersGrid";
import { getPublishedMembers } from "@/lib/members";
import { buildPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

const description =
  "밴드 서스테인 멤버 소개 페이지. 각 멤버의 역할과 개성을 한곳에서 확인할 수 있습니다.";
const ogImage = "/members/member01.jpg";

export const metadata: Metadata = buildPageMetadata({
  title: "멤버",
  path: "/members",
  description,
  keywords: ["서스테인 멤버", "밴드 서스테인 멤버", "Band Sustain members"],
  ogImage,
});

export default async function MembersPage() {
  const members = await getPublishedMembers();

  return (
    <section className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24">
      <header className="mb-10 md:mb-12">
        <h1 className="font-display font-black uppercase tracking-tight text-4xl md:text-6xl mb-6">
          Members
        </h1>
        <p className="text-lg md:text-xl text-[var(--color-text-muted)] leading-[1.5]">
          Let me introduce the best friends of your life
          <br />
          밴드 서스테인을 함께 만드는 멤버들을 소개합니다
        </p>
      </header>

      <MembersGrid members={members} />
    </section>
  );
}
