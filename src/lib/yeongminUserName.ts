export type UserNameContext = {
  preferredName: string;
  casualName: string;
};

export function normalizeUserNameInput(input: string): string | null {
  const normalized = input.trim().replace(/\s+/g, " ");
  if (!normalized) return null;
  if (normalized.length > 30) return null;
  return normalized;
}

export function buildUserNameContext(input: string): UserNameContext | null {
  const preferredName = normalizeUserNameInput(input);
  if (!preferredName) return null;

  const compactKorean = preferredName.replace(/\s+/g, "");
  const isSimpleKoreanName = /^[가-힣]{3}$/.test(compactKorean);
  const casualName = isSimpleKoreanName ? compactKorean.slice(1) : preferredName;

  return { preferredName, casualName };
}
