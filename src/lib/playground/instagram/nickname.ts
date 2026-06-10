export type NicknameResult = { ok: true; value: string } | { ok: false; reason: string };

const BANNED_SUBSTRINGS = [
  "시발", "씨발", "병신", "지랄", "좆", "썅", "개새끼", "새끼", "느금", "니애미", "보지", "자지",
  "fuck", "shit", "bitch", "asshole", "nigger", "sex",
];

const CONTROL_RE = /[\x00-\x1f\x7f]/; // 제어문자(줄바꿈 포함)
const PLAIN_CHAR_RE = /[0-9A-Za-z가-힣ㄱ-ㆎ ]/; // 한글/영문/숫자/공백

export function validateNickname(raw: string): NicknameResult {
  // Strip zero-width/invisible chars before any validation so bypass attempts
  // (e.g. "시​발" with U+200B) are caught and the stored value is clean.
  const value = raw.trim().replace(/[\u200B-\u200D\u2060\uFEFF\u00AD]/g, "");
  if (value.length < 2 || value.length > 20) {
    return { ok: false, reason: "닉네임은 2~20자로 입력해 주세요." };
  }
  if (/[<>]/.test(value) || CONTROL_RE.test(value)) {
    return { ok: false, reason: "사용할 수 없는 문자가 포함되어 있어요." };
  }
  const lower = value.toLowerCase().replace(/\s/g, "");
  if (BANNED_SUBSTRINGS.some((w) => lower.includes(w))) {
    return { ok: false, reason: "부적절한 표현은 사용할 수 없어요." };
  }
  const special = [...value].filter((ch) => !PLAIN_CHAR_RE.test(ch)).length;
  if (special > value.length / 2) {
    return { ok: false, reason: "특수문자를 줄여 주세요." };
  }
  return { ok: true, value };
}
