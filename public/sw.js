// 会場など電波の弱い場所でも開けるよう、アプリ本体をキャッシュする（動画は扱わない）
// GitHub Pagesはindex.html等にCache-Control: max-age=600を付けてくるため、
// ここでの fetch は毎回 no-store でブラウザのディスクキャッシュを素通りし、常に最新を取りにいく
const CACHE = 'golazo-v3'

self.addEventListener('install', () => self.skipWaiting())
// github.io は他アプリと同じオリジンなので、自分のキャッシュだけを消す
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => /^golazo-v\d+$/.test(k) && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()),
))

self.addEventListener('message', e => {
  if (e.data?.type === 'precache') e.waitUntil(caches.open(CACHE).then(c => c.addAll(e.data.urls)).catch(() => {}))
})

self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return
  if (req.mode === 'navigate') {
    // 画面は新しい版を優先し、つながらなければキャッシュ。no-storeでブラウザのディスクキャッシュを無視する
    e.respondWith(fetch(req, { cache: 'no-store' }).then(r => {
      const copy = r.clone()
      caches.open(CACHE).then(c => c.put(req, copy))
      return r
    }).catch(() => caches.match(req).then(r => r || caches.match('./'))))
    return
  }
  // ファイル名にハッシュが付かない sw.js / manifest 等も、ここで毎回ディスクキャッシュを無視して確かめる
  e.respondWith(caches.match(req).then(hit => hit || fetch(req, { cache: 'no-store' }).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)) }
    return r
  })))
})
