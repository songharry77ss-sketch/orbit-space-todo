/* ORBIT 서비스 워커: 온라인이면 항상 최신 파일, 오프라인이면 캐시로 열립니다. 설치형 앱(PWA) 요건도 충족합니다. */
const CACHE = "orbit-v14";
const SHELL = [
  "./", "./index.html", "./manifest.webmanifest", "./css/style.css",
  "./js/utils.js", "./js/bodies.js", "./js/icons.js", "./js/store.js", "./js/gl.js", "./js/gl3d.js", "./js/fx.js", "./js/scene.js", "./js/panel.js", "./js/calendar.js", "./js/calsync.js", "./js/gcal.js", "./js/board.js", "./js/now.js", "./js/listview.js", "./js/intro.js", "./js/app.js",
  "./textures/sun.jpg", "./textures/moon.jpg", "./textures/earth_daymap.jpg", "./textures/earth_nightmap.jpg", "./textures/earth_clouds.jpg",
  "./textures/jupiter.jpg", "./textures/mars.jpg", "./textures/neptune.jpg", "./textures/saturn.jpg", "./textures/saturn_ring.png",
  "./textures/venus_atmosphere.jpg", "./textures/uranus.jpg", "./textures/mercury.jpg", "./textures/stars_milky_way_2k.jpg",
  ...["sun", "moon", "earth", "jupiter", "mars", "neptune", "saturn", "venus", "uranus", "mercury"].map(k => `./textures/thumbs/${k}.png`),
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
    if (url.pathname.endsWith("textures-inline.js")) return;
    e.respondWith(fetch(req, { cache: "no-cache" }).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match("./index.html"))));
  } else if (/(fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net)$/.test(url.host)) {
    e.respondWith(caches.open(CACHE + "-fonts").then(async c => {
      const hit = await c.match(req); if (hit) return hit;
      try { const res = await fetch(req); if (res.ok) c.put(req, res.clone()); return res; } catch (err) { return new Response("", { status: 408 }); }
    }));
  }
});
