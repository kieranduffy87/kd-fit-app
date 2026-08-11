# 40 — KD Performance Log

A daily discipline tracker counting down to your 40th (7 May 2027), built in the KD design system (Night Studio theme, Electric Blue, Instrument Sans).

**Live:** https://kieranduffy87.github.io/kd-fit-app/

## What's in here
- `index.html` — shell, with the splash screen inlined so it paints on the first frame
- `css/app.css` — the interface
- `js/app.js` — state, storage, settings, push subscription
- `manifest.json` — makes it installable to your home screen
- `sw.js` — service worker (offline support + notification display)
- `icons/` — app icons, generated from the KD chevron
- `fonts/` — Instrument Sans, self-hosted from `kd-design-system`
- `scripts/send-push.mjs` + `.github/workflows/notify.yml` — the daily reminder
- `.github/workflows/deploy.yml` — publishes to GitHub Pages on every push to `main`

## How it scores you

**Daily habits** drive everything — the ring, the streak, the ledger. A day counts
as logged at 70% of them. Four sections ship by default: Body, Mind, Soul and
Inflammation.

Each day records the habit count it was scored against, so adding habits later
raises the bar from that point on rather than retroactively failing days you
already earned. Days logged before that was tracked are stamped with their
original count on upgrade.

The Inflammation habits are ordinary daily levers — diet pattern, alcohol, and
the overnight fast. They are not medical advice, and inflammation you're actually
worried about is a conversation for a doctor, not a checklist.

**Training is a weekly target, not a daily box.** Two lifts, one football, three
mobility — done across the week, whenever. A rest day is not a failure and can't
break a streak. Earlier versions treated the four training items as daily, which
meant a perfect habit day with no session scored 7/11 and broke the run; that was
wrong and is fixed.

Everything is editable in Settings — habits, training targets, and the date it all
counts down to.

## Design

Built on `kd-design-system` — one mark, one blue, one typeface. Tokens mirror
`css/tokens.css`; motion uses the house curve `cubic-bezier(0.22, 0.7, 0.2, 1)`
and the rise-and-unblur primitive, so it settles rather than bounces.

- **The dial is the screen.** The number is days to 40; the ring around it is
  today, closing as you log. Finish the day and the ring shuts, the glow lifts
  and the caption turns blue.
- **Blue stays scarce** — the accent word, the ring, the checks.
- **Art is generative**, not photographic: a deep-blue bloom on Scrim Ink under a
  film-grain overlay, drawn in CSS and SVG. Sharp at any size, a couple of KB,
  works offline.
- **The view is patched, not rebuilt.** Toggling an item updates only what
  changed, which is what lets the ring, meters and check marks animate at all.
- Instrument Sans is self-hosted, so the app is on brand on first paint and
  offline. Haptics fire on toggle, and safe-area insets keep it clear of the
  notch and home indicator when installed.

## Your data

Everything is stored on the device in `localStorage` — nothing leaves your phone,
no account, no server. That also means **clearing Safari's site data wipes your
history**, so take a backup now and then: Settings → Your data → Export backup
writes a plain JSON file you can re-import on any device.

## Daily reminders

A scheduled GitHub Action sends the nudge, so there is no server to run or pay
for. One-time setup:

1. **Generate a key pair** on your machine:
   ```
   npx web-push generate-vapid-keys
   ```
2. **Public key** → paste into `VAPID_PUBLIC_KEY` at the top of `js/app.js`, then
   commit. Public keys are safe to commit.
3. **Repo secrets** (Settings → Secrets and variables → Actions → Secrets):
   - `VAPID_PUBLIC_KEY` — the same public key
   - `VAPID_PRIVATE_KEY` — the private half. This one never goes in the repo.
   - `VAPID_SUBJECT` — `mailto:you@example.com`
4. **Subscribe on your phone.** Open the installed app → Settings → Daily
   reminder → Enable. Copy the subscription it gives you into a fourth secret,
   `PUSH_SUBSCRIPTION`.
5. **Switch it on**: add a repository *variable* (same page, Variables tab)
   `REMINDERS_ENABLED` = `true`. Until then the workflow skips instead of failing
   every morning.

Fires at 07:30 UTC — an hour later in Irish summer time. Edit the cron in
`.github/workflows/notify.yml` to move it, and use **Run workflow** on the
Actions tab to test without waiting for tomorrow.

Two things worth knowing: push on iPhone only works for a home-screen app, not a
Safari tab. And GitHub's scheduler is best-effort — it can run several minutes
late, which is fine for a nudge and no good as an alarm.

## Deploying

Nothing to build. Push to `main` and the workflow publishes the repo root to
Pages.

## Install it on your iPhone
1. Open the live URL in **Safari** (must be Safari — iOS only allows install from there)
2. Tap the Share icon → **Add to Home Screen**
3. It opens full-screen with your icon, no browser chrome

## Next steps worth considering
- A weight or resting-HR trend, so the app tracks an outcome and not just adherence
- Tapping a day in the ledger to read back that day's note
