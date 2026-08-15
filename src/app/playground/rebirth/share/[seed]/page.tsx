import type { Metadata } from "next";
import { headers } from "next/headers";
import { sharedRebirthResult } from "@/lib/rebirth/share";
import ShareRedirect from "./ShareRedirect";
import { locationName } from "@/lib/rebirth/scene";

type Props = { params: Promise<{ seed: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { seed } = await params;
  const result = sharedRebirthResult(seed);
  const place = result ? locationName(result) : "도시 외 지역";
  const country = result?.country.nameKo ?? "다시 태어난다면";
  const topPercent = result ? Math.max(1, 101 - result.percentile) : null;
  const title = result ? `다시 태어난다면: ${place}, ${country}` : "다시 태어난다면";
  const description = result
    ? `${place}, ${country} · 가정의 전국 경제 위치 상위 ${topPercent}%`
    : "국가와 도시, 그리고 가정의 출발점을 확률로 만나보세요.";
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "bandsustain.com";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const shareUrl = `${protocol}://${host}/playground/rebirth/share/${encodeURIComponent(seed)}`;
  const image = `${shareUrl}/opengraph-image`;

  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, type: "website", url: shareUrl, images: [{ url: image, width: 1200, height: 630, alt: title }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function RebirthSharePage({ params }: Props) {
  const { seed } = await params;
  return <ShareRedirect seed={seed} />;
}
