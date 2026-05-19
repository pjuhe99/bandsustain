import assert from "node:assert/strict";
import test from "node:test";

async function withServerOnlyStub<T>(fn: () => Promise<T>): Promise<T> {
  const moduleNs = await import("node:module");
  const moduleAny = moduleNs.Module as typeof moduleNs.Module & {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  };
  const originalLoad = moduleAny._load;

  moduleAny._load = function patchedLoad(request: string, parent: unknown, isMain: boolean) {
    if (String(request).includes("server-only")) {
      return {};
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return await fn();
  } finally {
    moduleAny._load = originalLoad;
  }
}

type YeongminBotContextModule = typeof import("./yeongminBotContext");
type NewsModule = typeof import("./news");

let yeongminBotContextModulePromise: Promise<YeongminBotContextModule> | null = null;
let newsModulePromise: Promise<NewsModule> | null = null;

async function getYeongminBotContextModule(): Promise<YeongminBotContextModule> {
  yeongminBotContextModulePromise ??= withServerOnlyStub(async () => import("./yeongminBotContext"));
  return yeongminBotContextModulePromise;
}

async function getNewsModule(): Promise<NewsModule> {
  newsModulePromise ??= withServerOnlyStub(async () => import("./news"));
  return newsModulePromise;
}

function makeDateLike(localYear: number, localMonthIndex: number, localDay: number, isoString: string): Date {
  return {
    getFullYear: () => localYear,
    getMonth: () => localMonthIndex,
    getDate: () => localDay,
    toISOString: () => isoString,
  } as Date;
}

function isDbRequest(requestPath: string): boolean {
  return requestPath === "./db" || /[\\/]src[\\/]lib[\\/]db(\.ts)?$/.test(requestPath);
}

test("classifyOfficialContextNeeds detects relevant official keywords conservatively", async () => {
  const { classifyOfficialContextNeeds } = await getYeongminBotContextModule();
  assert.deepEqual(classifyOfficialContextNeeds("When is the next live show?"), {
    live: true,
    members: false,
    songs: false,
    news: false,
  });
  assert.deepEqual(classifyOfficialContextNeeds("Please show me how to update the release notes."), {
    live: false,
    members: false,
    songs: false,
    news: false,
  });
});

test("classifyOfficialContextNeeds detects member, song, and news requests", async () => {
  const { classifyOfficialContextNeeds } = await getYeongminBotContextModule();
  assert.deepEqual(classifyOfficialContextNeeds("Tell me about the members and songs."), {
    live: false,
    members: true,
    songs: true,
    news: false,
  });
  assert.deepEqual(classifyOfficialContextNeeds("Any news today?"), {
    live: false,
    members: false,
    songs: false,
    news: true,
  });
  assert.deepEqual(classifyOfficialContextNeeds("Any press release on the band?"), {
    live: false,
    members: false,
    songs: false,
    news: true,
  });
});

test("classifyOfficialContextNeeds ignores unrelated chat", async () => {
  const { classifyOfficialContextNeeds } = await getYeongminBotContextModule();
  assert.deepEqual(classifyOfficialContextNeeds("How are you doing today?"), {
    live: false,
    members: false,
    songs: false,
    news: false,
  });
});

test("classifyOfficialContextNeeds ignores broad generic words", async () => {
  const { classifyOfficialContextNeeds } = await getYeongminBotContextModule();
  assert.deepEqual(classifyOfficialContextNeeds("Tell me a story."), {
    live: false,
    members: false,
    songs: false,
    news: false,
  });
  assert.deepEqual(classifyOfficialContextNeeds("What music should I listen to?"), {
    live: false,
    members: false,
    songs: false,
    news: false,
  });
  assert.deepEqual(classifyOfficialContextNeeds("Do I need a ticket for the museum?"), {
    live: false,
    members: false,
    songs: false,
    news: false,
  });
  assert.deepEqual(classifyOfficialContextNeeds("Any press coverage or headline yet?"), {
    live: false,
    members: false,
    songs: false,
    news: false,
  });
});

test("buildYeongminOfficialContext loads member context when a member name is mentioned directly", async () => {
  const { buildYeongminOfficialContext } = await getYeongminBotContextModule();
  const calls: string[] = [];

  const context = await buildYeongminOfficialContext("김상준이 누구야?", {
    getUpcomingEvents: async () => {
      calls.push("live");
      return [];
    },
    getPublishedMembers: async () => {
      calls.push("members");
      return [
        {
          id: 1,
          nameKr: "김상준",
          nameEn: "Sangjun Kim",
          position: "Bass",
          photoUrl: "https://example.com/member.jpg",
          favoriteArtist: "Blur",
          favoriteSong: "Coffee & TV",
          displayOrder: 1,
          published: true,
        },
      ];
    },
    getPublishedSongs: async () => {
      calls.push("songs");
      return [];
    },
    getPublishedNews: async () => {
      calls.push("news");
      return [];
    },
  });

  assert.equal(calls.join(","), "members");
  assert.match(context ?? "", /### Members/);
  assert.match(context ?? "", /김상준/);
  assert.doesNotMatch(context ?? "", /### Songs/);
});

test("formatNewsDate preserves local calendar date components", async () => {
  const { formatNewsDate } = await getNewsModule();
  const date = makeDateLike(2026, 4, 2, "2026-05-01T15:00:00.000Z");

  assert.equal(formatNewsDate(date), "2026-05-02");
});

test("formatOfficialContext returns null when there is no relevant data", async () => {
  const { formatOfficialContext } = await getYeongminBotContextModule();
  assert.equal(
    formatOfficialContext({
      live: [],
      members: [],
      songs: [],
      news: [],
    }),
    null,
  );
});

test("buildYeongminRuntimeContext includes the local current date and song release guidance", async () => {
  const { buildYeongminRuntimeContext } = await getYeongminBotContextModule();
  const runtimeContext = buildYeongminRuntimeContext(
    makeDateLike(2026, 4, 19, "2026-05-18T15:00:00.000Z"),
  );

  assert.match(runtimeContext, /Today is 2026-05-19 in Asia\/Seoul\./);
  assert.match(runtimeContext, /published songs listed in official context are already released/i);
});

test("buildYeongminOfficialContext formats only relevant official data", async () => {
  const { buildYeongminOfficialContext } = await getYeongminBotContextModule();
  const calls: string[] = [];
  const context = await buildYeongminOfficialContext(
    "Please share the latest live, member, song, and news info.",
    {
      getUpcomingEvents: async () => {
        calls.push("live");
        return [
          {
            id: 1,
            eventDate: "2026-06-01",
            venue: "Main Hall",
            city: "Seoul",
            ticketUrl: "https://example.com/tickets",
            videoUrl: null,
            published: true,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-02T00:00:00.000Z"),
          },
        ];
      },
      getPublishedMembers: async () => {
        calls.push("members");
        return [
          {
            id: 1,
            nameKr: "Kim Band",
            nameEn: "Kim Band",
            position: "Vocals",
            photoUrl: "https://example.com/member.jpg",
            favoriteArtist: "Nirvana",
            favoriteSong: "Lithium",
            displayOrder: 1,
            published: true,
          },
        ];
      },
      getPublishedSongs: async () => {
        calls.push("songs");
        return [
          {
            id: 1,
            title: "First Light",
            category: "Single",
            artworkUrl: "https://example.com/artwork.jpg",
            lyrics: null,
            releasedAt: makeDateLike(2026, 4, 2, "2026-05-01T15:00:00.000Z"),
            listenUrl: "https://example.com/listen",
            published: true,
          },
        ];
      },
      getPublishedNews: async () => {
        calls.push("news");
        return [
          {
            id: 1,
            headline: "Band Opens Secret Portal",
            category: "Editorial",
            date: makeDateLike(2026, 4, 3, "2026-05-02T15:00:00.000Z"),
            heroImage: "https://example.com/news.jpg",
            body: [
              "A very long playful article body that should be summarized rather than copied in full.",
              "It keeps going with extra editorial flourishes, backstage rumors, and dramatic flourishes.",
              "The raw article text should not appear verbatim in the prompt.",
            ].join(" "),
            midImage: null,
            published: true,
          },
        ];
      },
    },
  );

  assert.equal(context !== null, true);
  assert.deepEqual([...calls].sort(), ["live", "members", "news", "songs"]);
  assert.match(context ?? "", /^## Official Bandsustain Context/m);
  assert.match(context ?? "", /playful, fictional, or exaggerated editorial writing/i);
  assert.match(context ?? "", /published songs listed here are already released/i);
  assert.match(context ?? "", /Band Opens Secret Portal/);
  assert.doesNotMatch(context ?? "", /The raw article text should not appear verbatim in the prompt\./);
  assert.match(context ?? "", /First Light/);
  assert.match(context ?? "", /2026-05-02/);
  assert.match(context ?? "", /2026-05-03/);
  assert.doesNotMatch(context ?? "", /2026-05-01/);
  assert.doesNotMatch(context ?? "", /2026-05-02T15:00:00.000Z/);
  assert.match(context ?? "", /Kim Band/);
  assert.match(context ?? "", /Main Hall/);
});

test.skip("buildYeongminOfficialContext uses the real live and news loaders when no deps are injected", async () => {
  const { buildYeongminOfficialContext } = await getYeongminBotContextModule();
  await withServerOnlyStub(async () => {
    const moduleNs = await import("node:module");
    const moduleAny = moduleNs.Module as typeof moduleNs.Module & {
      _load: (request: string, parent: unknown, isMain: boolean) => unknown;
    };
    const originalLoad = moduleAny._load;

    moduleAny._load = function patchedLoad(request: string, parent: unknown, isMain: boolean) {
      const requestPath = String(request);
      if (requestPath.includes("server-only")) {
        return {};
      }
      if (isDbRequest(requestPath)) {
        return {
          getPool: () => ({
            query: async (sql: string) => {
              if (sql.includes("FROM live_events")) {
                return [
                  [
                    {
                      id: 7,
                      event_date: "2026-06-01",
                      venue: "Moon Hall",
                      city: "Seoul",
                      ticket_url: null,
                      video_url: null,
                      published: 1,
                      created_at: new Date("2026-01-01T00:00:00.000Z"),
                      updated_at: new Date("2026-01-02T00:00:00.000Z"),
                    },
                  ],
                  undefined,
                ] as const;
              }
              if (sql.includes("FROM news")) {
                return [
                  [
                    {
                      id: 9,
                      headline: "Real Loader Headline",
                      category: "Editorial",
                      date: new Date("2026-05-02T00:00:00.000Z"),
                      hero_image: "https://example.com/news-real.jpg",
                      body: [
                        "This body is intentionally long so the real news excerpt helper has to shorten it.",
                        "It keeps going with extra detail and should not appear in full.",
                        "The excerpt should end with an ellipsis.",
                      ].join(" "),
                      mid_image: null,
                      published: 1,
                    },
                  ],
                  undefined,
                ] as const;
              }
              return [[], undefined] as const;
            },
          }),
        };
      }
      return originalLoad.call(this, request, parent, isMain);
    };

    try {
      const context = await buildYeongminOfficialContext("live and news");

      assert.match(context ?? "", /JUN 01 · 2026/);
      assert.match(context ?? "", /Moon Hall/);
      assert.match(context ?? "", /Real Loader Headline/);
      assert.match(context ?? "", /2026-05-02/);
      assert.match(context ?? "", /\.\.\./);
      assert.doesNotMatch(context ?? "", /The excerpt should end with an ellipsis\./);
    } finally {
      moduleAny._load = originalLoad;
    }
  });
});
