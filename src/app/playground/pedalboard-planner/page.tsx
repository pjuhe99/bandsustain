import type { Metadata } from "next";
import { BoardSelectGrid } from "@/components/playground/pedalboard/BoardSelectGrid";
import { listBoardBrands, searchBoards } from "@/lib/playground/playgroundDb";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Pedalboard Planner",
  path: "/playground/pedalboard-planner",
  description: "원하는 보드를 골라 페달을 배치하고 공유하세요.",
  ogImage: "/slides/hero-b4d9e516.jpg",
});

export default async function Page() {
  const [brands, boards] = await Promise.all([
    listBoardBrands(),
    searchBoards({ limit: 50, offset: 0 }),
  ]);
  return <BoardSelectGrid initialBrands={brands} initialBoards={boards} />;
}
