/* ============================================================
   Jotara — a daily habit log

   Storage keys
     kd-fit:config            editable config (habits, training, birthday)
     kd-fit:YYYY-MM-DD        a day's ticks, { itemId: true }
     kd-fit:note:YYYY-MM-DD   a day's one-line note
     kd-fit:view              ledger view preference
     kd-fit:push              last push subscription, for the settings sheet
     kd-fit:migrated          schema marker

   Day records keep their original key format, so history logged by
   earlier versions carries over untouched.
   ============================================================ */

/* ------------------------------------------------------------
   Push setup. Paste the PUBLIC half of your VAPID key pair here
   — public keys are safe to commit. Generate a pair with:
       npx web-push generate-vapid-keys
   The private half goes in the repo's Actions secrets, never here.
   See README → "Daily reminders".
   ------------------------------------------------------------ */
const VAPID_PUBLIC_KEY = 'BBLYVuuQkywQrxEiB1nQnS7hI3cFVRXuT2Y6CSQaePPydevHNR0FvuKG1ojoRC335cNKOD4sVwK03WBzGsDO3Ic';

/* Daily levers with reasonable evidence behind them for inflammatory
   load — diet pattern, alcohol, and the overnight fast. Deliberately
   behavioural and daily-checkable; nothing here is medical advice, and
   persistent inflammation is a conversation for a doctor. Edit or
   remove any of them in Settings. */
const INFLAMMATION_ITEMS = [
  { id: 'omega3', label: 'Oily fish, olive oil or nuts' },
  { id: 'colour', label: 'Two portions of colour — berries or greens' },
  { id: 'unprocessed', label: 'Nothing ultra-processed' },
  { id: 'noalcohol', label: 'Alcohol-free day' },
  { id: 'overnightfast', label: '12 hours between dinner and breakfast' }
];

/* Ten general levers, chosen to not repeat what the other sections
   already ask for: this is duration where Soul tracks regularity,
   volume where Body tracks a single glass, and it picks up the things
   nothing else covers — light, sitting, caffeine timing, teeth, and
   actually talking to someone. */
const HEALTH_ITEMS = [
  { id: 'sleep7', label: "Seven hours' sleep" },
  { id: 'steps', label: '8,000 steps' },
  { id: 'daylight', label: 'Daylight within an hour of waking' },
  { id: 'water2l', label: 'Two litres of water' },
  { id: 'fibre', label: '30g of fibre' },
  { id: 'caffeine', label: 'Caffeine done by 2pm' },
  { id: 'standup', label: 'Up and moving every hour' },
  { id: 'lastmeal', label: 'Nothing to eat 3 hours before bed' },
  { id: 'teeth', label: 'Floss, and brush twice' },
  { id: 'talk', label: 'Ten minutes of real conversation' }
];

/* The full set the app shipped with. Kept intact because migrate()
   still installs these for anyone upgrading, and onboarding offers
   them as packs — but they are no longer what a new user starts with.
   Twenty-two boxes on day one is a wall, not a system. */
const LEGACY_DEFAULT_DAILY = [
  { id: 'body', title: 'Body', items: [
    { id: 'walk', label: 'Morning walk — 10+ min outside' },
    { id: 'protein', label: 'Protein at first meal' },
    { id: 'water', label: 'Water before coffee' }
  ]},
  { id: 'mind', title: 'Mind', items: [
    { id: 'task', label: 'One task done before phone' },
    { id: 'noinput', label: '5 min no-input' }
  ]},
  { id: 'soul', title: 'Soul', items: [
    { id: 'sleep', label: 'Fixed sleep / wake time' },
    { id: 'lookforward', label: 'One thing to look forward to' }
  ]},
  { id: 'inflammation', title: 'Inflammation', items: INFLAMMATION_ITEMS },
  { id: 'health', title: 'General health', items: HEALTH_ITEMS }
];

/* What onboarding offers. Deliberately short lists — the point is to
   leave with three or four things you will actually do, not to browse
   a catalogue. Everything here is editable afterwards. */
const HABIT_LIBRARY = [
  { id: 'lib-move', title: 'Move', items: [
    { id: 'walk', label: 'Walk — 10+ minutes outside' },
    { id: 'move30', label: 'Move for 30 minutes' },
    { id: 'stretch', label: 'Stretch or mobility' },
    { id: 'steps', label: '8,000 steps' }
  ]},
  { id: 'lib-eat', title: 'Eat', items: [
    { id: 'water', label: 'Two litres of water' },
    { id: 'protein', label: 'Protein at first meal' },
    { id: 'colour', label: 'Two portions of veg or fruit' },
    { id: 'noalcohol', label: 'Alcohol-free day' }
  ]},
  { id: 'lib-rest', title: 'Rest', items: [
    { id: 'sleep', label: 'Fixed sleep / wake time' },
    { id: 'sleep7', label: "Seven hours' sleep" },
    { id: 'nophone', label: 'No phone for the first hour' },
    { id: 'daylight', label: 'Daylight within an hour of waking' }
  ]},
  { id: 'lib-mind', title: 'Mind', items: [
    { id: 'noinput', label: 'Five quiet minutes' },
    { id: 'task', label: 'One real task before the phone' },
    { id: 'read', label: 'Read ten pages' },
    { id: 'journal', label: 'Write one line about the day' }
  ]},
  { id: 'lib-people', title: 'People', items: [
    { id: 'talk', label: 'Ten minutes of real conversation' },
    { id: 'reachout', label: 'Message someone you care about' },
    { id: 'gratitude', label: 'Name one good thing' }
  ]}
];

/* Starter suggestions by focus — three each, which is the number
   people actually sustain in week one. */
const STARTER_PACKS = {
  movement: { label: 'Move more',       picks: ['walk', 'stretch', 'water'] },
  calm:     { label: 'Feel calmer',     picks: ['noinput', 'nophone', 'sleep'] },
  health:   { label: 'Get healthier',   picks: ['walk', 'water', 'sleep7'] },
  focus:    { label: 'Focus better',    picks: ['task', 'nophone', 'read'] }
};

const THEMES = ['system', 'dark', 'light'];
/* `blue` is kept as the id of the default so stored configs still
   resolve — it is coral now, which is what the swatch shows. */
const ACCENTS = [
  { id: 'blue',   label: 'Coral',  hex: '#f4785c' },
  { id: 'rose',   label: 'Rose',   hex: '#e8698c' },
  { id: 'violet', label: 'Violet', hex: '#a274d4' },
  { id: 'amber',  label: 'Amber',  hex: '#e8a34e' },
  { id: 'green',  label: 'Green',  hex: '#5fae8d' },
  { id: 'teal',   label: 'Teal',   hex: '#5aa5b8' }
];

const DEFAULT_CONFIG = {
  // An optional thing you are counting toward. No date means the dial
  // shows today instead of a countdown — most people are not training
  // for a birthday.
  goal: { label: '', date: '' },
  daily: [
    { id: 'daily', title: 'Every day', items: [
      { id: 'walk', label: 'Walk — 10+ minutes outside' },
      { id: 'water', label: 'Two litres of water' },
      { id: 'sleep', label: 'Fixed sleep / wake time' }
    ]}
  ],
  // Weekly targets, not daily boxes — a rest day is not a failure.
  training: [],
  // The same idea over a calendar month, for the things that are too
  // occasional to be weekly: a long walk, a proper day off, a haircut.
  monthly: [],
  theme: 'system',
  accent: 'blue'
};

const HISTORY_DAYS = 28;
const YEAR_WEEKS = 53;
const GOOD_DAY = 0.7;

/* The Jotara mark (icons/jot.svg), inlined so it can take its colour
   from whatever it sits in — the supplied file hardcodes #231f20,
   which would vanish against the dark theme. */
const KD_MARK = `<svg viewBox="0 0 68.02 102.03" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" fill="currentColor"><path d="M34,34.01C34,52.79,18.79,68.02,0,68.02v34.01c37.56,0,68.01-30.46,68.01-68.02h-34.01Z"/><rect width="34.01" height="34.01"/></svg>`;
const ICON_COG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;

const NOTIF_SUPPORTED = typeof Notification !== 'undefined';
const PUSH_SUPPORTED = NOTIF_SUPPORTED && 'PushManager' in window;
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- storage primitives ---------- */
function read(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  }catch(e){ return fallback; }
}
function write(key, value){
  try{
    const raw = JSON.stringify(value);
    localStorage.setItem(key, raw);
    mirror(key, raw);
    return true;
  }
  catch(e){ return false; } // private mode / quota — the session still works
}

/* Every write is echoed to the native vault, fire-and-forget. It is a
   mirror of localStorage rather than a replacement: the app reads
   synchronously everywhere, and rewriting that for an async store
   would touch every function in this file for no gain. */
function mirror(key, raw){
  const n = window.KDNative;
  if(!n || !n.vaultAvailable || !n.vaultAvailable()) return;
  if(raw === null) n.vaultRemove(key);
  else n.vaultSet(key, raw);
}
function unmirror(key){
  const n = window.KDNative;
  if(n && n.vaultAvailable && n.vaultAvailable()) n.vaultRemove(key);
}

/* ---------- config ---------- */
let config = loadConfig();

function loadConfig(){
  const stored = read('kd-fit:config', null);
  if(!stored) return structuredClone(DEFAULT_CONFIG);
  // Merge shallowly so a config saved by an older build still boots.
  // `birthday` was the only goal there used to be; fold it into the
  // general shape rather than leaving two sources of truth.
  const goal = stored.goal && typeof stored.goal === 'object'
    ? { label: stored.goal.label || '', date: stored.goal.date || '' }
    : { label: stored.birthday ? '40' : '', date: stored.birthday || '' };

  return {
    goal,
    daily: Array.isArray(stored.daily) && stored.daily.length ? stored.daily : structuredClone(DEFAULT_CONFIG.daily),
    training: Array.isArray(stored.training) ? stored.training : [],
    monthly: Array.isArray(stored.monthly) ? stored.monthly : [],
    theme: THEMES.includes(stored.theme) ? stored.theme : 'system',
    accent: ACCENTS.some(a => a.id === stored.accent) ? stored.accent : 'blue'
  };
}
function saveConfig(){ write('kd-fit:config', config); }

/* ---------- which habits apply today ----------
   An item with no `days` runs every day. `days` is a list of JS
   weekday numbers (0 Sunday … 6 Saturday), so a Tuesday-only habit
   never makes a Thursday look failed — the day is scored against what
   was actually asked of it. */
function itemRunsOn(item, date){
  if(!Array.isArray(item.days) || !item.days.length) return true;
  return item.days.includes(date.getDay());
}
function sectionItemsOn(sec, date){
  return sec.items.filter(it => itemRunsOn(it, date));
}
function dailyItems(date = new Date()){
  return config.daily.flatMap(s => sectionItemsOn(s, date));
}
function dailyTotal(date = new Date()){ return dailyItems(date).length; }
function goodDayMark(date = new Date()){
  return Math.max(1, Math.ceil(dailyTotal(date) * GOOD_DAY));
}

const DAY_NAMES = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/* "Mon, Wed, Fri" / "Every day" — for the settings summary line. */
function daysLabel(item){
  if(!Array.isArray(item.days) || !item.days.length) return 'Every day';
  if(item.days.length === 7) return 'Every day';
  const order = [1, 2, 3, 4, 5, 6, 0];
  return order.filter(d => item.days.includes(d))
    .map(d => DAY_FULL[d].slice(0, 3)).join(', ');
}

