/* ============================================================
   40 — KD Performance Log

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

const DEFAULT_CONFIG = {
  birthday: '2027-05-07',
  // Daily habits — these drive the ring, the streak and the ledger.
  daily: [
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
    { id: 'inflammation', title: 'Inflammation', items: INFLAMMATION_ITEMS }
  ],
  // Training is a weekly target, not a daily box. A rest day is not a
  // failure, so it must not be able to break a streak.
  training: [
    { id: 'lift', label: 'Lift', target: 2 },
    { id: 'football', label: 'Football', target: 1 },
    { id: 'mobility', label: 'Mobility', target: 3 }
  ]
};

const HISTORY_DAYS = 28;
const YEAR_WEEKS = 53;
const GOOD_DAY = 0.7;

const KD_MARK = `<svg viewBox="0 0 18.62 11.73" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><polygon fill="#0339f8" points="18.62 0 12 0 6 5.86 12 11.73 18.62 11.73 12.62 5.86 18.62 0"/><polygon fill="#eceef2" points="0 0 0 11.72 6 5.86 0 0"/></svg>`;
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
  try{ localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch(e){ return false; } // private mode / quota — the session still works
}

/* ---------- config ---------- */
let config = loadConfig();

function loadConfig(){
  const stored = read('kd-fit:config', null);
  if(!stored) return structuredClone(DEFAULT_CONFIG);
  // Merge shallowly so a config saved by an older build still boots.
  return {
    birthday: stored.birthday || DEFAULT_CONFIG.birthday,
    daily: Array.isArray(stored.daily) && stored.daily.length ? stored.daily : DEFAULT_CONFIG.daily,
    training: Array.isArray(stored.training) && stored.training.length ? stored.training : DEFAULT_CONFIG.training
  };
}
function saveConfig(){ write('kd-fit:config', config); }

function dailyItems(){ return config.daily.flatMap(s => s.items); }
function dailyTotal(){ return dailyItems().length; }
function goodDayMark(){ return Math.ceil(dailyTotal() * GOOD_DAY); }

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

function birthdayDate(){
  const d = parseKey(config.birthday);
  return isNaN(d) ? parseKey(DEFAULT_CONFIG.birthday) : d;
}
function daysUntilBirthday(){
  return Math.round((midnight(birthdayDate()) - midnight(new Date())) / 86400000);
}

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
  try{
    if(text) localStorage.setItem(`kd-fit:note:${key}`, text);
    else localStorage.removeItem(`kd-fit:note:${key}`);
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
function trainingIdSet(){ return new Set(config.training.map(t => t.id)); }

function dayTotalOf(entry){
  const t = Number(entry._total);
  return t > 0 ? t : dailyTotal();
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

function migrate(){
  const at = read('kd-fit:migrated', 0);
  if(at >= 4) return;
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
    // Stamp every day already logged with the habit count it was
    // actually scored against, BEFORE the new section lands. Without
    // this they fall back to the new count and a real streak evaporates.
    const stored = read('kd-fit:config', null);
    const priorDaily = (stored && Array.isArray(stored.daily))
      ? stored.daily
      : DEFAULT_CONFIG.daily.filter(s => s.id !== 'inflammation');
    const priorTotal = priorDaily.reduce((n, s) => n + (s.items ? s.items.length : 0), 0);

    if(priorTotal > 0){
      keys.forEach(k => {
        const entry = read(k, null);
        if(!entry || entry._total) return;
        entry._total = priorTotal;
        write(k, entry);
      });
    }

    // A new default section never reaches anyone who has already saved
    // settings, since their stored config wins. Add it explicitly.
    if(stored && Array.isArray(stored.daily) && !stored.daily.some(s => s.id === 'inflammation')){
      stored.daily.push({
        id: 'inflammation',
        title: 'Inflammation',
        items: structuredClone(INFLAMMATION_ITEMS)
      });
      write('kd-fit:config', stored);
    }
  }

  write('kd-fit:migrated', 4);
}

/* ---------- computed history ---------- */
function historyFrom(startDate, count){
  const tids = trainingIdSet();
  const days = [];
  for(let i = 0; i < count; i++){
    const d = addDays(startDate, i);
    const key = dayKey(d);
    const entry = getDay(key);
    const total = dayTotalOf(entry);
    days.push({ key, date: d, total, done: loggedCount(entry, total, tids) });
  }
  return days;
}
function recentHistory(){
  return historyFrom(addDays(midnight(new Date()), -(HISTORY_DAYS - 1)), HISTORY_DAYS);
}

// Yesterday backwards — today is still in play, so it can't break a run.
function streakOf(days){
  let s = 0;
  for(let i = days.length - 2; i >= 0; i--){
    if(isGoodDay(days[i])) s++; else break;
  }
  return s;
}
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
const GAUGE_BY_SECTION = { body: 'arc', mind: 'rings', soul: 'clock', inflammation: 'heat' };
function gaugeType(id){ return GAUGE_BY_SECTION[id] || 'arc'; }

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
    const each = (sweep - gap * (n - 1)) / n;
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
        <stop offset="0" stop-color="#ff7a59"/><stop offset="1" stop-color="#0339f8"/>
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
        `color-mix(in srgb, #0339f8 ${Math.round(ratio * 100)}%, #ff7a59)`);
    }
  }

  svg.classList.toggle('full', total > 0 && done === total);
}

