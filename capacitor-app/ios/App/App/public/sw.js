// SleepTransit Service Worker (Lightweight Mobile-Safe Strategy — v142)
const CACHE_NAME = 'sleeptransit-v145';
const DATA_CACHE = 'sleeptransit-data-v2';
const MAX_DATA_CACHE_ENTRIES = 80;

// Pré-cache ultra-léger à l'installation pour ne pas ralentir l'ouverture initiale
// (idfm-transfers.json et idfm-carriage-positions.json sont mis en cache automatiquement à la première demande)
const CORE_ASSETS = [
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './styles.css',
  './transit-data.js'
];

function isTransientApiUrl(urlStr) {
  return (
    urlStr.includes('api.transitous.org') ||
    urlStr.includes('/api/plan') ||
    urlStr.includes('/api/v1/') ||
    urlStr.includes('prim.iledefrance-mobilites.fr') ||
    urlStr.includes('api-adresse.data.gouv.fr') ||
    urlStr.includes('photon.komoot.io') ||
    urlStr.includes('nominatim.openstreetmap.org') ||
    urlStr.includes('corsproxy.io') ||
    urlStr.includes('allorigins.win') ||
    urlStr.includes('maps.googleapis.com') ||
    urlStr.includes('router.project-osrm.org') ||
    urlStr.includes('routing.openstreetmap.de')
  );
}

function isMapDataOrTileUrl(urlStr) {
  return (
    urlStr.includes('idfm-bus-traces.json') ||
    urlStr.includes('data.iledefrance-mobilites.fr') ||
    urlStr.includes('server.arcgisonline.com') ||
    urlStr.includes('tile.openstreetmap.org') ||
    urlStr.includes('basemaps.cartocdn.com') ||
    urlStr.includes('opendata.paris.fr') ||
    urlStr.includes('france-geojson')
  );
}

async function trimDataCacheIfNeeded(cache) {
  try {
    const keys = await cache.keys();
    if (keys.length > MAX_DATA_CACHE_ENTRIES) {
      const overflow = keys.length - MAX_DATA_CACHE_ENTRIES;
      await Promise.all(keys.slice(0, overflow).map((k) => cache.delete(k)));
    }
  } catch (e) {}
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        CORE_ASSETS.map((assetUrl) =>
          fetch(assetUrl)
            .then((resp) => (resp && resp.status === 200 ? cache.put(assetUrl, resp) : null))
            .catch(() => null)
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== DATA_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) return;
  const reqUrl = event.request.url;

  if (isTransientApiUrl(reqUrl)) {
    return;
  }

  if (isMapDataOrTileUrl(reqUrl)) {
    event.respondWith(
      caches.open(DATA_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const resp = await fetch(event.request);
          if (resp && resp.status === 200) {
            cache.put(event.request, resp.clone()).then(() => trimDataCacheIfNeeded(cache));
          }
          return resp;
        } catch (e) {
          return new Response('Hors ligne', { status: 503, statusText: 'Offline' });
        }
      })
    );
    return;
  }

  if (reqUrl.includes('/idfm-transfers.json') || reqUrl.includes('/idfm-carriage-positions.json') || reqUrl.includes('/styles.css') || reqUrl.includes('/transit-data.js') || reqUrl.includes('/manifest.json') || reqUrl.includes('/icon-192.png') || reqUrl.includes('/icon-512.png')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request, { ignoreSearch: true });
        if (cached) return cached;
        try {
          const resp = await fetch(event.request);
          if (resp && resp.status === 200) {
            cache.put(event.request, resp.clone());
          }
          return resp;
        } catch (e) {
          return new Response('{}', { status: 503, headers: { 'Content-Type': 'application/json' } });
        }
      })
    );
    return;
  }

  const isHtmlNav =
    event.request.mode === 'navigate' ||
    reqUrl.endsWith('/') ||
    reqUrl.includes('/index.html');

  if (isHtmlNav) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(async () => {
        const cached = (await caches.match(event.request)) || (await caches.match('./index.html'));
        return cached || new Response('Hors ligne', { status: 503, statusText: 'Offline' });
      })
    );
    return;
  }
});


// === v104 LOCK-SCREEN NOTIFICATIONS (WAKE & TRAFFIC ALERTS) ===
const scheduledSwTimers = new Map();

function buildWakeNotifOptions(payload) {
  const isUrgent = payload && (payload.urgent || payload.stage === 2);
  return {
    body: (payload && payload.body) || 'Votre arrêt approche — préparez-vous à descendre !',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: (payload && payload.tag) || 'sleeptransit-wake',
    renotify: true,
    requireInteraction: true,
    silent: Boolean(payload && payload.silent),
    vibrate: isUrgent ? [400, 150, 400, 150, 600] : [200, 100, 200],
    data: {
      url: './',
      station: (payload && payload.station) || '',
      stage: (payload && payload.stage) || 2
    },
    actions: [
      { action: 'wake_ack', title: '✅ Je suis réveillé' },
      { action: 'snooze_2m', title: '⏰ Rappel +2 min' }
    ]
  };
}

function scheduleSwWakeNotification(payload) {
  const id = (payload && payload.id) || 'default_wake';
  if (scheduledSwTimers.has(id)) {
    clearTimeout(scheduledSwTimers.get(id));
    scheduledSwTimers.delete(id);
  }
  const delayMs = Math.max(0, Number((payload && payload.delayMs) || 0));
  const title = (payload && payload.title) || '🔔 SleepTransit — Réveil';
  const opts = buildWakeNotifOptions(payload);

  if (delayMs === 0) {
    return self.registration.showNotification(title, opts);
  }
  const timerId = setTimeout(() => {
    scheduledSwTimers.delete(id);
    self.registration.showNotification(title, opts).catch(() => {});
  }, delayMs);
  scheduledSwTimers.set(id, timerId);
  return Promise.resolve();
}

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SCHEDULE_WAKE_NOTIFICATION' || data.type === 'SEND_IMMEDIATE_NOTIFICATION') {
    const payload = data.type === 'SEND_IMMEDIATE_NOTIFICATION'
      ? Object.assign({}, data.payload, { delayMs: 0 })
      : data.payload;
    event.waitUntil(scheduleSwWakeNotification(payload));
  } else if (data.type === 'CANCEL_WAKE_NOTIFICATION') {
    const id = data.id || 'default_wake';
    if (scheduledSwTimers.has(id)) {
      clearTimeout(scheduledSwTimers.get(id));
      scheduledSwTimers.delete(id);
    }
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notifData = (event.notification && event.notification.data) || {};
  if (event.action === 'snooze_2m') {
    event.waitUntil(
      scheduleSwWakeNotification({
        id: 'snooze_wake',
        delayMs: 120000,
        title: '🔔 SleepTransit — Rappel +2 min !',
        body: notifData.station
          ? `Réveil rappel : descendez bientôt à ${notifData.station} !`
          : 'Rappel de réveil SleepTransit !',
        station: notifData.station || '',
        urgent: true,
        stage: 2
      })
    );
    return;
  }
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('./');
    })
  );
});
