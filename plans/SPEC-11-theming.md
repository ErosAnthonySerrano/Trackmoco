# SPEC-11 — Theming

## Overview
Since Trackmoco should feel distinct from Quentadoz (which uses deep navy/teal), this spec proposes a full palette and type system. Treat the proposal below as a strong default — everything is just CSS variable values, so swapping later is cheap. I'm making an actual call here rather than leaving it open, since that was the ask.

## Direction
Quentadoz reads "budgeting app" — cool navy/teal, calm. Trackmoco is about *installments and shared obligations between people*, so I'd lean toward something warmer and slightly more energetic, while staying elegant rather than playful. Proposal: **deep ink + warm amber**, with a soft neutral base. Amber reads as "attention/progress" (fitting for due dates and payment status) without tipping into alarm-red or generic fintech-blue.

## Proposed palette

### Light mode
| Token | Value | Use |
|---|---|---|
| `--color-bg` | `#FAF9F6` | page background, warm off-white, not stark |
| `--color-surface` | `#FFFFFF` | cards, table, modals |
| `--color-ink` | `#1C1B1F` | primary text, headings |
| `--color-ink-muted` | `#6B6875` | secondary text |
| `--color-primary` | `#1C1B1F` | primary buttons, active tab underline |
| `--color-accent` | `#E8A33D` | due-soon badges, highlights, focus rings |
| `--color-accent-soft` | `#FDF1DD` | accent backgrounds (badges, hover states) |
| `--color-success` | `#3E8E5A` | paid status |
| `--color-danger` | `#C4453A` | overdue status, destructive actions |
| `--color-border` | `#E7E4DD` | dividers, table borders |

### Dark mode (`[data-theme="dark"]`)
| Token | Value |
|---|---|
| `--color-bg` | `#131215` |
| `--color-surface` | `#1C1B1F` |
| `--color-ink` | `#F2F1ED` |
| `--color-ink-muted` | `#9A97A3` |
| `--color-primary` | `#F2F1ED` |
| `--color-accent` | `#F2B25C` |
| `--color-accent-soft` | `#332617` |
| `--color-success` | `#5FB980` |
| `--color-danger` | `#E17167` |
| `--color-border` | `#2C2A30` |

## Typography
- Headings: **"Sora"** — geometric, a bit more character than a default sans, distinct from Quentadoz's Montserrat
- Body: **"Inter"** — high legibility for tables full of dates/amounts
- Both via `next/font/google`, no external CSS import needed

## Token structure in `globals.css`
Same `@theme` block pattern used in Quentadoz, for consistency in your own workflow:

```css
@theme {
  --color-bg: #FAF9F6;
  --color-surface: #FFFFFF;
  --color-ink: #1C1B1F;
  --color-ink-muted: #6B6875;
  --color-primary: #1C1B1F;
  --color-accent: #E8A33D;
  --color-accent-soft: #FDF1DD;
  --color-success: #3E8E5A;
  --color-danger: #C4453A;
  --color-border: #E7E4DD;
  --font-heading: "Sora", sans-serif;
  --font-body: "Inter", sans-serif;
  --radius-md: 10px;
  --radius-lg: 16px;
}

[data-theme="dark"] {
  --color-bg: #131215;
  --color-surface: #1C1B1F;
  --color-ink: #F2F1ED;
  --color-ink-muted: #9A97A3;
  --color-primary: #F2F1ED;
  --color-accent: #F2B25C;
  --color-accent-soft: #332617;
  --color-success: #5FB980;
  --color-danger: #E17167;
  --color-border: #2C2A30;
}
```

## Theme switching
- `data-theme` attribute on `<html>`, toggled client-side, persisted to `localStorage` (this is a plain browser preference, not app data, so `localStorage` is fine here — unlike artifacts, a real Next.js app has no restriction on it)
- Respect `prefers-color-scheme` as the initial default before any manual toggle is set

## Status badge mapping (used throughout SPEC-07/08)
- Unpaid → neutral badge (`--color-ink-muted` text, `--color-border` background)
- Due within 7 days → accent badge (`--color-accent-soft` background, `--color-accent` text/icon)
- Overdue (due date passed, still unpaid) → danger badge
- Paid → success badge

## If you want a second option
An alternative I'd also consider: **deep forest green + warm sand** (`#1F3A2E` / `#D9A76A`) — reads more "trustworthy savings app" and less energetic than amber. Amber is my primary recommendation for Trackmoco specifically, but flagging this in case the energetic tone doesn't feel right once you see it built.
