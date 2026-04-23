"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import Fade from "embla-carousel-fade";

const slides = [
  { src: "/slides/hero-a7f3c1e2.jpg", alt: "bandsustain — slide 1" },
  { src: "/slides/hero-b4d9e516.jpg", alt: "bandsustain — slide 2" },
  { src: "/slides/hero-c28a7f43.jpg", alt: "bandsustain — slide 3" },
  { src: "/slides/hero-d6e15b8c.jpg", alt: "bandsustain — slide 4" },
];

export default function HeroCarousel() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(m.matches);
    const h = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    m.addEventListener("change", h);
    return () => m.removeEventListener("change", h);
  }, []);

  const plugins = reducedMotion
    ? [Fade()]
    : [
        Autoplay({ delay: 5500, stopOnInteraction: false, stopOnMouseEnter: true }),
        Fade(),
      ];

  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, duration: 30 },
    plugins
  );

  const [selected, setSelected] = useState(0);
  const scrollTo = useCallback(
    (i: number) => emblaApi && emblaApi.scrollTo(i),
    [emblaApi]
  );

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelected(emblaApi.selectedScrollSnap());
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi]);

  return (
    <div className="relative w-full overflow-hidden">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {slides.map((s, i) => (
            <div
              key={s.src}
              className="relative flex-[0_0_100%] aspect-[3/2] bg-[--color-bg-muted]"
            >
              <Image
                src={s.src}
                alt={s.alt}
                fill
                priority={i === 0}
                sizes="100vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="absolute left-0 right-0 bottom-4 md:bottom-6 flex justify-center gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => scrollTo(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={`w-2.5 h-2.5 border border-white/80 transition-colors ${
              i === selected ? "bg-white" : "bg-transparent hover:bg-white/40"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
