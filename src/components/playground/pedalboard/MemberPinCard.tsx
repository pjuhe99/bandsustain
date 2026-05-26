import Link from "next/link";
import { BoardThumbnail } from "./BoardThumbnail";
import type { MemberPinView } from "@/lib/playground/memberPins";

export function MemberPinCard({ pin }: { pin: MemberPinView }) {
  return (
    <li>
      <Link href={`/playground/p/${pin.share_token}`} className="block">
        <div className="aspect-[3/1] bg-[var(--color-bg-muted)] relative overflow-hidden">
          <BoardThumbnail
            thumb={pin.thumb}
            fallbackImage={pin.board.image_filename}
            alt={`${pin.board.brand} ${pin.board.name}`}
          />
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
