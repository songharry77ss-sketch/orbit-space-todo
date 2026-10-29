/* ═══════════════ 손맛 레이어: 완료 · 점화 같은 순간을 빛 입자 · 혜성 · 짧은 효과음 · 진동으로 ═══════════════
   화면 맨 위 캔버스(#juice)에 그려서 보드 · 집중 바 위에서도 불꽃이 보인다. 입자가 없으면 프레임을 돌리지 않는다.
   목록이 다시 그려질 때는 줄이 원래 자리에서 새 자리로 미끄러지게(FLIP) 한다. */
"use strict";

const Juice = {
  cv: null, ctx: null, W: 1, H: 1, ps: [], comets: [], raf: 0, last: 0, glows: new Map(), reduced: false, ac: null, master: null, nbuf: null,
  combo: { n: 0, t: 0 },
  init() {
    const cv = document.createElement("canvas"); cv.id = "juice"; cv.setAttribute("aria-hidden", "true");
    document.body.appendChild(cv); this.cv = cv; this.ctx = cv.getContext("2d");
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.resize(); window.addEventListener("resize", () => this.resize());
  },
  resize() {
    const d = Math.min(window.devicePixelRatio || 1, 2); this.W = innerWidth; this.H = innerHeight;
    this.cv.width = Math.round(this.W * d); this.cv.height = Math.round(this.H * d); this.ctx.setTransform(d, 0, 0, d, 0, 0);
  },
  center(el) { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; },
  /* 색을 입힌 빛 번짐 스프라이트 (색마다 한 번만 만든다) */
  glow(c) {
    let s = this.glows.get(c); if (s) return s;
    s = document.createElement("canvas"); s.width = s.height = 64;
    const g = s.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.16, c); gr.addColorStop(0.42, c + "55"); gr.addColorStop(1, c + "00");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); this.glows.set(c, s); return s;
  },

  /* ── 입자 ── */
  add(p) { if (this.ps.length < 900) this.ps.push(Object.assign({ life: 0, max: 0.8, vx: 0, vy: 0, drag: 0.94, g: 0, kind: "dot", r: 2, w: 1.6 }, p)); this.go(); },
  sparks(x, y, colors, n = 20, power = 1) {
    if (this.reduced) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = U.rand(90, 340) * power;
      this.add({ kind: "spark", x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, max: U.rand(0.35, 0.75), w: U.rand(1.1, 2.2), c: colors[i % colors.length], drag: 0.9, g: 160, tail: 0.045 });
    }
  },
  stars(x, y, c, n = 5, spread = 34) {
    if (this.reduced) return;
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, d = U.rand(8, spread); this.add({ kind: "star", x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, vx: Math.cos(a) * 24, vy: Math.sin(a) * 24 - 18, max: U.rand(0.5, 0.9), r: U.rand(4, 8), c, drag: 0.92, rot: Math.random() * 0.8 }); }
  },
  ring(x, y, c, r0 = 6, grow = 40, max = 0.5, w = 2) { this.add({ kind: "ring", x, y, c, r: r0, grow, max, w }); },
  flash(x, y, c, r = 30, max = 0.35) { this.add({ kind: "flash", x, y, c, r, max }); },
  /* 곡선을 그리며 날아가는 빛덩이. 꼬리에 불씨를 흘리고, 도착하면 onEnd */
  comet(a, b, o = {}) {
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, arc = o.arc == null ? 0.3 : o.arc;
    const c = { x: (a.x + b.x) / 2 - dy / d * d * arc, y: (a.y + b.y) / 2 + dx / d * d * arc };
    this.comets.push(Object.assign({ a, b, c, t: 0, dur: 0.6, size: 4, color: "#ffffff", core: "#ffffff", px: a.x, py: a.y }, o)); this.go();
  },
  float(x, y, text, cls = "") {
    const el = document.createElement("div"); el.className = `j-float ${cls}`; el.textContent = text;
    el.style.left = `${Math.round(x)}px`; el.style.top = `${Math.round(y)}px`; document.body.appendChild(el);
    setTimeout(() => el.remove(), 1100);
  },
  go() { if (!this.raf) { this.last = 0; this.raf = requestAnimationFrame(t => this.frame(t)); } },
  frame(ts) {
    try { this.draw(ts); } catch (_) { this.ps.length = 0; this.comets.length = 0; this.resize(); }
    if (this.ps.length || this.comets.length) this.raf = requestAnimationFrame(t => this.frame(t));
    else { this.raf = 0; this.ctx.clearRect(0, 0, this.W, this.H); }
  },
  draw(ts) {
    /* rAF 시각이 앞 프레임보다 이를 수 있어 0 밑으로는 내려가지 않게 */
    const dt = this.last ? U.clamp((ts - this.last) / 1000, 0, 0.04) : 0.016; this.last = ts;
    const ctx = this.ctx; ctx.clearRect(0, 0, this.W, this.H);
    ctx.save(); ctx.globalCompositeOperation = this.dark === false ? "source-over" : "lighter";
    for (let i = this.comets.length - 1; i >= 0; i--) {
      const m = this.comets[i]; m.t += dt; const k = Math.min(1, m.t / m.dur), e = 0.3 * k + 0.7 * k * k * (3 - 2 * k) * (0.6 + 0.4 * k), u = 1 - e;
      const x = u * u * m.a.x + 2 * u * e * m.c.x + e * e * m.b.x, y = u * u * m.a.y + 2 * u * e * m.c.y + e * e * m.b.y;
      const steps = Math.max(1, Math.ceil(Math.hypot(x - m.px, y - m.py) / 5));
      for (let s = 1; s <= steps; s++) {
        const q = s / steps, tx = m.px + (x - m.px) * q, ty = m.py + (y - m.py) * q;
        if (this.ps.length < 900) this.ps.push({ kind: "dot", x: tx + U.rand(-1.5, 1.5), y: ty + U.rand(-1.5, 1.5), vx: U.rand(-22, 22), vy: U.rand(-22, 22) - (m.fire ? 30 : 0), life: 0, max: U.rand(0.25, m.fire ? 0.6 : 0.45), r: m.size * U.rand(0.35, 0.8), c: m.fire && Math.random() < 0.5 ? "#ff6a2a" : m.color, drag: 0.9, g: 0 });
      }
      m.px = x; m.py = y;
      const gs = m.size * 7; ctx.globalAlpha = 1; ctx.drawImage(this.glow(m.color), x - gs, y - gs, gs * 2, gs * 2);
      ctx.fillStyle = m.core; ctx.beginPath(); ctx.arc(x, y, m.size * 0.7, 0, Math.PI * 2); ctx.fill();
      if (k >= 1) { this.comets.splice(i, 1); if (m.onEnd) m.onEnd(); }
    }
    for (let i = this.ps.length - 1; i >= 0; i--) {
      const p = this.ps[i]; p.life += dt;
      if (p.life >= p.max) { this.ps.splice(i, 1); continue; }
      p.vx *= Math.pow(p.drag, dt * 60); p.vy = p.vy * Math.pow(p.drag, dt * 60) + p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      const k = p.life / p.max, a = 1 - k;
      if (p.kind === "spark") {
        ctx.globalAlpha = a; ctx.strokeStyle = p.c; ctx.lineWidth = p.w * (1 - k * 0.6); ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(p.x - p.vx * p.tail, p.y - p.vy * p.tail); ctx.lineTo(p.x, p.y); ctx.stroke();
      } else if (p.kind === "ring") {
        const r = Math.max(0, p.r + p.grow * (1 - Math.pow(1 - k, 3)));
        ctx.globalAlpha = a * 0.9; ctx.strokeStyle = p.c; ctx.lineWidth = p.w * (1 - k * 0.7);
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
      } else if (p.kind === "flash") {
        const r = p.r * (0.7 + k * 0.6); ctx.globalAlpha = a * a; ctx.drawImage(this.glow(p.c), p.x - r, p.y - r, r * 2, r * 2);
      } else if (p.kind === "star") {
        const r = Math.max(0, p.r * (k < 0.3 ? k / 0.3 : 1 - (k - 0.3) / 0.7)), w = r * 0.18;
        ctx.globalAlpha = 0.95; ctx.fillStyle = p.c; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(w, -w); ctx.lineTo(r, 0); ctx.lineTo(w, w); ctx.lineTo(0, r); ctx.lineTo(-w, w); ctx.lineTo(-r, 0); ctx.lineTo(-w, -w); ctx.closePath(); ctx.fill(); ctx.restore();
        ctx.globalAlpha = 0.5 * a; ctx.drawImage(this.glow(p.c), p.x - r * 1.6, p.y - r * 1.6, r * 3.2, r * 3.2);
      } else {
        const r = p.r * (1 - k * 0.5); ctx.globalAlpha = a * 0.9; ctx.drawImage(this.glow(p.c), p.x - r * 3, p.y - r * 3, r * 6, r * 6);
      }
    }
    ctx.restore();
  },

  /* ── 소리: 파일 없이 합성 (설정에서 끌 수 있음) ── */
  on() { return Store.state.settings.sfx !== false; },
  audio() {
    if (!this.on()) return null;
    try {
      if (!this.ac) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; this.ac = new AC(); this.master = this.ac.createGain(); this.master.gain.value = 0.3; this.master.connect(this.ac.destination); }
      if (this.ac.state === "suspended") this.ac.resume();
      return this.ac;
    } catch (_) { return null; }
  },
  bell(f, at = 0, dur = 0.6, vol = 0.4) {
    const ac = this.audio(); if (!ac) return; const t = ac.currentTime + at;
    [[1, 1, 1], [2.0, 0.28, 0.5], [3.01, 0.1, 0.3]].forEach(([m, v, dk]) => {
      const o = ac.createOscillator(), g = ac.createGain(); o.type = "sine"; o.frequency.value = f * m;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * v, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur * dk);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
    });
  },
  noise(at, dur, f0, f1, vol, q = 1) {
    const ac = this.audio(); if (!ac) return; const t = ac.currentTime + at;
    if (!this.nbuf) { const n = ac.sampleRate, b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; this.nbuf = b; }
    const s = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = this.nbuf;
    bp.type = "bandpass"; bp.Q.value = q; bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.55); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(bp); bp.connect(g); g.connect(this.master); s.start(t); s.stop(t + dur + 0.05);
  },
  thump(at, f0, f1, dur, vol) {
    const ac = this.audio(); if (!ac) return; const t = ac.currentTime + at, o = ac.createOscillator(), g = ac.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  },
  sfx(kind, n = 1) {
    switch (kind) {
      /* 완료: 맑은 두 음(5도 위로). 연달아 끝내면 한 음씩 올라간다 */
      case "done": { const f = 659.25 * Math.pow(2, Math.min(n - 1, 7) * 2 / 12); this.noise(0, 0.04, 5200, 7000, 0.08, 0.7); this.bell(f, 0, 0.5, 0.36); this.bell(f * 1.5, 0.075, 0.7, 0.3); break; }
      case "land": this.bell(1567.98, 0, 0.35, 0.12); break;
      case "step": this.bell(1174.66, 0, 0.32, 0.2); break;
      case "add": this.bell(587.33, 0, 0.28, 0.18); this.bell(880, 0.05, 0.34, 0.14); break;
      case "whoosh": this.noise(0, 0.42, 280, 2400, 0.3, 0.8); break;
      case "ignite": this.thump(0, 150, 42, 0.5, 0.7); this.noise(0, 0.7, 2200, 260, 0.22, 0.6); this.bell(392, 0.01, 1.1, 0.12); this.bell(587.33, 0.03, 1.1, 0.08); break;
      case "pause": this.bell(587.33, 0, 0.3, 0.16); this.bell(440, 0.09, 0.45, 0.14); break;
      case "all": [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, i) => this.bell(f, i * 0.09, 1.4, 0.26)); this.thump(0, 110, 40, 0.7, 0.45); break;
    }
  },
  /* 진동: 안드로이드(브라우저 · 앱). iOS 앱은 native.js 가 기기 촉감으로 처리 */
  buzz(kind) {
    try { if (typeof Native !== "undefined" && Native.ok()) return; if (navigator.vibrate) navigator.vibrate({ done: 14, start: [8, 40, 18], all: [16, 60, 16, 60, 40], step: 8, add: 8, pause: 10 }[kind] || 10); } catch (_) { /* 지원 안 함 */ }
  },

  /* ── 순간들 ── */
  /* 체크를 누른 즉시: 버튼 팝 · 초록 고리 · 불꽃 · 소리 · 진동. 연속 완료 수를 돌려준다 */
  check(btn, row) {
    const now = performance.now(), c = this.combo; c.n = now - c.t < 8000 ? c.n + 1 : 1; c.t = now;
    if (btn) { btn.classList.remove("j-pop"); void btn.offsetWidth; btn.classList.add("j-pop"); }
    if (row) row.classList.add("j-done");
    const p = btn ? this.center(btn) : null;
    if (p) this.burstDone(p.x, p.y, c.n);
    this.sfx("done", c.n); this.buzz("done");
    if (p && c.n >= 2) this.float(p.x, p.y - 16, `연속 ${c.n}`, "combo");
    return c.n;
  },
  burstDone(x, y, n = 1) {
    this.flash(x, y, "#7ee2a8", 30, 0.32); this.ring(x, y, "#a6f2c8", 8, 30 + Math.min(n, 6) * 4, 0.5, 2);
    this.sparks(x, y, ["#7ee2a8", "#e6fff0", "#ffffff", "#ffd59a"], 16 + Math.min(n, 6) * 3, 0.85 + Math.min(n, 6) * 0.06);
    this.stars(x, y, "#eafff3", 3 + Math.min(n, 4));
  },
  /* 완료 빛이 상단의 진행 링으로 날아가 숫자를 올린다 */
  toRing(from, onArrive) {
    const btn = document.getElementById("progressBtn"), svg = btn && btn.querySelector("svg");
    if (btn && btn.closest("[hidden]")) { if (onArrive) onArrive(); return; }
    if (!svg || !from || this.reduced || !svg.getClientRects().length) { if (onArrive) onArrive(); return; }
    const to = this.center(svg);
    this.comet(from, to, { color: "#7ee2a8", core: "#f2fff8", size: 3.2, dur: U.clamp(Math.hypot(to.x - from.x, to.y - from.y) / 1500, 0.45, 0.75), arc: from.x < to.x ? -0.28 : 0.28, onEnd: () => {
      this.ring(to.x, to.y, "#a6f2c8", 10, 24, 0.45, 1.6); this.flash(to.x, to.y, "#7ee2a8", 26, 0.3); this.sparks(to.x, to.y, ["#7ee2a8", "#ffffff"], 8, 0.5);
      this.sfx("land"); if (onArrive) onArrive();
    } });
  },
  /* 점화: 누른 자리에서 불덩이가 곡선을 그리며 태양으로 날아가 터진다 */
  /* to: 오늘 화면 집중 카드의 태양 자리. 없으면 우주 탭의 태양으로 */
  ignite(from, onArrive, to) {
    this.sfx("whoosh"); this.buzz("start");
    if (to && from && !this.reduced) {
      this.flash(from.x, from.y, "#ffb060", 24, 0.3); this.sparks(from.x, from.y, ["#ffd59a", "#ff8a3c"], 10, 0.55);
      this.comet(from, to, { color: "#ff9a4a", core: "#fff4dc", size: 4.6, fire: true, dur: U.clamp(Math.hypot(to.x - from.x, to.y - from.y) / 1300, 0.35, 0.7), arc: from.x < to.x ? -0.22 : 0.22, onEnd: () => {
        this.sfx("ignite"); this.flash(to.x, to.y, "#ffcf8a", 70, 0.5); this.ring(to.x, to.y, "#ffd59a", 20, 60, 0.7, 2.4); this.sparks(to.x, to.y, ["#ffd59a", "#ff8a3c", "#fff1d6"], 22, 1); if (onArrive) onArrive();
      } });
      return;
    }
    const sun = Scene.sun, ok = from && !this.reduced && !Scene.isOverlay() && sun.sr > 2;
    if (from) { this.flash(from.x, from.y, "#ffb060", 24, 0.3); this.sparks(from.x, from.y, ["#ffd59a", "#ff8a3c"], 10, 0.55); }
    if (!ok) { setTimeout(() => this.ignited(onArrive, !Scene.isOverlay()), from ? 160 : 380); return; }
    const at = { x: sun.sx, y: sun.sy };
    this.comet(from, at, { color: "#ff9a4a", core: "#fff4dc", size: 4.6, fire: true, dur: U.clamp(Math.hypot(at.x - from.x, at.y - from.y) / 1300, 0.42, 0.78), arc: from.x < at.x ? -0.22 : 0.22, onEnd: () => this.ignited(onArrive, true) });
  },
  ignited(cb, atSun) {
    this.sfx("ignite");
    if (atSun) {
      const s = Scene.sun, R = Math.max(14, s.sr);
      this.flash(s.sx, s.sy, "#ffcf8a", R * 3, 0.55); this.ring(s.sx, s.sy, "#ffd59a", R * 1.05, R * 1.6 + 70, 0.85, 2.6); this.ring(s.sx, s.sy, "#ff8a3c", R * 0.9, R + 40, 0.6, 1.6);
      this.sparks(s.sx, s.sy, ["#ffd59a", "#ff8a3c", "#fff1d6", "#ff6a2a"], 34, 1.25);
      if (Scene.kick) Scene.kick();
      this.shake();
    }
    if (cb) cb();
  },
  shake() {
    if (this.reduced) return; const st = document.getElementById("stage"); if (!st || !st.animate) return;
    st.animate([{ transform: "none" }, { transform: "translate(2px,-2px)" }, { transform: "translate(-2px,1px)" }, { transform: "translate(1px,2px)" }, { transform: "none" }], { duration: 280, easing: "ease-out" });
  },
  /* 작은 반응: 단계 완료 · 할 일 추가 */
  pop(el, kind = "step") {
    if (!el) return; const p = this.center(el);
    el.classList.remove("j-pop"); void el.offsetWidth; el.classList.add("j-pop");
    if (kind === "add") { this.ring(p.x, p.y, "#ffd59a", 8, 26, 0.45, 1.6); this.sparks(p.x, p.y, ["#ffd59a", "#ffffff"], 10, 0.55); }
    else { this.ring(p.x, p.y, "#a6f2c8", 6, 20, 0.4, 1.4); this.sparks(p.x, p.y, ["#7ee2a8", "#ffffff"], 9, 0.5); }
    this.sfx(kind); this.buzz(kind);
  },
  /* 오늘 할 일을 모두 끝냈을 때: 태양에서 퍼지는 고리 · 별똥별 · 가운데 카드 */
  celebrate(info = {}) {
    this.sfx("all"); this.buzz("all");
    const s = Scene.sun, ov = Scene.isOverlay(), cx = ov ? this.W / 2 : s.sx, cy = ov ? this.H / 2 : s.sy, R = ov ? 30 : Math.max(16, s.sr);
    [["#ffd59a", 0], ["#7ee2a8", 160], ["#ffffff", 320]].forEach(([c, ms]) => setTimeout(() => { this.ring(cx, cy, c, R, Math.max(this.W, this.H) * 0.45, 1.4, 2.2); this.flash(cx, cy, c, R * 3, 0.5); }, ms));
    this.sparks(cx, cy, ["#ffd59a", "#7ee2a8", "#ffffff", "#ffb060"], 60, 1.8);
    if (!this.reduced) for (let i = 0; i < 22; i++) setTimeout(() => {
      const x = U.rand(this.W * 0.15, this.W * 1.05), y = U.rand(-20, this.H * 0.35), sp = U.rand(520, 900), a = U.rand(2.2, 2.5);
      this.add({ kind: "spark", x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, max: U.rand(0.7, 1.1), w: U.rand(1, 1.8), c: i % 3 ? "#ffffff" : "#ffd59a", drag: 0.995, g: 0, tail: 0.11 });
    }, 200 + i * 70);
    const el = document.createElement("div"); el.className = "j-cele"; el.setAttribute("role", "status");
    el.innerHTML = `<div class="jc-k">MISSION COMPLETE</div><div class="jc-t">오늘 할 일을 모두 끝냈어요</div>${info.sub ? `<div class="jc-s">${U.esc(info.sub)}</div>` : ""}`;
    document.body.appendChild(el);
    const bye = () => { if (!el.isConnected) return; el.classList.add("out"); setTimeout(() => el.remove(), 500); };
    el.addEventListener("click", bye); setTimeout(bye, 3400);
  },

  /* ── 다시 그릴 때 줄이 미끄러지게 (FLIP) ── */
  SEL: ".view:not([hidden]) .tk[data-task], .uni-card .tk[data-task]",
  key(el) { return (el.closest(".uni-card") ? "u" : "v") + ":" + el.dataset.task; },
  snap() {
    if (this.reduced) return null; const m = new Map();
    document.querySelectorAll(this.SEL).forEach(el => { const r = el.getBoundingClientRect(); if (r.height) m.set(this.key(el), r); });
    return m;
  },
  flip(before, enter) {
    if (!before) return;
    document.querySelectorAll(this.SEL).forEach(el => {
      const r0 = before.get(this.key(el));
      if (!r0) { if (enter && enter.has(el.dataset.task || el.dataset.id)) { el.classList.add("j-enter"); setTimeout(() => el.classList.remove("j-enter"), 1300); } return; }
      const r = el.getBoundingClientRect(), dx = r0.left - r.left, dy = r0.top - r.top;
      if ((Math.abs(dx) < 1 && Math.abs(dy) < 1) || !r.height) return;
      el.style.transition = "none"; el.style.transform = `translate(${dx}px, ${dy}px)`; el.getBoundingClientRect();
      el.style.transition = "transform .42s cubic-bezier(.2,.8,.2,1)"; el.style.transform = "";
      const done = () => { el.style.transition = ""; el.removeEventListener("transitionend", done); };
      el.addEventListener("transitionend", done);
    });
  },
  /* 사라지는 줄: 다시 그리기 전에 복제해 두었다가, 그린 뒤 같은 자리에서 옆으로 빠져나가게 */
  ghost(el) {
    if (!el || !el.isConnected || this.reduced) return null;
    const host = el.closest(".view, .sheet, .uni-card"); if (!host) return null;
    const hr = host.getBoundingClientRect(), r = el.getBoundingClientRect(); if (!r.height) return null;
    const g = el.cloneNode(true); g.classList.add("j-ghost"); g.classList.remove("hov"); g.removeAttribute("data-task"); g.removeAttribute("data-id"); g.removeAttribute("tabindex"); g.setAttribute("aria-hidden", "true");
    Object.assign(g.style, { position: "absolute", left: `${r.left - hr.left + host.scrollLeft}px`, top: `${r.top - hr.top + host.scrollTop}px`, width: `${r.width}px`, height: `${r.height}px`, margin: "0", zIndex: "6", pointerEvents: "none" });
    return { g, host };
  },
  playGhost(o) { if (!o) return; o.host.appendChild(o.g); setTimeout(() => o.g.remove(), 700); },
};
