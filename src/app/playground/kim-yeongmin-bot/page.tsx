import type { Metadata } from "next";
import Image from "next/image";
import ChatRoom from "@/components/yeongmin/ChatRoom";
import { buildPageMetadata } from "@/lib/seo";
import { getSettings } from "@/lib/yeongminBot";

export const dynamic = "force-dynamic";

const description =
  "諛대뱶 ?쒖뒪?뚯씤 由щ뜑 源?곷???紐⑦떚釉뚮줈 留뚮뱺 AI 罹먮┃??梨쀫큸. ?ㅼ젣 源?곷? 蹂몄씤? ?꾨땲硫? ?붾㈃??踰쀬뼱?섎㈃ ??붾뒗 ?щ씪?몄슂.";
const ogImage = "/slides/hero-b4d9e516.jpg";

export const metadata: Metadata = buildPageMetadata({
  title: "김영민 봇",
  path: "/playground/kim-yeongmin-bot",
  description,
  keywords: ["김영민 봇", "서스테인 김영민", "Band Sustain chatbot"],
  ogImage,
});

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
              alt="源?곷? 遊?"
              width={40}
              height={40}
              className="w-10 h-10 object-cover"
            />
          ) : (
            <span className="block w-10 h-10 text-center leading-10 text-sm text-[var(--color-text-muted)]">
              源
            </span>
          )}
        </div>
        <div className="flex flex-col">
          <span className="font-display font-bold text-base leading-tight">源?곷? 遊?</span>
          <span className="text-xs text-[var(--color-text-muted)] leading-tight">
            AI 罹먮┃??쨌 ?ㅼ젣 源?곷? 蹂몄씤 ?꾨떂 쨌 ?붾㈃ 踰쀬뼱?섎㈃ ????щ씪吏?
          </span>
        </div>
      </header>
      <ChatRoom profileImagePath={profileImagePath} />
    </section>
  );
}
