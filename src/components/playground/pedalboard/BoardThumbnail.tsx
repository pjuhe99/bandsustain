import Image from "next/image";
import type { ThumbData } from "@/lib/playground/thumbnail";

// Aspect ratio of the card frame these thumbnails live in (aspect-[3/1]).
const CARD_RATIO = 3;
const IMG_SIZES = "(max-width: 768px) 50vw, 25vw";

/**
 * Renders a gallery thumbnail. When `thumb` is present it composites the board
 * image with each pedal positioned over it (mirroring ShareView / the OG image
 * math), so the thumbnail shows the finished board — not the bare board.
 *
 * The card frame is a fixed 3/1 box, but boards have their own aspect ratios,
 * so we "contain" a board-ratio stage inside the card and center it; pedals are
 * then positioned as a percentage of the board, keeping them aligned.
 *
 * Falls back to the bare board image when there is no usable snapshot.
 */
export function BoardThumbnail({ thumb, fallbackImage, alt }: {
  thumb: ThumbData | null;
  fallbackImage: string | null;
  alt: string;
}) {
  if (!thumb) {
    return fallbackImage ? (
      <Image src={`/playground/images/pedalboards/${fallbackImage}`} alt={alt}
        fill className="object-contain" sizes={IMG_SIZES} />
    ) : null;
  }

  const { board, items } = thumb;
  const boardRatio = board.width_in / board.height_in;

  // Largest board-ratio rectangle that fits inside the 3/1 card (object-contain).
  let stageW = 100;
  let stageH = 100;
  if (boardRatio >= CARD_RATIO) {
    stageH = (CARD_RATIO / boardRatio) * 100;
  } else {
    stageW = (boardRatio / CARD_RATIO) * 100;
  }
  const stageLeft = (100 - stageW) / 2;
  const stageTop = (100 - stageH) / 2;

  return (
    <div style={{
      position: "absolute",
      left: `${stageLeft}%`, top: `${stageTop}%`,
      width: `${stageW}%`, height: `${stageH}%`,
    }}>
      {board.image_filename && (
        <Image src={`/playground/images/pedalboards/${board.image_filename}`} alt={alt}
          fill className="object-contain" sizes={IMG_SIZES} />
      )}
      {items.map((it, i) => {
        const wPct = (it.width_in / board.width_in) * 100;
        const hPct = (it.height_in / board.height_in) * 100;
        const xPct = (it.x / board.width_in) * 100;
        const yPct = (it.y / board.height_in) * 100;
        return (
          <div key={i} style={{
            position: "absolute",
            left: `${xPct}%`, top: `${yPct}%`,
            width: `${wPct}%`, height: `${hPct}%`,
            transform: `rotate(${it.rot}deg)`, transformOrigin: "center center",
          }}>
            {it.image_filename && (
              <Image src={`/playground/images/pedals/${it.image_filename}`} alt=""
                fill className="object-contain" sizes="120px" />
            )}
          </div>
        );
      })}
    </div>
  );
}
