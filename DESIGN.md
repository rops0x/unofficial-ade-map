# Design

The map follows Amsterdam Dance Event's house style so it feels at home next to the official site, while staying clearly unofficial.

Source: `amsterdam-dance-event.nl` stylesheet (`/build/main-*.css`), read 2026-10-17. Tokens live in [src/styles.css](src/styles.css) `:root`; the map markers read them at runtime in [src/map/map.ts](src/map/map.ts).

## Colour

ADE is black, white and one electric yellow. Nothing else gets colour, so yellow always means "something is on".

| Token | Value | ADE usage | Here |
| --- | --- | --- | --- |
| `--black` | `#000` | main ink and background | page, map background, venue marker edge |
| `--surface` | `#0d0d0d` | dark sections | bottom panel / side column |
| `--surface-raised` | `#1c1c1c` | dark cards | venue popups |
| `--line` | `#333` | — | borders, slider track |
| `--text` | `#fff` | — | body text; the ring on a picked venue and the rule beside a pick in its popup |
| `--text-muted` | `#999` | secondary text | day, address, credit (6.9:1 on `--surface`) |
| `--accent` | `#ffff07` | buttons, highlights | live venues, current time, chosen day, primary buttons |
| `--on-accent` | `#000` | text on yellow buttons | same |
| `--you` | `#43a2f3` | ADE's only blue | your location |
| `--alert` | `#ff8a7a` | not from ADE | error notices |

Picks (events recommended in r/amsterdam_rave's daily previews) stay yellow, because they are still "on". A thick white ring and a slightly bigger dot mark them, so the map gains no new colour.

The app stays dark-only (ADE's site is mostly white): it is used outdoors at night. The OSM tiles are inverted and greyscaled so the yellow venues are the only colour on the map.

## Type

ADE uses **Helvetica Neue LT Std** (licensed, so its files are not copied here) with **Inter** as a secondary face. The stack is `'Helvetica Neue', 'Inter Variable', Helvetica, Arial, sans-serif`: iPhones and Macs render the real Helvetica Neue from the system, everything else gets Inter, which ships with the app (`@fontsource-variable/inter`, OFL).

Headings and the big time readout are bold with ADE's tight tracking (`-0.03em`); body text is regular/medium.

## Shape and motion

- Pill buttons (`border-radius: 100px`) like `.ade-button`: outlined by default, solid yellow with black text when selected or primary.
- Cards/popups use ADE's `15px` radius.
- Press feedback is a small scale with ADE's easing, `cubic-bezier(0.19, 1, 0.22, 1)`; disabled under `prefers-reduced-motion`.

## Filters

ADE's own program filters (Program, Genre, Type, and hiding sold-out events), collected from its program page so the options match the official site. Days are left out: the map's day buttons already cover them.

- A **Filters** pill sits next to "Picks only". While filters are on it turns yellow and counts them ("Filters · 2"). It opens a dialog rather than toggling, so it uses `data-active`, not `aria-pressed`.
- The dialog is a `--surface` card with the `15px` radius over a 70% black backdrop. It is centred with a `--gutter` margin and scrolls inside, so it fits a phone. The header, with an outlined round close button, and the footer stay put.
- Options are pill chips (`.day.chip`, 36px tall since Type alone has 29), yellow when chosen. Genre styles (about 90) fold under "Specific styles" so the phone view stays short.
- "Hide sold-out events" is a pill switch that fills yellow when on, like a chosen chip.
- The footer pairs an outlined "Clear all" with a primary yellow "Show N events" that closes the dialog. N is what matches at the chosen time.
- Esc, the close button or a tap on the backdrop close it, and focus returns to the Filters pill. Matching follows ADE: any chosen option within a group, and every group with a choice. With filters on, the status reads "N matching events on".

## Not borrowed

No ADE logo, wordmark or imagery: the app is unofficial and says so in the header.
