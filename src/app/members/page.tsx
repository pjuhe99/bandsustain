import type { Metadata } from "next";
import MembersGrid from "@/components/MembersGrid";
import { sortedMembers } from "@/data/members";

const description = "Let me introduce the best friends of your life — 너의 인생에 최고의 친구들을 소개합니다";
const ogImage = "/members/member01.jpg";

export const metadata: Metadata = {
  title: "Members",
  description,
  openGraph: {
    type: "website",
    siteName: "Band Sustain",
    url: "https://bandsustain.com/members",
    title: "Members — Band Sustain",
    description,
    images: [{ url: ogImage, alt: "Members" }],
    locale: "ko_KR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Members — Band Sustain",
    description,
    images: [ogImage],
  },
};

export default function MembersPage() {
  const all = sortedMembers();

  return (
    <section className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24">
      <header className="mb-10 md:mb-12">
        <h1 className="font-display font-black uppercase tracking-tight text-4xl md:text-6xl mb-6">
          Members
        </h1>
        <p className="text-lg md:text-xl text-[var(--color-text-muted)] leading-[1.5]">
          Let me introduce the best friends of your life
          <br />
          너의 인생에 최고의 친구들을 소개합니다
        </p>
      </header>

      <MembersGrid members={all} />
    </section>
  );
}
