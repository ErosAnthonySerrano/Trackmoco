# SPEC-12 — PWA, Favicon & Manifest

## Overview
Makes Trackmoco installable as an app on mobile/desktop with a proper icon, using the palette from SPEC-11.

## Assets needed
- Source logo mark (square, simple enough to read at 48px — a monogram or simple glyph works better than detailed artwork)
- Generated sizes: 16x16, 32x32, 48x48 (favicon), 180x180 (apple-touch-icon), 192x192, 512x512 (PWA), plus a maskable 512x512 variant with safe-zone padding

## `manifest.json`
```json
{
  "name": "Trackmoco",
  "short_name": "Trackmoco",
  "description": "Track and share installment payments with due-date reminders.",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#FAF9F6",
  "theme_color": "#1C1B1F",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- `background_color`/`theme_color` use the light-mode tokens from SPEC-11; PWA manifests don't support dynamic dark-mode switching, so light mode is the safe default for the OS-level splash/status-bar color
- Referenced in `app/layout.tsx` metadata (`manifest: "/manifest.json"`) — standard Next.js App Router metadata API, no manual `<link>` tag needed

## Favicon
- Next.js App Router convention: drop `icon.png` / `apple-icon.png` into `src/app/` and Next.js handles the `<link>` tags automatically — no need to hand-write favicon markup

## Notes
- This spec is intentionally last in the build order (per SPEC-00 index) — icons are easy to swap in at the end once the palette/logo are finalized, no reason to block earlier work on final artwork
