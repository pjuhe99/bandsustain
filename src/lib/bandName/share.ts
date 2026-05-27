// 밴드 이름 공유 — 결과를 URL 경로 토큰으로 인코딩/디코딩.
//
// 결과는 서버에 저장하지 않으므로, 공유 가능한 정보(이름·씬·분위기)를
// base64url 토큰에 담아 경로 세그먼트로 실어 나른다. opengraph-image 는
// searchParams 를 받지 못하고 params 만 받으므로 반드시 경로에 둬야 한다.

import { moodLabels, sceneLabels } from "./data";
import type { Mood, Scene } from "./types";

export type SharePayload = {
  name: string;
  scene: Scene;
  mood: Mood;
};

const MAX_NAME_LENGTH = 40;

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

export function encodeShare(payload: SharePayload): string {
  // 배열로 직렬화해 토큰을 짧게 유지.
  return toBase64Url(JSON.stringify([payload.name, payload.scene, payload.mood]));
}

export function decodeShare(token: string): SharePayload | null {
  try {
    const parsed = JSON.parse(fromBase64Url(token));
    if (!Array.isArray(parsed) || parsed.length !== 3) return null;
    const [name, scene, mood] = parsed;
    if (typeof name !== "string" || name.length === 0 || name.length > MAX_NAME_LENGTH) {
      return null;
    }
    if (typeof scene !== "string" || !Object.hasOwn(sceneLabels, scene)) return null;
    if (typeof mood !== "string" || !Object.hasOwn(moodLabels, mood)) return null;
    return { name, scene: scene as Scene, mood: mood as Mood };
  } catch {
    return null;
  }
}

export function shareTagsFor(payload: SharePayload): string[] {
  return [sceneLabels[payload.scene], moodLabels[payload.mood]];
}
