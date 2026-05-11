import Link from "next/link";
import HeroCarousel from "./HeroCarousel";

export default function Hero() {
  return (
    <section className="bg-[var(--color-bg)] text-[var(--color-text)]">
      <div className="max-w-4xl mx-auto px-6 md:px-12 pt-16 md:pt-24 pb-10 md:pb-12 text-center">
        <p className="text-xs md:text-sm font-medium uppercase tracking-[0.25em] text-[var(--color-accent)] mb-6">
          Since 2021
        </p>
        <h1 className="font-display font-black uppercase leading-[1.02] tracking-tight text-4xl sm:text-6xl md:text-7xl mb-8">
          SUSTAIN
        </h1>
        <div className="space-y-2 text-base md:text-lg leading-relaxed max-w-2xl mx-auto mb-6">
          <p>서스테인은 2021년에 결성되어 현재까지 활동중인 대한민국의 밴드 입니다.</p>
          <p>국내 클럽은 물론 정부 행사와 팬 이벤트 등 다양한 무대에서 관객과 소통하며 음악의 즐거움을 전하고 있습니다.</p>
          <p>우리의 음악은 팝적인 감각과 감미로운 선율로 대중의 마음을 움직이는 힘이 있습니다.</p>
          <p>앞으로 이어질 우리의 여정을 기대해 주시기 바랍니다.</p>
          <p>감사합니다.</p>
        </div>
        <div className="space-y-1 text-xs md:text-sm leading-relaxed text-[var(--color-text-muted)] max-w-xl mx-auto mb-10">
          <p>Sustain is a South Korean band formed in 2021 and is still active today.</p>
          <p>We share the joy of music with audiences on various stages, including local clubs, government events, and fan gatherings.</p>
          <p>Our music, with its pop sensibility and melodious touch, has the power to move and inspire people.</p>
          <p>Please look forward to the journey that lies ahead.</p>
          <p>Thank you.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/songs"
            className="inline-flex items-center justify-center px-8 py-3 text-sm font-semibold uppercase tracking-wider border border-[var(--color-text)] bg-transparent text-[var(--color-text)] hover:bg-[var(--color-text)] hover:text-[var(--color-bg)] transition-colors"
          >
            Explore Music
          </Link>
          <Link
            href="/live"
            className="inline-flex items-center justify-center px-8 py-3 text-sm font-semibold uppercase tracking-wider border border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-ink)] hover:opacity-90 transition-colors"
          >
            Live Schedule
          </Link>
        </div>
      </div>

      <div className="pb-16 md:pb-20">
        <HeroCarousel />
      </div>
    </section>
  );
}
