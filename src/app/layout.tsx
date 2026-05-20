import type { Metadata } from "next";
import { Archivo, Inter } from "next/font/google";
import AnalyticsBeacon from "@/components/AnalyticsBeacon";
import ClickTracker from "@/components/ClickTracker";
import SiteChrome from "@/components/SiteChrome";
import { buildRootMetadata } from "@/lib/seo";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  weight: ["700", "900"],
  display: "swap",
});

const rootMetadata = buildRootMetadata();

export const metadata: Metadata = {
  ...rootMetadata,
  verification: {
    google: "AMJOi47eVTgK7Oh9l3ihsx4JAayNErTTsuPI8ro8IP4",
    other: {
      "naver-site-verification": "2524ed358d9d1ad3dca1254ea8571ab30ece6d69",
      "msvalidate.01": "559A923768AC7A160FF2BA438DC09ABC",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={`${inter.variable} ${archivo.variable} overflow-x-hidden`}>
      <body className="flex min-h-screen flex-col overflow-x-hidden">
        <AnalyticsBeacon />
        <ClickTracker />
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
