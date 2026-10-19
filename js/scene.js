/* ═══════════════ 우주 씬: 레이아웃 · 둥실 떠다니는 행성계 · 위성(할 일) · 태양(집중) · 드래그 앤 드롭 ═══════════════ */
"use strict";

const Scene = {
  stage: null, cvGL: null, labels: null, focus: null, tip: null, ghost: null, hint: null,
  W: 0, H: 0, dpr: 1, time: 0, last: 0, view: "today", search: "", useGL: false,
  sun: { x: 0, y: 0, bx: 0, by: 0, R: 60, heat: 0, heatT: 0 },
  systems: new Map(), order: [], orbs: new Map(), hover: null, drag: null, base: 28,
  ptr: { x: -1e4, y: -1e4, in: false }, par: { x: 0, y: 0, tx: 0, ty: 0 },
  narrow: false, touch: false, reduced: false, panelOpen: false, area: null, lastPos: new Map(), q: 1, perf: { ema: 1 / 60, t: 0 },
  SHELL_CAP: [6, 9, 12, 16, 22],

  init() {
    this.stage = document.getElementById("stage");
    this.cvGL = document.getElementById("gl");
    this.labels = document.getElementById("labels");
    this.focus = document.getElementById("focus");
    this.tip = document.getElementById("tooltip");
    this.ghost = document.getElementById("dragGhost");
    this.hint = document.getElementById("sunHint");
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.useGL = GL.init(this.cvGL);
    document.body.classList.toggle("no-gl", !this.useGL);
    FX.init(document.getElementById("fx"));
    this.measure();
    if (this.useGL) {
      [TEX.sun, TEX.moon, this.skyTex()].forEach(u => GL.texture(u, true));
      Object.values(BODIES).forEach(b => [b.tex, b.night, b.clouds].forEach(u => u && GL.texture(u, true)));
      GL.texture(BODIES.saturn.ring, false);
    } else this.loadFallback();
    this.bind();
    this.sync({ type: "init" });
    this.snap();
    requestAnimationFrame(t => this.loop(t));
  },
  skyTex() { return Math.max(screen.width, screen.height) * (window.devicePixelRatio || 1) > 2400 && !this.touch ? TEX.sky : TEX.sky2k; },
  seed(id, k) { let h = 2166136261; const s = id + ":" + k; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; },
  panelW() { return Math.min(400, this.W * 0.34); },

  /* ── 기하 ── */
  measure() {
    const r = this.stage.getBoundingClientRect();
    this.W = Math.max(1, r.width); this.H = Math.max(1, r.height);
    this.narrow = this.W < 640;
    this.touch = matchMedia("(hover: none) and (pointer: coarse)").matches;
    let dpr = Math.max(0.7, Math.min(window.devicePixelRatio || 1, 1.5) * this.q);
    const maxPx = 5.2e6; if (this.W * this.H * dpr * dpr > maxPx) dpr = Math.sqrt(maxPx / (this.W * this.H));
    this.dpr = dpr;
    if (this.useGL) GL.resize(this.W, this.H, dpr);
    FX.resize(this.W, this.H);
    document.body.classList.toggle("narrow", this.narrow);
    document.body.classList.toggle("touch", this.touch);
    this.layout();
  },
  layout() {
    const burning = this.orbs.size > 0, n = this.order.length;
    const top = this.narrow ? 128 : 100;
    const bottom = this.H - (this.narrow ? (burning ? 160 : 86) : 116);
    const left = this.narrow ? 0 : 28;
    const right = this.W - (this.narrow ? 0 : 28) - (this.panelOpen && !this.narrow ? this.panelW() + 20 : 0);
    const aw = Math.max(200, right - left), ah = Math.max(220, bottom - top), cx = left + aw / 2;
    if (this.narrow) {
      this.sun.R = U.clamp(Math.min(aw, ah) * 0.105, 34, 46);
      this.sun.bx = cx; this.sun.by = top + ah * 0.42;
      this.base = U.clamp(aw * 0.055, 15, 22);
      const span = ah - 104;
      this.order.forEach((id, i) => {
        const s = this.systems.get(id); if (!s) return;
        const t = n === 1 ? 0.5 : i / (n - 1);
        s.bx = left + aw * (i % 2 ? 0.79 : 0.21); s.by = top + 30 + t * span;
      });
    } else {
      this.sun.R = U.clamp(Math.min(aw, ah) * 0.105, 48, 96);
      const cy = top + ah * 0.47; this.sun.bx = cx; this.sun.by = cy;
      this.base = U.clamp(Math.min(aw, ah) * 0.058, 22, 48);
      const rx = Math.max(240, aw / 2 - 150), ry = Math.max(150, ah / 2 - 88);
      const two = n > 7, outerN = two ? Math.ceil(n * 0.6) : n;
      this.order.forEach((id, i) => {
        const s = this.systems.get(id); if (!s) return;
        let a, k = 1;
        if (!two) a = Math.PI / 2 + Math.PI / n + (i / n) * Math.PI * 2;
        else if (i < outerN) a = Math.PI / 2 + Math.PI / outerN + (i / outerN) * Math.PI * 2;
        else { const j = i - outerN, m = n - outerN; a = Math.PI / 2 + Math.PI / m + (j / m) * Math.PI * 2; k = 0.55; }
        s.bx = cx + Math.cos(a) * rx * k; s.by = cy + Math.sin(a) * ry * k;
      });
    }
    this.systems.forEach(s => { s.R = this.base * s.body.size; });
    this.area = { top, bottom, left, right };
  },
  snap() { this.sun.x = this.sun.bx; this.sun.y = this.sun.by; this.systems.forEach(s => { s.x = s.bx; s.y = s.by; }); },
  setPanel(open) { this.panelOpen = open; this.layout(); },

  /* ── 스토어 → 씬 동기화 ── */
  setView(v) { this.view = v; this.sync({ type: "filter" }); },
  setSearch(q) { this.search = (q || "").trim().toLowerCase(); },
  shellOf(i) { let acc = 0; for (let k = 0; k < this.SHELL_CAP.length; k++) { acc += this.SHELL_CAP[k]; if (i < acc) return k; } return this.SHELL_CAP.length - 1; },
  shellR(s, i) { return s.R * 1.6 + i * Math.max(14, s.R * 0.42); },
  moonR(t) { const b = U.clamp(this.base * 0.17, 4.6, 7.6) + (this.touch ? 1.3 : 0); return t.important ? b * 1.2 : b; },
  sync(d = {}) {
    const planets = Store.planets(), ids = new Set(planets.map(p => p.id));
    for (const [id, s] of this.systems) if (!ids.has(id)) { s.label.remove(); this.systems.delete(id); }
    planets.forEach(p => { let s = this.systems.get(p.id); if (!s) s = this.makeSystem(p); s.planet = p; s.body = bodyOf(p); s.key = bodyKey(p); s.R = this.base * s.body.size; s.nameEl.textContent = p.name; s.label.style.setProperty("--c", s.body.color); });
    const prev = this.order.join(","); this.order = planets.map(p => p.id);
    const visible = Store.visibleTasks(this.view === "all" ? "all" : "today");
    const moonTasks = visible.filter(t => t.status !== "doing"), want = new Map(moonTasks.map(t => [t.id, t]));
    for (const s of this.systems.values()) for (const [tid, m] of s.moons) {
      const t = want.get(tid);
      if (!t || t.planetId !== s.id) { if (d.type === "task-complete" && d.id === tid) this.burstAt(m.sx, m.sy, s.body.color, false); s.moons.delete(tid); }
    }
    moonTasks.forEach(t => {
      const s = this.systems.get(t.planetId) || this.systems.get(this.order[0]); if (!s) return;
      let m = s.moons.get(t.id); if (!m) { m = this.makeMoon(s, t); s.moons.set(t.id, m); } m.task = t;
    });
    const doing = Store.tasks().filter(t => t.status === "doing").sort((a, b) => a.startedAt - b.startedAt);
    for (const s of this.systems.values()) {
      const list = [...s.moons.values()].sort((a, b) => a.task.createdAt - b.task.createdAt);
      list.forEach((m, i) => { m.shell = this.shellOf(i); m.speed = (Math.PI * 2) / (28 + m.shell * 12) * (m.shell % 2 ? -1 : 1); });
      s.shells = list.length ? this.shellOf(list.length - 1) + 1 : 0;
      const fire = doing.filter(t => t.planetId === s.id).length;
      s.metaEl.textContent = `${s.body.en.toUpperCase()} · ${list.length}${fire ? ` · 집중 ${fire}` : ""}`;
      s.label.classList.toggle("empty", !list.length && !fire);
      s.label.setAttribute("aria-label", `${s.planet.name} 행성 · 할 일 ${list.length}개 · 열기`);
    }
    const dset = new Set(doing.map(t => t.id));
    for (const [tid, o] of this.orbs) if (!dset.has(tid)) { if (d.type === "task-complete" && d.id === tid) this.burstAt(o.sx, o.sy, "#ffc070", true); this.orbs.delete(tid); }
    doing.forEach(t => {
      let o = this.orbs.get(t.id);
      if (!o) { o = { id: t.id, task: t, sx: this.sun.X || this.sun.x, sy: this.sun.Y || this.sun.y, z: 1, r: 6, from: this.takeFrom(t.id) }; this.orbs.set(t.id, o); }
      o.task = t;
    });
    this.sun.heatT = doing.length ? Math.min(1, 0.55 + 0.15 * (doing.length - 1)) : 0;
    this.renderFocus(doing);
    this.updateHint();
    const burning = doing.length > 0;
    if (prev !== this.order.join(",") || d.type === "reset" || d.type === "init" || this._burning !== burning) { this._burning = burning; this.layout(); }
  },
  takeFrom(id) { let p = this.lastPos.get(id); this.lastPos.delete(id); if (!p && this.launch) { p = this.launch; this.launch = null; } return p && this.time - p.t0 < 2 ? { x: p.x, y: p.y, t0: this.time } : null; },
  makeSystem(p) {
    const el = document.createElement("button");
    el.type = "button"; el.className = "p-label"; el.dataset.id = p.id;
    el.innerHTML = `<span class="pl-name"></span><span class="pl-meta"></span>`;
    el.addEventListener("click", () => App.openPlanet(p.id));
    el.addEventListener("pointerenter", () => { const s = this.systems.get(p.id); if (s) s.labelHover = true; });
    el.addEventListener("pointerleave", () => { const s = this.systems.get(p.id); if (s) s.labelHover = false; });
    this.labels.appendChild(el);
    const sd = k => this.seed(p.id, k);
    const s = {
      id: p.id, planet: p, body: bodyOf(p), key: bodyKey(p), label: el, nameEl: el.firstChild, metaEl: el.lastChild, moons: new Map(), shells: 0,
      x: this.sun.x, y: this.sun.y, bx: this.sun.x, by: this.sun.y, X: this.sun.x, Y: this.sun.y, R: this.base, h: 0, hover: false, labelHover: false, pinned: false,
      ph: [1, 2, 3, 4].map(k => sd(k) * Math.PI * 2), fr: [0.55 + sd(5) * 0.3, 0.35 + sd(6) * 0.25, 0.45 + sd(7) * 0.3, 0.3 + sd(8) * 0.2],
      depth: 0.55 + sd(9) * 0.45, ratio: 0.33 + sd(10) * 0.1, roll: (sd(11) - 0.5) * 0.5, rot0: sd(12) * Math.PI * 2, ext: 0, ry: 0,
    };
    this.systems.set(p.id, s);
    return s;
  },
  makeMoon(s, t) {
    const TAU = Math.PI * 2, angles = [...s.moons.values()].map(m => m.angle);
    let best = Math.random() * TAU;
    if (angles.length) {
      let bd = -1;
      for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU; const dd = Math.min(...angles.map(e => { const x = Math.abs(a - e) % TAU; return Math.min(x, TAU - x); })); if (dd > bd) { bd = dd; best = a; } }
    }
    return { id: t.id, task: t, angle: best, shell: 0, speed: 0.2, sx: s.X, sy: s.Y, z: 1, r: 5, scale: 1, hidden: false, match: true, seed: this.seed(t.id, 1) * 6.28, from: this.takeFrom(t.id) };
  },
  renderFocus(doing) {
    const max = this.narrow ? 8 : 3, shown = doing.slice(0, max);
    this.focus.hidden = !doing.length;
    this.focus.innerHTML = shown.map(t => {
      const p = Store.planet(t.planetId);
      return `<div class="fcard" data-id="${t.id}" style="--c:${p ? pColor(p) : "#fff"}">
        <span class="f-ember" aria-hidden="true"><i></i><i></i></span>
        <button type="button" class="f-main" data-act="open"><span class="f-title">${U.esc(t.title)}</span><span class="f-meta"><span class="f-pl">${U.esc(p ? p.name : "")}</span><span class="f-timer" data-live="${t.id}">${U.fmtClock(Store.burned(t))}</span></span></button>
        <button type="button" class="f-done" data-act="done" aria-label="완료" title="완료">${ico("check", 17)}</button></div>`;
    }).join("") + (doing.length > max ? `<button type="button" class="f-more" data-act="more">+${doing.length - max}개 더 보기</button>` : "");
  },
  updateHint() {
    const el = this.hint, d = this.drag && !this.drag.pending ? this.drag : null;
    let txt = "", sub = "";
    if (d) { txt = d.kind === "orb" ? "행성에 놓으면 궤도로 돌아가요" : d.sunTarget ? "놓으면 점화" : "태양에 놓으면 집중 시작"; sub = d.kind === "orb" ? "타이머는 일시정지돼요" : "다른 행성에 놓으면 카테고리 이동"; }
    else if (!this.orbs.size) {
      const any = [...this.systems.values()].some(s => s.moons.size);
      txt = any ? "위성을 태양으로 끌어오세요" : (this.view === "today" ? "오늘 남은 할 일이 없어요" : "할 일이 없어요");
      sub = any ? "놓는 순간부터 타오르며 집중이 시작돼요" : "아래 입력창에서 새 할 일을 띄워 보세요";
    }
    el.hidden = !txt;
    el.classList.toggle("active", !!(d && d.sunTarget));
    if (txt && (el._t !== txt || el._s !== sub)) { el._t = txt; el._s = sub; el.innerHTML = `<b>${txt}</b><span>${sub}</span>`; }
  },
  burstAt(x, y, color, big) {
    if (x == null) return;
    FX.burst(x, y, color, big ? 70 : 46, big ? 1.3 : 1);
    FX.ring(x, y, 4, color, big ? 120 : 80, 0.7);
    if (big) FX.ring(this.sun.X, this.sun.Y, this.sun.R, "#ffb35c", 220, 1.1);
  },

  /* ── 프레임 루프 ── */
  loop(ts) {
    const now = ts / 1000, raw = now - (this.last || now), dt = Math.min(0.05, raw); this.last = now;
    if (document.visibilityState === "visible" && raw > 0 && raw < 0.25) { this.perf.ema += (raw - this.perf.ema) * 0.05; this.perf.t += raw; if (this.perf.t > 2.5) { this.perf.t = 0; this.adapt(); } }
    this.time += dt;
    this.update(dt);
    if (this.useGL && GL.ok) this.renderGL();
    this.renderOverlay(dt);
    requestAnimationFrame(t => this.loop(t));
  },
  update(dt) {
    const t = this.time, k = Math.min(1, dt * 2.4), A = this.reduced ? 0 : (this.narrow ? 4 : 7.5), sun = this.sun;
    this.par.x += (this.par.tx - this.par.x) * Math.min(1, dt * 1.8); this.par.y += (this.par.ty - this.par.y) * Math.min(1, dt * 1.8);
    const px = this.touch ? 0 : this.par.x, py = this.touch ? 0 : this.par.y;
    sun.x += (sun.bx - sun.x) * k; sun.y += (sun.by - sun.y) * k;
    sun.heat += (sun.heatT - sun.heat) * Math.min(1, dt * 1.4);
    sun.X = sun.x + Math.sin(t * 0.21) * A * 0.3 + px * 5; sun.Y = sun.y + Math.cos(t * 0.17) * A * 0.3 + py * 5;
    for (const s of this.systems.values()) {
      s.x += (s.bx - s.x) * k; s.y += (s.by - s.y) * k;
      const f = s.fr, p = s.ph;
      s.X = s.x + (Math.sin(t * f[0] * 0.5 + p[0]) + 0.5 * Math.sin(t * f[1] * 0.5 + p[1])) * A * 0.7 + px * 20 * s.depth;
      s.Y = s.y + (Math.cos(t * f[2] * 0.5 + p[2]) * 0.9 + 0.45 * Math.sin(t * f[3] * 0.5 + p[3])) * A + py * 20 * s.depth;
      const want = (s.hover || s.labelHover || s.pinned || (this.drag && this.drag.target === s)) ? 1 : 0;
      s.h += (want - s.h) * Math.min(1, dt * 5);
      s.rot = s.rot0 + t * Math.PI * 2 / s.body.spin;
      const h = s.h, ratio = U.lerp(s.ratio, 0.8, h), spread = U.lerp(1, 1.14, h), spin = U.lerp(1, 0.04, h) * (this.touch ? 0.6 : 1) * (this.reduced ? 0.25 : 1);
      const roll = s.roll * (1 - h), cr = Math.cos(roll), sr = Math.sin(roll);
      s.cRatio = ratio; s.cSpread = spread; s.cRoll = roll;
      let ext = s.R * 1.3;
      for (const m of s.moons.values()) {
        const held = this.drag && this.drag.id === m.id && !this.drag.pending;
        if (!held) m.angle += m.speed * spin * dt;
        const ro = this.shellR(s, m.shell) * spread, ca = Math.cos(m.angle), sa = Math.sin(m.angle);
        const lx = ca * ro, ly = sa * ro * ratio;
        const x = lx * cr - ly * sr, y = lx * sr + ly * cr;
        m.z = sa; m.scale = 1 + 0.16 * sa * (1 - h * 0.6); m.r = this.moonR(m.task) * m.scale;
        let sx = s.X + x, sy = s.Y + y;
        if (m.from) { const e = U.clamp((t - m.from.t0) / 0.9, 0, 1), ee = 1 - Math.pow(1 - e, 3); sx = U.lerp(m.from.x, sx, ee); sy = U.lerp(m.from.y, sy, ee); if (e >= 1) m.from = null; }
        m.sx = sx; m.sy = sy;
        m.hidden = m.z < 0 && Math.hypot(sx - s.X, sy - s.Y) < s.R * 0.98;
        m.match = !this.search || m.task.title.toLowerCase().includes(this.search);
        ext = Math.max(ext, ro);
      }
      s.ext = ext; s.ry = s.shells ? this.shellR(s, s.shells - 1) * spread * ratio : 0;
    }
    const list = [...this.orbs.values()], n = list.length, sR = sun.R;
    this.orbBase = (this.orbBase || 0) + dt * (this.reduced ? 0.08 : 0.3);
    list.forEach((o, i) => {
      const a = this.orbBase + (i / Math.max(1, n)) * Math.PI * 2, ro = sR * 1.6, roll = -0.22;
      const lx = Math.cos(a) * ro, ly = Math.sin(a) * ro * 0.34;
      const x = lx * Math.cos(roll) - ly * Math.sin(roll), y = lx * Math.sin(roll) + ly * Math.cos(roll);
      o.z = Math.sin(a);
      let sx = sun.X + x, sy = sun.Y + y;
      if (o.from) { const e = U.clamp((t - o.from.t0) / 1.0, 0, 1), ee = 1 - Math.pow(1 - e, 3); sx = U.lerp(o.from.x, sx, ee); sy = U.lerp(o.from.y, sy, ee); if (e >= 1) o.from = null; }
      o.sx = sx; o.sy = sy; o.r = U.clamp(sR * 0.11, 5, 9) * (1 + 0.15 * o.z);
      o.hidden = o.z < 0 && Math.hypot(x, y) < sR;
    });
  },
  /* 프레임이 밀리면 렌더 해상도를 낮추고, 여유가 생기면 되돌린다 */
  adapt() {
    const e = this.perf.ema;
    if (e > 0.021 && this.q > 0.6) { this.q = Math.max(0.6, this.q - 0.15); this.measure(); }
    else if (e < 0.0135 && this.q < 1) { this.q = Math.min(1, this.q + 0.1); this.measure(); }
  },
  light(x, y) { const dx = this.sun.X - x, dy = this.sun.Y - y, l = Math.hypot(dx, dy) || 1; return [dx / l * 0.8, -dy / l * 0.8, 0.6]; },
  renderGL() {
    const t = this.time, cal = this.view === "calendar", sun = this.sun;
    GL.begin();
    GL.drawBg({ sky: this.skyTex(), time: t, off: [this.par.x * 36, this.par.y * 36], dim: cal ? 0.5 : 1, exp: 1.9, stars: 1 });
    if (cal) return;
    const orbs = [...this.orbs.values()].filter(o => !(this.drag && this.drag.id === o.id && !this.drag.pending));
    orbs.filter(o => o.z < 0).forEach(o => this.drawOrb(o));
    GL.drawSun({ x: sun.X, y: sun.Y, R: sun.R * (this.drag && this.drag.sunTarget ? 1.06 : 1), half: sun.R * 3.4, time: t % 3600, heat: Math.max(sun.heat, this.drag && this.drag.sunTarget ? 0.45 : 0), dim: 1 });
    orbs.filter(o => o.z >= 0).forEach(o => this.drawOrb(o));
    [...this.systems.values()].sort((a, b) => a.Y - b.Y).forEach(s => this.drawSystem(s));
  },
  drawSystem(s) {
    const b = s.body, L = this.light(s.X, s.Y), t = this.time, tilt = b.tilt * Math.PI / 180;
    const R = s.R * (1 + s.h * 0.05) * (this.drag && this.drag.target === s ? 1.08 : 1);
    const back = [], front = [];
    for (const m of s.moons.values()) { if (this.drag && this.drag.id === m.id && !this.drag.pending) continue; (m.z < 0 ? back : front).push(m); }
    const oc = s.oc || (s.oc = hexRGB(s.body.color).map(v => 0.55 + v * 0.45)), oa = 0.16 + s.h * 0.22;
    for (let i = 0; i < s.shells; i++) { const ro = this.shellR(s, i) * s.cSpread; GL.drawOrbit({ x: s.X, y: s.Y, R: ro, half: ro * 1.04 + 2, roll: s.cRoll, ratio: s.cRatio, front: false, color: oc, alpha: oa }); }
    back.sort((a, c) => a.z - c.z).forEach(m => this.drawMoon(s, m, L));
    if (b.ring) GL.drawRing({ tex: b.ring, x: s.X, y: s.Y, R, half: R * 2.4, roll: tilt, ratio: 0.32, light: L, front: false });
    GL.drawSphere({ x: s.X, y: s.Y, R, half: R * 1.4, tex: b.tex, night: b.night, clouds: b.clouds, rot: s.rot, cloudRot: t * 0.0035, tilt, light: L, atm: b.atm, atmK: b.atmK, limb: b.limb, time: t });
    if (b.ring) GL.drawRing({ tex: b.ring, x: s.X, y: s.Y, R, half: R * 2.4, roll: tilt, ratio: 0.32, light: L, front: true });
    for (let i = 0; i < s.shells; i++) { const ro = this.shellR(s, i) * s.cSpread; GL.drawOrbit({ x: s.X, y: s.Y, R: ro, half: ro * 1.04 + 2, roll: s.cRoll, ratio: s.cRatio, front: true, color: oc, alpha: oa }); }
    front.sort((a, c) => a.z - c.z).forEach(m => this.drawMoon(s, m, L));
  },
  drawMoon(s, m, L) {
    const task = m.task, hov = this.hover && this.hover.id === m.id;
    let halo = [0, 0, 0, 0];
    if (Store.isOverdue(task)) halo = [1, 0.38, 0.45, 0.6 + 0.3 * Math.sin(this.time * 3.5)];
    else if (task.important) halo = [1, 0.8, 0.42, 0.8];
    if (hov) halo = [1, 1, 1, 0.95];
    const c = s.tint || (s.tint = hexRGB(s.body.color));
    GL.drawSphere({ x: m.sx, y: m.sy, R: m.r, half: m.r * 2.1, tex: TEX.moon, rot: m.seed + m.angle * 0.25, tilt: 0, light: L, tint: [c[0], c[1], c[2], 0.3], halo, alpha: m.match ? 1 : 0.18, time: this.time });
  },
  drawOrb(o) {
    const hov = this.hover && this.hover.id === o.id;
    GL.drawSphere({ x: o.sx, y: o.sy, R: o.r, half: o.r * 2.6, tex: TEX.moon, rot: this.time * 0.6, tilt: 0, light: this.light(o.sx, o.sy), fire: 0.8 + 0.12 * Math.sin(this.time * 6 + o.r), halo: hov ? [1, 1, 1, 0.9] : [0, 0, 0, 0], time: this.time });
  },

  /* ── 오버레이: 먼지 · 드롭 타깃 · 불씨 · DOM 위치 ── */
  renderOverlay(dt) {
    const ctx = FX.ctx, cal = this.view === "calendar";
    FX.clear();
    if (!(this.useGL && GL.ok)) this.render2D(ctx);
    if (!cal) {
      FX.dust(dt, this.par.x, this.par.y, this.reduced);
      if (this.drag && !this.drag.pending) this.drawTargets(ctx);
      if (this.sun.heat > 0.03 && !this.reduced) {
        const rate = (4 + this.sun.heat * 34) * dt; let n = Math.floor(rate) + (Math.random() < rate % 1 ? 1 : 0);
        while (n-- > 0) FX.ember(this.sun.X, this.sun.Y, this.sun.R, this.sun.heat);
      }
    }
    FX.update(dt); FX.draw();
    this.placeDom();
  },
  placeDom() {
    for (const s of this.systems.values()) {
      const off = Math.max(s.R * 1.34, s.R + s.ry + 4) + 10;
      s.label.style.transform = `translate3d(${s.X.toFixed(1)}px, ${(s.Y + off).toFixed(1)}px, 0) translateX(-50%)`;
      s.label.classList.toggle("hot", s.h > 0.5);
    }
    const sun = this.sun, below = sun.Y + sun.R * 1.42 + 18;
    this.focus.style.transform = this.narrow ? "" : `translate3d(${sun.X.toFixed(1)}px, ${below.toFixed(1)}px, 0) translateX(-50%)`;
    this.hint.style.transform = `translate3d(${sun.X.toFixed(1)}px, ${(this.narrow ? sun.Y + sun.R * 1.35 + 10 : below).toFixed(1)}px, 0) translateX(-50%)`;
    const hv = this.hover;
    if (hv && !this.drag && !this.touch) {
      const o = hv.kind === "moon" ? hv.sys && hv.sys.moons.get(hv.id) : hv.kind === "orb" ? this.orbs.get(hv.id) : null;
      if (o) this.tip.style.transform = `translate3d(${U.clamp(o.sx, 150, this.W - 150).toFixed(1)}px, ${(o.sy - o.r - 12).toFixed(1)}px, 0) translate(-50%, -100%)`;
    }
    if (!this._tt || this.time - this._tt > 0.5) {
      this._tt = this.time;
      this.focus.querySelectorAll("[data-live]").forEach(el => { const t = Store.task(el.dataset.live); if (t) el.textContent = U.fmtClock(Store.burned(t)); });
    }
  },
  drawTargets(ctx) {
    const d = this.drag, t = this.time, sun = this.sun;
    ctx.save();
    if (d.kind === "moon") {
      const on = d.sunTarget;
      ctx.strokeStyle = on ? "rgba(255,220,160,.95)" : "rgba(255,200,140,.42)"; ctx.lineWidth = on ? 2 : 1.3;
      ctx.setLineDash([2, 7]); ctx.lineDashOffset = -t * 20;
      ctx.beginPath(); ctx.arc(sun.X, sun.Y, sun.R * (on ? 1.55 : 1.42), 0, Math.PI * 2); ctx.stroke();
    }
    for (const s of this.systems.values()) {
      if (d.kind === "moon" && s.id === d.sysId) continue;
      const on = d.target === s;
      ctx.strokeStyle = on ? s.body.color : "rgba(255,255,255,.2)"; ctx.globalAlpha = on ? 0.95 : 0.7;
      ctx.lineWidth = on ? 1.8 : 1; ctx.setLineDash(on ? [] : [2, 6]); ctx.lineDashOffset = t * 10;
      ctx.beginPath(); ctx.arc(s.X, s.Y, s.R * 1.5 + 12, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  },

  /* ── 선택 · 호버 ── */
  pick(x, y) {
    const slop = this.touch ? 14 : 7; let best = null, bd = 1e9;
    for (const o of this.orbs.values()) { if (o.hidden) continue; const d = Math.hypot(x - o.sx, y - o.sy); if (d < o.r + slop && d < bd) { bd = d; best = { kind: "orb", id: o.id }; } }
    for (const s of this.systems.values()) for (const m of s.moons.values()) {
      if (m.hidden || !m.match) continue; const d = Math.hypot(x - m.sx, y - m.sy);
      if (d < m.r + slop && d < bd) { bd = d; best = { kind: "moon", id: m.id, sys: s }; }
    }
    if (best) return best;
    for (const s of this.systems.values()) if (Math.hypot(x - s.X, y - s.Y) < s.R + 4) return { kind: "planet", id: s.id, sys: s };
    if (Math.hypot(x - this.sun.X, y - this.sun.Y) < this.sun.R * 1.05) return { kind: "sun", id: "sun" };
    return null;
  },
  nearSystem(x, y) { for (const s of this.systems.values()) if (Math.hypot(x - s.X, y - s.Y) < s.ext + 26) return s; return null; },
  setHover(h) {
    const same = h && this.hover ? h.kind === this.hover.kind && h.id === this.hover.id : !h && !this.hover;
    this.hover = h; if (same) return;
    if (h && (h.kind === "moon" || h.kind === "orb") && !this.touch) this.showTip(h); else this.tip.hidden = true;
  },
  showTip(h) {
    const t = Store.task(h.id); if (!t) { this.tip.hidden = true; return; }
    const p = Store.planet(t.planetId), late = Store.isOverdue(t), meta = [];
    if (t.status === "doing") meta.push(`<span class="hot">${ico("flame", 12)}${U.fmtDuration(Store.burned(t))} 집중 중</span>`);
    if (t.due) meta.push(`<span class="${late ? "late" : ""}">${ico(late ? "alert" : "calendar", 12)}${U.relDate(t.due)}${t.time ? " " + U.fmtTime(t.time) : ""}</span>`);
    else if (t.time) meta.push(`<span>${ico("clock", 12)}${U.fmtTime(t.time)}</span>`);
    if (t.important) meta.push(`<span class="imp">${ico("star", 12)}중요</span>`);
    if (t.steps.length) meta.push(`<span>${ico("list", 12)}${t.steps.filter(s => s.done).length}/${t.steps.length}</span>`);
    if (t.repeat && t.repeat !== "none") meta.push(`<span>${ico("repeat", 12)}반복</span>`);
    this.tip.innerHTML = `<div class="tt-top"><i style="--c:${p ? pColor(p) : "#fff"}"></i>${U.esc(p ? p.name : "")}</div><div class="tt-title">${U.esc(t.title)}</div>${meta.length ? `<div class="tt-meta">${meta.join("")}</div>` : ""}<div class="tt-hint">${h.kind === "orb" ? "클릭해서 열기 · 행성으로 끌면 궤도 복귀" : "클릭해서 열기 · 태양으로 끌면 집중 시작"}</div>`;
    this.tip.hidden = false;
  },

  /* ── 포인터 · 드래그 앤 드롭 ── */
  bind() {
    window.addEventListener("resize", () => this.measure());
    const st = this.stage;
    st.addEventListener("pointermove", e => this.onMove(e));
    st.addEventListener("pointerleave", () => { this.systems.forEach(s => { s.hover = false; }); if (!this.drag) this.setHover(null); st.style.cursor = ""; });
    st.addEventListener("pointerdown", e => this.onDown(e));
    window.addEventListener("pointermove", e => { this.par.tx = e.clientX / window.innerWidth - 0.5; this.par.ty = e.clientY / window.innerHeight - 0.5; }, { passive: true });
    this.focus.addEventListener("pointerdown", e => {
      if (e.target.closest(".f-done, .f-more")) return;
      const card = e.target.closest(".fcard"); if (!card) return;
      this.startPending(e, { kind: "orb", id: card.dataset.id, sysId: null });
    });
    this.focus.addEventListener("click", e => {
      const b = e.target.closest("[data-act]"); if (!b) return;
      if (b.dataset.act === "done") App.completeTask(b.closest(".fcard").dataset.id);
      else if (b.dataset.act === "more") App.openToday();
    });
    this.focus.addEventListener("keydown", e => { const m = e.target.closest(".f-main"); if (m && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); App.openTask(m.closest(".fcard").dataset.id); } });
  },
  onMove(e) {
    if (this.drag || e.pointerType !== "mouse") return;
    const x = e.clientX, y = e.clientY;
    for (const s of this.systems.values()) s.hover = Math.hypot(x - s.X, y - s.Y) < s.ext + 26;
    if (e.target.closest("button, .fcard, .p-label, #hint")) { this.setHover(null); this.stage.style.cursor = ""; return; }
    const hit = this.pick(x, y); this.setHover(hit);
    this.stage.style.cursor = hit ? (hit.kind === "moon" || hit.kind === "orb" ? "grab" : "pointer") : "";
  },
  onDown(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.target.closest("button, a, input, .fcard, .p-label")) return;
    const x = e.clientX, y = e.clientY;
    if (e.pointerType !== "mouse") { const ns = this.nearSystem(x, y); this.systems.forEach(s => { s.pinned = s === ns; }); }
    const hit = this.pick(x, y); if (!hit) return;
    this.startPending(e, { kind: hit.kind, id: hit.id, sysId: hit.sys ? hit.sys.id : null });
  },
  startPending(e, o) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    this.drag = Object.assign({ pending: true, x0: e.clientX, y0: e.clientY, target: null, sunTarget: false }, o);
    this._mv = ev => this.onDragMove(ev); this._up = ev => this.onUp(ev);
    window.addEventListener("pointermove", this._mv); window.addEventListener("pointerup", this._up); window.addEventListener("pointercancel", this._up);
  },
  beginDrag(d) {
    d.pending = false;
    const t = Store.task(d.id), p = t && Store.planet(t.planetId); d.color = p ? pColor(p) : "#ffffff";
    this.ghost.className = "drag-ghost" + (d.kind === "orb" ? " is-orb" : "");
    this.ghost.style.setProperty("--c", d.color);
    this.ghost.innerHTML = `<span class="g-orb"></span><span class="g-title">${U.esc(t ? t.title : "")}</span>`;
    this.ghost.hidden = false; document.body.classList.add("dragging"); this.setHover(null);
    if (d.kind === "orb") this.focus.querySelector(`.fcard[data-id="${d.id}"]`)?.classList.add("lifted");
  },
  onDragMove(e) {
    const d = this.drag; if (!d) return;
    const x = e.clientX, y = e.clientY;
    if (d.pending) {
      if (Math.hypot(x - d.x0, y - d.y0) < (e.pointerType === "mouse" ? 6 : 10)) return;
      if (d.kind !== "moon" && d.kind !== "orb") { this.endDrag(); return; }
      this.beginDrag(d);
    }
    this.ghost.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    const sunT = d.kind === "moon" && Math.hypot(x - this.sun.X, y - this.sun.Y) < this.sun.R + 60;
    let target = null, bd = 1e9;
    if (!sunT) for (const s of this.systems.values()) { const dd = Math.hypot(x - s.X, y - s.Y); if (dd < s.R * 1.6 + 30 && dd < bd) { bd = dd; target = s; } }
    if (target && d.kind === "moon" && target.id === d.sysId) target = null;
    if (sunT !== d.sunTarget) { d.sunTarget = sunT; this.ghost.classList.toggle("over-sun", sunT); }
    d.target = target; this.updateHint();
    if (!this.reduced && Math.random() < 0.55) FX.trail(x, y, sunT ? "#ffd08a" : d.color);
  },
  onUp(e) {
    const d = this.drag; this.endDrag(); if (!d) return;
    if (d.pending) {
      if (d.kind === "moon" || d.kind === "orb") App.openTask(d.id);
      else if (d.kind === "planet") App.openPlanet(d.id);
      else if (d.kind === "sun") App.openToday();
      return;
    }
    const t = Store.task(d.id); if (!t) return;
    const pos = { x: e.clientX, y: e.clientY, t0: this.time };
    if (d.sunTarget && d.kind === "moon") { this.lastPos.set(t.id, pos); App.startTask(t.id); return; }
    if (!d.target) return;
    const pid = d.target.id, moved = pid !== t.planetId, name = d.target.planet.name;
    this.lastPos.set(t.id, pos);
    if (d.kind === "orb") {
      if (moved) Store.updateTask(t.id, { planetId: pid });
      Store.stopTask(t.id);
      App.toast("orbitBack", moved ? `${name} 궤도로 옮기고 타이머를 멈췄어요` : "궤도로 돌아왔어요 · 타이머 일시정지");
    } else if (moved) { Store.updateTask(t.id, { planetId: pid }); App.toast("orbit", `「${t.title}」 → ${name}`); }
  },
  endDrag() {
    window.removeEventListener("pointermove", this._mv); window.removeEventListener("pointerup", this._up); window.removeEventListener("pointercancel", this._up);
    this.drag = null; this.ghost.hidden = true; this.ghost.classList.remove("over-sun"); document.body.classList.remove("dragging");
    this.systems.forEach(s => { s.hover = false; });
    this.focus.querySelectorAll(".lifted").forEach(c => c.classList.remove("lifted"));
    this.updateHint();
  },

  /* ── WebGL 미지원 기기용 2D 대체 렌더 ── */
  loadFallback() { this.fb = {}; ["sun", "moon", ...BODY_ORDER].forEach(k => { const im = new Image(); im.src = thumbOf(k); this.fb[k] = im; }); },
  render2D(ctx) {
    if (this.view === "calendar" || !this.fb) return;
    const img = (k, x, y, R, sat) => { const im = this.fb[k]; if (!im || !im.complete || !im.naturalWidth) return; const h = R / (sat ? 0.42 : 0.8); ctx.drawImage(im, x - h, y - h, h * 2, h * 2); };
    const sun = this.sun, g = ctx.createRadialGradient(sun.X, sun.Y, sun.R * 0.8, sun.X, sun.Y, sun.R * 3);
    g.addColorStop(0, `rgba(255,170,80,${0.35 + sun.heat * 0.25})`); g.addColorStop(1, "rgba(255,120,40,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sun.X, sun.Y, sun.R * 3, 0, Math.PI * 2); ctx.fill();
    img("sun", sun.X, sun.Y, sun.R);
    for (const o of this.orbs.values()) { ctx.fillStyle = "#ffb050"; ctx.beginPath(); ctx.arc(o.sx, o.sy, o.r, 0, Math.PI * 2); ctx.fill(); }
    for (const s of this.systems.values()) {
      for (const m of s.moons.values()) if (m.z < 0) img("moon", m.sx, m.sy, m.r);
      img(s.key, s.X, s.Y, s.R, !!s.body.ring);
      for (const m of s.moons.values()) if (m.z >= 0) img("moon", m.sx, m.sy, m.r);
    }
  },
};
function hexRGB(h) { const n = parseInt(h.replace("#", ""), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }
