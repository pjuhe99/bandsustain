import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import path from "node:path";
import { getLayoutByShareToken } from "@/lib/playground/playgroundDb";
import { parseSnapshot } from "@/lib/playground/layoutSerializer";
import { isValidToken } from "@/lib/playground/tokens";

export const runtime = "nodejs";
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };
export const alt = "Pedalboard";

const ORIGIN = "https://bandsustain.com";

export default async function Image({ params }: { params: Promise<{ shareToken: string }> }) {
  const { shareToken } = await params;

  // Always succeed — never 500. Fall back to a neutral card if anything fails.
  let title = "Pedalboard";
  let board: { width_in: number; height_in: number; image: string | null } | null = null;
  let items: Array<{ x: number; y: number; rot: number; w: number; h: number; image: string | null }> = [];

  try {
    if (isValidToken(shareToken)) {
      const row = await getLayoutByShareToken(shareToken);
      if (row && row.visibility !== "private" && row.snapshot_json) {
        const layout = parseSnapshot(row.snapshot_json);
        title = layout.title || "Pedalboard";
        board = {
          width_in: layout.board.width_in,
          height_in: layout.board.height_in,
          image: layout.board.image_filename ? `${ORIGIN}/playground/images/pedalboards/${layout.board.image_filename}` : null,
        };
        items = layout.items.map((it) => ({
          x: it.x, y: it.y, rot: it.rot, w: it.width_in, h: it.height_in,
          image: it.image_filename ? `${ORIGIN}/playground/images/pedals/${it.image_filename}` : null,
        }));
      }
    }
  } catch {
    // swallow — fall through to neutral card
  }

  const fontData = readFileSync(path.join(process.cwd(), "public/fonts/Pretendard-Bold.otf"));

  // Layout math: fit the board into a 1040×420 stage with padding, keep aspect.
  const STAGE_W = 1040;
  const STAGE_H = 420;
  let stagePixelW = STAGE_W;
  let stagePixelH = STAGE_H;
  if (board) {
    const boardRatio = board.width_in / board.height_in;
    const stageRatio = STAGE_W / STAGE_H;
    if (boardRatio > stageRatio) {
      stagePixelW = STAGE_W;
      stagePixelH = STAGE_W / boardRatio;
    } else {
      stagePixelH = STAGE_H;
      stagePixelW = STAGE_H * boardRatio;
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200, height: 630,
          background: "#ffffff",
          display: "flex", flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px 80px",
          fontFamily: "Pretendard",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 4, color: "#888", textTransform: "uppercase" }}>
            Pedalboard
          </div>
          <div style={{ display: "flex", fontSize: 52, color: "#0a0a0a", lineHeight: 1.1, fontWeight: 700, maxWidth: 1040, overflow: "hidden" }}>
            {title}
          </div>
        </div>

        {board ? (
          <div
            style={{
              position: "relative",
              width: stagePixelW,
              height: stagePixelH,
              alignSelf: "center",
              background: "#f5f5f5",
              display: "flex",
            }}
          >
            {board.image && (
              <img
                src={board.image}
                alt=""
                width={stagePixelW}
                height={stagePixelH}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }}
              />
            )}
            {items.map((it, i) => {
              const wPct = (it.w / board!.width_in) * 100;
              const hPct = (it.h / board!.height_in) * 100;
              const xPct = (it.x / board!.width_in) * 100;
              const yPct = (it.y / board!.height_in) * 100;
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: `${xPct}%`, top: `${yPct}%`,
                    width: `${wPct}%`, height: `${hPct}%`,
                    transform: `rotate(${it.rot}deg)`,
                    transformOrigin: "center center",
                    display: "flex",
                  }}
                >
                  {it.image && (
                    <img src={it.image} alt="" width="100%" height="100%" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ display: "flex", alignSelf: "center", color: "#888", fontSize: 28 }}>bandsustain.com</div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 22, color: "#888" }}>
          <div style={{ display: "flex" }}>bandsustain.com</div>
          <div style={{ display: "flex" }}>{items.length}개의 페달</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Pretendard",
          data: fontData,
          weight: 700,
          style: "normal",
        },
      ],
    },
  );
}
