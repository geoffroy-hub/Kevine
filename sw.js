// ============================================================
//  Service Worker — Kevine Anniversaire v4
//  Corrigé : fonctionne sur iOS Safari + Android + tous navigateurs
// ============================================================

const CACHE_NAME  = 'kevine-aniv-v4';
const FONTS_CACHE = 'kevine-fonts-v4';

// Liste COMPLÈTE de tous les assets à pré-cacher
const LOCAL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/detect-devtools.js',
  '/css/style.css',
  '/fonts/css.css',
  '/fonts/local.css',
  '/fonts/google-local.css',
  '/js/script.js',
  '/js/Stage.js',
  '/js/MyMath.js',
  '/js/fscreen.js',
  '/images/og-image.png',
  '/images/icon-192.png',
  '/images/icon-512.png',
  '/images/screen.png',
  '/images/b1.webp',
  '/images/b2.webp',
  '/images/b3.webp',
  '/images/b4.webp',
  '/images/b5.webp',
  '/images/b6.webp',
  '/images/b7.webp',
  '/images/b8.webp',
  '/images/b9.webp',
  '/images/b10.webp',
  '/images/b11.webp',
  '/images/b12.webp',
  '/images/b13.webp',
  '/images/b14.webp',
  '/images/b15.webp',
  '/audio/burst1.mp3',
  '/audio/burst2.mp3',
  '/audio/burst-sm-1.mp3',
  '/audio/burst-sm-2.mp3',
  '/audio/crackle1.mp3',
  '/audio/crackle-sm-1.mp3',
  '/audio/lift1.mp3',
  '/audio/lift2.mp3',
  '/audio/lift3.mp3',
  '/music/music.mp3'
];

// ---- Message handler (pour SKIP_WAITING depuis la page) ----
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ---- INSTALLATION : pré-cache TOUT en parallèle ----
self.addEventListener('install', event => {
  console.log('[SW v4] Installation...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // On utilise allSettled pour qu'un fichier manquant ne bloque pas tout
      return Promise.allSettled(
        LOCAL_ASSETS.map(url =>
          cache.add(url).catch(err => {
            console.warn('[SW] Échec cache:', url, err.message);
          })
        )
      );
    }).then(() => {
      console.log('[SW v4] Pré-cache terminé');
      // skipWaiting immédiat : le SW prend le contrôle sans attendre
      return self.skipWaiting();
    })
  );
});

// ---- ACTIVATION : supprime tous les anciens caches ----
self.addEventListener('activate', event => {
  console.log('[SW v4] Activation...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== FONTS_CACHE)
          .map(k => {
            console.log('[SW] Suppression ancien cache:', k);
            return caches.delete(k);
          })
      )
    ).then(() => {
      console.log('[SW v4] Activation terminée — contrôle de tous les clients');
      // claim() immédiat : prend le contrôle de TOUTES les pages ouvertes
      return self.clients.claim();
    })
  );
});

// ---- FETCH : stratégie selon la ressource ----
self.addEventListener('fetch', event => {
  // Ignorer les requêtes non-GET
  if (event.request.method !== 'GET') return;

  // Ignorer les requêtes non-HTTP (extensions, etc.)
  if (!event.request.url.startsWith('http')) return;

  const url = new URL(event.request.url);

  // Google Fonts → Cache-First
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(handleFonts(event.request));
    return;
  }

  // Ressources externes (CDN) → Network-First avec fallback cache
  if (url.hostname !== self.location.hostname) {
    event.respondWith(handleExternal(event.request));
    return;
  }

  // Assets locaux → Cache-First (instantané + hors ligne garanti)
  event.respondWith(handleLocal(event.request));
});

// ---- Cache-First pour Google Fonts ----
async function handleFonts(request) {
  const cache = await caches.open(FONTS_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return new Response('/* police hors ligne */', {
      headers: { 'Content-Type': 'text/css' }
    });
  }
}

// ---- Network-First pour CDN externes ----
async function handleExternal(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached || new Response('', { status: 503 });
  }
}

// ---- Cache-First pour assets locaux ----
async function handleLocal(request) {
  const cache = await caches.open(CACHE_NAME);

  // 1. Chercher dans le cache
  const cached = await cache.match(request);
  if (cached) return cached;

  // 2. Essayer aussi avec l'URL normalisée (iOS parfois envoie des URLs avec query string)
  const urlWithoutQuery = request.url.split('?')[0];
  if (urlWithoutQuery !== request.url) {
    const cachedClean = await cache.match(urlWithoutQuery);
    if (cachedClean) return cachedClean;
  }

  // 3. Pas en cache → réseau
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Hors ligne et pas en cache
    if (request.mode === 'navigate') {
      // Retourner index.html pour toute navigation
      return (
        await cache.match('/index.html') ||
        await cache.match('/') ||
        new Response(
          '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Hors ligne</title></head>' +
          '<body style="background:#000820;color:#FFD700;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;text-align:center;">' +
          '<div><div style="font-size:3rem">🎂</div><p>Visite le site une fois avec internet<br>pour l\'activer hors ligne.</p></div>' +
          '</body></html>',
          { status: 200, headers: { 'Content-Type': 'text/html' } }
        )
      );
    }
    return new Response('', { status: 503 });
  }
}
