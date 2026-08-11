/* Sends the daily reminder to the stored push subscription.
   Runs from .github/workflows/notify.yml — there is no server.

   Secrets it expects:
     VAPID_PUBLIC_KEY    public half of the pair (also in js/app.js)
     VAPID_PRIVATE_KEY   private half — only ever lives in Actions secrets
     VAPID_SUBJECT       a mailto: or https: URL identifying the sender
     PUSH_SUBSCRIPTION   the JSON the app's Settings sheet hands you
                         (one subscription, or a JSON array of them)
*/
import webpush from 'web-push';

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, PUSH_SUBSCRIPTION } = process.env;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:nobody@example.com';

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !PUSH_SUBSCRIPTION) {
  console.error('Missing VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY or PUSH_SUBSCRIPTION.');
  process.exit(1);
}

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

let subs;
try {
  const parsed = JSON.parse(PUSH_SUBSCRIPTION);
  subs = Array.isArray(parsed) ? parsed : [parsed];
} catch (err) {
  console.error('PUSH_SUBSCRIPTION is not valid JSON:', err.message);
  process.exit(1);
}

const LINES = [
  'Log the day before it resets.',
  'Small thing, done again.',
  'Consistency over intensity.',
  "Today's the one you control.",
  'Close the ring.'
];

const payload = JSON.stringify({
  title: '40',
  body: LINES[new Date().getDate() % LINES.length]
});

let failed = 0;

for (const sub of subs) {
  try {
    await webpush.sendNotification(sub, payload);
    console.log('Sent to', sub.endpoint?.slice(0, 60) + '…');
  } catch (err) {
    failed++;
    // 404/410 mean the subscription is dead — re-subscribe in the app
    // and replace the secret.
    console.error('Failed:', err.statusCode, err.body || err.message);
  }
}

if (failed === subs.length) process.exit(1);
