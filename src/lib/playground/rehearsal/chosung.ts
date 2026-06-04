// 한글 초성 추출 + 초성 쿼리 판별 (순수 함수, 검색용).
const CHO = [
  "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ",
  "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
];
const CHO_SET = new Set(CHO);

// 각 한글 음절(U+AC00–U+D7A3)을 초성 자모로, 그 외 문자는 그대로.
export function toChosung(str: string): string {
  let out = "";
  for (const ch of str) {
    const code = ch.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) {
      out += CHO[Math.floor((code - 0xac00) / 588)];
    } else {
      out += ch;
    }
  }
  return out;
}

// 공백 제거 후 모든 문자가 초성 자모(19종)면 true. 빈 문자열은 false.
export function isChosungQuery(q: string): boolean {
  const s = q.replace(/\s+/g, "");
  if (!s) return false;
  for (const ch of s) if (!CHO_SET.has(ch)) return false;
  return true;
}
