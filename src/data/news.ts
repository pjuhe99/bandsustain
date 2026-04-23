export type NewsItem = {
  id: string;
  headline: string;
  category: string;
  date: string;
  heroImage: string;
  body: string;
  midImage?: string;
};

export const news: NewsItem[] = [
  {
    id: "01",
    headline: "Announcing the first studio session recordings",
    category: "Studio",
    date: "2026-04-22",
    heroImage: "",
    body: `The band stepped into the studio last week for a two-day session. Early mixes sound full and wide — we'll share a first listen in the coming weeks.

The setup was simple: one microphone on each source, one on the room, everything captured live. No overdubs, no tricks.

A short video will follow later this month, along with a breakdown of the gear and the rooms used.

Stay tuned.`,
    midImage: "",
  },
  {
    id: "02",
    headline: "Spring run — small rooms across the peninsula",
    category: "Tour",
    date: "2026-04-15",
    heroImage: "",
    body: `We are booking a short run of dates through late May and early June. The idea is simple: small rooms, long sets, slow cities.

The full schedule will land on the Live page once the venues confirm, but the first weekend is already locked in.

If your town is not on the list and you think it should be, let us know.`,
  },
  {
    id: "03",
    headline: "Behind the scenes: building the mix",
    category: "News",
    date: "2026-04-03",
    heroImage: "",
    body: `Mixing has been slower than we planned, and we are okay with that.

We decided to keep the room tone from the studio takes rather than cleaning it up. It changes the feel of the record in a way we like.

More notes from the process will follow as the release gets closer.`,
  },
];

export function sortedByDateDesc(list: NewsItem[] = news): NewsItem[] {
  return [...list].sort((a, b) => b.date.localeCompare(a.date));
}

export function formatNewsDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

export function excerpt(body: string, max = 140): string {
  const firstParagraph = body.split(/\n\n/)[0]?.trim() ?? "";
  if (firstParagraph.length <= max) return firstParagraph;
  return firstParagraph.slice(0, max).replace(/\s+\S*$/, "") + "…";
}
