import Image from "next/image";
import type { Layout } from "@/lib/playground/layoutSerializer";

export function ShareView({ layout }: { layout: Layout }) {
  return (
    <section className="max-w-5xl mx-auto px-6 md:px-12 py-12">
      <header className="mb-6">
        <h1 className="font-display font-black text-3xl md:text-5xl">{layout.title}</h1>
        <div className="mt-2 text-sm text-[var(--color-text-muted)]">
          {layout.board.brand} {layout.board.name} · {layout.board.width_in}{'"'} × {layout.board.height_in}{'"'}
        </div>
      </header>
      <div className="relative w-full" style={{ aspectRatio: `${layout.board.width_in} / ${layout.board.height_in}` }}>
        {layout.board.image_filename && (
          <Image src={`/playground/images/pedalboards/${layout.board.image_filename}`}
            alt={`${layout.board.brand} ${layout.board.name}`} fill className="object-contain" sizes="100vw" />
        )}
        {layout.items.map((it, i) => {
          const wPct = (it.width_in / layout.board.width_in) * 100;
          const hPct = (it.height_in / layout.board.height_in) * 100;
          const xPct = (it.x / layout.board.width_in) * 100;
          const yPct = (it.y / layout.board.height_in) * 100;
          return (
            <div key={i} style={{
              position: "absolute",
              left: `${xPct}%`, top: `${yPct}%`,
              width: `${wPct}%`, height: `${hPct}%`,
              transform: `rotate(${it.rot}deg)`, transformOrigin: "center center",
            }}>
              {it.image_filename && (
                <Image src={`/playground/images/pedals/${it.image_filename}`} alt={`${it.brand} ${it.name}`}
                  fill className="object-contain" sizes="200px" />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
