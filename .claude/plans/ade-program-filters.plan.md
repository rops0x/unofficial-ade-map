# Plan: ADE program filters on the map

**Complexity**: Medium

## Summary
Bring the filters from ADE's own program page (`/en/program/filter/`) to the map, so a visitor can narrow "what's on now" to, say, techno in warehouses with tickets left. The filter list is read from ADE's page on every collect, not hard-coded, so new genres or types appear on the next data refresh.

## What ADE offers (read 2026-10-23)
| ADE group | Options | Where an event's membership comes from |
|---|---|---|
| Days | Wed–Sun | Already covered by the map's day buttons and slider; not repeated |
| Program | Festival, Arts & Culture, Friends | Not in the event listing; collected by asking the API for each option (`category=<id>`) |
| Genre | 10 families (House, Techno, …), ~90 styles | The listing's `categories` text (`"Nighttime events / Techno / Hard Techno"`), matched by name |
| Type | 30 (Club nights, Warehouses, Free Festival Events, …) | Same `categories` text |
| Available tickets only | switch | The listing's `soldOut` flag |

## Decisions
- **Matching**: any chosen option within a group, all groups together (ADE's own behaviour). Choosing a genre family matches all its styles: the build gives an event tagged "Deep House" the "House" tag too.
- **Only useful options**: options with no event on the map are left out of `events.json`.
- **Sold out**: the flag is as of the last collect; the switch says "Hide sold-out events", not a promise of tickets.
- **UI**: a "Filters" pill next to "Picks only" opens a native `<dialog>` (focus trap and Esc for free). Chips are `aria-pressed` pill buttons, as with the day buttons. Genre families are chips; styles sit behind a "Specific styles" disclosure to keep the phone view short.
- **Status**: with filters on, the status counts "matching events".

## Files
| File | Action |
|---|---|
| `scripts/lib/ade.ts` | keep `categories` and `soldOut` from the API |
| `scripts/lib/filters.ts` (+ test) | parse ADE's filter panel HTML; tag events; drop unused options |
| `scripts/collect-ade.ts`, `scripts/lib/store.ts` | save `data/raw/ade-filters.json` (taxonomy + Program membership) |
| `scripts/lib/build.ts`, `scripts/build-events.ts` (+ test) | write `tags`, `isSoldOut` and `filters` into `events.json` |
| `src/filters/schema.ts`, `src/events/schema.ts` (+ test) | validate the filter groups, and that every tag names a known option |
| `src/filters/filters.ts` (+ test) | pure selection logic: toggle, count, match |
| `src/ui/filterPanel.ts` (+ test) | the dialog |
| `src/ui/timeControl.ts`, `src/ui/status.ts` (+ tests) | Filters button; "matching events" wording |
| `src/main.ts`, `src/styles.css`, `DESIGN.md` | wire up and style |
| `e2e/map.spec.ts`, `e2e/fixtures/events.json` | filter flow on a phone viewport |
