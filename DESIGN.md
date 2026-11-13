# Perp Board UI system

Three layers. Each one is built only from the layer below it.

| Layer | Lives in | Job |
|---|---|---|
| **Tokens** | `app/globals.css`, named in `tailwind.config.js` | Every colour, size, radius and shadow the UI may use |
| **Components** | `components/ui` (base), `components/data` (market values) | The only things that turn tokens into pixels |
| **Screens** | `components/board`, `components/insights`, `app/` | Arrange components. No styling decisions of their own |

Everything here is rendered live at **`/system`** — in both themes, with the real
implementations. Check that page after changing a token or a component.

## Tokens

Change a value in `app/globals.css` (`:root` = light, `.dark` = dark). Never
write a raw value in a component.

### Colour

| Token | Use |
|---|---|
| `surface-0` / `surface-1` / `surface-2` / `surface-pop` | Page ground and app bar / table and panels / sidebar / tooltips and drawer |
| `fill` / `fill-strong` | Control fill and hover wash / pressed, skeleton |
| `fg` / `fg-muted` / `fg-faint` | Primary text / secondary / placeholders, units, ticks |
| `line` / `line-strong` | Rules / control outlines |
| `accent` / `accent-soft` / `on-accent` | **Selected, live, focused** — nothing else |
| `up` / `down` | **Price direction** — nothing else |
| `cold` / `hot` | **RSI extremes** (≤ 25 / ≥ 75) — nothing else |
| `track`, `star` | Meter tracks, the watchlist star |

That is the colour budget: if a value is not selected, a price move or an RSI
extreme, it is neutral. A screen full of mid-range RSI readings has no colour
in it, so the two readings that matter stand out.

`up`, `down`, `cold`, `hot`, `accent` and the surfaces take an alpha modifier
(`bg-up/10`).

### Type

One face — Inter — for text and numbers. Five sizes, three weights.

| Class | Size | Use |
|---|---|---|
| `text-display` | 30 | A panel's headline figure |
| `text-title` | 15 | Stat values, headings |
| `text-body` | 13 | Default |
| `text-small` | 12 | Secondary text |
| `text-caption` | 11 | Caps labels (`.caps`), tags, ticks |

Weights: `font-normal`, `font-medium`, `font-semibold`.

### Size and shape

| Class | Value | Use |
|---|---|---|
| `h-control-sm` / `-md` / `-lg` | 24 / 28 / 32 | Every interactive control |
| `h-row` | 36 | Table rows, tabs |
| `rounded-tag` / `-control` / `-panel` / `-full` | 4 / 6 / 10 | Tags, segments / buttons, fields / panels, drawer / chips, dots |
| `shadow-seg` / `-pop` / `-drawer` | | Selected segment / tooltip / drawer |
| `shadow-edge` / `-edge-accent` | | 1px control outline / selected outline |
| `.rule-b` / `.rule-t` / `.rule-r` | | 1px rules that never change a box's size |

Spacing uses Tailwind's 4px grid (`gap-2`, `px-4`…); prefer 4 / 8 / 12 / 16 / 24.

## Numbers

Numbers are the product. Every number on screen goes through a component in
`components/data/Num.tsx`, which applies four rules:

1. **Tabular figures** (`.num`) — digits line up in columns.
2. **Decimal alignment** — `<Price aligned>` right-aligns the integer part and
   left-aligns the fraction, so a column of prices lines up on the point.
3. **Insignificant characters step back** — decimals, `%`, `$` and `B` / `T`
   are dimmed (`.num-dim`), so the eye lands on the significant digits.
4. **Tiny prices use subscript zeros** — `0.0000043` is written `0.0₅43`.

Formatting logic is in `lib/format.ts` and is unit-tested (`tests/format.test.ts`).

## Components

### Base — `components/ui`

| Component | Use |
|---|---|
| `Button` | Any action. `solid` (the one primary action), `outline` (default), `ghost`, and `bare` — no chrome, for a custom hit area |
| `IconButton` | Icon-only action; `label` is required |
| `Segmented` | Mutually exclusive views (exchange, asset class, time frame) |
| `Chips` | Filters that toggle; single or `multiple` |
| `Tabs` | Pages inside a region |
| `SearchField`, `Kbd` | Search with the ⌘K hint |
| `Tag` | A short state label, toned; `solid` for the rare strongest state |
| `Tip`, `TipBody`, `InfoTip` | The one tooltip (Radix): hover, focus, or click on an ⓘ |
| `Skeleton` | Loading placeholder |
| `TokenAvatar`, `ThemeToggle` | |

### Data — `components/data`

These own the colour rules. A screen picks the readout; it never picks a colour.

| Component | Rule it enforces |
|---|---|
| `Price`, `Money`, `Percent`, `Figure` | The four number rules above |
| `Delta` | Red / green by direction — the only place they appear |
| `RsiReading`, `Meter`, `Gauge` | Neutral in the middle, `cold` ≤ 25, `hot` ≥ 75 |
| `FundingValue` | Neutral until ±10% APR (`FUNDING.HIGHLIGHT_APR`) |
| `TdValue` | A completed 9 is a tinted tag, a 13 a solid one; counts in progress are faint text |
| `Sparkline`, `SparkDelta` | Colour follows the change |
| `Panel`, `List`, `ListRow`, `ListHeading`, `EmptyLine`, `Stat` | The one shell for a sidebar block. An empty list is one quiet line, never a hero |
| `TokenCell`, `FavoriteButton` | |

`lib/` never returns class names. It returns a **`Tone`** (`'neutral' | 'up' |
'down' | 'cold' | 'hot'`) and `components/ui/tone.ts` is the only place a tone
becomes a colour.

## Rules

Enforced by ESLint (`eslint.config.mjs`) and so by CI before every deploy:

- **Only system classes.** Tailwind's own scales are replaced, so `text-sm`,
  `rounded-lg`, `bg-red-500`, `font-bold` generate nothing — and fail lint.
- **No raw colours** (`bg-[#…]`). The exception is brand artwork in
  `components/board/logos.tsx`.
- **Screens use the scale.** Outside `components/ui` and `components/data`, no
  arbitrary sizes (`p-[13px]`, `text-[0.8rem]`) and no raw `<button>`.
- **`lib/` and `hooks/` carry no presentation.**

Adding to the system: a new value goes in `app/globals.css` +
`tailwind.config.js` (and `cn()`'s class groups in `lib/utils.ts` if it is a
font size, radius or shadow); a new pattern becomes a component with an entry
on `/system` and in this file.

## Layout

From `lg` up the app is a fixed frame: app bar, Insights sidebar on the left,
the table on the right. The table shares spare width across its columns and
pins star / rank / token while scrolling sideways. Below `lg` it is one section
at a time (Markets / Insights / Watchlist) with a card list in place of the
table; it uses the same components and gets no separate styling.

Interface details beyond the system (focus, forms, motion, hydration…) follow
`docs/web-interface-guidelines.md`.
