// 밴드 이름 공유 이미지 렌더러 (next/og).
//
// 두 변형을 한 곳에서 그려 톤을 통일한다:
//  - "og"    : 1200×630 (1.91:1) — 일반 링크 미리보기 / og:image / twitter
//  - "kakao" : 1200×1200 (1:1)   — 카카오톡 피드는 와이드 이미지를 잘라 보여줘서
//                                   정사각형 변형을 따로 제공한다.

import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import path from "node:path";
import { shareTagsFor, type SharePayload } from "./share";

export type ShareImageVariant = "og" | "kakao";

export const OG_SIZE = { width: 1200, height: 630 };
export const KAKAO_SIZE = { width: 1200, height: 1200 };

export function shareImageSize(variant: ShareImageVariant) {
  return variant === "kakao" ? KAKAO_SIZE : OG_SIZE;
}

export function renderShareImage(
  payload: SharePayload | null,
  variant: ShareImageVariant = "og",
): ImageResponse {
  const square = variant === "kakao";
  const size = shareImageSize(variant);

  // 디코드 실패 시에도 500 내지 않도록 중립 카드로 폴백.
  const name = payload?.name ?? "밴드 이름 생성기";
  const tags = payload ? shareTagsFor(payload) : [];

  const fontData = readFileSync(path.join(process.cwd(), "public/fonts/Pretendard-Bold.otf"));

  // 이름 길이에 따라 폰트 크기 조절 (긴 한글 이름이 박스를 넘지 않도록).
  const len = name.length;
  const base = len <= 6 ? 128 : len <= 10 ? 100 : len <= 16 ? 78 : 58;
  const nameSize = square ? Math.round(base * 1.06) : base;

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
          밴드 이름 생성기
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
          <div
            style={{
              display: "flex",
              justifyContent: square ? "center" : "flex-start",
              width: "100%",
              fontSize: nameSize,
              fontWeight: 700,
              color: "#0a0a0a",
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              textAlign: square ? "center" : "left",
            }}
          >
            {name}
          </div>
          {tags.length > 0 && (
            <div style={{ display: "flex", gap: 12, justifyContent: square ? "center" : "flex-start" }}>
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
          <div style={{ display: "flex" }}>우리 밴드, 이름부터</div>
        </div>
      </div>
    ),
    {
      width: size.width,
      height: size.height,
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
