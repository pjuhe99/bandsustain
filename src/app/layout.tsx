import type { Metadata } from "next";
import { Inter, Archivo } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

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

const siteUrl = "https://bandsustain.com";
const defaultDescription = "Band Sustain — music, stories, experiments.";
const defaultOgImage = "/slides/hero-a7f3c1e2.jpg";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Band Sustain",
    template: "%s — Band Sustain",
  },
  description: defaultDescription,
  openGraph: {
    type: "website",
    siteName: "Band Sustain",
    url: siteUrl,
    title: "Band Sustain",
    description: defaultDescription,
    images: [{ url: defaultOgImage, alt: "Band Sustain" }],
    locale: "ko_KR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Band Sustain",
    description: defaultDescription,
    images: [defaultOgImage],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${archivo.variable} overflow-x-hidden`}>
      <body className="min-h-screen flex flex-col overflow-x-hidden">
        <Nav />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
