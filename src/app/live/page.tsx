import type { Metadata } from "next";

const description = "Live — coming soon.";
const ogImage = "/slides/hero-b4d9e516.jpg";

export const metadata: Metadata = {
  title: "Live",
  description,
  openGraph: {
    type: "website",
    siteName: "bandsustain",
    url: "https://bandsustain.com/live",
    title: "Live — bandsustain",
    description,
    images: [{ url: ogImage, alt: "Live" }],
    locale: "ko_KR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Live — bandsustain",
    description,
    images: [ogImage],
  },
};

export default function LivePage() {
  return (
    <section className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24">
      <h1 className="font-display font-black uppercase tracking-tight text-4xl md:text-6xl mb-6">
        Live
      </h1>
      <p className="text-[var(--color-text-muted)]">Coming soon.</p>
    </section>
  );
}