/* ---------- dates ---------- */
function dayKey(d = new Date()){
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function parseKey(key){
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function midnight(d){ return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function addDays(d, n){ const c = new Date(d); c.setDate(c.getDate() + n); return c; }

/* ---------- the goal ----------
   Optional. With a date set the dial counts down to it; without one it
   shows how much of today is done, which is what most people want and
   what every new install now starts as. */
function hasGoal(){
  return !!(config.goal && config.goal.date && !isNaN(parseKey(config.goal.date)));
}
function goalDate(){ return parseKey(config.goal.date); }
function daysUntilGoal(){
  if(!hasGoal()) return 0;
  return Math.round((midnight(goalDate()) - midnight(new Date())) / 86400000);
}
function goalReached(){ return hasGoal() && daysUntilGoal() <= 0; }

/* ---------- theme ----------
   Applied to <html> before first paint by a snippet in index.html, and
   again here whenever it changes. "system" follows the OS and keeps
   following it — the listener stays live for the life of the page. */
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

function resolvedTheme(){
  if(config.theme === 'system') return systemDark.matches ? 'dark' : 'light';
  return config.theme;
}
function applyTheme(){
  const root = document.documentElement;
  const theme = resolvedTheme();
  root.setAttribute('data-theme', theme);
  root.setAttribute('data-accent', config.accent || 'blue');
  // The iOS status bar reads this, so it has to move with the palette
  // or the notch area stays the old colour.
  const meta = document.querySelector('meta[name="theme-color"]');
  if(meta){
    meta.setAttribute('content', theme === 'light' ? '#f4e9e8' : '#241a22');
  }
  // Enables the cross-fade only after the first paint, so loading the
  // app in light mode doesn't animate from dark.
  requestAnimationFrame(() => root.setAttribute('data-theme-ready', ''));

}
systemDark.addEventListener('change', () => {
  if(config.theme === 'system') applyTheme();
});

// Weeks run Monday to Sunday.
function weekStart(d = new Date()){
  const m = midnight(d);
  const shift = (m.getDay() + 6) % 7;
  return addDays(m, -shift);
}

/* ---------- day records ---------- */
function getDay(key){ return read(`kd-fit:${key}`, {}) || {}; }
function setDay(key, data){ write(`kd-fit:${key}`, data); }
function getNote(key){
  try{ return localStorage.getItem(`kd-fit:note:${key}`) || ''; }
  catch(e){ return ''; }
}
function setNote(key, text){
  const k = `kd-fit:note:${key}`;
  try{
    if(text){ localStorage.setItem(k, text); mirror(k, text); }
    else { localStorage.removeItem(k); unmirror(k); }
  }catch(e){ /* ignore */ }
}

let today = getDay(dayKey());

// Daily-habit ticks only — training no longer counts toward the day.
function dailyDone(entry){
  return dailyItems().filter(it => entry[it.id]).length;
}

/* Past days are scored against the habit count that was in force when
   they were logged, recorded as _total. Without it, adding a habit today
   would raise the bar on every day already behind you and wipe out a
   streak you actually earned. Days logged before this existed fall back
   to the current count. */
/* Weekly and monthly ticks live in the same day record as the daily
   habits, so they must be excluded from the daily count or a gym
   session would inflate the ring. */
function trainingIdSet(){
  return new Set([
    ...config.training.map(t => t.id),
    ...config.monthly.map(t => t.id)
  ]);
}

function dayTotalOf(entry, date = new Date()){
  const t = Number(entry._total);
  // Falling back to that date's own schedule, not today's, so a day
  // logged before _total existed is still judged by what it asked for.
  return t > 0 ? t : dailyTotal(date);
}

// Counts every non-training tick, so a habit since renamed or removed
// still counts toward the day it was logged on.
function loggedCount(entry, total, tids){
  let n = 0;
  for(const k in entry){
    if(!entry[k] || k.startsWith('_') || tids.has(k)) continue;
    n++;
  }
  return Math.min(n, total);
}

function isGoodDay(d){
  return d.total > 0 && d.done >= Math.ceil(d.total * GOOD_DAY);
}

/* ---------- migration ----------
   v1 and v2 shipped "Lift 1" and "Lift 2" as separate daily boxes.
   Weekly training replaces them with one Lift activity done twice a
   week, so fold any old lift1/lift2 tick into the new id.
   -------------------------------------------------------------- */
function dayKeysInStorage(){
  const keys = [];
  for(let i = 0; i < localStorage.length; i++){
    const k = localStorage.key(i);
    if(k && /^kd-fit:\d{4}-\d{2}-\d{2}$/.test(k)) keys.push(k);
  }
  return keys; // collected first — the loops below write as they go
}

// Adding a section to DEFAULT_CONFIG never reaches anyone who has
// already saved settings — their stored config wins — so each new
// section needs an explicit step here.
function addSection(stored, id, title, items){
  if(!stored || !Array.isArray(stored.daily)) return false;
  if(stored.daily.some(s => s.id === id)) return false;
  stored.daily.push({ id, title, items: structuredClone(items) });
  return true;
}

// Stamp days that predate _total with what they were really scored
// against, before the new section moves the number.
function stampTotals(keys, priorTotal){
  if(!(priorTotal > 0)) return;
  keys.forEach(k => {
    const entry = read(k, null);
    if(!entry || entry._total) return;
    entry._total = priorTotal;
    write(k, entry);
  });
}

function migrate(){
  const at = read('kd-fit:migrated', 0);
  if(at >= 6) return; // must match the version stamped at the end
  const keys = dayKeysInStorage();

  if(at < 3){
    keys.forEach(k => {
      const entry = read(k, null);
      if(!entry) return;
      if(entry.lift1 || entry.lift2){
        entry.lift = true;
        delete entry.lift1;
        delete entry.lift2;
        write(k, entry);
      }
    });
  }

  if(at < 4){
    const stored = read('kd-fit:config', null);
    const priorDaily = (stored && Array.isArray(stored.daily))
      ? stored.daily
      : DEFAULT_CONFIG.daily.filter(s => s.id !== 'inflammation' && s.id !== 'health');
    stampTotals(keys, priorDaily.reduce((n, s) => n + (s.items ? s.items.length : 0), 0));
    if(addSection(stored, 'inflammation', 'Inflammation', INFLAMMATION_ITEMS)){
      write('kd-fit:config', stored);
    }
  }

  if(at < 5){
    const stored = read('kd-fit:config', null);
    const priorDaily = (stored && Array.isArray(stored.daily))
      ? stored.daily
      : DEFAULT_CONFIG.daily.filter(s => s.id !== 'health');
    stampTotals(keys, priorDaily.reduce((n, s) => n + (s.items ? s.items.length : 0), 0));
    if(addSection(stored, 'health', 'General health', HEALTH_ITEMS)){
      write('kd-fit:config', stored);
    }
  }

  /* v6 — onboarding arrives. Anyone with a saved config or a single
     logged day has already set this app up by hand, and must not be
     dropped into a first-run wizard that would overwrite it. */
  if(at < 6){
    const stored = read('kd-fit:config', null);
    if(stored || keys.length) write('kd-fit:onboarded', true);
  }

  write('kd-fit:migrated', 6);
}

/* localStorage in a WKWebView is evictable — iOS can clear it under
   storage pressure, which for a habit log means silently losing the
   history that is the entire point. This asks the browser to treat it
   as persistent; it is best-effort and unsupported in some engines. */
function requestPersistence(){
  try{
    if(navigator.storage && navigator.storage.persist){
      navigator.storage.persisted().then(already => {
        if(!already) navigator.storage.persist().catch(() => {});
      }).catch(() => {});
    }
  }catch(e){ /* not fatal — the app works either way */ }
}

/* ---------- computed history ---------- */
function historyFrom(startDate, count){
  const tids = trainingIdSet();
  const days = [];
  for(let i = 0; i < count; i++){
    const d = addDays(startDate, i);
    const key = dayKey(d);
    const entry = getDay(key);
    const total = dayTotalOf(entry, d);
    days.push({ key, date: d, total, done: loggedCount(entry, total, tids) });
  }
  return days;
}
function recentHistory(){
  return historyFrom(addDays(midnight(new Date()), -(HISTORY_DAYS - 1)), HISTORY_DAYS);
}

/* Yesterday backwards — today is still in play, so it can't break a run.

   One missed day no longer ends a streak; two in a row does. Losing
   weeks of work to a single bad Tuesday is the moment people delete a
   habit app, and it punishes exactly the person the app is for. The
   0.7 threshold already said a day needn't be perfect — this says the
   same about a week.

   A forgiven day is returned as well as counted, so the ledger can
   mark it rather than quietly pretending it went well. */
function streakInfo(days){
  let streak = 0;
  let pendingGrace = null;
  const grace = new Set();

  for(let i = days.length - 2; i >= 0; i--){
    const d = days[i];
    if(isGoodDay(d)){
      streak++;
      if(pendingGrace){ grace.add(pendingGrace); pendingGrace = null; }
      continue;
    }
    // A second miss with no good day between them ends the run.
    if(pendingGrace) break;
    pendingGrace = d.key;
  }
  // A miss still pending when the walk ends was never earned back.
  return { streak, grace };
}
function streakOf(days){ return streakInfo(days).streak; }
function bestRunOf(days){
  let best = 0, run = 0;
  days.forEach(d => {
    if(isGoodDay(d)){ run++; best = Math.max(best, run); }
    else run = 0;
  });
  return best;
}
function rateOf(days){
  const good = days.filter(isGoodDay).length;
  return Math.round((good / days.length) * 100);
}

/* ---------- weekly training ---------- */
function trainingWeek(){
  const start = weekStart();
  const keys = [];
  for(let i = 0; i < 7; i++) keys.push(dayKey(addDays(start, i)));
  const entries = keys.map(getDay);
  return config.training.map(t => ({
    ...t,
    count: entries.filter(e => e[t.id]).length,
    todayOn: !!today[t.id]
  }));
}
function trainingProgress(week){
  const target = week.reduce((n, t) => n + t.target, 0);
  const hit = week.reduce((n, t) => n + Math.min(t.count, t.target), 0);
  return { hit, target, ratio: target ? hit / target : 0 };
}

/* ---------- monthly ----------
   Same mechanism as training over a calendar month. Deliberately not a
   rolling 30 days: "twice this month" is how people actually think,
   and a month that resets on the 1st gives a clean run at it. */
function monthDays(d = new Date()){
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const keys = [];
  for(let i = 1; i <= end.getDate(); i++){
    keys.push(dayKey(new Date(start.getFullYear(), start.getMonth(), i)));
  }
  return keys;
}
function monthlyMonth(){
  const entries = monthDays().map(getDay);
  return config.monthly.map(t => ({
    ...t,
    count: entries.filter(e => e[t.id]).length,
    todayOn: !!today[t.id]
  }));
}
function monthlyProgress(month){
  const target = month.reduce((n, t) => n + t.target, 0);
  const hit = month.reduce((n, t) => n + Math.min(t.count, t.target), 0);
  return { hit, target, ratio: target ? hit / target : 0 };
}

/* ---------- ring ---------- */
const R = 128;
const CIRC = 2 * Math.PI * R;

function checkMark(){
  return `<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2.5 7.3 5.6 10.4 11.5 3.9"/></svg>`;
}

/* ============================================================
   Section instruments

   One gauge per section, all 68px, all on the house curve — but a
   different mechanism each, so the column reads as an instrument
   cluster instead of the same ring four times.

     arc     segmented sweep + needle   physical output
     rings   concentric, lighting inward   dialling in
     clock   wedges closing a full circle  a day going round
     heat    a needle running hot to cool  an inverse measure

   Inflammation is the one gauge that isn't a fill: less is better, so
   it runs coral to blue. That coral is the design system's expressive
   accent, used here because the meaning needs a second hue — it is the
   only non-blue in the app.
   ============================================================ */
/* 'heat' is deliberately not in here. It runs coral-to-blue because it
   was built for Inflammation, where less is better — handing it to an
   ordinary progress card showed a full hot arc at 0/1, which reads as
   the exact opposite of the truth. It stays available, but only to a
   section that actually means it. */
const GAUGE_TYPES = ['arc', 'rings', 'clock', 'ladder'];
const INVERSE_SECTIONS = { inflammation: 'heat' };

/* Instruments are handed out in order down the page — daily sections
   first, then the weekly and monthly cards — so no two cards you can
   see at once share a mechanism. A hash of the section id was the first
   attempt and collided badly; three of six sections came out identical.

   The original five sections were body, mind, soul, inflammation,
   health in that order, which lands on exactly the arc / rings / clock
   / heat / ladder they were designed with, so nothing moves for an
   existing config. */
function gaugeAssignment(){
  const map = {};
  let i = 0;
  config.daily.forEach(sec => {
    map[sec.id] = INVERSE_SECTIONS[sec.id] || GAUGE_TYPES[i++ % GAUGE_TYPES.length];
  });
  map['@weekly']  = GAUGE_TYPES[i++ % GAUGE_TYPES.length];
  map['@monthly'] = GAUGE_TYPES[i++ % GAUGE_TYPES.length];
  return map;
}
let GAUGES = {};
function gaugeType(id){ return GAUGES[id] || 'arc'; }

const G = 68, GC = G / 2;

function polar(r, deg){
  const a = (deg - 90) * Math.PI / 180;
  return [GC + r * Math.cos(a), GC + r * Math.sin(a)];
}
function arcPath(r, a0, a1){
  const [x0, y0] = polar(r, a0);
  const [x1, y1] = polar(r, a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

const ARC_SWEEP = 260, ARC_FROM = -130;

function buildGauge(type, n, uid){
  const seg = (from, sweep, gap, r) => {
    /* An arc whose start and end land on the same point draws nothing,
       so a one-segment clock (a monthly target of 1) rendered an empty
       gauge. Clamp just short of a full turn. */
    const each = Math.min((sweep - gap * (n - 1)) / n, 359.4);
    return Array.from({ length: n }, (_, i) => {
      const a0 = from + i * (each + gap);
      return `<path class="seg" data-i="${i}" d="${arcPath(r, a0, a0 + each)}"/>`;
    }).join('');
  };

  if(type === 'rings'){
    const rings = Array.from({ length: n }, (_, i) =>
      `<circle class="seg" data-i="${i}" cx="${GC}" cy="${GC}" r="${26 - i * (18 / Math.max(n, 1))}"/>`).join('');
    return `<svg class="g g-rings" viewBox="0 0 ${G} ${G}" aria-hidden="true">
      ${rings}<circle class="core" cx="${GC}" cy="${GC}" r="2.6"/></svg>`;
  }

  if(type === 'clock'){
    return `<svg class="g g-clock" viewBox="0 0 ${G} ${G}" aria-hidden="true">
      ${seg(0, 360, 5, 22)}</svg>`;
  }

  // A level meter — ten rungs filling bottom-up. The radial forms get
  // cramped past about six segments; this stays legible at ten.
  if(type === 'ladder'){
    const span = 50, half = 21;
    const rungs = Array.from({ length: n }, (_, i) => {
      const y = n > 1 ? GC + span / 2 - (span / (n - 1)) * i : GC;
      return `<line class="seg" data-i="${i}" x1="${GC - half}" y1="${y.toFixed(2)}" x2="${GC + half}" y2="${y.toFixed(2)}"/>`;
    }).join('');
    return `<svg class="g g-ladder" viewBox="0 0 ${G} ${G}" aria-hidden="true">${rungs}</svg>`;
  }

  if(type === 'heat'){
    // A needle with nothing to read it against is decoration, so the
    // scale carries one tick per habit.
    const ticks = Array.from({ length: n + 1 }, (_, i) => {
      const deg = -104 + (208 / n) * i;
      const [x0, y0] = polar(19.5, deg);
      const [x1, y1] = polar(25.5, deg);
      return `<line class="tick" data-i="${i}" x1="${x0.toFixed(2)}" y1="${y0.toFixed(2)}" x2="${x1.toFixed(2)}" y2="${y1.toFixed(2)}"/>`;
    }).join('');
    return `<svg class="g g-heat" viewBox="0 0 ${G} ${G}" aria-hidden="true">
      <defs><linearGradient id="h${uid}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="var(--kd-warm)"/><stop offset="1" stop-color="var(--kd-accent)"/>
      </linearGradient></defs>
      <path class="heat-track" d="${arcPath(24, -104, 104)}" stroke="url(#h${uid})"/>
      ${ticks}
      <g class="needle"><line x1="${GC}" y1="${GC}" x2="${GC}" y2="${GC - 19}"/></g>
      <circle class="hub" cx="${GC}" cy="${GC}" r="2.6"/></svg>`;
  }

  return `<svg class="g g-arc" viewBox="0 0 ${G} ${G}" aria-hidden="true">
    ${seg(ARC_FROM, ARC_SWEEP, 6, 24)}
    <g class="needle"><line x1="${GC}" y1="${GC}" x2="${GC}" y2="${GC - 17}"/></g>
    <circle class="hub" cx="${GC}" cy="${GC}" r="2.6"/></svg>`;
}

function syncGauge(node, type, done, total){
  if(!node) return;
  const svg = node.querySelector('.g');
  if(!svg) return;
  const ratio = total ? done / total : 0;

  svg.querySelectorAll('.seg').forEach(s => {
    // Rings light from the outside in; everything else in order.
    const lit = +s.dataset.i < done;
    if(lit && !s.classList.contains('on')){
      s.classList.add('on', 'pop');
      setTimeout(() => s.classList.remove('pop'), 420);
    } else if(!lit){
      s.classList.remove('on');
    }
  });

  svg.querySelectorAll('.tick').forEach(t =>
    t.classList.toggle('on', +t.dataset.i <= done));

  const needle = svg.querySelector('.needle');
  if(needle){
    const deg = type === 'heat'
      ? -104 + 208 * ratio
      : ARC_FROM + ARC_SWEEP * ratio;
    needle.style.transform = `rotate(${deg}deg)`;
    if(type === 'heat'){
      needle.style.setProperty('--needle',
        `color-mix(in srgb, var(--kd-accent) ${Math.round(ratio * 100)}%, var(--kd-warm))`);
    }
  }

  svg.classList.toggle('full', total > 0 && done === total);
}

// Routed through KDNative: navigator.vibrate does nothing on iOS Safari,
// so in the PWA these are silent on iPhone and only fire in the native shell.
function tap(kind){ if(global_native()) global_native().haptic(kind); }
function global_native(){ return window.KDNative; }

function toast(message){
  let node = document.querySelector('.toast');
  if(!node){
    node = document.createElement('div');
    node.className = 'toast';
    document.body.appendChild(node);
  }
  node.textContent = message;
  requestAnimationFrame(() => node.classList.add('show'));
  clearTimeout(node._t);
  node._t = setTimeout(() => node.classList.remove('show'), 2400);
}

/* ---------- what the dial says ----------
   With a future goal it counts down to it. Otherwise the same dial
   reports today, so the app opens with something true on it rather
   than someone else's birthday. */
function countdownMode(){ return hasGoal() && daysUntilGoal() > 0; }

function dialUnit(){
  if(countdownMode()){
    const label = (config.goal.label || '').trim();
    const n = daysUntilGoal();
    return label
      ? `${n === 1 ? 'Day' : 'Days'} to <em>${escapeHtml(label)}</em>`
      : `${n === 1 ? 'Day' : 'Days'} to go`;
  }
  if(goalReached() && (config.goal.label || '').trim()){
    return `<em>${escapeHtml(config.goal.label.trim())}</em> — here`;
  }
  return `of ${dailyTotal()} today`;
}
function dialDate(){
  if(countdownMode()){
    return goalDate().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });
  }
  return new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' });
}

/* ============================================================
   Build once, then patch. Rebuilding the DOM per tap would
   restart every entrance animation and cut transitions short.
   ============================================================ */
const el = {};
let ledgerView = (() => {
  try{ return localStorage.getItem('kd-fit:view') || '28'; }catch(e){ return '28'; }
})();

function build(){
  const now = new Date();
  GAUGES = gaugeAssignment();

  /* Only today's habits are rendered. A Tuesday habit on a Thursday
     isn't greyed out, it's simply not today's business — and because
     the day is scored against what it asked for, its absence can't
     cost you the day. */
  const todaySections = config.daily
    .map(sec => ({ sec, items: sectionItemsOn(sec, now) }))
    .filter(x => x.items.length);

  const sections = todaySections.map(({ sec, items }, i) => {
    const hidden = sec.items.length - items.length;
    return `
    <section class="card rise" style="animation-delay:${300 + i * 70}ms" data-section="${sec.id}">
      <div class="card-head">
        <div class="card-headings">
          <h2 class="card-title">${escapeHtml(sec.title)}</h2>
          <div class="card-count" data-count><b>0</b>/${items.length}</div>
        </div>
        <div class="gauge" data-gauge>${buildGauge(gaugeType(sec.id), items.length, sec.id)}</div>
      </div>
      ${items.map(it => `
        <div class="item" data-id="${it.id}" role="checkbox" aria-checked="false" tabindex="0">
          <div class="box">${checkMark()}</div>
          <div class="item-label">${escapeHtml(it.label)}</div>
        </div>`).join('')}
      ${hidden ? `<div class="card-aside">${hidden} not scheduled today</div>` : ''}
    </section>`;
  }).join('');

  const periodRows = (list, unit) => list.map(t => `
    <div class="train" data-id="${t.id}" role="checkbox" aria-checked="false" tabindex="0">
      <div class="box">${checkMark()}</div>
      <div class="train-body">
        <div class="train-label">${escapeHtml(t.label)}</div>
        <div class="train-sub" data-train-sub>0/${t.target} ${unit}</div>
      </div>
      <div class="pips" data-pips></div>
    </div>`).join('');

  const delay = 300 + todaySections.length * 70;

  document.getElementById('app').innerHTML = `
    <header class="masthead rise">
      <div class="brand">
        ${KD_MARK}
        <span class="visually-hidden">Jotara</span>
      </div>
      <div class="masthead-right">
        <div class="label" data-today-date></div>
        <button class="icon-btn" type="button" data-settings aria-label="Settings">${ICON_COG}</button>
      </div>
    </header>

    <div class="hero rise" style="animation-delay:60ms">
      <div class="dial">
        <svg viewBox="0 0 280 280" aria-hidden="true">
          <circle class="dial-track" cx="140" cy="140" r="${R}"/>
          <circle class="dial-glow" cx="140" cy="140" r="${R}" data-glow
                  stroke-dasharray="${CIRC}" stroke-dashoffset="${CIRC}"/>
          <circle class="dial-prog" cx="140" cy="140" r="${R}" data-prog
                  stroke-dasharray="${CIRC}" stroke-dashoffset="${CIRC}"/>
          <line class="dial-target" data-target/>
        </svg>
        <div class="dial-face" data-face>
          <div class="dial-num num" data-days>${
            countdownMode() ? (REDUCED_MOTION ? daysUntilGoal() : 0) : dailyDone(today)
          }</div>
          <div class="dial-unit" data-dial-unit>${dialUnit()}</div>
          <div class="dial-date" data-dial-date>${dialDate()}</div>
        </div>
        <div class="dial-seal" data-seal>
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle class="seal-bloom" cx="50" cy="50" r="34"/>
            <path class="seal-check" d="M30 51.5 L44 65.5 L71 35"/>
          </svg>
        </div>
      </div>
      <div class="dial-status" data-status></div>
    </div>

    <div class="stats rise" style="animation-delay:140ms">
      <div class="stat">
        <div class="stat-num num" data-streak>0</div>
        <div class="stat-cap">Day streak</div>
      </div>
      <div class="stat">
        <div class="stat-num num" data-rate>0<small>%</small></div>
        <div class="stat-cap">28-day rate</div>
      </div>
      <div class="stat">
        <div class="stat-num num" data-best>0</div>
        <div class="stat-cap">Best run</div>
      </div>
    </div>

    <section class="ledger rise" style="animation-delay:200ms">
      <div class="ledger-head">
        <div class="label" data-ledger-label></div>
        <div class="seg">
          <button type="button" data-view="28">28 days</button>
          <button type="button" data-view="year">Year</button>
        </div>
      </div>
      <div data-ledger-body></div>
    </section>

    ${sections}

    ${config.training.length ? `
    <section class="card rise" style="animation-delay:${delay}ms" data-training>
      <div class="card-head">
        <div class="card-headings">
          <h2 class="card-title">This week</h2>
          <div class="card-count" data-week-count><b>0</b>/0 this week</div>
        </div>
        <div class="gauge" data-week-gauge>${
          buildGauge(gaugeType('@weekly'), config.training.reduce((n, t) => n + t.target, 0) || 1, 'train')
        }</div>
      </div>
      ${periodRows(config.training, 'this week')}
    </section>` : ''}

    ${config.monthly.length ? `
    <section class="card rise" style="animation-delay:${delay + 30}ms" data-monthly>
      <div class="card-head">
        <div class="card-headings">
          <h2 class="card-title">This month</h2>
          <div class="card-count" data-month-count><b>0</b>/0 this month</div>
        </div>
        <div class="gauge" data-month-gauge>${
          buildGauge(gaugeType('@monthly'), config.monthly.reduce((n, t) => n + t.target, 0) || 1, 'month')
        }</div>
      </div>
      ${periodRows(config.monthly, 'this month')}
    </section>` : ''}

    <section class="card pad-b rise" style="animation-delay:${delay + 60}ms">
      <div class="card-head">
        <h2 class="card-title">What moved today</h2>
      </div>
      <textarea class="note-field" data-note rows="2"
        placeholder="One line. What actually happened."></textarea>
    </section>

    <div class="remind rise" style="animation-delay:${delay + 120}ms">
      <div class="remind-copy">
        <div class="remind-title">Daily reminder</div>
        <div class="remind-status" data-notif-status></div>
      </div>
      <button class="btn" type="button" data-settings>Set up</button>
    </div>

    <footer class="footer rise" style="animation-delay:${delay + 180}ms">
      ${KD_MARK}
      <div class="label">Consistency over intensity</div>
    </footer>
  `;

  el.days = document.querySelector('[data-days]');
  el.prog = document.querySelector('[data-prog]');
  el.glow = document.querySelector('[data-glow]');
  el.status = document.querySelector('[data-status]');
  el.target = document.querySelector('[data-target]');
  el.streak = document.querySelector('[data-streak]');
  el.rate = document.querySelector('[data-rate]');
  el.best = document.querySelector('[data-best]');
  el.ledgerBody = document.querySelector('[data-ledger-body]');
  el.ledgerLabel = document.querySelector('[data-ledger-label]');
  el.notifStatus = document.querySelector('[data-notif-status]');
  el.note = document.querySelector('[data-note]');
  el.weekCount = document.querySelector('[data-week-count]');
  el.weekGauge = document.querySelector('[data-week-gauge]');
  el.monthCount = document.querySelector('[data-month-count]');
  el.monthGauge = document.querySelector('[data-month-gauge]');
  el.dialUnit = document.querySelector('[data-dial-unit]');
  el.items = Array.from(document.querySelectorAll('.item'));
  el.trains = Array.from(document.querySelectorAll('.train'));

  setDateLabel();
  buildLedger();
  wire();
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

function setDateLabel(){
  document.querySelector('[data-today-date]').textContent =
    new Date().toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' });
}

/* ============================================================
   The day editor

   You log at night, or you forget entirely and remember on Wednesday
   what you did on Monday. Until now there was no way to say so — the
   ledger drew every day and none of them could be touched, which made
   an honest record impossible and gave people a reason to give up.

   Tapping any past cell opens that day with the habits that were
   actually scheduled for it. `_total` is stamped from that date's own
   schedule, so a Tuesday-only habit is neither demanded of a Thursday
   nor lost from a Tuesday.
   ============================================================ */
let editingKey = null;

function openDay(key){
  if(!key) return;
  const date = parseKey(key);
  if(isNaN(date)) return;
  // Tomorrow hasn't happened; there is nothing honest to record.
  if(midnight(date) > midnight(new Date())) return;

  editingKey = key;
  const host = document.getElementById('dayedit');
  host.hidden = false;
  host.innerHTML = dayEditMarkup(key, date);
  document.body.style.overflow = 'hidden';
  wireDayEdit(host, key);
  tap('light');
}

function closeDay(){
  const host = document.getElementById('dayedit');
  host.hidden = true;
  host.innerHTML = '';
  editingKey = null;
  document.body.style.overflow = '';
}

function dayEditMarkup(key, date){
  const entry = getDay(key);
  const isToday = key === dayKey();
  const scheduled = config.daily
    .map(sec => ({ sec, items: sectionItemsOn(sec, date) }))
    .filter(x => x.items.length);

  const rows = scheduled.map(({ sec, items }) => `
    <div class="de-group">
      <div class="label">${escapeHtml(sec.title)}</div>
      ${items.map(it => `
        <div class="item de-item${entry[it.id] ? ' done' : ''}" data-de-id="${it.id}"
             role="checkbox" aria-checked="${!!entry[it.id]}" tabindex="0">
          <div class="box">${checkMark()}</div>
          <div class="item-label">${escapeHtml(it.label)}</div>
        </div>`).join('')}
    </div>`).join('');

  const periodic = [...config.training, ...config.monthly];
  const periodicRows = periodic.length ? `
    <div class="de-group">
      <div class="label">Weekly &amp; monthly</div>
      ${periodic.map(t => `
        <div class="item de-item${entry[t.id] ? ' done' : ''}" data-de-id="${t.id}"
             role="checkbox" aria-checked="${!!entry[t.id]}" tabindex="0">
          <div class="box">${checkMark()}</div>
          <div class="item-label">${escapeHtml(t.label)}</div>
        </div>`).join('')}
    </div>` : '';

  return `
    <div class="de-inner">
      <div class="sheet-head">
        <div>
          <div class="sheet-title">${date.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' })}</div>
          <div class="label" data-de-count></div>
        </div>
        <button class="btn" type="button" data-de-close>Done</button>
      </div>
      ${isToday ? '<div class="group-note">This is today — changes here are the same as ticking on the main screen.</div>' : ''}
      ${rows || '<div class="group-note">No habits were scheduled for this day.</div>'}
      ${periodicRows}
      <div class="de-group">
        <div class="label">What moved</div>
        <textarea class="note-field" data-de-note rows="2"
          placeholder="One line. What actually happened.">${escapeHtml(getNote(key))}</textarea>
      </div>
    </div>`;
}

function wireDayEdit(host, key){
  const date = parseKey(key);
  const countNode = host.querySelector('[data-de-count]');

  const refreshCount = () => {
    const entry = getDay(key);
    const total = dailyTotal(date);
    const done = dailyItems(date).filter(it => entry[it.id]).length;
    countNode.textContent = `${done} of ${total} · target ${goodDayMark(date)}`;
  };
  refreshCount();

  host.querySelectorAll('[data-de-id]').forEach(node => {
    const toggleRow = () => {
      const entry = getDay(key);
      const id = node.dataset.deId;
      if(entry[id]) delete entry[id];
      else entry[id] = true;
      // Scored against what that day actually asked for, not today's.
      entry._total = dailyTotal(date);
      setDay(key, entry);

      const on = !!entry[id];
      node.classList.toggle('done', on);
      node.setAttribute('aria-checked', String(on));
      if(on){
        node.classList.add('just-done');
        setTimeout(() => node.classList.remove('just-done'), 400);
      }
      refreshCount();

      // Editing today has to move the main screen with it.
      if(key === dayKey()) today = getDay(key);
      buildLedger();
      sync();
      tap(on ? 'tick' : 'light');
    };
    node.addEventListener('click', toggleRow);
    node.addEventListener('keydown', e => {
      if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); toggleRow(); }
    });
  });

  const note = host.querySelector('[data-de-note]');
  let noteTimer;
  note.addEventListener('input', () => {
    autoGrow(note);
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => {
      setNote(key, note.value.trim());
      if(key === dayKey() && el.note) el.note.value = note.value;
    }, 400);
  });
  autoGrow(note);

  host.querySelector('[data-de-close]').addEventListener('click', closeDay);
}

/* ---------- ledger ---------- */
function buildLedger(){
  document.querySelectorAll('[data-view]').forEach(b =>
    b.classList.toggle('is-active', b.dataset.view === ledgerView));

  if(ledgerView === 'year') buildYear();
  else buildTally();
}

/* Every drawn day is a way into that day. The ledger was previously
   decoration you could only look at. */
function wireLedgerCells(){
  document.querySelectorAll('[data-day]').forEach(cell => {
    if(cell.classList.contains('void')) return;
    cell.addEventListener('click', () => openDay(cell.dataset.day));
  });
}

function buildTally(){
  /* Newest first. Chronological order put today at the far right, which
     reads as though the chart starts in the wrong corner — everything
     else on the page starts at the left. Reversed, the eye lands on
     today first and history trails off behind it, and the axis caption
     below says which way time runs so it can't be misread. */
  const days = recentHistory().slice().reverse();
  const { grace } = streakInfo(recentHistory());
  const tKey = dayKey();

  el.ledgerLabel.textContent = 'Last 28 days';
  el.ledgerBody.innerHTML = `<div class="tally-row" data-tally>${
    days.map((d, i) => {
      const ratio = d.total ? Math.min(d.done / d.total, 1) : 0;
      const cls = ['tally'];
      if(d.key === tKey) cls.push('today');
      if(isGoodDay(d)) cls.push('full');
      else if(d.done > 0) cls.push('partial');
      if(grace.has(d.key)) cls.push('grace');
      const label = d.date.toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' })
        + (grace.has(d.key) ? ' — missed, streak carried' : '');
      return `<div class="${cls.join(' ')}" data-day="${d.key}"
        style="height:${38 + ratio * 62}%;${REDUCED_MOTION ? '' : `animation:kd-tally-in 0.5s var(--kd-ease) ${320 + i * 14}ms both`}"
        title="${label} — ${d.done}/${d.total}"></div>`;
    }).join('')
  }</div>
  <div class="tally-axis">
    <span>Today</span>
    <span>28 days ago</span>
  </div>`;
  el.tally = document.querySelector('[data-tally]');
  wireLedgerCells();
}

function buildYear(){
  const tKey = dayKey();
  const start = addDays(weekStart(), -(YEAR_WEEKS - 1) * 7);
  const days = historyFrom(start, YEAR_WEEKS * 7);
  const todayTime = midnight(new Date()).getTime();

  el.ledgerLabel.textContent = 'Last 12 months';
  el.ledgerBody.innerHTML = `
    <div class="year-wrap" data-year-wrap>
      <div class="year">${days.map(d => {
        if(d.date.getTime() > todayTime) return `<div class="ycell void"></div>`;
        const ratio = d.total ? d.done / d.total : 0;
        let cls = 'ycell';
        if(ratio >= 0.99) cls += ' l4';
        else if(ratio >= 0.66) cls += ' l3';
        else if(ratio >= 0.33) cls += ' l2';
        else if(ratio > 0) cls += ' l1';
        if(d.key === tKey) cls += ' today';
        const label = d.date.toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
        return `<div class="${cls}" data-day="${d.key}" title="${label} — ${d.done}/${d.total}"></div>`;
      }).join('')}</div>
    </div>
    <div class="tally-axis">
      <span>12 months ago</span>
      <span>Today</span>
    </div>`;

  // Land on today rather than a year ago.
  const wrap = document.querySelector('[data-year-wrap]');
  if(wrap) wrap.scrollLeft = wrap.scrollWidth;
  el.tally = null;
  wireLedgerCells();
}

/* ---------- sync ---------- */
function sync(){
  const total = dailyTotal();
  const done = dailyDone(today);
  const ratio = total ? done / total : 0;
  /* The day is "done" at the target, not at every last box. With 22
     habits, requiring all of them would mean the ring never closes and
     the reward for a genuinely good day never fires — the same 70% that
     has always defined a logged day now defines a closed ring. Clearing
     the whole list is its own, rarer thing. */
  const mark = goodDayMark();
  const complete = total > 0 && done >= mark;
  const perfect = total > 0 && done === total;

  const offset = CIRC * (1 - ratio);
  el.prog.style.strokeDashoffset = offset;
  el.glow.style.strokeDashoffset = offset;

  el.status.textContent = perfect ? 'Perfect day'
    : complete ? 'Day complete'
    : `Today ${done}/${total} — target ${mark}`;
  document.body.classList.toggle('is-complete', complete);
  document.body.classList.toggle('is-perfect', perfect);
  syncSeal(complete);

  // Where the day starts counting, marked on the ring itself.
  if(el.target && total > 0){
    const deg = 360 * (mark / total);
    const rad = deg * Math.PI / 180;
    el.target.setAttribute('x1', (140 + Math.cos(rad) * (R - 9)).toFixed(2));
    el.target.setAttribute('y1', (140 + Math.sin(rad) * (R - 9)).toFixed(2));
    el.target.setAttribute('x2', (140 + Math.cos(rad) * (R + 9)).toFixed(2));
    el.target.setAttribute('y2', (140 + Math.sin(rad) * (R + 9)).toFixed(2));
  }

  const now = new Date();
  config.daily.forEach(sec => {
    const card = document.querySelector(`[data-section="${sec.id}"]`);
    if(!card) return;
    const scheduled = sectionItemsOn(sec, now);
    const n = scheduled.filter(it => today[it.id]).length;
    card.querySelector('[data-count]').innerHTML = `<b>${n}</b>/${scheduled.length}`;
    syncGauge(card.querySelector('[data-gauge]'), gaugeType(sec.id), n, scheduled.length);
  });

  // In progress mode the dial's big number is today's count, so it has
  // to move on every tick rather than only at boot. Re-trigger the bump
  // only when the value actually changed — restarting the animation on
  // every sync would make the number twitch at rest.
  if(!countdownMode() && el.days){
    const next = String(done);
    if(el.days.textContent !== next){
      el.days.textContent = next;
      el.days.classList.remove('bumped');
      void el.days.offsetWidth;          // reflow, so the animation restarts
      el.days.classList.add('bumped');
    }
    if(el.dialUnit) el.dialUnit.innerHTML = dialUnit();
  }

  el.items.forEach(node => {
    const on = !!today[node.dataset.id];
    node.classList.toggle('done', on);
    node.setAttribute('aria-checked', String(on));
  });

  // weekly and monthly share a row shape, so they share the patching
  const week = trainingWeek();
  const month = monthlyMonth();
  if(el.weekCount){
    const prog = trainingProgress(week);
    el.weekCount.innerHTML = `<b>${prog.hit}</b>/${prog.target} this week`;
    syncGauge(el.weekGauge, gaugeType('@weekly'), prog.hit, prog.target);
  }
  if(el.monthCount){
    const prog = monthlyProgress(month);
    el.monthCount.innerHTML = `<b>${prog.hit}</b>/${prog.target} this month`;
    syncGauge(el.monthGauge, gaugeType('@monthly'), prog.hit, prog.target);
  }

  el.trains.forEach(node => {
    const isMonth = !!node.closest('[data-monthly]');
    const t = (isMonth ? month : week).find(x => x.id === node.dataset.id);
    if(!t) return;
    const unit = isMonth ? 'this month' : 'this week';
    node.classList.toggle('done', t.todayOn);
    node.classList.toggle('hit', t.count >= t.target);
    node.setAttribute('aria-checked', String(t.todayOn));
    node.querySelector('[data-train-sub]').textContent =
      t.count >= t.target ? `Target met — ${t.count}/${t.target}` : `${t.count}/${t.target} ${unit}`;
    node.querySelector('[data-pips]').innerHTML =
      Array.from({ length: t.target }, (_, i) =>
        `<div class="pip${i < t.count ? ' on' : ''}"></div>`).join('');
  });

  // today's cell in the 28-day view
  if(el.tally){
    const cell = el.tally.querySelector(`[data-day="${dayKey()}"]`);
    if(cell){
      cell.style.height = `${38 + Math.min(ratio, 1) * 62}%`;
      cell.classList.toggle('full', done >= goodDayMark());
      cell.classList.toggle('partial', done > 0 && done < goodDayMark());
      cell.title = `Today — ${done}/${total}`;
    }
  }

  const days = recentHistory();
  el.streak.textContent = streakOf(days);
  el.rate.innerHTML = `${rateOf(days)}<small>%</small>`;
  el.best.textContent = bestRunOf(days);

  syncNotifStatus();
}

/* ---------- the completion seal ----------
   Closing the day used to swap the number for the logo, extruded and
   spinning. A rotating 3D wordmark is a screensaver, not a reward: it
   said nothing about the day, it never settled, and it dragged a whole
   software renderer along with it.

   What replaces it is a mark being made — a check drawn in one stroke,
   left to right, over a soft bloom of the accent. It has an end state,
   it reads instantly at a glance, and it is the same gesture you just
   performed four times to get here. Tap the dial to go back to the
   count. */
let sealOn = true;

function syncSeal(complete){
  const dial = document.querySelector('.dial');
  if(!dial) return;
  const show = complete && sealOn;
  const was = dial.classList.contains('show-seal');
  dial.classList.toggle('show-seal', show);

  // Re-run the draw only on the transition into the sealed state, so it
  // isn't redrawn by every unrelated sync.
  if(show && !was){
    const check = dial.querySelector('.seal-check');
    if(check && !REDUCED_MOTION){
      check.classList.remove('draw');
      void check.getBoundingClientRect();
      check.classList.add('draw');
    }
  }
}

function wireSeal(){
  const dial = document.querySelector('.dial');
  if(!dial) return;
  dial.addEventListener('click', () => {
    if(!document.body.classList.contains('is-complete')) return;
    sealOn = !sealOn;
    syncSeal(true);
    tap('light');
  });
}

function syncNotifStatus(){
  if(!el.notifStatus) return;
  if(window.KDNative && window.KDNative.isNative){
    const t = reminderTimes();
    el.notifStatus.textContent = !t.length ? 'Off — pick a time'
      : t.length === 1 ? `On — every day at ${t[0]}`
      : `On — ${t.length} times a day`;
    return;
  }
  if(!NOTIF_SUPPORTED){ el.notifStatus.textContent = 'Not supported in this browser'; return; }
  if(Notification.permission === 'denied'){ el.notifStatus.textContent = 'Blocked — enable in Settings'; return; }
  if(Notification.permission === 'granted'){
    el.notifStatus.textContent = read('kd-fit:push', null)
      ? 'On — a daily nudge is scheduled'
      : 'Allowed — finish setup to schedule it';
    return;
  }
  el.notifStatus.textContent = 'Off — a nudge to log the day';
}

/* ---------- interaction ---------- */
function toggle(node){
  const id = node.dataset.id;
  const wasOn = !!today[id];
  today[id] = !wasOn;
  if(!today[id]) delete today[id];
  today._total = dailyTotal(); // what this day was scored out of
  setDay(dayKey(), today);

  if(!wasOn){
    node.classList.add('just-done');
    setTimeout(() => node.classList.remove('just-done'), 400);
  }

  const wasComplete = document.body.classList.contains('is-complete');
  const wasPerfect = document.body.classList.contains('is-perfect');
  sync();
  const nowComplete = document.body.classList.contains('is-complete');
  const nowPerfect = document.body.classList.contains('is-perfect');

  if(nowComplete && !wasComplete){
    tap('success');
    celebrate(nowPerfect);
  } else if(nowPerfect && !wasPerfect){
    // Clearing the whole list after already hitting the target is its
    // own, rarer moment and deserves the second showing.
    tap('success');
    celebrate(true);
  } else {
    tap(wasOn ? 'light' : 'tick');
  }
}

/* ---------- the completion overlay ----------
   Fires only on the transition into a closed day, never on load and
   never on a re-render — a reward that replays itself stops being one. */
let celTimer = null;

/* The completion mark is built from the day, not from a generic tick.
   One segment per habit you actually closed, lit in sequence around the
   ring, then the count lands in the middle. It uses the same segmented-
   arc language as the section gauges, so the reward looks like it came
   from this app rather than from a component library — and it says
   something: that is your five things, one at a time. */
function celebrationMark(done, total){
  const C = 60, R = 44;
  const n = Math.max(1, Math.min(done, 24));
  const gap = n === 1 ? 0 : Math.min(7, 120 / n);
  const each = Math.min((360 - gap * n) / n, 359.4);

  const pt = (r, deg) => {
    const a = (deg - 90) * Math.PI / 180;
    return [(C + r * Math.cos(a)).toFixed(2), (C + r * Math.sin(a)).toFixed(2)];
  };
  const arc = (r, a0, a1) => {
    const [x0, y0] = pt(r, a0), [x1, y1] = pt(r, a1);
    return `M${x0} ${y0} A${r} ${r} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} 1 ${x1} ${y1}`;
  };

  const segs = Array.from({ length: n }, (_, i) => {
    const a0 = -90 + i * (each + gap);
    return `<path class="cel-seg" style="--i:${i}" d="${arc(R, a0, a0 + each)}"/>`;
  }).join('');

  // The faint full ring underneath is the shape of the whole day, so a
  // completed-but-not-perfect day still reads as "not quite all of it".
  return `
    <circle class="cel-track" cx="${C}" cy="${C}" r="${R}"/>
    ${segs}
    <text class="cel-count" x="${C}" y="${C}" text-anchor="middle"
          dominant-baseline="central" style="--n:${n}">${done}</text>`;
}

function celebrate(perfect){
  const host = document.getElementById('celebrate');
  if(!host) return;

  const days = recentHistory();
  const streak = streakOf(days) + 1;   // today counts once it's closed
  const done = dailyDone(today);
  const total = dailyTotal();

  host.querySelector('[data-cel-mark]').innerHTML = celebrationMark(done, total);
  host.querySelector('[data-cel-title]').textContent = perfect ? 'Perfect day' : 'Day complete';
  host.querySelector('[data-cel-sub]').textContent =
    `${done} of ${total}` + (streak > 1 ? ` · ${streak} day streak` : '');

  clearTimeout(celTimer);
  host.classList.remove('out');
  host.classList.toggle('perfect', !!perfect);
  host.hidden = false;
  // Restart the whole sequence even if it was already on screen.
  void host.offsetWidth;

  const close = () => {
    clearTimeout(celTimer);
    host.classList.add('out');
    setTimeout(() => { host.hidden = true; host.classList.remove('out'); }, 500);
  };
  host.onclick = close;
  celTimer = setTimeout(close, REDUCED_MOTION ? 1400 : 2600);
}

function wire(){
  [...el.items, ...el.trains].forEach(node => {
    node.addEventListener('click', () => toggle(node));
    node.addEventListener('keydown', e => {
      if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); toggle(node); }
    });
  });

  document.querySelectorAll('[data-settings]').forEach(b =>
    b.addEventListener('click', openSheet));

  wireSeal();

  document.querySelectorAll('[data-view]').forEach(b =>
    b.addEventListener('click', () => {
      ledgerView = b.dataset.view;
      try{ localStorage.setItem('kd-fit:view', ledgerView); mirror('kd-fit:view', ledgerView); }catch(e){ /* ignore */ }
      buildLedger();
      sync();
    }));

  el.note.value = getNote(dayKey());
  autoGrow(el.note);
  let noteTimer;
  el.note.addEventListener('input', () => {
    autoGrow(el.note);
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => setNote(dayKey(), el.note.value.trim()), 400);
  });
}

