import assert from "node:assert/strict";
import Module from "node:module";

type HomepageUpcomingEvent = import("@/lib/home-live").HomepageUpcomingEvent;
type ModuleWithLoad = typeof Module & {
  _load: (
    request: string,
    parent: NodeModule | null,
    isMain: boolean,
  ) => unknown;
};

const moduleWithLoad = Module as ModuleWithLoad;
const originalLoad = moduleWithLoad._load;
moduleWithLoad._load = function patchedLoad(request, parent, isMain) {
  if (request === "server-only") {
    return {};
  }
  return originalLoad.call(this, request, parent, isMain);
};

void (async () => {
  const { getHomepageUpcomingEvent } = await import("@/lib/home-live");

  const fixtures: HomepageUpcomingEvent[] = [
    {
      id: 2,
      eventDate: "2026-08-19",
      venue: "Rolling Hall",
      city: "Seoul",
      ticketUrl: null,
    },
    {
      id: 1,
      eventDate: "2026-06-12",
      venue: "Club FF",
      city: "Seoul",
      ticketUrl: "https://example.com/tickets/club-ff",
    },
  ];

  assert.equal(
    getHomepageUpcomingEvent([]),
    null,
    "empty upcoming lists should not produce a homepage card",
  );

  assert.deepEqual(
    getHomepageUpcomingEvent(fixtures),
    fixtures[0],
    "homepage should show the first already-sorted upcoming event",
  );

  console.log("verify-home-upcoming-live: ok");
})();
