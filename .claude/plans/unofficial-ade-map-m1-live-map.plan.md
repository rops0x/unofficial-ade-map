# Plan: Live map of official events

**Source PRD**: `.claude/prds/unofficial-ade-map.prd.md`
**Selected Milestone**: 1 — Live map of official events
**Complexity**: Medium (about 2 days of a ~1-week runway)

## Summary
A static, phone-first web page that shows ADE 2026 events on a map of Amsterdam. It opens on "now", on the first event if ADE hasn't started yet, or on "See you in 2027!" once it's over. Visitors can pick any other moment and can show their own location. A re-runnable script collects every event from the ADE website, checks each one against a schema, and bundles the result into the site as JSON, so Milestone 1 needs no server. The script is run repeatedly during the festival; a scheduled job and redeploy are set up with hosting in Milestone 3.

## Founder decisions (17 Oct 2026)
- **Missing end time**: assume the event ends 8 h after it starts. Store `isEndEstimated: true` and show "end time not listed" in the popup.
- **Proof it's happening**: every event must link to a public event page (`sourceUrl` required). Events without one are skipped.
- **Underground stays hidden**: only publicly listed events with a public venue appear. Events with a secret, "TBA" or "location on the day" venue are skipped and never pinned.
- **Collection**: collect *everything* from the ADE website, repeatedly during the event, not once. Each run replaces the whole data set, so cancelled or moved events disappear or move on the next run.

## Stack decision (new: nothing exists yet)
| Choice | Pick | Why |
|---|---|---|
| Language / build | TypeScript (strict) + Vite, no UI framework | One page with a few controls doesn't need React. A static build can be hosted anywhere (hosting is part of Milestone 3, Launch) |
| Map | Leaflet 1.9.x + OpenStreetMap tiles | Simplest well-tested mobile map. OSM's tile policy is fine at the target traffic (~100 visitors) as long as the page credits OSM |
| Validation | zod | Event data comes from scraped websites, so it's checked at the system boundary |
| Unit tests | Vitest + coverage (v8) | Native to Vite |
| E2E | Playwright (mobile viewport) | `page.clock` fakes "now" and `context.geolocation` fakes the visitor's position |
| Scripts | Plain `.ts` run with Node 25 (built-in type stripping) | No `tsx` or `ts-node` dependency. Scripts must use only type syntax Node can strip |

Milestone 2 (submissions plus approval) will need storage and a small backend. Keeping events in one validated `Event` shape now lets Milestone 2 merge approved pop-ups into the same list without changing the map code.

## Patterns to Mirror
No application code exists yet, so there is nothing in the codebase to copy. This milestone sets the patterns. They follow the project's ECC rules:

| Category | Source | Pattern to establish |
|---|---|---|
| Naming | `.claude/rules/ecc/common/coding-style.md` (Naming Conventions) | Feature folders (`src/events`, `src/time`, `src/map`, `src/ui`). camelCase files and functions, PascalCase types. Booleans named `is…`/`has…` |
| Immutability | `.claude/rules/ecc/common/coding-style.md` (Immutability) | Pure functions over `readonly` arrays. Never mutate the events array |
| Errors | `.claude/rules/ecc/common/coding-style.md` (Error Handling) | Scripts fail fast with the bad record and which field failed. The UI shows a friendly message if data won't load or location is denied. Errors are never silently swallowed |
| Validation | `.claude/rules/ecc/common/coding-style.md` (Input Validation) | All scraped data passes through `EventSchema.parse` before it's written to `events.json` |
| Tests | `.claude/rules/ecc/common/testing.md` | Arrange-Act-Assert. `*.test.ts` files sit next to the source. E2E specs live in `e2e/`. Tests are written first. Coverage target 80% |
| Logging | — | No logging in the browser. Scripts print a one-line summary (counts, skipped records with reasons) |

