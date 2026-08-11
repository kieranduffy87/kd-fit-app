# 40 — KD Performance Log

A daily discipline tracker counting down to your 40th (7 May 2027), built in the KD design system (Night Studio theme, Electric Blue, Instrument Sans).

**Live:** https://kieranduffy87.github.io/kd-fit-app/

## What's in here
- `index.html` — the whole app
- `manifest.json` — makes it installable to your home screen
- `sw.js` — service worker (offline support + notification display)
- `icons/` — app icons, generated from the KD chevron
- `fonts/` — Instrument Sans, self-hosted from `kd-design-system`
- `.github/workflows/deploy.yml` — publishes the site to GitHub Pages on every push to `main`

## Design

Built on `kd-design-system` — one mark, one blue, one typeface. Tokens mirror
`css/tokens.css` (Night Studio dark theme); motion uses the house curve
`cubic-bezier(0.22, 0.7, 0.2, 1)` and the rise-and-unblur primitive, so it
settles rather than bounces.

- **The dial is the screen.** The number is days to 40; the ring around it is
  today, closing as you log. Finish the day and the ring shuts, the glow lifts
  and the caption turns blue.
- **Blue stays scarce** — the accent word, the ring, the checks. Active
  training chips are a tint and a border rather than a fill, because four
  solid pills at once would swamp the screen.
- **Art is generative**, not photographic: a deep-blue bloom on Scrim Ink under
  a film-grain overlay, drawn in CSS and SVG. Sharp at any size, a couple of KB,
  works offline.
- **The view is patched, not rebuilt.** Toggling an item updates only what
  changed instead of re-rendering, which is what lets the ring, meters and
  check marks animate at all.
- Instrument Sans is self-hosted, so the app is on brand on first paint and
  offline. Haptics fire on toggle, and safe-area insets keep it clear of the
  notch and home indicator when installed.

## Deploying

Nothing to build. Push to `main` and the workflow publishes the repo root to Pages.

The workflow runs `actions/configure-pages` with `enablement: true`, so the first successful run turns Pages on by itself. If that step fails with a permissions error, switch it on manually once — **Settings → Pages → Source: GitHub Actions** — then re-run the workflow from the Actions tab.

## Install it on your iPhone
1. Open the live URL in **Safari** (must be Safari — iOS only allows install from there)
2. Tap the Share icon → **Add to Home Screen**
3. It now opens full-screen with your icon, no browser chrome — behaves like an app

## About notifications — the honest version
iOS supports push notifications for home-screen web apps (16.4+), but there are two tiers:

- **Local notifications** (already wired up): tap "Enable notifications" in the app, and it can show notifications while the app is open or freshly backgrounded. Good for testing, not reliable for scheduled daily reminders.
- **Real scheduled push** (e.g. "remind me every day at 8am" even if the app's closed): this needs a small backend that holds your push subscription and sends messages on a schedule. Not built yet — it needs a decision on where it lives (a tiny Node service on Render/Railway, or a scheduled serverless function). Roughly 30–45 minutes of work, not a rebuild.

## Data
Everything's stored locally on your phone (`localStorage`) — nothing leaves your device, no account needed. This also means: if you clear Safari's site data, your history clears with it. Fine for now; worth knowing.

## Next steps worth considering
- Real push notifications on a schedule (see above)
- Weekly/monthly view beyond the 28-day ledger
- Editing the birthday/checklist items without touching code
