import Image from "next/image";
import type { MemberPinView } from "@/lib/playground/memberPins";
import { groupConsecutiveBy } from "@/lib/playground/groupConsecutive";
import { MemberPinCard } from "./MemberPinCard";

export function MemberPinSection({ pins }: { pins: MemberPinView[] }) {
  if (pins.length === 0) return null;
  const groups = groupConsecutiveBy(pins, (p) => p.member.id);
  return (
    <section className="mb-12" aria-labelledby="member-pin-section-heading">
      <h2
        id="member-pin-section-heading"
        className="font-display font-black uppercase tracking-tight text-2xl md:text-3xl mb-6"
      >
        서스테인 멤버 페달보드
      </h2>
      <div className="space-y-10">
        {groups.map((g, idx) => {
          const m = g.items[0].member;
          return (
            <div key={`${m.id}-${idx}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className="relative w-12 h-12 bg-[var(--color-bg-muted)] shrink-0">
                  <Image
                    src={m.photoUrl}
                    alt={m.nameKr}
                    fill
                    className="object-cover"
                    sizes="48px"
                  />
                </div>
                <div>
                  <div className="font-semibold text-base">{m.nameKr}</div>
                  <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
                    {m.position}
                  </div>
                </div>
              </div>
              <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                {g.items.map((pin) => (
                  <MemberPinCard key={pin.pin_id} pin={pin} />
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