function tap(pattern){ if(navigator.vibrate) navigator.vibrate(pattern); }

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

/* ============================================================
   Build once, then patch. Rebuilding the DOM per tap would
   restart every entrance animation and cut transitions short.
   ============================================================ */
const el = {};
let ledgerView = (() => {
  try{ return localStorage.getItem('kd-fit:view') || '28'; }catch(e){ return '28'; }
})();

function build(){
  const bday = birthdayDate();

  const sections = config.daily.map((sec, i) => `
    <section class="card rise" style="animation-delay:${300 + i * 70}ms" data-section="${sec.id}">
      <div class="card-head">
        <div class="card-headings">
          <h2 class="card-title">${escapeHtml(sec.title)}</h2>
          <div class="card-count" data-count><b>0</b>/${sec.items.length}</div>
        </div>
        <div class="gauge" data-gauge>${buildGauge(gaugeType(sec.id), sec.items.length, sec.id)}</div>
      </div>
      ${sec.items.map(it => `
        <div class="item" data-id="${it.id}" role="checkbox" aria-checked="false" tabindex="0">
          <div class="box">${checkMark()}</div>
          <div class="item-label">${escapeHtml(it.label)}</div>
        </div>`).join('')}
    </section>`).join('');

  const trainingRows = config.training.map(t => `
    <div class="train" data-id="${t.id}" role="checkbox" aria-checked="false" tabindex="0">
      <div class="box">${checkMark()}</div>
      <div class="train-body">
        <div class="train-label">${escapeHtml(t.label)}</div>
        <div class="train-sub" data-train-sub>0/${t.target} this week</div>
      </div>
      <div class="pips" data-pips></div>
    </div>`).join('');

  const delay = 300 + config.daily.length * 70;

  document.getElementById('app').innerHTML = `
    <header class="masthead rise">
      <div class="brand">
        ${KD_MARK}
        <div class="label">Performance Log</div>
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
        </svg>
        <div class="dial-face">
          <div class="dial-num num" data-days>${REDUCED_MOTION ? daysUntilBirthday() : 0}</div>
          <div class="dial-unit">Days to <em>40.</em></div>
          <div class="dial-date">${bday.toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })}</div>
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

    <section class="card rise" style="animation-delay:${delay}ms" data-training>
      <div class="card-head">
        <div class="card-headings">
          <h2 class="card-title">Training</h2>
          <div class="card-count" data-week-count><b>0</b>/0 this week</div>
        </div>
        <div class="gauge" data-week-gauge>${
          buildGauge('arc', config.training.reduce((n, t) => n + t.target, 0) || 1, 'train')
        }</div>
      </div>
      ${trainingRows}
    </section>

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
  el.streak = document.querySelector('[data-streak]');
  el.rate = document.querySelector('[data-rate]');
  el.best = document.querySelector('[data-best]');
  el.ledgerBody = document.querySelector('[data-ledger-body]');
  el.ledgerLabel = document.querySelector('[data-ledger-label]');
  el.notifStatus = document.querySelector('[data-notif-status]');
  el.note = document.querySelector('[data-note]');
  el.weekCount = document.querySelector('[data-week-count]');
  el.weekGauge = document.querySelector('[data-week-gauge]');
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

/* ---------- ledger ---------- */
function buildLedger(){
  document.querySelectorAll('[data-view]').forEach(b =>
    b.classList.toggle('is-active', b.dataset.view === ledgerView));

  if(ledgerView === 'year') buildYear();
  else buildTally();
}

function buildTally(){
  const days = recentHistory();
  const tKey = dayKey();

  el.ledgerLabel.textContent = 'Last 28 days';
  el.ledgerBody.innerHTML = `<div class="tally-row" data-tally>${
    days.map((d, i) => {
      const ratio = d.total ? Math.min(d.done / d.total, 1) : 0;
      const cls = ['tally'];
      if(d.key === tKey) cls.push('today');
      if(isGoodDay(d)) cls.push('full');
      else if(d.done > 0) cls.push('partial');
      const label = d.date.toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' });
      return `<div class="${cls.join(' ')}" data-day="${d.key}"
        style="height:${38 + ratio * 62}%;${REDUCED_MOTION ? '' : `animation:kd-tally-in 0.5s var(--kd-ease) ${320 + i * 14}ms both`}"
        title="${label} — ${d.done}/${d.total}"></div>`;
    }).join('')
  }</div>`;
  el.tally = document.querySelector('[data-tally]');
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
    </div>`;

  // Land on today rather than a year ago.
  const wrap = document.querySelector('[data-year-wrap]');
  if(wrap) wrap.scrollLeft = wrap.scrollWidth;
  el.tally = null;
}

