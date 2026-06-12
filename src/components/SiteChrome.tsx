"use client";

import { usePathname } from "next/navigation";
import Footer from "./Footer";
import Nav from "./Nav";
import BgmProvider from "./bgm/BgmProvider";
import BgmMiniPlayer from "./bgm/BgmMiniPlayer";

// Routes that need a full-bleed canvas (no site nav, no site footer).
// The editor needs the viewport top-to-bottom for the fixed right panel
// and the in-canvas TopBar; the surrounding chrome would clip both.
const FULL_BLEED = [/^\/playground\/pedalboard-planner\/edit\//];

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const path = usePathname() ?? "";
  const fullBleed = FULL_BLEED.some((re) => re.test(path));
  // BgmProvider 는 full-bleed 여부와 무관하게 항상 마운트 상태를 유지해야
  // 라우트 전환 시 BGM 이 끊기지 않는다. 분기는 Provider 안쪽에서만.
  return (
    <BgmProvider>
      {fullBleed ? (
        <>
          <main className="flex-1 flex flex-col">{children}</main>
          {/* 재생 중에만 축소 칩으로 노출 — UI 없이 소리만 나는 상태 방지.
              분기 전환 시 리마운트되므로 진입 때마다 항상 축소로 시작한다. */}
          <BgmMiniPlayer overlay />
        </>
      ) : (
        <>
          <Nav />
          <main className="flex-1">{children}</main>
          <Footer />
          <BgmMiniPlayer />
        </>
      )}
    </BgmProvider>
  );
}