## Files to Change
| File | Action | Why |
|---|---|---|
| `.claude/rules/ecc/typescript/` | CREATE (copy) | TS rule pack from `~/.claude/plugins/marketplaces/ecc/rules/typescript`, now that the stack is chosen |
| `package.json`, `tsconfig.json`, `vite.config.ts`, `playwright.config.ts`, `.gitignore` | CREATE | Project setup, plus scripts: `dev`, `build`, `typecheck`, `test`, `test:e2e`, `data:build` |
| `index.html`, `src/styles.css` | CREATE | Page shell: title "Unofficial ADE map", "not affiliated with ADE" note, OSM credit, mobile-first layout |
| `src/events/schema.ts` (+ test) | CREATE | `EventSchema` (zod) and `Event` type: `id, name, venue {name, lat, lng, address?}, start, end, sourceUrl, origin: 'ade' \| 'venue'` |
| `src/events/data.ts` (+ test) | CREATE | Imports `src/data/events.json`, checks it at startup, returns `readonly Event[]` |
| `src/time/moments.ts` (+ test) | CREATE | Pure time logic: `festivalRange`, `initialView(now, events)` → `{kind:'live'\|'preview'\|'ended', moment}`, `eventsAt(moment, events)`, `nextStartAfter` |
| `src/time/format.ts` (+ test) | CREATE | Formats dates and times in the `Europe/Amsterdam` time zone with `Intl.DateTimeFormat`. Defines festival days as 06:00 to 06:00 the next morning |
| `src/map/map.ts` | CREATE | Starts Leaflet. One marker per venue, updated when the chosen moment changes |
| `src/map/popup.ts` (+ test) | CREATE | Builds the venue popup (name, venue, times, source link) with DOM APIs and `textContent`, never `innerHTML` |
| `src/map/location.ts` (+ test) | CREATE | "Show my location" button, user dot, handling for denied/unavailable location |
| `src/ui/timeControl.ts` (+ test) | CREATE | Day buttons, a time slider in 30-minute steps, and a "Now" button that only appears while ADE is on |
| `src/ui/status.ts` | CREATE | Messages: "ADE starts …", "Nothing on right now — next at …" with a jump button, "See you in 2027!" |
| `src/main.ts` | CREATE | Connects data, time state, map and controls |
| `scripts/collect/ade.ts` | CREATE | One-time collection from the official ADE listing → `data/raw/ade.json` |
| `scripts/collect/venues.ts` | CREATE | One-time collection from each venue listing in `data/venue-sources.json` → `data/raw/venues.json` |
| `scripts/geocode.ts` | CREATE | Looks up each venue's coordinates once via Nominatim (1 request/s, own User-Agent) → `data/venues.json`. Coordinates are then checked by hand |
| `scripts/build-events.ts` (+ test for merge logic) | CREATE | Merges raw data with venue coordinates, removes duplicates, validates, writes `src/data/events.json` |
| `src/data/events.json` | CREATE (generated, committed) | The data bundled into the site |
| `e2e/map.spec.ts` | CREATE | Main visitor flows on a phone-sized screen |
| `.claude/prds/unofficial-ade-map.prd.md` | UPDATE | Milestone 1 → `in-progress`, link to this plan |

## Tasks

### Task 0: Repo and rules setup
- **Action**: `git init`. Copy the TS rule pack into `.claude/rules/ecc/typescript/`. Scaffold Vite (vanilla-ts template), then add leaflet, zod, vitest, @vitest/coverage-v8, @playwright/test. Commit exact versions in `package-lock.json`.
- **Mirror**: ECC memory note (add the language pack once the stack is chosen; no `install.sh`)
- **Validate**: `npm run typecheck && npm run build`

### Task 1: Check permission to collect (blocking for Task 6, not for Tasks 2–5)
- **Action**: Read the ADE site's terms and `robots.txt`, and each chosen venue's. Record the result in the PRD's Open Questions. If collection isn't allowed, enter the biggest events by hand into `data/raw/ade.json` in the same shape.
- **Validate**: Decision recorded in the PRD

### Task 2: Event schema (TDD)
- **Action**: Write tests first, then `EventSchema`. Rules:
  - `start` and `end` are ISO 8601 times with an offset.
  - `end > start`. A raw event with no end gets `end = start + 8 h` and `isEndEstimated: true`.
  - `sourceUrl` is required and must be an `https:`/`http:` URL pointing to the event's page.
  - A venue name that looks hidden (secret, TBA, "location on the day", etc.) is rejected.
  - lat/lng must fall inside a bounding box around Amsterdam.
  - names are trimmed and can't be empty.
- **Mirror**: Validation at the system boundary (coding-style.md)
- **Validate**: `npx vitest run src/events`

### Task 3: Time logic (TDD) — the core of the milestone
- **Action**: Write tests first. Cover:
  - before the first start → `preview` at the first start
  - during ADE → `live` at now
  - after the last end → `ended`
  - `eventsAt` uses `start <= t < end`, so an event ending at 03:00 isn't shown at 03:00
  - events that cross midnight
  - **the DST change on Sun 25 Oct 2026, when 03:00 CEST becomes 02:00 CET** (the 02:00–03:00 hour happens twice)
  - day buttons place an event at 01:00 on the night before
- **Mirror**: Pure, immutable functions
- **Validate**: `npx vitest run src/time --coverage`

### Task 4: Map, popups, location
- **Action**:
  - Leaflet centred on Amsterdam, zoomed to fit venues that have events on at the chosen moment.
  - Venue markers. A popup lists every event there at that moment, with a link to each source (`target=_blank rel="noopener noreferrer"`).
  - "Show my location" button using `navigator.geolocation.watchPosition`. Shows a dot and an accuracy circle. If location is denied or fails, a brief message appears and the map keeps working.
