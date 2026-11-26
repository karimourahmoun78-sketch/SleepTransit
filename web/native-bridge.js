// SleepTransit Native Capacitor Bridge (Android & iOS)
// Active uniquement dans l'application native ; totalement inactif sur navigateur Web / PWA.
(function () {
  const Cap = typeof window !== 'undefined' ? window.Capacitor : null;
  const isNative = Boolean(Cap && typeof Cap.isNativePlatform === 'function' && Cap.isNativePlatform());

  const state = {
    isNative,
    bgWatcherId: null,
    notifChannelReady: false,
    fallbackNotifId: 77001,
    nextNotifId: 77100
  };

  function getPlugins() {
    return (Cap && Cap.Plugins) ? Cap.Plugins : {};
  }

  async function ensureNativeNotificationChannel() {
    if (!isNative) return false;
    const { LocalNotifications } = getPlugins();
    if (!LocalNotifications) return false;
    try {
      const perm = await LocalNotifications.checkPermissions();
      if (perm && perm.display !== 'granted') {
        await LocalNotifications.requestPermissions();
      }
      if (!state.notifChannelReady && typeof LocalNotifications.createChannel === 'function') {
        await LocalNotifications.createChannel({
          id: 'sleeptransit_alarm',
          name: 'Alertes de descente & Réveil SleepTransit',
          description: 'Notifications haute priorité pour vous réveiller avant votre arrêt',
          importance: 5,
          visibility: 1,
          vibration: true,
          lights: true,
          lightColor: '#3B82F6',
          sound: 'default'
        });
        state.notifChannelReady = true;
      }
      return true;
    } catch (e) {
      console.warn('[SleepTransitNative] Notification init error:', e);
      return false;
    }
  }

  async function sendNativeNotification(title, body, opts = {}) {
    if (!isNative) return { delivered: false, channel: 'web' };
    const { LocalNotifications, Haptics } = getPlugins();
    if (!LocalNotifications) return { delivered: false, channel: 'missing_plugin' };
    await ensureNativeNotificationChannel();

    const id = Number.isFinite(opts.nativeId) ? opts.nativeId : (++state.nextNotifId);
    const delayMs = Math.max(0, Number(opts.delayMs || 0));
    const scheduleAt = new Date(Date.now() + Math.max(500, delayMs));

    try {
      await LocalNotifications.schedule({
        notifications: [{
          id,
          title: title || '🔔 SleepTransit — Réveil',
          body: body || 'Votre arrêt approche ! Préparez-vous à descendre.',
          channelId: 'sleeptransit_alarm',
          schedule: { at: scheduleAt, allowWhileIdle: true },
          sound: opts.silent ? undefined : 'default',
          smallIcon: 'ic_stat_sleeptransit',
          actionTypeId: '',
          extra: { station: opts.station || '', urgent: Boolean(opts.urgent) }
        }]
      });
      if (opts.urgent && delayMs === 0 && Haptics && typeof Haptics.vibrate === 'function') {
        try { await Haptics.vibrate({ duration: 900 }); } catch (e) {}
      }
      return { delivered: true, channel: 'capacitor_local_notifications', id, delayMs };
    } catch (e) {
      console.warn('[SleepTransitNative] schedule notification error:', e);
      return { delivered: false, channel: 'capacitor_error' };
    }
  }

  async function scheduleFallbackArrivalAlarm(route, leadMin = 2) {
    if (!isNative || !route) return;
    const { LocalNotifications } = getPlugins();
    if (!LocalNotifications) return;
    try {
      await LocalNotifications.cancel({ notifications: [{ id: state.fallbackNotifId }] });
    } catch (e) {}

    let arrMs = Number(route.arrMs || 0);
    if (!arrMs && route.arrTime && typeof route.arrTime === 'string' && route.arrTime.includes(':')) {
      const [h, m] = route.arrTime.split(':').map(Number);
      if (Number.isFinite(h) && Number.isFinite(m)) {
        const d = new Date();
        d.setHours(h, m, 0, 0);
        if (d.getTime() < Date.now() - 5 * 60000) d.setDate(d.getDate() + 1);
        arrMs = d.getTime();
      }
    }
    if (!arrMs || arrMs <= Date.now() + 60000) return;

    const triggerMs = Math.max(Date.now() + 15000, arrMs - Math.max(1, Number(leadMin || 2)) * 60000);
    const delayMs = triggerMs - Date.now();
    const destName = (route.destName || route.destination || 'votre destination');
    await sendNativeNotification(
      `🔔 SleepTransit — Descente proche (${destName})`,
      `Arrivée prévue dans ~${leadMin} min (${route.arrTime || ''}). Préparez-vous à descendre !`,
      { nativeId: state.fallbackNotifId, delayMs, urgent: true, station: destName }
    );
  }

  async function cancelFallbackArrivalAlarm() {
    if (!isNative) return;
    const { LocalNotifications } = getPlugins();
    if (!LocalNotifications) return;
    try {
      await LocalNotifications.cancel({ notifications: [{ id: state.fallbackNotifId }] });
    } catch (e) {}
  }

  async function startBackgroundGps(routeLabel = '') {
    if (!isNative) return false;
    const { BackgroundGeolocation } = getPlugins();
    if (!BackgroundGeolocation || typeof BackgroundGeolocation.addWatcher !== 'function') return false;

    await ensureNativeNotificationChannel();
    if (state.bgWatcherId) {
      await stopBackgroundGps();
    }
    try {
      state.bgWatcherId = await BackgroundGeolocation.addWatcher(
        {
          backgroundTitle: '🌙 SleepTransit — Suivi en cours',
          backgroundMessage: routeLabel
            ? `GPS actif en arrière-plan • ${routeLabel}`
            : 'GPS actif en arrière-plan pour votre alarme de descente',
          requestPermissions: true,
          stale: false,
          distanceFilter: 25
        },
        (location, error) => {
          if (error) {
            if (error.code === 'NOT_AUTHORIZED' && typeof BackgroundGeolocation.openSettings === 'function') {
              console.warn('[SleepTransitNative] Background location permission not authorized');
            }
            return;
          }
          if (!location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) return;
          const acc = Math.round(location.accuracy || 15);
          const spd = location.speed != null ? Math.round(Math.max(0, location.speed) * 3.6) : 0;
          if (typeof window.processLocationAndWakeupDecision === 'function') {
            window.processLocationAndWakeupDecision(location.latitude, location.longitude, acc, spd, false);
          }
          if (typeof window.persistAndRenderGpsMascot === 'function') {
            window.persistAndRenderGpsMascot(location.latitude, location.longitude, acc);
          }
        }
      );
      return true;
    } catch (e) {
      console.warn('[SleepTransitNative] BackgroundGeolocation start error:', e);
      return false;
    }
  }

  async function stopBackgroundGps() {
    if (!isNative) return;
    const { BackgroundGeolocation } = getPlugins();
    if (state.bgWatcherId && BackgroundGeolocation && typeof BackgroundGeolocation.removeWatcher === 'function') {
      try {
        await BackgroundGeolocation.removeWatcher({ id: state.bgWatcherId });
      } catch (e) {}
    }
    state.bgWatcherId = null;
    await cancelFallbackArrivalAlarm();
  }

  window.SleepTransitNative = {
    isNative,
    ensureNativeNotificationChannel,
    sendNativeNotification,
    scheduleFallbackArrivalAlarm,
    cancelFallbackArrivalAlarm,
    startBackgroundGps,
    stopBackgroundGps
  };

  if (isNative) {
    document.addEventListener('DOMContentLoaded', () => {
      ensureNativeNotificationChannel();
    });
  }
})();
