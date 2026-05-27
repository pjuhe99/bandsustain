// src/lib/mbtiCasting/shareImage.tsx
// 캐스팅 결과 공유 이미지(next/og). og 1200×630 / kakao 정사각형 1200×1200.
// 디코드된 입력으로 엔진을 재계산해 결과 타이틀/포지션을 그린다.

import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import path from "node:path";
import { GENRES, POSITIONS } from "./data";
import { recommendBandCasting, type BandCastingInput } from "./engine";

export type ShareImageVariant = "og" | "kakao";

export const OG_SIZE = { width: 1200, height: 630 };
export const KAKAO_SIZE = { width: 1200, height: 1200 };

export function shareImageSize(variant: ShareImageVariant) {
  return variant === "kakao" ? KAKAO_SIZE : OG_SIZE;
}

export function renderCastingImage(
  input: BandCastingInput | null,
  variant: ShareImageVariant = "og",
): ImageResponse {
  const square = variant === "kakao";
  const size = shareImageSize(variant);

  // 디코드 실패 시에도 500 내지 않도록 중립 카드로 폴백.
  const result = input ? recommendBandCasting(input) : null;
  const title = result?.title ?? "MBTI 밴드 캐스팅";
  const positionLabel = result ? POSITIONS[result.primaryPosition].label : "";
  const eyebrow = input ? `${input.mbti} · ${GENRES[input.genre].label}` : "MBTI 밴드 캐스팅";
  const tags = result ? result.moodTags : [];

  const fontData = readFileSync(path.join(process.cwd(), "public/fonts/Pretendard-Bold.otf"));

  const len = title.length;
  const base = len <= 8 ? 96 : len <= 14 ? 76 : len <= 20 ? 60 : 48;
  const titleSize = square ? Math.round(base * 1.06) : base;
  const align = square ? "center" : "flex-start";

  return new ImageResponse(
    (
      <div
        style={{
          width: size.width,
          height: size.height,
          background: "#ffffff",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          alignItems: "stretch",
          padding: square ? "104px 90px" : "64px 80px",
          fontFamily: "Pretendard",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: square ? "center" : "flex-start",
            fontSize: 24,
            letterSpacing: 6,
            color: "#2563FF",
            textTransform: "uppercase",
          }}
        >
          {eyebrow}
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: align, gap: 24, width: "100%" }}>
          {positionLabel && (
            <div style={{ display: "flex", justifyContent: square ? "center" : "flex-start", fontSize: 32, color: "#555555" }}>
              {positionLabel}
            </div>
          )}
          <div
            style={{
              display: "flex",
              justifyContent: square ? "center" : "flex-start",
              width: "100%",
              fontSize: titleSize,
              fontWeight: 700,
              color: "#0a0a0a",
              lineHeight: 1.08,
              letterSpacing: "-0.02em",
              textAlign: square ? "center" : "left",
            }}
          >
            {title}
          </div>
          {tags.length > 0 && (
            <div style={{ display: "flex", gap: 12, justifyContent: square ? "center" : "flex-start", flexWrap: "wrap" }}>
              {tags.map((tag) => (
                <div key={tag} style={{ display: "flex", fontSize: 24, color: "#555555", border: "1px solid #e5e5e5", padding: "8px 18px" }}>
                  {tag}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 24, color: "#888888" }}>
          <div style={{ display: "flex" }}>bandsustain.com</div>
          <div style={{ display: "flex" }}>MBTI 밴드 캐스팅</div>
        </div>
      </div>
    ),
    {
      width: size.width,
      height: size.height,
      fonts: [{ name: "Pretendard", data: fontData, weight: 700, style: "normal" }],
    },
  );
}
