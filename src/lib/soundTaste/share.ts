// 사운드 취향 테스트 공유 — 결과를 URL 경로 토큰으로 인코딩/디코딩.
//
// 결과는 서버에 저장하지 않고, 8축 프로필 벡터(결과의 유일한 입력)를 base64url
// 토큰에 담아 경로 세그먼트로 실어 나른다. 디코드 측에서 createTestResult 로
// 동일한 결과를 재구성하므로 공유받은 사람도 원본과 같은 결과를 본다.
// opengraph-image 는 searchParams 가 아니라 params 만 받으므로 경로에 둬야 한다.

import { DIMENSIONS, type SoundVector } from "./data";

function toBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(input: string): string {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// 차원 순서(DIMENSIONS)에 맞춘 숫자 배열로 직렬화해 토큰을 짧게 유지.
export function encodeShareProfile(profile: SoundVector): string {
  const arr = DIMENSIONS.map((d) => Number(profile[d].toFixed(2)));
  return toBase64Url(JSON.stringify(arr));
}

export function decodeShareProfile(token: string): SoundVector | null {
  try {
    const parsed = JSON.parse(fromBase64Url(token));
    if (!Array.isArray(parsed) || parsed.length !== DIMENSIONS.length) return null;
    const profile = {} as SoundVector;
    for (let i = 0; i < DIMENSIONS.length; i++) {
      const v = parsed[i];
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 5) return null;
      profile[DIMENSIONS[i]] = v;
    }
    return profile;
  } catch {
    return null;
  }
}
