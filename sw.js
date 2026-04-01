// ============================================================
//  Service Worker — Kevine Anniversaire
//  Stratégie : Cache-First pour tous les assets locaux
//              + mise en cache automatique des Google Fonts
// ============================================================

const CACHE_NAME  = 'kevine-aniv-v2';
const FONTS_CACHE = 'kevine-fonts-v2';

const LOCAL_ASSETS = [
  '/', '/index.html', '/manifest.json',
  '/css/style.css', '/fonts/css.css', '/fonts/local.css',
  '/js/script.js', '/js/Stage.js', '/js/MyMath.js', '/js/fscreen.js',
  '/images/og-image.png', '/images/icon-192.png', '/images/icon-512.png', '/images/screen.png',
  '/images/b1.webp','/images/b2.webp','/images/b3.webp','/images/b4.webp','/images/b5.webp',
  '/images/b6.webp','/images/b7.webp','/images/b8.webp','/images/b9.webp','/images/b10.webp',
  '/images/b11.webp','/images/b12.webp','/images/b13.webp','/images/b14.webp','/images/b15.webp',
  '/audio/burst1.mp3','/audio/burst2.mp3','/audio/burst-sm-1.mp3','/audio/burst-sm-2.mp3',
  '/audio/crackle1.mp3','/audio/crackle-sm-1.mp3',
  '/audio/lift1.mp3','/audio/lift2.mp3','/audio/lift3.mp3',
  '/music/music.mp3'
];

// INSTALLATION — pré-cache tous les assets locaux
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(LOCAL_ASSETS.map(url =>
        cache.add(url).catch(e => console.warn('Cache miss:', url, e))
      ))
    ).then(() => self.skipWaiting())
  );
});

// ACTIVATION — supprime les anciens caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== FONTS_CACHE).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// FETCH — stratégie selon l'origine
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Google Fonts → Cache-First (mis en cache à la 1ère visite)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(handleFonts(event.request));
    return;
  }

  // CDN externes → Network-First avec fallback cache
  if (url.hostname !== self.location.hostname) {
    event.respondWith(handleExternal(event.request));
    return;
  }

  // Assets locaux → Cache-First
  event.respondWith(handleLocal(event.request));
});

async function handleFonts(request) {
  const cache = await caches.open(FONTS_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return new Response('/* hors ligne */', { headers: { 'Content-Type': 'text/css' } });
  }
}

async function handleExternal(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return await cache.match(request) || new Response('', { status: 503 });
  }
}

async function handleLocal(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    if (request.mode === 'navigate') {
      return await cache.match('/index.html') || new Response('Hors ligne', { status: 503 });
    }
    return new Response('', { status: 503 });
  }
}