function autoGrow(node){
  node.style.height = 'auto';
  node.style.height = `${node.scrollHeight}px`;
}

/* The dial's headline number. Only the countdown counts up — in
   progress mode sync() already owns that number, and animating it on
   every tick would fight the tick itself. */
function refreshDial(){
  if(!el.days) return;
  if(el.dialUnit) el.dialUnit.innerHTML = dialUnit();
  const dateNode = document.querySelector('[data-dial-date]');
  if(dateNode) dateNode.textContent = dialDate();
  if(countdownMode()) countUp(el.days, daysUntilGoal());
  else el.days.textContent = dailyDone(today);
}

/* ---------- count-up ---------- */
function countUp(node, target){
  if(REDUCED_MOTION){ node.textContent = target; return; }
  const duration = 1100;
  const start = performance.now();
  function frame(now){
    const t = Math.min((now - start) / duration, 1);
    node.textContent = Math.round(target * (1 - Math.pow(1 - t, 4)));
    if(t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* ============================================================
   Settings
   ============================================================ */
function openSheet(){
  const sheet = document.getElementById('sheet');
  sheet.hidden = false;
  sheet.innerHTML = sheetMarkup();
  document.body.style.overflow = 'hidden';
  wireSheet(sheet);
}
function closeSheet(){
  const sheet = document.getElementById('sheet');
  sheet.hidden = true;
  sheet.innerHTML = '';
  document.body.style.overflow = '';
}

/* Monday-first, which is how a week reads even though JS starts on
   Sunday. The value stored is still the JS index. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/* Seven chips plus "Every day" repeated down a list of habits is a wall
   of near-identical marks — and for most habits the answer never
   changes from the default. So the row collapses to its own summary and
   only opens the chips when you actually want to change something. */
function dayChips(si, ii, item){
  const on = d => !Array.isArray(item.days) || !item.days.length || item.days.includes(d);
  const everyDay = !Array.isArray(item.days) || !item.days.length || item.days.length === 7;
  return `
    <div class="days-wrap${everyDay ? '' : ' is-custom'}" data-days-wrap="${si}.${ii}">
      <button type="button" class="days-summary" data-days-open="${si}.${ii}"
              aria-expanded="false">
        <span data-days-note="${si}.${ii}">${escapeHtml(daysLabel(item))}</span>
      </button>
      <div class="days" role="group" aria-label="Days this habit runs" hidden>
        ${WEEK_ORDER.map(d => `
          <button type="button" class="day${on(d) ? ' on' : ''}"
                  data-day-toggle="${si}.${ii}.${d}"
                  aria-pressed="${on(d)}"
                  title="${DAY_FULL[d]}">${DAY_NAMES[d]}</button>`).join('')}
      </div>
    </div>`;
}

function sheetMarkup(){
  const sections = config.daily.map((sec, si) => `
    <div class="sub-head">
      <input class="input title-input" data-section-title="${si}" value="${escapeHtml(sec.title)}" aria-label="Section name">
      <button class="add" type="button" data-add-item="${si}">+ Habit</button>
    </div>
    ${sec.items.map((it, ii) => `
      <div class="field-group">
        <div class="field">
          <input class="input" data-item="${si}.${ii}" value="${escapeHtml(it.label)}" aria-label="Habit">
          <button class="remove" type="button" data-del-item="${si}.${ii}" aria-label="Remove habit">&times;</button>
        </div>
        ${dayChips(si, ii, it)}
      </div>`).join('')}
  `).join('');

  const training = config.training.map((t, i) => `
    <div class="field">
      <input class="input" data-train="${i}" value="${escapeHtml(t.label)}" aria-label="Activity">
      <input class="input narrow" data-train-target="${i}" type="number" min="1" max="14"
             value="${t.target}" aria-label="Times per week" inputmode="numeric">
      <button class="remove" type="button" data-del-train="${i}" aria-label="Remove activity">&times;</button>
    </div>`).join('');

  const monthly = config.monthly.map((t, i) => `
    <div class="field">
      <input class="input" data-month="${i}" value="${escapeHtml(t.label)}" aria-label="Thing">
      <input class="input narrow" data-month-target="${i}" type="number" min="1" max="31"
             value="${t.target}" aria-label="Times per month" inputmode="numeric">
      <button class="remove" type="button" data-del-month="${i}" aria-label="Remove">&times;</button>
    </div>`).join('');

  const sub = read('kd-fit:push', null);

  return `
  <div class="sheet-inner">
    <div class="sheet-head">
      <div class="sheet-title">Settings</div>
      <button class="btn" type="button" data-close>Done</button>
    </div>

    <div class="group">
      <div class="label">Appearance</div>
      <div class="seg theme-seg">
        ${THEMES.map(t => `
          <button type="button" data-theme-pick="${t}" class="${config.theme === t ? 'is-active' : ''}">
            ${t[0].toUpperCase() + t.slice(1)}
          </button>`).join('')}
      </div>
      <div class="swatches">
        ${ACCENTS.map(a => `
          <button type="button" class="swatch${config.accent === a.id ? ' is-active' : ''}"
                  data-accent-pick="${a.id}" style="--sw:${a.hex}"
                  aria-label="${a.label}" aria-pressed="${config.accent === a.id}"></button>`).join('')}
      </div>
      <div class="group-note">System follows your phone's light and dark setting.</div>
    </div>

    <div class="group">
      <div class="label">Working toward</div>
      <div class="field">
        <input class="input" data-goal-label value="${escapeHtml(config.goal.label || '')}"
               placeholder="A race, a birthday, a trip…" aria-label="Goal name">
      </div>
      <input class="input" type="date" data-goal-date value="${escapeHtml(config.goal.date || '')}" aria-label="Goal date">
      <div class="group-note">
        Optional. With a date set, the dial counts down to it — leave it empty
        and the dial shows today instead.
      </div>
    </div>

    <div class="group">
      <div class="label">Daily habits</div>
      ${sections}
      <div class="group-note">
        These drive the ring, the streak and the ledger. Tap a habit's day
        summary to run it only on certain days — a Tuesday habit can't cost
        you a Thursday. Renaming keeps the history attached; removing a habit
        leaves its past ticks in place but stops counting it.
      </div>
    </div>

    <div class="group">
      <div class="sub-head">
        <div class="label">Weekly — times per week</div>
        <button class="add" type="button" data-add-train>+ Activity</button>
      </div>
      ${training}
      <div class="group-note">
        Weekly targets, not daily boxes — a rest day can't break a streak.
      </div>
    </div>

    <div class="group">
      <div class="sub-head">
        <div class="label">Monthly — times per month</div>
        <button class="add" type="button" data-add-month>+ Thing</button>
      </div>
      ${monthly}
      <div class="group-note">
        For what's too occasional to be weekly — a long walk, a proper day off,
        seeing people. Resets on the 1st.
      </div>
    </div>

    <div class="group">
      <div class="label">Daily reminder</div>
      ${pushMarkup(sub)}
    </div>

    <div class="group">
      <div class="label">Your data</div>
      <div class="row-btns">
        <button class="btn" type="button" data-export>Export backup</button>
        <button class="btn" type="button" data-import>Import backup</button>
      </div>
      <input type="file" accept="application/json" data-import-file hidden>
      <div class="group-note">
        Everything lives on this device only. Clearing Safari's site data wipes
        it, so take a backup now and then — the export is a plain JSON file.
      </div>
    </div>

    <div class="group">
      <button class="btn danger block" type="button" data-reset>Reset settings to defaults</button>
      <div class="group-note">Restores the default habits and training targets. Your logged history is untouched.</div>
    </div>

    <div class="group">
      <button class="btn primary block" type="button" data-save>Save changes</button>
    </div>
  </div>`;
}

/* Reminders are a list now. The old shape was a single { at } object,
   so anything stored by an earlier build is lifted into a one-item
   list rather than dropped. */
function reminderTimes(){
  const raw = read('kd-fit:reminder', null);
  if(!raw) return [];
  if(Array.isArray(raw)) return raw.filter(t => typeof t === 'string');
  if(raw.at) return [raw.at];
  return [];
}

function pushMarkup(sub){
  // Native shell: the OS owns the schedule. No keys, no secrets, no
  // subscription to keep alive — and it fires whether or not the app
  // has been opened.
  if(window.KDNative && window.KDNative.isNative){
    const times = reminderTimes();
    const rows = times.map((at, i) => `
      <div class="field">
        <input class="input" type="time" data-remind-time="${i}" value="${escapeHtml(at)}">
        <button class="remove" type="button" data-remind-del="${i}" aria-label="Remove reminder">&times;</button>
      </div>`).join('');

    return `
      ${rows || '<div class="group-note">No reminders set.</div>'}
      <div class="sub-head">
        <div></div>
        <button class="add" type="button" data-remind-add>+ Time</button>
      </div>
      <div class="row-btns">
        <button class="btn primary" type="button" data-remind-set>${times.length ? 'Save times' : 'Set reminder'}</button>
        ${times.length ? '<button class="btn danger" type="button" data-remind-off>Turn all off</button>' : ''}
      </div>
      <div class="group-note">
        ${times.length
          ? `Scheduled every day at ${times.map(escapeHtml).join(', ')} — by the phone itself, offline.`
          : 'Add one or more times and the phone will nudge you every day — offline, no server. A morning prompt and an evening log are a different job, so more than one is fine.'}
      </div>`;
  }

  if(!PUSH_SUPPORTED){
    return `<div class="group-note">
      This browser can't do push notifications. On iPhone, add the app to your
      home screen and open it from there — Safari only allows push for
      installed web apps.
    </div>`;
  }
  if(!VAPID_PUBLIC_KEY){
    return `<div class="group-note">
      Scheduled reminders need a one-time setup — generate a VAPID key pair with
      <code>npx web-push generate-vapid-keys</code>, put the public half in
      <code>js/app.js</code> and the private half in the repo's Actions secrets.
      Full steps are in the README under "Daily reminders".
    </div>`;
  }
  if(sub){
    return `
      <div class="group-note">Subscribed. Paste this into the repo secret
        <code>PUSH_SUBSCRIPTION</code> if you haven't already.</div>
      <div class="field"><textarea class="input" data-sub readonly rows="4">${escapeHtml(JSON.stringify(sub))}</textarea></div>
      <div class="row-btns">
        <button class="btn" type="button" data-copy-sub>Copy</button>
        <button class="btn" type="button" data-test-push>Send test</button>
      </div>`;
  }
  return `
    <button class="btn block" type="button" data-subscribe>Enable daily reminder</button>
    <div class="group-note">
      Allows notifications, then gives you a subscription to paste into the
      repo's <code>PUSH_SUBSCRIPTION</code> secret. A scheduled GitHub Action
      sends the nudge — no server to run.
    </div>`;
}

function wireSheet(sheet){
  const q = sel => sheet.querySelector(sel);
  const all = sel => Array.from(sheet.querySelectorAll(sel));

  q('[data-close]').addEventListener('click', () => { collect(sheet); persist(); closeSheet(); });
  q('[data-save]').addEventListener('click', () => { collect(sheet); persist(); closeSheet(); toast('Saved'); });

  all('[data-add-item]').forEach(b => b.addEventListener('click', () => {
    collect(sheet);
    config.daily[+b.dataset.addItem].items.push({ id: newId(), label: 'New habit' });
    saveConfig(); reopen();
  }));
  all('[data-del-item]').forEach(b => b.addEventListener('click', () => {
    collect(sheet);
    const [si, ii] = b.dataset.delItem.split('.').map(Number);
    config.daily[si].items.splice(ii, 1);
    saveConfig(); reopen();
  }));
  q('[data-add-train]').addEventListener('click', () => {
    collect(sheet);
    config.training.push({ id: newId(), label: 'New activity', target: 1 });
    saveConfig(); reopen();
  });
  all('[data-del-train]').forEach(b => b.addEventListener('click', () => {
    collect(sheet);
    config.training.splice(+b.dataset.delTrain, 1);
    saveConfig(); reopen();
  }));
  q('[data-add-month]').addEventListener('click', () => {
    collect(sheet);
    config.monthly.push({ id: newId(), label: 'New thing', target: 1 });
    saveConfig(); reopen();
  });
  all('[data-del-month]').forEach(b => b.addEventListener('click', () => {
    collect(sheet);
    config.monthly.splice(+b.dataset.delMonth, 1);
    saveConfig(); reopen();
  }));

  /* Theme and accent apply on the spot — picking a colour you can't see
     until you close the sheet is a guessing game. */
  all('[data-theme-pick]').forEach(b => b.addEventListener('click', () => {
    config.theme = b.dataset.themePick;
    saveConfig(); applyTheme();
    all('[data-theme-pick]').forEach(x => x.classList.toggle('is-active', x === b));
    tap('light');
  }));
  all('[data-accent-pick]').forEach(b => b.addEventListener('click', () => {
    config.accent = b.dataset.accentPick;
    saveConfig(); applyTheme();
    all('[data-accent-pick]').forEach(x => {
      const on = x === b;
      x.classList.toggle('is-active', on);
      x.setAttribute('aria-pressed', String(on));
    });
    tap('light');
  }));

  all('[data-days-open]').forEach(b => b.addEventListener('click', () => {
    const wrap = q(`[data-days-wrap="${b.dataset.daysOpen}"]`);
    if(!wrap) return;
    const chips = wrap.querySelector('.days');
    const open = chips.hidden;
    chips.hidden = !open;
    wrap.classList.toggle('is-open', open);
    b.setAttribute('aria-expanded', String(open));
  }));

  /* Day chips patch in place rather than rebuilding the sheet — a
     rebuild would throw you back to the top of a long scroll. */
  all('[data-day-toggle]').forEach(b => b.addEventListener('click', () => {
    const [si, ii, d] = b.dataset.dayToggle.split('.').map(Number);
    const item = config.daily[si]?.items[ii];
    if(!item) return;
    // Absent `days` means every day; materialise it before removing one.
    if(!Array.isArray(item.days) || !item.days.length) item.days = [0, 1, 2, 3, 4, 5, 6];
    const at = item.days.indexOf(d);
    if(at >= 0) item.days.splice(at, 1);
    else item.days.push(d);
    // Every day selected is the same as no constraint — store it that
    // way so the habit keeps working if the week model ever changes.
    if(item.days.length === 7) delete item.days;
    // A habit on no days would silently vanish, so the last one stays.
    if(Array.isArray(item.days) && !item.days.length){
      item.days = [d];
      toast('A habit needs at least one day');
    }
    const on = !Array.isArray(item.days) || item.days.includes(d);
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
    const note = q(`[data-days-note="${si}.${ii}"]`);
    if(note) note.textContent = daysLabel(item);
    const wrap = q(`[data-days-wrap="${si}.${ii}"]`);
    if(wrap){
      const custom = Array.isArray(item.days) && item.days.length && item.days.length < 7;
      wrap.classList.toggle('is-custom', !!custom);
    }
    saveConfig();
    tap('light');
  }));

  q('[data-export]').addEventListener('click', exportBackup);
  q('[data-import]').addEventListener('click', () => q('[data-import-file]').click());
  q('[data-import-file]').addEventListener('change', e => importBackup(e.target.files[0]));

  q('[data-reset]').addEventListener('click', () => {
    // Appearance isn't part of "the defaults" anyone means here — being
    // thrown back to dark blue for resetting your habits is a surprise.
    const { theme, accent } = config;
    config = structuredClone(DEFAULT_CONFIG);
    config.theme = theme;
    config.accent = accent;
    saveConfig(); reopen(); toast('Settings reset');
  });

  // Read every time field back, in order, de-duplicated.
  const collectTimes = () =>
    [...new Set(all('[data-remind-time]').map(i => i.value).filter(Boolean))].sort();

  const addTime = q('[data-remind-add]');
  if(addTime) addTime.addEventListener('click', () => {
    const times = collectTimes();
    if(times.length >= 8){ toast('Eight reminders is plenty'); return; }
    // Offer a sensible second slot rather than another 07:30 to edit.
    times.push(times.includes('07:30') ? '20:30' : '07:30');
    write('kd-fit:reminder', [...new Set(times)].sort());
    reopen();
  });
  all('[data-remind-del]').forEach(b => b.addEventListener('click', () => {
    const times = collectTimes();
    times.splice(+b.dataset.remindDel, 1);
    write('kd-fit:reminder', times);
    reopen();
  }));

  const setTime = q('[data-remind-set]');
  if(setTime) setTime.addEventListener('click', async () => {
    const times = collectTimes();
    if(!times.length){ toast('Add a time first'); return; }
    const parsed = times.map(at => {
      const [hour, minute] = at.split(':').map(Number);
      return { hour, minute };
    });
    const ok = await window.KDNative.scheduleDaily(parsed);
    if(ok){
      write('kd-fit:reminder', times);
      reopen();
      toast(times.length === 1 ? `Reminder set for ${times[0]}` : `${times.length} reminders set`);
    }
    else toast('Notifications not allowed');
  });
  const offBtn = q('[data-remind-off]');
  if(offBtn) offBtn.addEventListener('click', async () => {
    await window.KDNative.cancelDaily();
    try{ localStorage.removeItem('kd-fit:reminder'); unmirror('kd-fit:reminder'); }catch(e){ /* ignore */ }
    reopen(); toast('Reminder off');
  });

  const sub = q('[data-subscribe]');
  if(sub) sub.addEventListener('click', subscribePush);
  const copy = q('[data-copy-sub]');
  if(copy) copy.addEventListener('click', () => {
    const text = q('[data-sub]').value;
    navigator.clipboard?.writeText(text)
      .then(() => toast('Subscription copied'))
      .catch(() => { q('[data-sub]').select(); toast('Select and copy'); });
  });
  const test = q('[data-test-push]');
  if(test) test.addEventListener('click', async () => {
    const reg = await navigator.serviceWorker.ready;
    reg.showNotification('Jotara', { body: 'This is what the daily nudge looks like.', icon: 'icons/icon-192.png' });
  });
}

function newId(){ return 'i' + Math.random().toString(36).slice(2, 8); }

// Read the sheet's inputs back into config without touching the DOM order.
function collect(sheet){
  const goalLabel = sheet.querySelector('[data-goal-label]');
  const goalDateInput = sheet.querySelector('[data-goal-date]');
  if(goalLabel) config.goal.label = goalLabel.value.trim();
  // An empty date is a real choice — it turns the countdown off — so
  // this writes the empty string rather than skipping the assignment.
  if(goalDateInput) config.goal.date = goalDateInput.value || '';

  sheet.querySelectorAll('[data-section-title]').forEach(input => {
    const si = +input.dataset.sectionTitle;
    if(config.daily[si]) config.daily[si].title = input.value.trim() || config.daily[si].title;
  });
  sheet.querySelectorAll('[data-item]').forEach(input => {
    const [si, ii] = input.dataset.item.split('.').map(Number);
    const item = config.daily[si]?.items[ii];
    if(item) item.label = input.value.trim() || item.label;
  });
  sheet.querySelectorAll('[data-train]').forEach(input => {
    const t = config.training[+input.dataset.train];
    if(t) t.label = input.value.trim() || t.label;
  });
  sheet.querySelectorAll('[data-train-target]').forEach(input => {
    const t = config.training[+input.dataset.trainTarget];
    const n = parseInt(input.value, 10);
    if(t && n >= 1 && n <= 14) t.target = n;
  });
  sheet.querySelectorAll('[data-month]').forEach(input => {
    const t = config.monthly[+input.dataset.month];
    if(t) t.label = input.value.trim() || t.label;
  });
  sheet.querySelectorAll('[data-month-target]').forEach(input => {
    const t = config.monthly[+input.dataset.monthTarget];
    const n = parseInt(input.value, 10);
    if(t && n >= 1 && n <= 31) t.target = n;
  });
}

function reopen(){
  const sheet = document.getElementById('sheet');
  sheet.innerHTML = sheetMarkup();
  wireSheet(sheet);
}

// Config changes can add or remove rows, so the view is rebuilt.
function persist(){
  saveConfig();
  today = getDay(dayKey());
  build();
  sync();
  refreshDial();
}

/* ============================================================
   Onboarding

   Four screens, and you can leave at any point with something that
   works. The defaults are deliberately modest — the failure mode for a
   habit app is not "too few habits", it's a list so long that day one
   ends at 4/22 and there is no day two.
   ============================================================ */
let onboardState = null;

function needsOnboarding(){
  return !read('kd-fit:onboarded', false);
}

function startOnboarding(){
  onboardState = {
    step: 0,
    focus: null,
    picks: new Set(),
    weekly: [],
    monthly: [],
    goalLabel: '',
    goalDate: ''
  };
  renderOnboarding();
}

function finishOnboarding(){
  const picked = [];
  HABIT_LIBRARY.forEach(group => group.items.forEach(it => {
    if(onboardState.picks.has(it.id)) picked.push({ id: it.id, label: it.label });
  }));

  config.daily = picked.length
    ? [{ id: 'daily', title: 'Every day', items: picked }]
    : structuredClone(DEFAULT_CONFIG.daily);
  config.training = onboardState.weekly.filter(t => t.label.trim()).map(t => ({
    id: newId(), label: t.label.trim(), target: t.target
  }));
  config.monthly = onboardState.monthly.filter(t => t.label.trim()).map(t => ({
    id: newId(), label: t.label.trim(), target: t.target
  }));
  config.goal = {
    label: onboardState.goalLabel.trim(),
    date: onboardState.goalDate || ''
  };

  saveConfig();
  write('kd-fit:onboarded', true);
  onboardState = null;

  const host = document.getElementById('onboard');
  if(host){ host.hidden = true; host.innerHTML = ''; }
  document.body.style.overflow = '';

  applyTheme();
  today = getDay(dayKey());
  build();
  sync();
  refreshDial();
  toast('You’re set — tap a habit to log it');
}

function skipOnboarding(){
  write('kd-fit:onboarded', true);
  onboardState = null;
  const host = document.getElementById('onboard');
  if(host){ host.hidden = true; host.innerHTML = ''; }
  document.body.style.overflow = '';
}

function onboardStepMarkup(){
  const s = onboardState;

  if(s.step === 0){
    return `
      <div class="ob-step">
        <div class="ob-kicker">Welcome</div>
        <h1 class="ob-title">What are you trying to do?</h1>
        <p class="ob-sub">Pick one to start from. You can change everything later.</p>
        <div class="ob-choices">
          ${Object.entries(STARTER_PACKS).map(([id, p]) => `
            <button type="button" class="ob-choice${s.focus === id ? ' is-active' : ''}" data-focus="${id}">
              ${escapeHtml(p.label)}
            </button>`).join('')}
        </div>
      </div>`;
  }

  if(s.step === 1){
    return `
      <div class="ob-step">
        <div class="ob-kicker">Every day</div>
        <h1 class="ob-title">Choose a few daily habits</h1>
        <p class="ob-sub">
          Three or four is plenty. <b data-pick-count>${s.picks.size}</b> selected.
        </p>
        ${HABIT_LIBRARY.map(group => `
          <div class="ob-group">
            <div class="label">${escapeHtml(group.title)}</div>
            <div class="ob-pills">
              ${group.items.map(it => `
                <button type="button" class="ob-pill${s.picks.has(it.id) ? ' is-active' : ''}"
                        data-pick="${it.id}">${escapeHtml(it.label)}</button>`).join('')}
            </div>
          </div>`).join('')}
      </div>`;
  }

  if(s.step === 2){
    const rows = (list, kind, unit, max) => list.map((t, i) => `
      <div class="field">
        <input class="input" data-ob-${kind}="${i}" value="${escapeHtml(t.label)}"
               placeholder="Name it" aria-label="${unit}">
        <input class="input narrow" data-ob-${kind}-target="${i}" type="number"
               min="1" max="${max}" value="${t.target}" inputmode="numeric" aria-label="How many times">
        <button class="remove" type="button" data-ob-del-${kind}="${i}" aria-label="Remove">&times;</button>
      </div>`).join('');

    return `
      <div class="ob-step">
        <div class="ob-kicker">Now and then</div>
        <h1 class="ob-title">Anything weekly or monthly?</h1>
        <p class="ob-sub">
          Targets, not daily boxes — miss a day and nothing breaks. Skip this if
          you'd rather keep it simple.
        </p>
        <div class="ob-group">
          <div class="sub-head">
            <div class="label">Times per week</div>
            <button class="add" type="button" data-ob-add-weekly>+ Add</button>
          </div>
          ${rows(s.weekly, 'weekly', 'Activity', 14) || '<div class="group-note">Nothing yet — gym, run, a call home.</div>'}
        </div>
        <div class="ob-group">
          <div class="sub-head">
            <div class="label">Times per month</div>
            <button class="add" type="button" data-ob-add-monthly>+ Add</button>
          </div>
          ${rows(s.monthly, 'monthly', 'Thing', 31) || '<div class="group-note">Nothing yet — a long walk, a proper day off.</div>'}
        </div>
      </div>`;
  }

  return `
    <div class="ob-step">
      <div class="ob-kicker">Optional</div>
      <h1 class="ob-title">Working toward anything?</h1>
      <p class="ob-sub">
        A race, a birthday, a trip. Set a date and the dial counts down to it —
        leave it empty and it just shows today.
      </p>
      <div class="ob-group">
        <input class="input" data-ob-goal-label value="${escapeHtml(s.goalLabel)}"
               placeholder="Name it — optional" aria-label="Goal name">
        <input class="input" type="date" data-ob-goal-date value="${escapeHtml(s.goalDate)}" aria-label="Goal date">
      </div>
      <div class="ob-group">
        <div class="label">Appearance</div>
        <div class="seg theme-seg">
          ${THEMES.map(t => `
            <button type="button" data-theme-pick="${t}" class="${config.theme === t ? 'is-active' : ''}">
              ${t[0].toUpperCase() + t.slice(1)}
            </button>`).join('')}
        </div>
        <div class="swatches">
          ${ACCENTS.map(a => `
            <button type="button" class="swatch${config.accent === a.id ? ' is-active' : ''}"
                    data-accent-pick="${a.id}" style="--sw:${a.hex}"
                    aria-label="${a.label}" aria-pressed="${config.accent === a.id}"></button>`).join('')}
        </div>
      </div>
    </div>`;
}

function renderOnboarding(){
  const host = document.getElementById('onboard');
  if(!host) return;
  const s = onboardState;
  const last = s.step === 3;

  host.hidden = false;
  document.body.style.overflow = 'hidden';
  host.innerHTML = `
    <div class="ob-inner">
      <div class="ob-progress" aria-hidden="true">
        ${[0, 1, 2, 3].map(i => `<i class="${i <= s.step ? 'on' : ''}"></i>`).join('')}
      </div>
      ${onboardStepMarkup()}
      <div class="ob-actions">
        ${s.step > 0 ? '<button class="btn" type="button" data-ob-back>Back</button>' : ''}
        <button class="btn primary" type="button" data-ob-next>${last ? 'Start' : 'Continue'}</button>
        ${!last ? '<button class="btn ghost" type="button" data-ob-skip>Skip setup</button>' : ''}
      </div>
    </div>`;
  wireOnboarding(host);
}

function wireOnboarding(host){
  const s = onboardState;
  const q = sel => host.querySelector(sel);
  const all = sel => Array.from(host.querySelectorAll(sel));

  // Read any inputs on screen back into state before moving.
  const capture = () => {
    const gl = q('[data-ob-goal-label]');
    const gd = q('[data-ob-goal-date]');
    if(gl) s.goalLabel = gl.value;
    if(gd) s.goalDate = gd.value;
    all('[data-ob-weekly]').forEach(i => { s.weekly[+i.dataset.obWeekly].label = i.value; });
    all('[data-ob-weekly-target]').forEach(i => {
      const n = parseInt(i.value, 10);
      if(n >= 1) s.weekly[+i.dataset.obWeeklyTarget].target = Math.min(n, 14);
    });
    all('[data-ob-monthly]').forEach(i => { s.monthly[+i.dataset.obMonthly].label = i.value; });
    all('[data-ob-monthly-target]').forEach(i => {
      const n = parseInt(i.value, 10);
      if(n >= 1) s.monthly[+i.dataset.obMonthlyTarget].target = Math.min(n, 31);
    });
  };

  all('[data-focus]').forEach(b => b.addEventListener('click', () => {
    s.focus = b.dataset.focus;
    // Seed the picks so step two opens with a sensible answer already
    // in place rather than an empty list to stare at.
    s.picks = new Set(STARTER_PACKS[s.focus].picks);
    all('[data-focus]').forEach(x => x.classList.toggle('is-active', x === b));
    tap('light');
  }));

  all('[data-pick]').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.pick;
    if(s.picks.has(id)) s.picks.delete(id); else s.picks.add(id);
    b.classList.toggle('is-active', s.picks.has(id));
    const count = q('[data-pick-count]');
    if(count) count.textContent = s.picks.size;
    tap('light');
  }));

  const addWeekly = q('[data-ob-add-weekly]');
  if(addWeekly) addWeekly.addEventListener('click', () => {
    capture(); s.weekly.push({ label: '', target: 2 }); renderOnboarding();
  });
  const addMonthly = q('[data-ob-add-monthly]');
  if(addMonthly) addMonthly.addEventListener('click', () => {
    capture(); s.monthly.push({ label: '', target: 1 }); renderOnboarding();
  });
  all('[data-ob-del-weekly]').forEach(b => b.addEventListener('click', () => {
    capture(); s.weekly.splice(+b.dataset.obDelWeekly, 1); renderOnboarding();
  }));
  all('[data-ob-del-monthly]').forEach(b => b.addEventListener('click', () => {
    capture(); s.monthly.splice(+b.dataset.obDelMonthly, 1); renderOnboarding();
  }));

  all('[data-theme-pick]').forEach(b => b.addEventListener('click', () => {
    config.theme = b.dataset.themePick;
    saveConfig(); applyTheme();
    all('[data-theme-pick]').forEach(x => x.classList.toggle('is-active', x === b));
  }));
  all('[data-accent-pick]').forEach(b => b.addEventListener('click', () => {
    config.accent = b.dataset.accentPick;
    saveConfig(); applyTheme();
    all('[data-accent-pick]').forEach(x => x.classList.toggle('is-active', x === b));
  }));

  const back = q('[data-ob-back]');
  if(back) back.addEventListener('click', () => { capture(); s.step--; renderOnboarding(); });
  const skip = q('[data-ob-skip]');
  if(skip) skip.addEventListener('click', skipOnboarding);

  q('[data-ob-next]').addEventListener('click', () => {
    capture();
    if(s.step === 1 && !s.picks.size){
      toast('Pick at least one habit');
      return;
    }
    if(s.step >= 3){ finishOnboarding(); return; }
    s.step++;
    renderOnboarding();
    host.scrollTop = 0;
  });
}

