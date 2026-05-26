// 패턴에서 "씬 → 그 씬의 패턴이 사용하는 카테고리" 매핑을 파생한다.
// 단어 자체에는 씬이 없고(언어×카테고리로만 저장), 씬은 패턴의 slots 를 통해
// 카테고리와 연결된다. admin Words 탭의 "장르 필터" 뷰가 이 매핑을 써서,
// 선택한 장르의 패턴이 실제로 쓰는 카테고리만 보여준다.
export function deriveSceneCategories(
  patterns: { scenes: string[]; slots: string[] }[],
): Record<string, string[]> {
  const acc: Record<string, Set<string>> = {};
  for (const p of patterns) {
    for (const scene of p.scenes) {
      const set = (acc[scene] ??= new Set<string>());
      for (const slot of p.slots) set.add(slot);
    }
  }
  return Object.fromEntries(
    Object.entries(acc).map(([scene, set]) => [scene, [...set].sort()]),
  );
}
