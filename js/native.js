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

  const REMINDER_ID = 4040;

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

  // repeats:true with an `on` pattern means the OS owns the schedule —
  // it keeps firing daily without the app ever being opened.
  async function scheduleDaily(hour, minute){
    if(!isNative || !ln()) return false;
    const permission = await reminderPermission();
    if(permission !== 'granted') return false;
    try{
      await ln().cancel({ notifications: [{ id: REMINDER_ID }] });
      await ln().schedule({
        notifications: [{
          id: REMINDER_ID,
          title: '40',
          body: LINES[new Date().getDate() % LINES.length],
          schedule: { on: { hour, minute }, allowWhileIdle: true, repeats: true },
          smallIcon: 'ic_stat_icon'
        }]
      });
      return true;
    }catch(e){ return false; }
  }

  async function cancelDaily(){
    if(!isNative || !ln()) return;
    try{ await ln().cancel({ notifications: [{ id: REMINDER_ID }] }); }
    catch(e){ /* nothing scheduled */ }
  }

  async function reminderPending(){
    if(!isNative || !ln()) return false;
    try{
      const list = await ln().getPending();
      return (list.notifications || []).some(n => n.id === REMINDER_ID);
    }catch(e){ return false; }
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
    ready
  };
})(window);
