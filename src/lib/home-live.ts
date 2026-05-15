import "server-only";

import type { LiveEvent } from "@/lib/live";

export type HomepageUpcomingEvent = Pick<
  LiveEvent,
  "id" | "eventDate" | "venue" | "city" | "ticketUrl"
>;

export function getHomepageUpcomingEvent(
  events: HomepageUpcomingEvent[],
): HomepageUpcomingEvent | null {
  return events[0] ?? null;
}