/* ---------- backup ---------- */
function exportBackup(){
  const days = {}, notes = {};
  for(let i = 0; i < localStorage.length; i++){
    const k = localStorage.key(i);
    if(!k) continue;
    let m = k.match(/^kd-fit:(\d{4}-\d{2}-\d{2})$/);
    if(m){ days[m[1]] = read(k, {}); continue; }
    m = k.match(/^kd-fit:note:(\d{4}-\d{2}-\d{2})$/);
    if(m){ notes[m[1]] = localStorage.getItem(k); }
  }
  const payload = { app: 'kd-fit', version: 3, exported: new Date().toISOString(), config, days, notes };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kd-fit-backup-${dayKey()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Backup downloaded');
}

async function importBackup(file){
  if(!file) return;
  try{
    const data = JSON.parse(await file.text());
    if(data.app !== 'kd-fit') throw new Error('Not a kd-fit backup');
    if(data.config) config = data.config;
    Object.entries(data.days || {}).forEach(([k, v]) => write(`kd-fit:${k}`, v));
    Object.entries(data.notes || {}).forEach(([k, v]) => setNote(k, v));
    saveConfig();
    closeSheet();
    persist();
    toast('Backup restored');
  }catch(err){
    toast(`Import failed — ${err.message}`);
  }
}

/* ---------- push ---------- */
function urlBase64ToUint8Array(base64String){
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

async function subscribePush(){
  try{
    const permission = await Notification.requestPermission();
    if(permission !== 'granted'){ toast('Notifications not allowed'); syncNotifStatus(); return; }
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
    write('kd-fit:push', sub.toJSON());
    reopen();
    syncNotifStatus();
    toast('Subscribed — copy it into the repo secret');
  }catch(err){
    toast(`Could not subscribe — ${err.message}`);
  }
}

/* ---------- day rollover ---------- */
let mountedOn = dayKey();
function checkRollover(){
  if(dayKey() === mountedOn) return;
  mountedOn = dayKey();
  today = getDay(mountedOn);
  setDateLabel();
  buildLedger();
  sync();
  el.note.value = getNote(mountedOn);
  autoGrow(el.note);
  refreshDial();
}
document.addEventListener('visibilitychange', () => { if(!document.hidden) checkRollover(); });

/* ---------- boot ---------- */
/* Recover anything the OS evicted from localStorage before a single
   read happens, then seed the mirror for installs that predate it.
   Both are no-ops off-device. */
async function restoreFromVault(){
  const n = window.KDNative;
  if(!n || !n.vaultAvailable || !n.vaultAvailable()) return;
  const restored = await n.vaultRestore();
  if(restored){
    // Storage was cleared under us — reload so every module re-reads.
    config = loadConfig();
    today = getDay(dayKey());

    /* Boot has already decided whether to onboard by the time this
       resolves. If the recovered data says this user was set up long
       ago, close the wizard rather than letting them configure over
       the top of their own history. */
    const host = document.getElementById('onboard');
    if(host && !host.hidden && read('kd-fit:onboarded', false)){
      host.hidden = true;
      host.innerHTML = '';
      document.body.style.overflow = '';
      onboardState = null;
    }

    build();
    sync();
    refreshDial();
    toast(`Restored ${restored} record${restored === 1 ? '' : 's'}`);
  }
  n.vaultSeed();
}

migrate();
config = loadConfig(); // migrate may have rewritten it
applyTheme();
requestPersistence();
restoreFromVault();
today = getDay(dayKey());
build();
sync();
refreshDial();
if(needsOnboarding()) startOnboarding();

// Hold the splash briefly so it reads as an intro rather than a flash,
// but never let it outstay the content being ready.
const SPLASH_MS = REDUCED_MOTION ? 0 : 1250;
const bootedAt = performance.now();
function dismissSplash(){
  const splash = document.getElementById('splash');
  if(!splash) return;
  splash.classList.add('out');
  setTimeout(() => splash.remove(), 600);
}
const wait = Math.max(0, SPLASH_MS - (performance.now() - bootedAt));
if(document.fonts && document.fonts.ready){
  document.fonts.ready.then(() => setTimeout(dismissSplash, wait));
} else {
  setTimeout(dismissSplash, wait);
}
// Never strand the user behind the splash if a font request hangs.
setTimeout(dismissSplash, 3500);

if('serviceWorker' in navigator && !(window.KDNative && window.KDNative.isNative)){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.error('SW failed', err));
  });
}
if(window.KDNative && window.KDNative.isNative) window.KDNative.ready();
