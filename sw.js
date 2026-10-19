/* ORBIT 서비스 워커: 온라인이면 항상 최신 파일을 쓰고, 오프라인이면 캐시로 열립니다. 설치형 앱(PWA) 요건도 충족합니다. */
const CACHE = "orbit-v2";
const SHELL = [
  "./", "./index.html", "./manifest.webmanifest",
  "./css/style.css",
  "./js/utils.js", "./js/store.js", "./js/sky.js", "./js/scene.js", "./js/mobile.js", "./js/panel.js", "./js/calendar.js", "./js/app.js",
  "./icons/icon.svg", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable-512.png", "./icons/apple-touch-icon.png",
];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(SHELL.map(u => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== CACHE + "-fonts").map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // 앱 파일: 네트워크 우선(항상 최신), 실패하면 캐시(오프라인)
    e.respondWith(fetch(req).then(res => { if (res.ok) caches.open(CACHE).then(c => c.put(req, res.clone())); return res; }).catch(() => caches.match(req).then(hit => hit || caches.match("./index.html"))));
  } else if (/fonts\.(googleapis|gstatic)\.com/.test(url.host)) {
    // 글꼴: 캐시 우선
    e.respondWith(caches.open(CACHE + "-fonts").then(async c => {
      const hit = await c.match(req); if (hit) return hit;
      try { const res = await fetch(req); if (res.ok) c.put(req, res.clone()); return res; } catch (err) { return new Response("", { status: 408 }); }
    }));
  }
});
