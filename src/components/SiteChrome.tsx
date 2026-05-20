"use client";

import { usePathname } from "next/navigation";
import Footer from "./Footer";
import Nav from "./Nav";

// Routes that need a full-bleed canvas (no site nav, no site footer).
// The editor needs the viewport top-to-bottom for the fixed right panel
// and the in-canvas TopBar; the surrounding chrome would clip both.
const FULL_BLEED = [/^\/playground\/pedalboard-planner\/edit\//];

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const path = usePathname() ?? "";
  const fullBleed = FULL_BLEED.some((re) => re.test(path));
  if (fullBleed) {
    return <main className="flex-1 flex flex-col">{children}</main>;
  }
  return (
    <>
      <Nav />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
