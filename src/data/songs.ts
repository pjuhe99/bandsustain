export type Song = {
  id: string;
  title: string;
  year: string;
  category: "Album" | "EP" | "Single" | "Live Session";
  artwork: string;
  listenUrl: string;
  lyrics: string;
  releasedAt: string;
};

export const songs: Song[] = [
  {
    id: "placeholder-001",
    title: "Placeholder One",
    year: "2026",
    category: "Single",
    artwork: "",
    listenUrl: "https://example.com/listen/1",
    lyrics:
      "첫 번째 verse\n자리잡은 placeholder 가사 한 줄\n자리잡은 placeholder 가사 두 줄\n\nChorus\n후렴 라인이 여기 들어갑니다\n길게 늘어지는 가사 한 줄 더",
    releasedAt: "2026-04-01",
  },
  {
    id: "placeholder-002",
    title: "Placeholder Two",
    year: "2026",
    category: "EP",
    artwork: "",
    listenUrl: "https://example.com/listen/2",
    lyrics:
      "Verse 1\nAnother placeholder song\nWith a few lines here\n\nVerse 2\nAnd a couple more\nPlaceholders all the way",
    releasedAt: "2026-02-10",
  },
  {
    id: "placeholder-003",
    title: "Placeholder Three",
    year: "2025",
    category: "Album",
    artwork: "",
    listenUrl: "https://example.com/listen/3",
    lyrics:
      "Intro\n하나\n둘\n셋\n\nVerse\n네 번째 곡의 플레이스홀더 가사\n나중에 실데이터로 교체됩니다",
    releasedAt: "2025-10-05",
  },
  {
    id: "placeholder-004",
    title: "Placeholder Four",
    year: "2024",
    category: "Live Session",
    artwork: "",
    listenUrl: "https://example.com/listen/4",
    lyrics:
      "Live intro\n첫 번째 라이브 세션 플레이스홀더\n\n곡 본문\n가사 자리\n가사 자리",
    releasedAt: "2024-12-20",
  },
];

export function sortedByReleaseDesc(list: Song[] = songs): Song[] {
  return [...list].sort((a, b) => b.releasedAt.localeCompare(a.releasedAt));
}
