/* ShopSmart — Service Worker.
 * - Pré-cache do app (shell) versionado: a nova versão só assume quando o usuário aceitar a atualização.
 * - Nunca toca no IndexedDB/localStorage: atualizar o app não apaga dados nem interrompe uma compra em andamento.
 * - Cache de runtime (catálogo de produtos e motor OCR) é preservado entre versões.
 */
const VERSION = '8535e75dc29f'
const SHELL_CACHE = `shopsmart-shell-${VERSION}`
const RUNTIME_CACHE = 'shopsmart-runtime-v1'
const PRECACHE = ["assets/AnimatedNumber-D4TMDQDw.js", "assets/Catalog-BkX7-wG2.js", "assets/Charts-DZrnz-aS.js", "assets/Comparator-EMKsxfxv.js", "assets/Finance-C56cFo4J.js", "assets/FuelCalc-D3-Kzlm0.js", "assets/Home-CNJHPegO.js", "assets/Lists-Bh069eyd.js", "assets/Page-BDBJGBqi.js", "assets/Purchases-BMMygxCd.js", "assets/Settings-Bgb3riKN.js", "assets/Sheet-CqMeNIO0.js", "assets/Shop-j9QAR3bP.js", "assets/SmartCapture-JDtl8_Q9.js", "assets/UnitCalc-BUlLSeEW.js", "assets/dates-waE83WNH.js", "assets/decode-D5pDNuwq.js", "assets/download-DecS7t1q.js", "assets/engine-BAZqA7Fi.js", "assets/finance-Dwx_Ehjo.js", "assets/index-B9Om_X5P.css", "assets/index-DKXmaMMv.js", "assets/lookup-BFURfXf7.js", "assets/prices-DnNGY-jR.js", "assets/src-IM7fgiv4.js", "assets/useLocalStorage-Cq20jf0-.js", "favicon.svg", "icons/apple-touch-icon.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "index.html", "manifest.webmanifest"]
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
