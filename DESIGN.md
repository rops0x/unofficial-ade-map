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
| `--text` | `#fff` | — | body text |
| `--text-muted` | `#999` | secondary text | day, address, credit (6.9:1 on `--surface`) |
| `--accent` | `#ffff07` | buttons, highlights | live venues, current time, chosen day, primary buttons |
| `--on-accent` | `#000` | text on yellow buttons | same |
| `--you` | `#43a2f3` | ADE's only blue | your location |
| `--alert` | `#ff8a7a` | not from ADE | error notices |

The app stays dark-only (ADE's site is mostly white): it is used outdoors at night. The OSM tiles are inverted and greyscaled so the yellow venues are the only colour on the map.

## Type

ADE uses **Helvetica Neue LT Std** (licensed, so its files are not copied here) with **Inter** as a secondary face. The stack is `'Helvetica Neue', 'Inter Variable', Helvetica, Arial, sans-serif`: iPhones and Macs render the real Helvetica Neue from the system, everything else gets Inter, which ships with the app (`@fontsource-variable/inter`, OFL).

Headings and the big time readout are bold with ADE's tight tracking (`-0.03em`); body text is regular/medium.

## Shape and motion

- Pill buttons (`border-radius: 100px`) like `.ade-button`: outlined by default, solid yellow with black text when selected or primary.
- Cards/popups use ADE's `15px` radius.
- Press feedback is a small scale with ADE's easing, `cubic-bezier(0.19, 1, 0.22, 1)`; disabled under `prefers-reduced-motion`.

## Not borrowed

No ADE logo, wordmark or imagery: the app is unofficial and says so in the header.
