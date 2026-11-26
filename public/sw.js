/* ShopSmart — Service Worker.
 * - Pré-cache do app (shell) versionado: a nova versão só assume quando o usuário aceitar a atualização.
 * - Nunca toca no IndexedDB/localStorage: atualizar o app não apaga dados nem interrompe uma compra em andamento.
 * - Cache de runtime (catálogo de produtos e motor OCR) é preservado entre versões.
 */
const VERSION = '__SW_VERSION__'
const SHELL_CACHE = `shopsmart-shell-${VERSION}`
const RUNTIME_CACHE = 'shopsmart-runtime-v1'
const PRECACHE = [/*__PRECACHE__*/]
const SCOPE = self.registration.scope

const abs = (p) => new URL(p, SCOPE).href

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHE.map(abs))),
    // sem skipWaiting aqui: o app mostra "Atualização disponível" e o usuário decide
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k.startsWith('shopsmart-shell-') && k !== SHELL_CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})

const withTimeout = (p, ms) => new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('timeout')), ms)
  p.then((v) => { clearTimeout(t); res(v) }, (e) => { clearTimeout(t); rej(e) })
})

async function networkFirstShell(request) {
  const cache = await caches.open(SHELL_CACHE)
  try {
    const res = await withTimeout(fetch(request), 3500)
    if (res && res.ok) cache.put(abs('index.html'), res.clone())
    return res
  } catch {
    return (await cache.match(abs('index.html'))) || (await cache.match(abs('./'))) || Response.error()
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(request, { ignoreVary: true })
  if (hit) return hit
  const res = await fetch(request)
  if (res && res.ok) cache.put(request, res.clone())
  return res
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(request, { ignoreVary: true })
  const net = fetch(request).then((res) => { if (res && res.ok) cache.put(request, res.clone()); return res }).catch(() => null)
  return hit || (await net) || Response.error()
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // APIs externas (Open Food Facts etc.) vão direto à rede
  if (!url.href.startsWith(SCOPE)) return

  if (req.mode === 'navigate') {
    event.respondWith(networkFirstShell(req))
    return
  }
  const path = url.pathname.slice(new URL(SCOPE).pathname.length)
  if (path.startsWith('ocr/')) {
    event.respondWith(cacheFirst(req, RUNTIME_CACHE)) // motor OCR: baixado uma vez, depois funciona offline
    return
  }
  if (path.startsWith('catalog/')) {
    event.respondWith(staleWhileRevalidate(req, RUNTIME_CACHE))
    return
  }
  event.respondWith(
    caches.open(SHELL_CACHE).then(async (cache) => (await cache.match(req, { ignoreVary: true })) || staleWhileRevalidate(req, RUNTIME_CACHE)),
  )
})
