import { ImageResponse } from "next/og";
/* eslint-disable @next/next/no-img-element */
import { readFileSync } from "node:fs";
import path from "node:path";
import type { RebirthResult } from "./engine";
import { locationName } from "./scene";

export const OG_SIZE = { width: 1200, height: 630 };

const money = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function welfareLabel(type: string) {
  if (type === "income") return "소득";
  if (type === "consumption") return "소비";
  return "생활수준";
}

function flagUrl(iso2: string) {
  return `https://flagcdn.com/w160/${iso2.toLowerCase()}.png`;
}

async function embeddedFlag(iso2: string) {
  try {
    const response = await fetch(flagUrl(iso2), { next: { revalidate: 60 * 60 * 24 * 30 } });
    if (!response.ok) return null;
    const data = Buffer.from(await response.arrayBuffer()).toString("base64");
    return `data:image/png;base64,${data}`;
  } catch {
    return null;
  }
}

export async function renderRebirthShareImage(result: RebirthResult | null) {
  const fontData = readFileSync(path.join(process.cwd(), "public/fonts/Pretendard-Bold.otf"));
  const flag = result ? await embeddedFlag(result.country.iso2) : null;
  const place = result ? locationName(result) : "도시 외 지역";
  const topPercent = result ? Math.max(1, 101 - result.percentile) : null;
  const country = result?.country.nameKo ?? "어디에서 다시 태어날까?";
  const monthly = result ? `$${money.format(result.monthlyWelfarePpp)}` : "";

  return new ImageResponse(
    (
      <div style={{ width: "1200px", height: "630px", display: "flex", flexDirection: "column", background: "#f5f7fb", color: "#101828", padding: "56px 68px", fontFamily: "Pretendard" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 22, color: "#2563eb", letterSpacing: "0.12em" }}>
          <div style={{ display: "flex" }}>다시 태어난다면</div>
          <div style={{ display: "flex", color: "#667085", letterSpacing: 0 }}>bandsustain.com</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", marginTop: "48px" }}>
          {flag && <img src={flag} alt={`${country} 국기`} width={112} height={84} style={{ borderRadius: "8px", border: "2px solid #d0d5dd", objectFit: "cover", marginRight: "28px" }} />}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 58, lineHeight: 1.08, letterSpacing: "-0.04em" }}>{place}, {country}</div>
            {result && <div style={{ display: "flex", marginTop: "12px", fontSize: 26, color: "#667085" }}>{result.country.name}</div>}
          </div>
        </div>

        {result ? (
          <div style={{ display: "flex", marginTop: "58px", borderTop: "2px solid #d0d5dd", borderBottom: "2px solid #d0d5dd" }}>
            <div style={{ display: "flex", flexDirection: "column", width: "50%", padding: "28px 32px 30px 0", borderRight: "2px solid #d0d5dd" }}>
              <div style={{ display: "flex", fontSize: 23, color: "#667085" }}>가정의 전국 경제 위치</div>
              <div style={{ display: "flex", marginTop: "10px", fontSize: 46, color: "#101828" }}>상위 {topPercent}%</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", width: "50%", padding: "28px 0 30px 36px" }}>
              <div style={{ display: "flex", fontSize: 23, color: "#667085" }}>월 1인당 {welfareLabel(result.welfareType)}</div>
              <div style={{ display: "flex", marginTop: "10px", fontSize: 46, color: "#101828" }}>{monthly}</div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", marginTop: "58px", fontSize: 34, color: "#475467" }}>통계로 만나는 또 다른 출발점</div>
        )}

        <div style={{ display: "flex", marginTop: "auto", fontSize: 22, color: "#667085" }}>국가와 도시, 그리고 가정의 출발점을 확률로 만나보세요.</div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [{ name: "Pretendard", data: fontData, weight: 700, style: "normal" }],
    },
  );
}
