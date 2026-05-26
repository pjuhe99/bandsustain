import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import path from "node:path";
import { decodeShare, shareTagsFor } from "@/lib/bandName/share";

export const runtime = "nodejs";
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };
export const alt = "밴드 이름 생성기 — 밴드 서스테인";

export default async function Image({ params }: { params: Promise<{ data: string }> }) {
  const { data } = await params;

  // 어떤 경우에도 500 내지 않는다 — 디코드 실패 시 중립 카드로 폴백.
  const payload = decodeShare(data);
  const name = payload?.name ?? "밴드 이름 생성기";
  const tags = payload ? shareTagsFor(payload) : [];

  const fontData = readFileSync(path.join(process.cwd(), "public/fonts/Pretendard-Bold.otf"));

  // 이름 길이에 따라 폰트 크기 조절 (긴 한글 이름이 박스를 넘지 않도록).
  const len = name.length;
  const nameSize = len <= 6 ? 132 : len <= 10 ? 104 : len <= 16 ? 80 : 60;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "#ffffff",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 80px",
          fontFamily: "Pretendard",
        }}
      >
        <div style={{ display: "flex", fontSize: 24, letterSpacing: 6, color: "#2563FF", textTransform: "uppercase" }}>
          밴드 이름 생성기
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 28 }}>
          <div
            style={{
              display: "flex",
              fontSize: nameSize,
              fontWeight: 700,
              color: "#0a0a0a",
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              maxWidth: 1040,
            }}
          >
            {name}
          </div>
          {tags.length > 0 && (
            <div style={{ display: "flex", gap: 12 }}>
              {tags.map((tag) => (
                <div
                  key={tag}
                  style={{
                    display: "flex",
                    fontSize: 24,
                    color: "#555555",
                    border: "1px solid #e5e5e5",
                    padding: "8px 18px",
                  }}
                >
                  {tag}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 24, color: "#888888" }}>
          <div style={{ display: "flex" }}>bandsustain.com</div>
          <div style={{ display: "flex" }}>우리 밴드, 이름부터</div>
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
