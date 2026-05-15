import type { Metadata } from "next";
import Image from "next/image";
import ChatRoom from "@/components/yeongmin/ChatRoom";
import { getSettings } from "@/lib/yeongminBot";

export const dynamic = "force-dynamic";

const description =
  "밴드 서스테인 리더 김영민을 모티브로 만든 AI 캐릭터 챗봇. 실제 김영민 본인은 아니며, 화면을 벗어나면 대화는 사라져요.";
const ogImage = "/slides/hero-b4d9e516.jpg";

export const metadata: Metadata = {
  title: "김영민 봇",
  description,
  openGraph: {
    type: "website",
    siteName: "Band Sustain",
    url: "https://bandsustain.com/playground/kim-yeongmin-bot",
    title: "김영민 봇 — Band Sustain",
    description,
    images: [{ url: ogImage, alt: "김영민 봇" }],
    locale: "ko_KR",
  },
  twitter: {
    card: "summary_large_image",
    title: "김영민 봇 — Band Sustain",
    description,
    images: [ogImage],
  },
};

export default async function KimYeongminBotPage() {
  const settings = await getSettings();
  const profileImagePath = settings.profileImagePath;

  return (
    <section className="flex flex-col">
      <header className="border-b border-[var(--color-border)] px-4 md:px-6 py-3 flex items-center gap-3">
        <div className="shrink-0 w-10 h-10 overflow-hidden rounded-full bg-[var(--color-bg-muted)]">
          {profileImagePath ? (
            <Image
              src={profileImagePath}
              alt="김영민 봇"
              width={40}
              height={40}
              className="w-10 h-10 object-cover"
            />
          ) : (
            <span className="block w-10 h-10 text-center leading-10 text-sm text-[var(--color-text-muted)]">
              김
            </span>
          )}
        </div>
        <div className="flex flex-col">
          <span className="font-display font-bold text-base leading-tight">김영민 봇</span>
          <span className="text-xs text-[var(--color-text-muted)] leading-tight">
            AI 캐릭터 · 실제 김영민 본인 아님 · 화면 벗어나면 대화 사라짐
          </span>
        </div>
      </header>
      <ChatRoom profileImagePath={profileImagePath} />
    </section>
  );
}
