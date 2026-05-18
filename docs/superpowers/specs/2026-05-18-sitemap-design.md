# Bandsustain Sitemap Design

Date: 2026-05-18

## Goal

Make `https://bandsustain.com/sitemap.xml` suitable for Google Search Console submission by keeping only publicly indexable pages, while improving sitemap freshness metadata so each section reflects realistic update cadence.

## Scope

Include these public routes:

- `/`
- `/songs`
- `/news`
- `/news/[id]` for published news only
- `/live`
- `/members`
- `/quote`
- `/playground`
- `/playground/kim-youngmin-bot`

Exclude these routes:

- `/admin` and all admin descendants
- `/api` routes
- upload/file-serving routes
- unpublished content

## Approach

Update the existing `src/app/sitemap.ts` instead of splitting into multiple sitemap files.

The sitemap will combine:

1. Static public routes with explicit `changeFrequency` and `priority`
2. Dynamic published news detail URLs from the database
3. Section-level `lastModified` values derived from the freshest relevant content when possible

## Freshness Rules

- `/` uses the newest known public content timestamp among news, songs, and live events when available
- `/songs` uses the newest published song release date
- `/news` uses the newest published news date
- `/live` uses the newest published live event `updatedAt` when available, otherwise current time
- `/members`, `/quote`, `/playground`, and `/playground/kim-youngmin-bot` use current time unless a better source already exists in code
- `/news/[id]` uses each article's published date

## Data Sources

- `getPublishedNews()` from `src/lib/news.ts`
- `getPublishedSongs()` from `src/lib/songs.ts`
- `listAllLiveEvents()` from `src/lib/live.ts`, filtered to `published === true`

## Implementation Notes

- Keep using Next 16 `app/sitemap.ts` metadata route conventions
- Preserve `src/app/robots.ts` since it already points to `/sitemap.xml`
- Avoid adding admin or experimental private routes by building the public route list explicitly
- Keep the implementation small and local to the sitemap layer unless a tiny helper improves clarity

## Error Handling

- If a content section is empty, fall back to `new Date()` for that section's `lastModified`
- If live event data contains both upcoming and past events, use the most recently updated published event for freshness

## Testing

- Run lint against the modified files
- Build locally if needed to confirm the metadata route compiles
- Inspect generated `/sitemap.xml` output shape via Next.js runtime behavior if a local run is available

## Expected Search Console Submission

Submit:

- `https://bandsustain.com/sitemap.xml`

Do not submit individual page URLs as sitemap entries in Search Console.
