import Image from "next/image";

type Props = {
  portraitUrl: string | null;
  attribution: string | null;
};

function resolvePlaceholder(attribution: string | null): string {
  if (attribution == null) return "★";
  const trimmed = attribution.trim();
  const lower = trimmed.toLowerCase();
  if (lower === "anonymous" || trimmed === "익명") return "★";
  const first = trimmed.charAt(0);
  return /[a-zA-Z]/.test(first) ? first.toUpperCase() : first;
}

export default function QuotePortrait({ portraitUrl, attribution }: Props) {
  if (portraitUrl) {
    return (
      <Image
        src={portraitUrl}
        alt={attribution ?? "portrait"}
        width={160}
        height={200}
        className="w-full aspect-[4/5] object-cover grayscale contrast-[1.05]"
      />
    );
  }

  const glyph = resolvePlaceholder(attribution);
  return (
    <div className="w-full aspect-[4/5] bg-[var(--color-bg-muted)] flex items-center justify-center">
      <span className="font-display font-black text-4xl md:text-5xl text-[var(--color-border-strong)] opacity-30">
        {glyph}
      </span>
    </div>
  );
}
