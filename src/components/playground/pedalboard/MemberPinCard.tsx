import Link from "next/link";
import Image from "next/image";
import type { MemberPinView } from "@/lib/playground/memberPins";

export function MemberPinCard({ pin }: { pin: MemberPinView }) {
  return (
    <li>
      <Link href={`/playground/p/${pin.share_token}`} className="block">
        <div className="aspect-[3/1] bg-[var(--color-bg-muted)] relative overflow-hidden">
          {pin.board.image_filename && (
            <Image
              src={`/playground/images/pedalboards/${pin.board.image_filename}`}
              alt={`${pin.board.brand} ${pin.board.name}`}
              fill
              className="object-contain"
              sizes="(max-width: 768px) 50vw, 25vw"
            />
          )}
        </div>
        <div className="mt-2 text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
          {pin.board.brand} {pin.board.name}
        </div>
        <div className="font-semibold text-base truncate">{pin.title}</div>
        {pin.caption && (
          <div className="text-sm text-[var(--color-text-muted)] line-clamp-2 mt-1">
            {pin.caption}
          </div>
        )}
      </Link>
    </li>
  );
}
