# SPEC-20 — Dashboard Personal Greeting

## Overview
Replace the dashboard's static "Installments" eyebrow and "Your plans" heading with a personalized, time-of-day greeting.

## Greeting content
- Render one heading in the existing dashboard heading position, preserving its current typography and layout.
- Show a matching decorative Lucide icon beside the greeting: Sunrise for morning, Sun for afternoon, and Moon for evening/night. Mark the icon decorative for assistive technology because the greeting text conveys the same context.
- Place the icon in a small rounded accent-soft tile, keep the greeting phrase in the primary text color, and emphasize the name with the accent color. Keep the layout compact and allow the text to wrap on narrow screens.
- Use the browser's local time to select the greeting:
  - 5:00 AM through 11:59 AM: "Good morning"
  - 12:00 PM through 4:59 PM: "Good afternoon"
  - 5:00 PM through 4:59 AM: "Good evening"
- Follow the greeting with up to the first two name parts, e.g. "Good evening, Alex" or "Good evening, Alex Morgan". This preserves two-part given names while excluding the final surname from longer full names.
- Use `profiles.display_name` as the preferred name.
- If the profile name is empty or unavailable, fall back to up to the first two name parts in auth metadata full name, auth metadata name, then email prefix.
- Do not use a generic name such as "there". While the profile name is loading, show only the greeting phrase; if no name is available, keep the greeting phrase without a comma or placeholder.

## Data and timing
- Use the authenticated user's existing session to identify the profile row.
- Load the profile name for the signed-in user; do not expose or query another user's profile.
- Keep the greeting based on client-local time rather than a hard-coded timezone.
- Re-evaluate the greeting periodically while the dashboard is open so it changes when the time-of-day band changes.
- Avoid a server/client hydration mismatch by using a stable initial heading and resolving local time on the client.
- Do not show a placeholder name during profile loading.

## Scope
- Applies to the main dashboard heading on `/`, including when the dashboard is showing its empty state.
- Does not change installment detail titles, the account menu, or summary-card labels.
