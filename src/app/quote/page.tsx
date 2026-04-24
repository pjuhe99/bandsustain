import type { Metadata } from "next";

const description = "Quote — coming soon.";
const ogImage = "/slides/hero-c28a7f43.jpg";

export const metadata: Metadata = {
  title: "Quote",
  description,
  openGraph: {
    type: "website",
    siteName: "Band Sustain",
    url: "https://bandsustain.com/quote",
    title: "Quote — Band Sustain",
    description,
    images: [{ url: ogImage, alt: "Quote" }],
    locale: "ko_KR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Quote — Band Sustain",
    description,
    images: [ogImage],
  },
};

export default function QuotePage() {
  return (
    <section className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24">
      <h1 className="font-display font-black uppercase tracking-tight text-4xl md:text-6xl mb-6">
        Quote
      </h1>
      <p className="text-[var(--color-text-muted)]">Coming soon.</p>
    </section>
  );
}
