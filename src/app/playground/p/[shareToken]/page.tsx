import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getLayoutByShareToken } from "@/lib/playground/playgroundDb";
import { parseSnapshot } from "@/lib/playground/layoutSerializer";
import { ShareView } from "@/components/playground/pedalboard/ShareView";
import { isValidToken } from "@/lib/playground/tokens";
import { buildPageMetadata } from "@/lib/seo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadLayout(token: string) {
  if (!isValidToken(token)) return null;
  const row = await getLayoutByShareToken(token);
  if (!row) return null;
  if (row.visibility === "private") return null;
  if (!row.snapshot_json) return null;
  try {
    return { row, layout: parseSnapshot(row.snapshot_json) };
  } catch { return null; }
}

export async function generateMetadata({ params }: { params: Promise<{ shareToken: string }> }): Promise<Metadata> {
  const { shareToken } = await params;
  const loaded = await loadLayout(shareToken);
  if (!loaded) return buildPageMetadata({
    title: "Pedalboard",
    path: `/playground/p/${shareToken}`,
    description: "공유된 페달보드 레이아웃",
    ogImage: "/slides/hero-b4d9e516.jpg",
  });
  return buildPageMetadata({
    title: loaded.layout.title,
    path: `/playground/p/${shareToken}`,
    description: `${loaded.layout.board.brand} ${loaded.layout.board.name} · 페달 ${loaded.layout.items.length}개`,
    ogImage: "/slides/hero-b4d9e516.jpg",
  });
}

export default async function Page({ params }: { params: Promise<{ shareToken: string }> }) {
  const { shareToken } = await params;
  const loaded = await loadLayout(shareToken);
  if (!loaded) notFound();
  return <ShareView layout={loaded.layout} />;
}
