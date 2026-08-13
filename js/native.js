/* ============================================================
   Platform layer.

   The same codebase runs three ways: a browser tab, an installed
   PWA, and a native shell via Capacitor. This is the only file that
   knows the difference — everything else calls KDNative and gets the
   best available implementation.

   Two things are genuinely better natively:

     Haptics — navigator.vibrate does not exist on iOS Safari at all,
     so every haptic in the PWA is a no-op on iPhone. The Capacitor
     plugin talks to the Taptic Engine properly.

     Reminders — a local notification scheduled on the device fires on
     time, offline, with no server, no VAPID keys and no subscription
     to keep alive. It replaces the whole web-push arrangement.
   ============================================================ */
(function (global) {
  'use strict';

  const cap = global.Capacitor;
  const isNative = !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
  const plugins = (cap && cap.Plugins) || {};
  const platform = (cap && typeof cap.getPlatform === 'function') ? cap.getPlatform() : 'web';

  /* One notification id per reminder, allocated from a fixed base so
     they can all be cancelled without knowing what was scheduled. Eight
     a day is well past useful and keeps the id range predictable. */
  const REMINDER_ID = 4040;
  const MAX_REMINDERS = 8;
  const reminderIds = () =>
    Array.from({ length: MAX_REMINDERS }, (_, i) => REMINDER_ID + i);

  /* ---------- haptics ---------- */
  const WEB_PATTERNS = { light: 8, tick: 14, success: [14, 60, 14, 60, 26] };

  async function haptic(kind){
    if(isNative && plugins.Haptics){
      try{
        if(kind === 'success') await plugins.Haptics.notification({ type: 'SUCCESS' });
        else await plugins.Haptics.impact({ style: kind === 'light' ? 'LIGHT' : 'MEDIUM' });
        return;
      }catch(e){ /* fall through to the web path */ }
    }
    // No-op on iOS Safari — the API simply isn't there.
    if(global.navigator.vibrate) global.navigator.vibrate(WEB_PATTERNS[kind] || 14);
  }

  /* ---------- local notifications ---------- */
  function ln(){ return plugins.LocalNotifications; }

  const LINES = [
    'Log the day before it resets.',
    'Small thing, done again.',
    'Consistency over intensity.',
    "Today's the one you control.",
    'Close the ring.'
  ];

  async function reminderPermission(){
    if(!isNative || !ln()) return 'unsupported';
    try{
      let res = await ln().checkPermissions();
      if(res.display === 'prompt' || res.display === 'prompt-with-rationale'){
        res = await ln().requestPermissions();
      }
      return res.display; // 'granted' | 'denied' | 'prompt'
    }catch(e){ return 'denied'; }
  }

  /* repeats:true with an `on` pattern means the OS owns the schedule —
     it keeps firing daily without the app ever being opened.

     Takes a list of times so a day can have several nudges: a morning
     one to set up and an evening one to log are a different job. Every
     id is cancelled first, so removing a time actually removes it
     rather than leaving an orphan firing forever. */
  async function scheduleDaily(times){
    if(!isNative || !ln()) return false;
    // tolerate the old (hour, minute) call signature
    if(typeof times === 'number') times = [{ hour: arguments[0], minute: arguments[1] }];
    if(!Array.isArray(times) || !times.length) return false;

    const permission = await reminderPermission();
    if(permission !== 'granted') return false;

    try{
      await cancelDaily();
      const list = times.slice(0, MAX_REMINDERS).map((t, i) => ({
        id: REMINDER_ID + i,
        title: 'Jotara',
        // Stagger the copy so two reminders on one day don't read as a
        // duplicate notification.
        body: LINES[(new Date().getDate() + i) % LINES.length],
        schedule: { on: { hour: t.hour, minute: t.minute }, allowWhileIdle: true, repeats: true },
        smallIcon: 'ic_stat_icon'
      }));
      await ln().schedule({ notifications: list });
      return true;
    }catch(e){ return false; }
  }

  async function cancelDaily(){
    if(!isNative || !ln()) return;
    try{ await ln().cancel({ notifications: reminderIds().map(id => ({ id })) }); }
    catch(e){ /* nothing scheduled */ }
  }

  async function reminderPending(){
    if(!isNative || !ln()) return false;
    try{
      const list = await ln().getPending();
      const ids = reminderIds();
      return (list.notifications || []).some(n => ids.includes(n.id));
    }catch(e){ return false; }
  }

  /* ============================================================
     Durable storage

     localStorage in a WKWebView is evictable — iOS can clear it under
     storage pressure, and for a habit log that means silently losing
     the only thing the app is for. Capacitor Preferences writes to
     NSUserDefaults instead, which is backed up and survives eviction.

     It is a mirror, not a replacement: localStorage stays the working
     store because it is synchronous and the whole app reads it that
     way. Every write is echoed here, and on boot anything missing
     locally is restored from the mirror.
     ============================================================ */
  function prefs(){ return plugins.Preferences; }
  const vaultAvailable = () => !!(isNative && prefs());

  async function vaultSet(key, value){
    if(!vaultAvailable()) return;
    try{ await prefs().set({ key, value }); }catch(e){ /* best effort */ }
  }
  async function vaultRemove(key){
    if(!vaultAvailable()) return;
    try{ await prefs().remove({ key }); }catch(e){ /* best effort */ }
  }

  /* Pull anything the mirror has that localStorage doesn't. Runs once
     at boot, before the app reads its config. Returns how many keys
     were recovered so the caller can decide whether to re-render. */
  async function vaultRestore(){
    if(!vaultAvailable()) return 0;
    try{
      const { keys } = await prefs().keys();
      let restored = 0;
      for(const key of keys){
        if(!key.startsWith('kd-fit:')) continue;
        if(global.localStorage.getItem(key) !== null) continue;
        const { value } = await prefs().get({ key });
        if(value === null || value === undefined) continue;
        global.localStorage.setItem(key, value);
        restored++;
      }
      return restored;
    }catch(e){ return 0; }
  }

  /* Copy everything currently local into the mirror — used the first
     time the vault is seen, so an install that predates it is covered
     rather than starting from whatever happens to be written next. */
  async function vaultSeed(){
    if(!vaultAvailable()) return;
    try{
      for(let i = 0; i < global.localStorage.length; i++){
        const key = global.localStorage.key(i);
        if(!key || !key.startsWith('kd-fit:')) continue;
        await vaultSet(key, global.localStorage.getItem(key));
      }
    }catch(e){ /* best effort */ }
  }

  /* ---------- chrome ---------- */
  async function ready(){
    if(!isNative) return;
    try{ await plugins.StatusBar?.setStyle({ style: 'DARK' }); }catch(e){ /* optional */ }
    try{ await plugins.SplashScreen?.hide(); }catch(e){ /* optional */ }
  }

  global.KDNative = {
    isNative,
    platform,
    haptic,
    scheduleDaily,
    cancelDaily,
    reminderPending,
    reminderPermission,
    ready,
    vaultAvailable,
    vaultSet,
    vaultRemove,
    vaultRestore,
    vaultSeed
  };
})(window);
