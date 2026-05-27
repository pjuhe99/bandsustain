// 사운드 취향 테스트 공유 이미지 렌더러 (next/og).
//
//  - "og"    : 1200×630 (1.91:1) — 일반 링크 미리보기 / og:image / twitter
//  - "kakao" : 1200×1200 (1:1)   — 카카오톡 피드는 와이드 이미지를 잘라 보여줘서
//                                   정사각형 변형을 따로 제공한다.
//
// satori 제약상 이모지/Tailwind 클래스는 못 쓰므로 정적 Pretendard OTF + 텍스트만
// 사용한다(밴드 이름 공유 이미지와 동일 방식).

import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { SoundVector } from "./data";
import { createTestResult } from "./engine";

export type ShareImageVariant = "og" | "kakao";

export const OG_SIZE = { width: 1200, height: 630 };
export const KAKAO_SIZE = { width: 1200, height: 1200 };

export function shareImageSize(variant: ShareImageVariant) {
  return variant === "kakao" ? KAKAO_SIZE : OG_SIZE;
}

export function renderShareImage(
  profile: SoundVector | null,
  variant: ShareImageVariant = "og",
): ImageResponse {
  const square = variant === "kakao";
  const size = shareImageSize(variant);

  // 디코드 실패 시에도 500 내지 않도록 중립 카드로 폴백.
  const result = profile ? createTestResult(profile) : null;
  const title = result?.mainGenre.resultTitle ?? "내 귀는 어떤 밴드 사운드에 반응할까?";
  const genreName = result?.mainGenre.name ?? "";
  const tags = result?.tags ?? [];

  const fontData = readFileSync(
    path.join(process.cwd(), "public/fonts/Pretendard-Bold.otf"),
  );

  const len = title.length;
  const base = len <= 10 ? 92 : len <= 16 ? 74 : len <= 22 ? 60 : 50;
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
          사운드 취향 테스트
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: align,
            gap: 28,
            width: "100%",
          }}
        >
          {genreName && (
            <div
              style={{
                display: "flex",
                fontSize: 28,
                color: "#888888",
                justifyContent: square ? "center" : "flex-start",
              }}
            >
              {genreName}
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
            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                justifyContent: square ? "center" : "flex-start",
              }}
            >
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
                  #{tag}
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 24,
            color: "#888888",
          }}
        >
          <div style={{ display: "flex" }}>bandsustain.com</div>
          <div style={{ display: "flex" }}>내 사운드 취향은?</div>
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