- **Mirror**: DOM building with `textContent` only (scraped text is untrusted)
- **Validate**: `npx vitest run src/map` (popup HTML, escaping, rejected link types). Checked by hand with `npm run dev` on a phone over the local network.

### Task 5: Time control and status messages
- **Action**:
  - Day buttons for each festival day in the data range.
  - Slider in 30-minute steps within the chosen day.
  - "Now" button.
  - Empty state with a "jump to next" button.
  - "See you in 2027!" screen once ADE is over.
  - The range comes from the data (`festivalRange`), not hard-coded dates. This avoids guessing the exact ADE 2026 dates.
- **Validate**: `npx vitest run src/ui`

### Task 6: One-time data collection
- **Action**:
  - Write the ADE collector and the venue collectors (page structure to be checked first). Requests go slowly (≥1 s apart) and identify the site.
  - Look up venue coordinates once, then check them by hand.
  - `build-events.ts` removes duplicates when venue and start time match and the names are nearly the same. The ADE source is preferred.
  - Records missing an end time get start + 8 h. Records without an event-page link, or with a hidden or unknown venue, are **reported and skipped**.
  - `npm run data:refresh` runs collect, geocode (new venues only, cached) and build in one command. It's safe to run again and again; each run replaces the whole data set.
- **Mirror**: Fail fast, then print a summary of skipped records
- **Validate**: `npm run data:refresh` exits 0 and prints counts (events, venues, estimated ends, skipped by reason). Spot-check 10 events against their sources.

### Task 7: E2E on a phone-sized screen
- **Action**: Playwright with an iPhone-sized device profile. Test fixture data with fixed dates. Scenarios:
  - (a) "now" set before ADE → preview message and first-event markers
  - (b) "now" mid-festival → only events on at that moment
  - (c) moving the slider changes the markers
  - (d) location allowed → user dot shown
  - (e) location denied → message shown, map still works
  - (f) "now" after ADE → "See you in 2027!"
  - (g) popup source link opens in a new tab
  - (h) no horizontal scroll at 375 px
- **Validate**: `npm run test:e2e`

### Task 8: Review
- **Action**: Run the `typescript-reviewer`/`code-reviewer` agents and a `security-reviewer` pass on the popup rendering and scraping code. Fix any CRITICAL or HIGH issues.
- **Validate**: All validation commands below pass

## Validation
```bash
npm run typecheck
npm test -- --coverage          # ≥80% lines on src/
npm run data:build              # schema-validates src/data/events.json
npm run build
npm run test:e2e
```

## Risks
| Risk | Likelihood | Mitigation |
|---|---|---|
| ADE's page structure is hard to collect from (rendered by JavaScript or behind an API) | Medium | Check the page structure first in Task 6. Use the JSON endpoint the page itself calls if there is one. Otherwise enter the top events by hand (PRD fallback) |
| Clocks go back during ADE (Sun 25 Oct, 03:00 → 02:00) | High (certain to happen) | Store all times as ISO with offset. Do all time maths in UTC and only display in Amsterdam time. Test the DST case explicitly (Task 3) |
| Source events have no end time | Medium | Assume 8 h (founder decision). The popup says the end time isn't listed |
| Repeated collection puts load on the ADE site | Medium | No more than every 2–3 h, ≥1 s between requests, identifying User-Agent, conditional requests where supported |
| An underground event leaks onto the map | Low | Only publicly listed events, a required event-page link, and hidden-venue names rejected |
| Wrong venue coordinates (geocoder confuses same-named places) | Medium | Check coordinates by hand in `data/venues.json`. Bounding-box check in the schema |
| Scraped text includes HTML or script | Low | `textContent` only. Only http(s) links allowed. Security review in Task 8 |
| Location blocked on plain http | Low | Location needs https. `localhost` and the eventual host (Milestone 3) are https. Test on a phone through an https tunnel or after deploying a preview |
| Running out of the one-week runway | High | Tasks 2–5 don't wait on Task 6. If collection slips, launch with entries made by hand |

## Open questions this plan resolves or leaves
- **ADE 2026 dates/hours**: resolved in code. The time range is worked out from the collected events. It still needs a check that the collected data covers the whole festival.
- **Which venues to include**: still open. Needed before Task 6. The founder lists them in `data/venue-sources.json`.
- **Time changes and cancellations**: handled for ADE events by re-collecting during the festival. Every event also links to its source.

## Acceptance
- [ ] All tasks complete
- [ ] Validation passes
- [ ] Opening the page shows "now", the first event, or "See you in 2027!" correctly, all checked with a faked clock
- [ ] Each event shows name, venue, start and end time, and a working source link
- [ ] Location is optional: the map works with it allowed or denied
- [ ] "Unofficial" name and the not-affiliated note are visible on a phone
- [ ] Patterns established as listed above (no existing code to copy)
