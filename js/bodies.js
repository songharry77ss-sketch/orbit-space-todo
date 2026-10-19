/* ═══════════════ 천체 카탈로그: 실제 행성 텍스처 (Solar System Scope, NASA 자료 기반, CC BY 4.0) ═══════════════ */
"use strict";

const BODIES = {
  earth:   { ko: "지구",   en: "Earth",   tex: "textures/earth_daymap.jpg", night: "textures/earth_nightmap.jpg", clouds: "textures/earth_clouds.jpg", color: "#79b6ff", atm: [0.40, 0.66, 1.0], atmK: 1.0, size: 1.0, spin: 80, tilt: 23.4, limb: 0 },
  jupiter: { ko: "목성",   en: "Jupiter", tex: "textures/jupiter.jpg", color: "#e8bd90", atm: [1.0, 0.86, 0.68], atmK: 0.35, size: 1.34, spin: 46, tilt: 3, limb: 0.5 },
  mars:    { ko: "화성",   en: "Mars",    tex: "textures/mars.jpg", color: "#ff9068", atm: [1.0, 0.58, 0.38], atmK: 0.45, size: 0.84, spin: 84, tilt: 25, limb: 0 },
  neptune: { ko: "해왕성", en: "Neptune", tex: "textures/neptune.jpg", color: "#7d9bff", atm: [0.45, 0.62, 1.0], atmK: 0.75, size: 1.0, spin: 60, tilt: -28, limb: 0.35 },
  saturn:  { ko: "토성",   en: "Saturn",  tex: "textures/saturn.jpg", ring: "textures/saturn_ring.png", color: "#f0d79e", atm: [1.0, 0.92, 0.72], atmK: 0.3, size: 1.1, spin: 50, tilt: -18, limb: 0.4 },
  venus:   { ko: "금성",   en: "Venus",   tex: "textures/venus_atmosphere.jpg", color: "#f3d193", atm: [1.0, 0.84, 0.55], atmK: 0.9, size: 0.96, spin: 140, tilt: -3, limb: 0.2 },
  uranus:  { ko: "천왕성", en: "Uranus",  tex: "textures/uranus.jpg", color: "#97e6ec", atm: [0.62, 0.95, 1.0], atmK: 0.7, size: 0.96, spin: 70, tilt: 62, limb: 0.35 },
  mercury: { ko: "수성",   en: "Mercury", tex: "textures/mercury.jpg", color: "#c3bbb0", atm: null, atmK: 0, size: 0.74, spin: 110, tilt: 0, limb: 0 },
  moon:    { ko: "달",     en: "Moon",    tex: "textures/moon.jpg", color: "#d4d8e0", atm: null, atmK: 0, size: 0.72, spin: 120, tilt: 6.7, limb: 0 },
};
const BODY_ORDER = ["earth", "jupiter", "mars", "neptune", "saturn", "venus", "uranus", "mercury", "moon"];
const TEX = { sun: "textures/sun.jpg", moon: "textures/moon.jpg", sky: "textures/stars_milky_way.jpg", sky2k: "textures/stars_milky_way_2k.jpg" };

function bodyKey(p) { return p && BODIES[p.body] ? p.body : "earth"; }
function bodyOf(p) { return BODIES[bodyKey(p)]; }
function pColor(p) { return bodyOf(p).color; }
function thumbOf(key) { return `textures/thumbs/${BODIES[key] || key === "sun" ? key : "earth"}.png`; }
function thumbImg(key, size, cls) { return `<img class="thumb ${key === "saturn" ? "is-saturn" : ""} ${cls || ""}" src="${thumbOf(key)}" width="${size}" height="${size}" alt="" draggable="false">`; }