/* ---------- sync ---------- */
function sync(){
  const total = dailyTotal();
  const done = dailyDone(today);
  const ratio = total ? done / total : 0;
  const complete = total > 0 && done === total;

  const offset = CIRC * (1 - ratio);
  el.prog.style.strokeDashoffset = offset;
  el.glow.style.strokeDashoffset = offset;

  el.status.textContent = complete ? 'Day complete' : `Today ${done}/${total}`;
  document.body.classList.toggle('is-complete', complete);

  config.daily.forEach(sec => {
    const card = document.querySelector(`[data-section="${sec.id}"]`);
    if(!card) return;
    const n = sec.items.filter(it => today[it.id]).length;
    card.querySelector('[data-count]').innerHTML = `<b>${n}</b>/${sec.items.length}`;
    syncGauge(card.querySelector('[data-gauge]'), gaugeType(sec.id), n, sec.items.length);
  });

  el.items.forEach(node => {
    const on = !!today[node.dataset.id];
    node.classList.toggle('done', on);
    node.setAttribute('aria-checked', String(on));
  });

  // training — weekly
  const week = trainingWeek();
  const prog = trainingProgress(week);
  el.weekCount.innerHTML = `<b>${prog.hit}</b>/${prog.target} this week`;
  syncGauge(el.weekGauge, 'arc', prog.hit, prog.target);

  el.trains.forEach(node => {
    const t = week.find(x => x.id === node.dataset.id);
    if(!t) return;
    node.classList.toggle('done', t.todayOn);
    node.classList.toggle('hit', t.count >= t.target);
    node.setAttribute('aria-checked', String(t.todayOn));
    node.querySelector('[data-train-sub]').textContent =
      t.count >= t.target ? `Target met — ${t.count}/${t.target}` : `${t.count}/${t.target} this week`;
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

function syncNotifStatus(){
  if(!el.notifStatus) return;
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
  sync();
  const nowComplete = document.body.classList.contains('is-complete');

  if(nowComplete && !wasComplete) tap([14, 60, 14, 60, 26]);
  else tap(wasOn ? 8 : 14);
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

  document.querySelectorAll('[data-view]').forEach(b =>
    b.addEventListener('click', () => {
      ledgerView = b.dataset.view;
      try{ localStorage.setItem('kd-fit:view', ledgerView); }catch(e){ /* ignore */ }
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

function sheetMarkup(){
  const sections = config.daily.map((sec, si) => `
    <div class="sub-head">
      <input class="input" data-section-title="${si}" value="${escapeHtml(sec.title)}" aria-label="Section name">
      <button class="add" type="button" data-add-item="${si}">+ Habit</button>
    </div>
    ${sec.items.map((it, ii) => `
      <div class="field">
        <input class="input" data-item="${si}.${ii}" value="${escapeHtml(it.label)}" aria-label="Habit">
        <button class="remove" type="button" data-del-item="${si}.${ii}" aria-label="Remove habit">&times;</button>
      </div>`).join('')}
  `).join('');

  const training = config.training.map((t, i) => `
    <div class="field">
      <input class="input" data-train="${i}" value="${escapeHtml(t.label)}" aria-label="Activity">
      <input class="input narrow" data-train-target="${i}" type="number" min="1" max="14"
             value="${t.target}" aria-label="Times per week" inputmode="numeric">
      <button class="remove" type="button" data-del-train="${i}" aria-label="Remove activity">&times;</button>
    </div>`).join('');

  const sub = read('kd-fit:push', null);

  return `
  <div class="sheet-inner">
    <div class="sheet-head">
      <div class="sheet-title">Settings</div>
      <button class="btn" type="button" data-close>Done</button>
    </div>

    <div class="group">
      <div class="label">The date</div>
      <input class="input" type="date" data-birthday value="${escapeHtml(config.birthday)}">
      <div class="group-note">Everything counts down to this.</div>
    </div>

    <div class="group">
      <div class="label">Daily habits</div>
      ${sections}
      <div class="group-note">
        These drive the ring, the streak and the ledger. Renaming keeps the
        history attached; removing a habit leaves its past ticks in place but
        stops counting it.
      </div>
    </div>

    <div class="group">
      <div class="sub-head">
        <div class="label">Training — times per week</div>
        <button class="add" type="button" data-add-train>+ Activity</button>
      </div>
      ${training}
      <div class="group-note">
        Weekly targets, not daily boxes — a rest day can't break a streak.
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

function pushMarkup(sub){
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

  q('[data-export]').addEventListener('click', exportBackup);
  q('[data-import]').addEventListener('click', () => q('[data-import-file]').click());
  q('[data-import-file]').addEventListener('change', e => importBackup(e.target.files[0]));

  q('[data-reset]').addEventListener('click', () => {
    config = structuredClone(DEFAULT_CONFIG);
    saveConfig(); reopen(); toast('Settings reset');
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
    reg.showNotification('40', { body: 'This is what the daily nudge looks like.', icon: 'icons/icon-192.png' });
  });
}

function newId(){ return 'i' + Math.random().toString(36).slice(2, 8); }

// Read the sheet's inputs back into config without touching the DOM order.
function collect(sheet){
  const bday = sheet.querySelector('[data-birthday]');
  if(bday && bday.value) config.birthday = bday.value;

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
  countUp(el.days, daysUntilBirthday());
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
  countUp(el.days, daysUntilBirthday());
}
document.addEventListener('visibilitychange', () => { if(!document.hidden) checkRollover(); });

/* ---------- boot ---------- */
migrate();
config = loadConfig(); // migrate may have rewritten it
today = getDay(dayKey());
build();
sync();
countUp(el.days, daysUntilBirthday());

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

if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.error('SW failed', err));
  });
}
