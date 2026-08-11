# 40 — KD Performance Log

A daily discipline tracker counting down to your 40th (5 July 2027), built in the KD design system (Night Studio theme, Electric Blue, Instrument Sans).

**Live:** https://kieranduffy87.github.io/kd-fit-app/

## What's in here
- `index.html` — the whole app
- `manifest.json` — makes it installable to your home screen
- `sw.js` — service worker (offline support + notification display)
- `icons/` — app icons
- `.github/workflows/deploy.yml` — publishes the site to GitHub Pages on every push to `main`

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
