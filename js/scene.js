/* ═══════════════ 3D 우주 씬: 원근 카메라 · 동심 궤도의 행성계 · 위성(할 일) · 태양(집중) · 드래그 앤 드롭 ═══════════════
   월드 단위: 태양 반지름 2. 행성은 태양을 중심으로 한 동심 궤도에 놓이고, 계 전체가 아주 천천히 회전한다. */
"use strict";

const Scene = {
  stage: null, cvGL: null, labels: null, tags: null, focus: null, tip: null, ghost: null, hint: null,
  W: 1, H: 1, dpr: 1, time: 0, last: 0, view: "today", search: "", useGL: false, showNames: false,
  sun: { R: 2, heat: 0, heatT: 0, p: [0, 0, 0], sx: 0, sy: 0, sr: 40, w: 1 },
  cam: { fov: 0.58, az0: 0, el: 0.42, tEl: 0.42, dist: 60, tDist: 60, sx: 0, sy: 0, tsx: 0, tsy: 0, eye: [0, 0, 60], V: null, P: null, VP: null, focal: 600 },
  systems: new Map(), order: [], orbs: new Map(), hover: null, drag: null, carousel: 0, spin: 1,
  par: { x: 0, y: 0, tx: 0, ty: 0 }, narrow: false, touch: false, reduced: false, panelOpen: false, area: null,
  lastPos: new Map(), launch: null, q: 1, perf: { ema: 1 / 60, t: 0 }, idleAt: 0,
  SHELL_CAP: [6, 9, 12, 16, 22], HOLD: 380, DBL: 330, nowH: 0,
  v3d: { az: 0, el: 0, zoom: 1, taz: 0, tel: 0, tzoom: 1 }, focusId: null, fRef: null, ft: 0, autoRotate: true, orbitDrag: null, pinch: null, ptrs: new Map(),

  init() {
    this.stage = document.getElementById("stage"); this.cvGL = document.getElementById("gl");
    this.labels = document.getElementById("labels"); this.tags = document.getElementById("mtags");
    this.focus = document.getElementById("focus"); this.tip = document.getElementById("tooltip");
    this.ghost = document.getElementById("dragGhost"); this.hint = document.getElementById("sunHint");
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.showNames = !!Store.state.settings.moonNames; this.autoRotate = Store.state.settings.autoRotate !== false;
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
    this.cam.dist = this.cam.tDist; this.cam.sx = this.cam.tsx; this.cam.sy = this.cam.tsy; this.cam.el = this.cam.tEl;
    requestAnimationFrame(t => this.loop(t));
  },
  skyTex() { return Math.max(screen.width, screen.height) * (window.devicePixelRatio || 1) > 2400 && !this.touch ? TEX.sky : TEX.sky2k; },
  seed(id, k) { let h = 2166136261; const s = id + ":" + k; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; },
  panelW() { return Math.min(420, this.W * 0.36); },
  setNames(on) { this.showNames = on; Store.setSetting("moonNames", on); },

  /* ── 크기 · 카메라 ── */
  measure() {
    const r = this.stage.getBoundingClientRect();
    this.W = Math.max(1, r.width); this.H = Math.max(1, r.height);
    this.narrow = this.W < 640;
    this.touch = matchMedia("(hover: none) and (pointer: coarse)").matches;
    let dpr = Math.max(0.7, Math.min(window.devicePixelRatio || 1, 1.5) * this.q);
    const maxPx = 4.6e6; if (this.W * this.H * dpr * dpr > maxPx) dpr = Math.sqrt(maxPx / (this.W * this.H));
    this.dpr = dpr;
    if (this.useGL) GL.resize(this.W, this.H, dpr);
    FX.resize(this.W, this.H);
    document.body.classList.toggle("narrow", this.narrow); document.body.classList.toggle("touch", this.touch);
    this.layout();
    if (this._narrow !== this.narrow) { this._narrow = this.narrow; if (this.order.length) this.sync({}); }
  },
  orbitR(i) { return this.narrow ? 6.6 + i * 2.05 : 9 + i * 2.7; },
  shellR(s, i) { return s.R * (this.narrow ? 1.55 : 1.7) + 0.25 + i * (this.narrow ? 0.62 : 0.62); },
  moonR(t) { return ([0.24, 0.32, 0.27, 0.22][t.priority || 0]) * (this.narrow ? 1.45 : 1.12) * (this.touch ? 1.1 : 1); },
  layout() {
    const burning = this.orbs.size > 0, n = this.order.length;
    const top = this.narrow ? 124 : 92, bottom = this.H - (this.narrow ? 84 : 100) - (burning ? this.nowH : 0);
    const left = this.narrow ? 6 : 28 + (this.boardW || 0), right = this.W - (this.narrow ? 6 : 28) - (this.panelOpen && !this.narrow ? this.panelW() : 0);
    this.area = { top, bottom, left, right };
    this.order.forEach((id, i) => { const s = this.systems.get(id); if (!s) return; s.orbit = this.orbitR(i); s.ang0 = Math.PI / 2 + (i / Math.max(1, n)) * Math.PI * 2 + i * 0.35; s.R = (this.narrow ? 1.5 : 1.02) * s.body.size; });
    const asp = (right - left) / Math.max(1, bottom - top);
    this.cam.fov = this.narrow ? 0.6 : 0.4;
    this.cam.tEl = U.lerp(1.0, 0.44, U.clamp((asp - 0.6) / 1.1, 0, 1));
    this.fitCamera();
  },
  matrices(D, el, az, sx, sy, tg = [0, 0, 0]) {
    const eye = [tg[0] + Math.sin(az) * Math.cos(el) * D, tg[1] + Math.sin(el) * D, tg[2] + Math.cos(az) * Math.cos(el) * D];
    const V = M4.lookAt(eye, tg, [0, 1, 0]), P = M4.persp(this.cam.fov, this.W / this.H, Math.max(0.5, D * 0.05), D * 4 + 120, sx, sy);
    return { eye, V, P, VP: M4.mul(P, V) };
  },
  /* 모든 궤도(위성·라벨 여유 포함)가 사용 가능한 화면 영역에 들어가도록 거리와 렌즈 시프트를 찾는다 */
  fitCamera() {
    const a = this.area, n = this.order.length;
    let rmax = 8; for (const s of this.systems.values()) rmax = Math.max(rmax, s.orbit + (s.shells ? this.shellR(s, s.shells - 1) + 0.35 : s.R * 1.5));
    const pts = [];
    for (let i = 0; i < 48; i++) { const t = i / 48 * Math.PI * 2; pts.push([Math.cos(t) * rmax, 0.8, Math.sin(t) * rmax], [Math.cos(t) * rmax, -0.6, Math.sin(t) * rmax]); }
    pts.push([0, this.sun.R * 2.4, 0], [0, -this.sun.R * 2.2, 0]);
    const hw = (a.right - a.left) / this.W, hh = (a.bottom - a.top) / this.H, el = this.cam.tEl;
    const box = D => {
      const { VP } = this.matrices(D, el, this.cam.az0, 0, 0); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const p of pts) { const c = M4.xf(VP, p[0], p[1], p[2]); if (c[3] <= 0.05) return null; const x = c[0] / c[3], y = c[1] / c[3]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      return { x0, x1, y0, y1 };
    };
    let lo = 4, hi = 600;
    for (let k = 0; k < 34; k++) { const mid = (lo + hi) / 2, e = box(mid); if (e && (e.x1 - e.x0) / 2 <= hw && (e.y1 - e.y0) / 2 <= hh) hi = mid; else lo = mid; }
    const e = box(hi), rcx = (a.left + a.right) / this.W - 1, rcy = 1 - (a.top + a.bottom) / this.H;
    this.cam.tDist = hi; this.cam.tsx = rcx - (e.x0 + e.x1) / 2; this.cam.tsy = rcy - (e.y0 + e.y1) / 2;
  },
  setPanel(open) { this.panelOpen = open; this.layout(); },
  setBoard(w) { if (this.boardW === w) return; this.boardW = w; this.layout(); },
  project(p) { const c = M4.xf(this.cam.VP, p[0], p[1], p[2]), w = c[3] || 1e-6; return { x: (c[0] / w * 0.5 + 0.5) * this.W, y: (0.5 - c[1] / w * 0.5) * this.H, w }; },
  unproject(x, y, depth) {
    const inv = this.cam.inv || (this.cam.inv = M4.inv(this.cam.VP)); if (!inv) return [0, 0, 0];
    const nx = x / this.W * 2 - 1, ny = 1 - y / this.H * 2, a = M4.xf(inv, nx, ny, -1), b = M4.xf(inv, nx, ny, 1);
    const p0 = [a[0] / a[3], a[1] / a[3], a[2] / a[3]], p1 = [b[0] / b[3], b[1] / b[3], b[2] / b[3]];
    return V3.add(this.cam.eye, V3.scale(V3.norm(V3.sub(p1, p0)), depth));
  },

  /* ── 스토어 → 씬 ── */
  isOverlay() { return this.view === "calendar" || this.view === "list"; },
  setView(v) { this.view = v; if (this.isOverlay()) this.focusOn(null); this.sync({ type: "filter" }); },
  setNowH(h) { if (Math.abs(this.nowH - h) < 2) return; this.nowH = h; this.layout(); },
  setSearch(q) { this.search = (q || "").trim().toLowerCase(); },
  shellOf(i) { let acc = 0; for (let k = 0; k < this.SHELL_CAP.length; k++) { acc += this.SHELL_CAP[k]; if (i < acc) return k; } return this.SHELL_CAP.length - 1; },
  sync(d = {}) {
    const planets = Store.planets(), ids = new Set(planets.map(p => p.id));
    for (const [id, s] of this.systems) if (!ids.has(id)) { s.label.remove(); this.systems.delete(id); }
    if (this.focusId && !this.systems.has(this.focusId)) this.focusOn(null);
    planets.forEach(p => {
      let s = this.systems.get(p.id); if (!s) s = this.makeSystem(p);
      s.planet = p; s.body = bodyOf(p); s.key = bodyKey(p); s.tint = hexRGB(s.body.color); s.oc = s.tint.map(v => 0.55 + v * 0.45);
      s.nameEl.textContent = p.name; s.label.style.setProperty("--c", s.body.color);
    });
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
      list.forEach((m, i) => { m.shell = this.shellOf(i); m.speed = (Math.PI * 2) / (30 + m.shell * 12) * (m.shell % 2 ? -1 : 1); });
      s.shells = list.length ? this.shellOf(list.length - 1) + 1 : 0;
      const fire = doing.filter(t => t.planetId === s.id).length, late = list.filter(m => Store.isOverdue(m.task)).length, high = list.filter(m => m.task.priority === 1).length;
      s.metaEl.innerHTML = `<span>할 일 ${list.length}</span>${high ? `<span class="m-high">높음 ${high}</span>` : ""}${fire ? `<span class="m-fire">집중 ${fire}</span>` : ""}${late ? `<span class="m-late">지남 ${late}</span>` : ""}`;
      const max = this.narrow ? 2 : 3, open = list.map(m => m.task).sort(Store.sortTasks), rows = open.slice(0, max);
      s.listEl.innerHTML = rows.map(t => {
        const late = Store.isOverdue(t), side = late ? `<span class="pl-d late">지남</span>` : t.time && t.due === U.today() ? `<span class="pl-d">${U.fmtTime(t.time)}</span>` : "";
        return `<div class="pl-row ${t.priority ? "p" + t.priority : ""}" data-id="${t.id}" role="button" tabindex="0" aria-label="${U.esc(t.title)}"><i aria-hidden="true"></i><span class="tt">${U.esc(t.title)}</span>${side}</div>`;
      }).join("") + (open.length > max ? `<button type="button" class="pl-more">+${open.length - max}개 더</button>` : "");
      s.label.classList.toggle("empty", !list.length && !fire); s.label.classList.toggle("has-list", rows.length > 0); s.lm = 0;
      s.headEl.setAttribute("aria-label", `${s.planet.name} 행성, 할 일 ${list.length}개. 열기`);
    }
    const dset = new Set(doing.map(t => t.id));
    for (const [tid, o] of this.orbs) if (!dset.has(tid)) { if (d.type === "task-complete" && d.id === tid) this.burstAt(o.sx, o.sy, "#ffc070", true); this.orbs.delete(tid); }
    doing.forEach(t => { let o = this.orbs.get(t.id); if (!o) { o = { id: t.id, task: t, p: [0, 0, 0], sx: this.sun.sx, sy: this.sun.sy, sr: 4, w: 1, from: this.takeFrom(t.id) }; this.orbs.set(t.id, o); } o.task = t; });
    this.sun.heatT = doing.length ? Math.min(1, 0.55 + 0.15 * (doing.length - 1)) : 0;
    this.renderFocus(doing); this.updateHint();
    const burning = doing.length > 0;
    if (prev !== this.order.join(",") || d.type === "reset" || d.type === "init" || this._burning !== burning || d.type === "task-add" || d.type === "task-remove") { this._burning = burning; this.layout(); }
  },
  takeFrom(id) {
    let p = this.lastPos.get(id); this.lastPos.delete(id);
    if (!p && this.launch) { p = this.launch; this.launch = null; }
    return p && this.time - p.t0 < 2 ? { x: p.x, y: p.y, t0: this.time, p: null } : null;
  },
  makeSystem(p) {
    const el = document.createElement("div");
    el.className = "p-label"; el.dataset.id = p.id;
    el.innerHTML = `<span class="pl-lead" aria-hidden="true"></span><div class="pl-box"><button type="button" class="pl-head"><span class="pl-name"></span><span class="pl-meta"></span></button><div class="pl-list"></div></div>`;
    el.querySelector(".pl-head").addEventListener("click", () => App.openPlanet(p.id));
    /* 이름표 속 할 일 줄: 위성과 똑같이 클릭은 열기, 두 번 클릭·꾹 누르기는 잡기 */
    const lst = el.querySelector(".pl-list");
    lst.addEventListener("pointerdown", e => { const row = e.target.closest(".pl-row"); if (!row) return; e.stopPropagation(); this.startPending(e, { kind: "moon", id: row.dataset.id, sysId: p.id }); });
    lst.addEventListener("click", e => { if (e.target.closest(".pl-more")) App.openPlanet(p.id); });
    lst.addEventListener("keydown", e => { const row = e.target.closest(".pl-row"); if (row && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); App.openTask(row.dataset.id); } });
    lst.addEventListener("pointerover", e => { const row = e.target.closest(".pl-row"); if (row && e.pointerType === "mouse" && !this.drag) this.listHover = row.dataset.id; });
    lst.addEventListener("pointerout", e => { const row = e.target.closest(".pl-row"); if (row && !row.contains(e.relatedTarget) && this.listHover === row.dataset.id) this.listHover = null; });
    el.addEventListener("pointerenter", () => { const s = this.systems.get(p.id); if (s) s.labelHover = true; });
    el.addEventListener("pointerleave", () => { const s = this.systems.get(p.id); if (s) s.labelHover = false; });
    this.labels.appendChild(el);
    const sd = k => this.seed(p.id, k);
    const s = {
      id: p.id, planet: p, body: bodyOf(p), key: bodyKey(p), label: el, headEl: el.querySelector(".pl-head"), listEl: lst, nameEl: el.querySelector(".pl-name"), metaEl: el.querySelector(".pl-meta"),
      moons: new Map(), shells: 0, orbit: 8, ang0: 0, R: 0.8, p: [0, 0, 0], h: 0, hover: false, labelHover: false, pinned: false,
      bob: [sd(1) * 6.28, 0.35 + sd(2) * 0.25, sd(3) * 6.28], incl: 0.32 + sd(4) * 0.4, node: sd(5) * Math.PI * 2, rot0: sd(6) * Math.PI * 2,
      sx: 0, sy: 0, sr: 10, w: 1, ext: 40, n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1], born: this.time,
    };
    this.systems.set(p.id, s);
    return s;
  },
  makeMoon(s, t) {
    const TAU = Math.PI * 2, angles = [...s.moons.values()].map(m => m.angle);
    let best = Math.random() * TAU;
    if (angles.length) { let bd = -1; for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU; const dd = Math.min(...angles.map(e => { const x = Math.abs(a - e) % TAU; return Math.min(x, TAU - x); })); if (dd > bd) { bd = dd; best = a; } } }
    return { id: t.id, task: t, angle: best, shell: 0, speed: 0.2, p: s.p.slice(), sx: s.sx, sy: s.sy, sr: 3, w: 1, hidden: false, match: true, seed: this.seed(t.id, 1) * 6.28, from: this.takeFrom(t.id) };
  },
  renderFocus(doing) {
    const max = this.narrow ? 8 : 4, shown = doing.slice(0, max);
    this.focus.hidden = true; document.body.classList.remove("has-focus"); return;
    this.focus.innerHTML = (this.narrow ? "" : `<div class="f-head"><span class="f-dot"></span>집중 중<span class="n">${doing.length}</span></div>`) + shown.map(t => {
      const p = Store.planet(t.planetId);
      return `<div class="fcard" data-id="${t.id}" style="--c:${p ? pColor(p) : "#fff"}">
        <div class="f-main" role="button" tabindex="0"><span class="f-title">${U.esc(t.title)}</span><span class="f-meta"><span class="f-pl">${U.esc(p ? p.name : "")}</span><span class="f-timer" data-live="${t.id}">${U.fmtClock(Store.burned(t))}</span></span></div>
        <button type="button" class="f-done" data-act="done" aria-label="완료" title="완료">${ico("check", 16)}</button></div>`;
    }).join("") + (doing.length > max ? `<button type="button" class="f-more" data-act="more">${doing.length - max}개 더 보기</button>` : "");
  },
  updateHint() {
    const el = this.hint, d = this.drag && !this.drag.pending ? this.drag : null;
    let txt = "", sub = "";
    if (d && d.sticky) { const tap = this.touch ? "탭" : "클릭"; txt = d.sunTarget ? `${tap}하면 점화돼요` : d.target ? `${tap}하면 ${d.target.planet.name}${U.josa(d.target.planet.name, "으로", "로")} 옮겨요` : `놓을 곳을 ${tap}하세요`; sub = d.kind === "orb" ? "행성: 궤도로 복귀 · 빈 곳: 취소" : `태양: 집중 · 다른 행성: 이동 · 빈 곳${this.touch ? "" : "이나 Esc"}: 취소`; }
    else if (d) { txt = d.kind === "orb" ? "행성에 놓으면 궤도로 돌아가요" : d.sunTarget ? "놓으면 점화돼요" : "태양에 놓으면 집중을 시작해요"; sub = d.kind === "orb" ? "타이머는 일시정지돼요" : "다른 행성에 놓으면 카테고리가 바뀌어요"; }
    else if (!this.orbs.size && !this.focusId) {
      const any = [...this.systems.values()].some(s => s.moons.size);
      txt = any ? "위성을 태양으로 끌어 오세요" : (this.view === "today" ? "오늘 남은 할 일이 없어요" : "할 일이 없어요");
      sub = any ? "놓는 순간 집중 타이머가 시작돼요" : "아래 입력창에서 새 할 일을 추가해 보세요";
    }
    el.hidden = !txt; el.classList.toggle("active", !!(d && d.sunTarget));
    if (txt && (el._t !== txt || el._s !== sub)) { el._t = txt; el._s = sub; el.innerHTML = `<b>${txt}</b><span>${sub}</span>`; }
  },
  burstAt(x, y, color, big) {
    if (x == null) return;
    FX.burst(x, y, color, big ? 70 : 46, big ? 1.3 : 1); FX.ring(x, y, 4, color, big ? 120 : 80, 0.7);
    if (big) FX.ring(this.sun.sx, this.sun.sy, this.sun.sr, "#ffb35c", 220, 1.1);
  },

  /* ── 프레임 ── */
  loop(ts) {
    const now = ts / 1000, raw = now - (this.last || now), dt = Math.min(0.05, raw); this.last = now;
    if (document.visibilityState === "visible" && raw > 0 && raw < 0.25) { this.perf.ema += (raw - this.perf.ema) * 0.05; this.perf.t += raw; if (this.perf.t > 2.5) { this.perf.t = 0; this.adapt(); } }
    this.time += dt;
    this.update(dt);
    if (this.useGL && GL.ok) this.renderGL();
    this.renderOverlay(dt);
    requestAnimationFrame(t => this.loop(t));
  },
  adapt() {
    const e = this.perf.ema;
    if (e > 0.021 && this.q > 0.6) { this.q = Math.max(0.6, this.q - 0.15); this.measure(); }
    else if (e < 0.0135 && this.q < 1) { this.q = Math.min(1, this.q + 0.1); this.measure(); }
  },
  update(dt) {
    const t = this.time, cam = this.cam, sun = this.sun, k = Math.min(1, dt * 2.2), fl = this.reduced ? 0 : 1;
    this.par.x += (this.par.tx - this.par.x) * Math.min(1, dt * 1.6); this.par.y += (this.par.ty - this.par.y) * Math.min(1, dt * 1.6);
    const px = this.touch ? 0 : this.par.x, py = this.touch ? 0 : this.par.y;
    let busy = !!this.drag || !!this.orbitDrag || !!this.focusId || this.panelOpen || !this.autoRotate || (this.hover && this.hover.kind !== "sun");
    for (const s of this.systems.values()) if (s.hover || s.labelHover || s.pinned) busy = true;
    this.spin += ((this.reduced || busy ? 0 : 1) - this.spin) * Math.min(1, dt * 1.5);
    this.carousel += dt * this.spin * (Math.PI * 2 / 600);
    cam.dist += (cam.tDist - cam.dist) * k; cam.sx += (cam.tsx - cam.sx) * k; cam.sy += (cam.tsy - cam.sy) * k; cam.el += (cam.tEl - cam.el) * k;
    /* 사용자 시점(회전·확대)과 포커스 모드를 부드럽게 섞는다 */
    const v = this.v3d, kv = Math.min(1, dt * 7);
    v.az += (v.taz - v.az) * kv; v.el += (v.tel - v.el) * kv; v.zoom += (v.tzoom - v.zoom) * Math.min(1, dt * 6);
    const fs = this.focusId ? this.systems.get(this.focusId) : null; if (fs) this.fRef = fs;
    const dragOut = this.drag && !this.drag.pending && this.drag.kind === "moon";
    this.ft += ((fs && !dragOut ? 1 : 0) - this.ft) * Math.min(1, dt * 2.6);
    const fe = this.ft * this.ft * (3 - 2 * this.ft), fr = this.fRef && this.systems.has(this.fRef.id) ? this.fRef : null;
    let tg = [0, 0, 0], D = cam.dist, sx = cam.sx, sy = cam.sy, elB = cam.el, azF = 0;
    if (fr && fe > 0.001) {
      const c = this.areaCenter(); tg = V3.scale(fr.p, fe); D = U.lerp(cam.dist, this.focusDist(fr), fe); sx = U.lerp(cam.sx, c[0], fe); sy = U.lerp(cam.sy, c[1], fe); elB = U.lerp(cam.el, Math.min(cam.el, 0.42), fe);
      if (fr.faz == null || !fs) fr.faz = Math.atan2(fr.p[0], fr.p[2]) + 0.6;
      let d = fr.faz - (cam.az0 + v.az); d = Math.atan2(Math.sin(d), Math.cos(d)); azF = d * fe;
    }
    if (!fs && this.fRef) this.fRef.faz = null;
    D *= v.zoom; this.fe = fe;
    const az = cam.az0 + v.az + azF + Math.sin(t * 0.06) * 0.03 * fl + px * 0.09 * (1 - fe * 0.6);
    const el = U.clamp(elB + v.el + Math.sin(t * 0.045 + 1) * 0.012 * fl - py * 0.05, 0.06, 1.45);
    cam.azNow = az; cam.elNow = el;
    const mt = this.matrices(D, el, az, sx, sy, tg);
    cam.eye = mt.eye; cam.V = mt.V; cam.P = mt.P; cam.VP = mt.VP; cam.inv = null; cam.focal = this.H / 2 / Math.tan(cam.fov / 2);
    sun.heat += (sun.heatT - sun.heat) * Math.min(1, dt * 1.4);
    const sp = this.project(sun.p); sun.sx = sp.x; sun.sy = sp.y; sun.w = sp.w; sun.sr = sun.R * cam.focal / sp.w;
    for (const s of this.systems.values()) {
      const ang = s.ang0 + this.carousel, bob = Math.sin(t * s.bob[1] + s.bob[0]) * 0.24 * fl;
      s.p = V3.lerp(s.p, [Math.cos(ang) * s.orbit, bob, Math.sin(ang) * s.orbit], Math.min(1, dt * (t - s.born < 3 ? 2.4 : 4)));
      const want = (s.hover || s.labelHover || s.pinned || s.id === this.focusId || (this.drag && this.drag.target === s)) ? 1 : 0;
      s.h += (want - s.h) * Math.min(1, dt * 5);
      s.rot = s.rot0 + t * Math.PI * 2 / s.body.spin;
      const pp = this.project(s.p); s.sx = pp.x; s.sy = pp.y; s.w = pp.w; s.sr = s.R * cam.focal / pp.w;
      const n0 = [Math.sin(s.incl) * Math.cos(s.node), Math.cos(s.incl), Math.sin(s.incl) * Math.sin(s.node)];
      const n = V3.norm(V3.lerp(n0, V3.norm(V3.sub(cam.eye, s.p)), s.h * 0.9));
      const u = V3.norm(V3.cross(Math.abs(n[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0], n)), v = V3.cross(n, u);
      s.n = n; s.u = u; s.v = v; s.spread = U.lerp(1, 1.16, s.h);
      const spin = U.lerp(1, 0.04, s.h) * (this.touch ? 0.6 : 1) * (this.reduced ? 0.25 : 1);
      let ext = s.sr * 1.4;
      for (const m of s.moons.values()) {
        if (!(this.drag && this.drag.id === m.id && !this.drag.pending)) m.angle += m.speed * spin * dt;
        const ro = this.shellR(s, m.shell) * s.spread, ca = Math.cos(m.angle), sa = Math.sin(m.angle);
        let p = [s.p[0] + (u[0] * ca + v[0] * sa) * ro, s.p[1] + (u[1] * ca + v[1] * sa) * ro, s.p[2] + (u[2] * ca + v[2] * sa) * ro];
        if (m.from) {
          if (!m.from.p) m.from.p = this.unproject(m.from.x, m.from.y, Math.hypot(...V3.sub(p, cam.eye)));
          const e = U.clamp((t - m.from.t0) / 0.9, 0, 1), ee = 1 - Math.pow(1 - e, 3); p = V3.lerp(m.from.p, p, ee); if (e >= 1) m.from = null;
        }
        m.p = p;
        const mp = this.project(p); m.sx = mp.x; m.sy = mp.y; m.w = mp.w; m.sr = this.moonR(m.task) * cam.focal / mp.w;
        m.hidden = mp.w > s.w && Math.hypot(mp.x - s.sx, mp.y - s.sy) < s.sr * 0.96;
        m.match = !this.search || m.task.title.toLowerCase().includes(this.search);
        ext = Math.max(ext, Math.hypot(mp.x - s.sx, mp.y - s.sy) + m.sr);
      }
      s.ext = ext;
      s.hidden = s.w > sun.w && Math.hypot(s.sx - sun.sx, s.sy - sun.sy) < sun.sr * 0.98;
    }
    const list = [...this.orbs.values()], n = list.length;
    this.orbBase = (this.orbBase || 0) + dt * (this.reduced ? 0.08 : 0.32);
    const on = V3.norm(V3.lerp([0, 1, 0], V3.norm(cam.eye), 0.3)), ou = V3.norm(V3.cross([0, 0, 1], on)), ov = V3.cross(on, ou);
    list.forEach((o, i) => {
      const a = this.orbBase + (i / Math.max(1, n)) * Math.PI * 2, ro = sun.R * 1.75, ca = Math.cos(a), sa = Math.sin(a);
      let p = [(ou[0] * ca + ov[0] * sa) * ro, (ou[1] * ca + ov[1] * sa) * ro, (ou[2] * ca + ov[2] * sa) * ro];
      if (o.from) {
        if (!o.from.p) o.from.p = this.unproject(o.from.x, o.from.y, Math.hypot(...V3.sub(p, cam.eye)));
        const e = U.clamp((t - o.from.t0) / 1.0, 0, 1), ee = 1 - Math.pow(1 - e, 3); p = V3.lerp(o.from.p, p, ee); if (e >= 1) o.from = null;
      }
      o.p = p;
      const q = this.project(p); o.sx = q.x; o.sy = q.y; o.w = q.w; o.sr = 0.3 * cam.focal / q.w;
      o.hidden = q.w > sun.w && Math.hypot(q.x - sun.sx, q.y - sun.sy) < sun.sr;
    });
  },

  /* ── 렌더: 배경 → 불투명(태양·행성·위성) → 반투명(고리·궤도선) → 가산(코로나·대기·고리 표시) ── */
  renderGL() {
    const t = this.time, tt = t % 3600, cal = this.isOverlay(), sun = this.sun, d = this.drag && !this.drag.pending ? this.drag : null;
    GL.begin();
    const yaw = (this.cam.azNow || 0) - this.cam.az0, pitch = (this.cam.elNow || this.cam.el) - this.cam.el;
    GL.drawBg({ sky: this.skyTex(), time: t, off: [this.par.x * 40 - yaw * this.W * 0.55, this.par.y * 30 + pitch * this.H * 0.55], rot: [-yaw / (Math.PI * 2), pitch * 0.12], dim: cal ? 0.5 : 1, exp: 1.9, stars: 1 });
    if (cal) return;
    G3.frame(this.cam); G3.opaque();
    const heat = Math.max(sun.heat, d && d.sunTarget ? 0.45 : 0);
    G3.drawSun({ model: M4.model(sun.p, 0.12, t * 0.02, sun.R * (d && d.sunTarget ? 1.05 : 1)), time: tt, heat });
    for (const s of this.systems.values()) {
      const b = s.body, tilt = b.tilt * Math.PI / 180, R = s.R * (d && d.target === s ? 1.08 : 1);
      s.tilt = tilt; s.Rd = R;
      G3.drawPlanet({ model: M4.model(s.p, tilt, s.rot, R), tex: b.tex, night: b.night, clouds: b.clouds, cloudRot: t * 0.0035, atm: b.atm, atmK: b.atmK, limb: b.limb, spec: s.key === "earth" ? 1 : 0, lift: s.h * 0.12, time: tt,
        ring: b.ring ? { tex: b.ring, n: [-Math.sin(tilt), Math.cos(tilt), 0], c: s.p, inner: 1.24 * R, outer: 2.27 * R } : null });
      for (const m of s.moons.values()) {
        if (d && d.id === m.id) continue;
        G3.drawPlanet({ model: M4.model(m.p, 0, m.seed + m.angle * 0.3, this.moonR(m.task)), mesh: G3.M.lo, tex: TEX.moon, tint: [s.tint[0], s.tint[1], s.tint[2], 0.32], lift: m.match ? 0.1 : -0.75, time: tt });
      }
    }
    for (const o of this.orbs.values()) { if (d && d.id === o.id) continue; G3.drawPlanet({ model: M4.model(o.p, 0, t * 0.6, 0.3), mesh: G3.M.lo, tex: TEX.moon, fire: 0.8 + 0.12 * Math.sin(t * 6 + o.sr), time: tt }); }
    G3.translucent();
    for (const s of this.systems.values()) if (s.body.ring) G3.drawRing({ model: M4.model(s.p, s.tilt, 0, s.Rd), tex: s.body.ring, center: s.p, R: s.Rd });
    for (const s of this.systems.values()) G3.drawLine({ model: M4.model([0, 0, 0], 0, 0, s.orbit), center: [0, 0, 0], color: [0.72, 0.78, 0.95], alpha: 0.16 + 0.14 * s.h });
    for (const s of this.systems.values()) for (let i = 0; i < s.shells; i++) G3.drawLine({ model: M4.basis(s.p, s.u, s.n, s.v, this.shellR(s, i) * s.spread), center: s.p, color: s.oc, alpha: 0.2 + 0.3 * s.h });
    G3.drawGlow({ pos: sun.p, size: sun.R * 3.4, mode: 0, scale: 3.4, time: tt, heat });
    for (const s of this.systems.values()) {
      if (s.body.atmK) { const dx = sun.sx - s.sx, dy = sun.sy - s.sy, l = Math.hypot(dx, dy) || 1; G3.drawGlow({ pos: s.p, size: s.Rd * 1.4, mode: 1, scale: 1.4, color: s.body.atm, k: s.body.atmK, ld: [dx / l, -dy / l] }); }
      for (const m of s.moons.values()) {
        if (d && d.id === m.id) continue;
        const hov = (this.hover && this.hover.id === m.id) || this.listHover === m.id || (Panel.mode === "task" && Panel.id === m.id), late = Store.isOverdue(m.task), pr = m.task.priority || 0;
        if (!hov && !late && !pr) continue;
        const pc = pr ? hexRGB(PRIO[pr].color) : [1, 0.36, 0.42], pulse = late ? 0.65 + 0.35 * Math.sin(t * 3.5) : 1;
        const c = hov ? [1, 1, 1] : pc, kk = hov ? 1 : (pr === 3 ? 0.5 : pr === 2 ? 0.75 : 0.95) * pulse;
        G3.drawGlow({ pos: m.p, size: this.moonR(m.task) * 2.1, mode: 2, scale: 2.1, color: c, k: kk });
      }
    }
    for (const o of this.orbs.values()) if (!(d && d.id === o.id)) G3.drawGlow({ pos: o.p, size: 0.3 * 2.8, mode: 3, scale: 2.8, k: 0.9 });
  },

  /* ── 2D 오버레이 · DOM ── */
  renderOverlay(dt) {
    const ctx = FX.ctx, cal = this.isOverlay();
    FX.clear();
    if (!(this.useGL && GL.ok)) this.render2D(ctx);
    if (!cal) {
      FX.dust(dt, this.par.x, this.par.y, this.reduced);
      if (this.drag && !this.drag.pending) this.drawTargets(ctx);
      if (this.drag && this.drag.pending && this.drag.hold) this.drawHold(ctx, this.drag);
      if (this.sun.heat > 0.03 && !this.reduced) { const rate = (4 + this.sun.heat * 34) * dt; let n = Math.floor(rate) + (Math.random() < rate % 1 ? 1 : 0); while (n-- > 0) FX.ember(this.sun.sx, this.sun.sy, this.sun.sr, this.sun.heat); }
    }
    FX.update(dt); FX.draw();
    this.placeDom();
  },
  placeDom() {
    const W = this.W, near = Math.min(...[...this.systems.values()].map(s => s.w)), far = Math.max(...[...this.systems.values()].map(s => s.w));
    for (const s of this.systems.values()) {
      s.pref = [s.sx > W - 210 && s.sx > W / 2, s.lh > 0 && s.sy - s.sr * 0.72 - 14 - s.lh < this.area.top - 20];
      s.label.classList.toggle("hot", s.h > 0.5 || (this.listHover && s.moons.has(this.listHover))); s.label.classList.toggle("hid", s.hidden || (s.id === this.focusId && this.fe > 0.5));
      const depth = far > near ? (s.w - near) / (far - near) : 0, other = this.focusId && s.id !== this.focusId;
      s.label.style.setProperty("--dim", (other ? 0.32 : 1 - depth * 0.35).toFixed(2));
    }
    this.cullLabels();
    this.placeTags();
    const sun = this.sun;
    this.hint.style.transform = `translate3d(${sun.sx.toFixed(1)}px, ${(sun.sy + sun.sr * 1.55 + 14).toFixed(1)}px, 0) translateX(-50%)`;
    const hv = this.hover;
    if (hv && !this.drag && !this.touch) {
      const o = hv.kind === "moon" ? hv.sys && hv.sys.moons.get(hv.id) : hv.kind === "orb" ? this.orbs.get(hv.id) : null;
      if (o) this.tip.style.transform = `translate3d(${U.clamp(o.sx, 150, W - 150).toFixed(1)}px, ${(o.sy - o.sr - 14).toFixed(1)}px, 0) translate(-50%, -100%)`;
    }
    if (!this._tt || this.time - this._tt > 0.5) {
      this._tt = this.time;
      this.focus.querySelectorAll("[data-live]").forEach(el => { const t = Store.task(el.dataset.live); if (t) el.textContent = U.fmtClock(Store.burned(t)); });
    }
  },
  /* 라벨이 겹치면 가까운 행성·강조된 행성을 먼저 살리고, 나머지는 이름만 남기거나 숨긴다 */
  cullLabels() {
    /* 단계: 0 할 일 줄까지 · 1 이름과 개수 · 2 이름만 · 3 숨김.
       방향(오른쪽 위 → 아래 → 왼쪽)을 바꿔 가며 겹치지 않는 가장 자세한 단계를 고른다. 지난 프레임 방향을 먼저 써서 깜박임을 막는다 */
    const placed = [], hit = (a, b) => a[0] < b[2] + 4 && a[2] + 4 > b[0] && a[1] < b[3] + 2 && a[3] + 2 > b[1], W = this.W, A = this.area;
    const sun = this.sun, discs = [[sun.sx - sun.sr * 1.1, sun.sy - sun.sr * 1.1, sun.sx + sun.sr * 1.1, sun.sy + sun.sr * 1.1, "sun"]];
    for (const o of this.systems.values()) if (!o.hidden) discs.push([o.sx - o.sr, o.sy - o.sr, o.sx + o.sr, o.sy + o.sr, o.id]);
    /* 화면 위에 떠 있는 UI(보드 · 시점 버튼 · 집중 바)는 1초마다 다시 재서 이름표가 그 밑으로 숨지 않게 한다 */
    if (!this._obT || this.time - this._obT > 1) {
      this._obT = this.time;
      this._ob = ["board", "boardPill", "viewCtl", "nowbar", "focusChip"].map(id => document.getElementById(id)).filter(el => el && !el.hidden).map(el => el.getBoundingClientRect()).filter(q => q.width > 0).map(q => [q.left, q.top, q.right, q.bottom]);
    }
    placed.push(...this._ob);
    const anchor = (s, f, d) => [s.sx + (f ? -1 : 1) * s.sr * 0.72, s.sy + (d ? 1 : -1) * s.sr * 0.72];
    const rect = (s, f, d, w, h) => { const [ax, ay] = anchor(s, f, d), x0 = f ? ax - 14 - w : ax + 14, y0 = d ? ay + 14 : ay - 14 - h; return [x0, y0, x0 + w, y0 + h]; };
    const list = [...this.systems.values()].sort((a, b) => ((b.h > 0.5) - (a.h > 0.5)) || ((b.id === this.focusId) - (a.id === this.focusId)) || (a.w - b.w));
    for (const s of list) {
      if (!s.lm) {
        const L = s.label, keep = ["compact", "cull", "sum"].filter(c => L.classList.contains(c)); L.classList.remove(...keep);
        const box = L.querySelector(".pl-box"); s.lw = box.offsetWidth; s.lh = box.offsetHeight; s.sw = s.headEl.offsetWidth + 8; s.sh = s.headEl.offsetHeight + 6; s.cw = s.nameEl.offsetWidth + 8; s.lm = 1;
        L.classList.add(...keep);
      }
      const pref = s.pref || [false, false], [pf, pd] = pref;
      const oris = [[pf, pd], [pf, !pd], [!pf, pd], [!pf, !pd]]; if (s.ori) oris.unshift(s.ori);
      let mode = 3, ori = s.ori || pref, box = null;
      if (!s.label.classList.contains("hid")) {
        const other = this.focusId && s.id !== this.focusId, hasList = s.label.classList.contains("has-list");
        const tries = [[0, s.lw, s.lh], [1, s.sw, s.sh], [2, s.cw, 18]];
        search: for (const [m, w, h] of tries) {
          if (m === 0 && (!hasList || other)) continue;
          for (const [f, d] of oris) {
            const q = rect(s, f, d, w, h);
            if (m === 0 ? !(q[0] > 4 && q[2] < W - 4 && q[1] > A.top - 24 && q[3] < A.bottom + 30) : !(q[0] > -8 && q[2] < W + 8 && q[1] > 36)) continue;
            if (placed.some(p => hit(p, q))) continue;
            if (m === 0 && discs.some(p => p[4] !== s.id && hit(p, q))) continue;
            mode = m; ori = [f, d]; box = q; break search;
          }
        }
        if (box) { placed.push(box); s.ori = ori; }
      } else { ori = pref; s.ori = null; mode = -1; }
      const [ax, ay] = anchor(s, ori[0], ori[1]);
      s.label.style.transform = `translate3d(${ax.toFixed(1)}px, ${ay.toFixed(1)}px, 0)`;
      s.label.classList.toggle("flip", ori[0]); s.label.classList.toggle("down", ori[1]);
      s.label.classList.toggle("sum", mode === 1); s.label.classList.toggle("compact", mode === 2); s.label.classList.toggle("cull", mode === 3);
    }
  },
  /* 위성 옆 할 일 이름: 행성에 올렸을 때(또는 설정에서 항상) 보여 준다 */
  placeTags() {
    const pool = this.tagPool || (this.tagPool = []), items = [], dragging = this.drag && !this.drag.pending;
    if (this.view !== "calendar" && !dragging) for (const s of this.systems.values()) {
      const live = s.h > 0.55; if (!(this.showNames || live || (this.listHover && s.moons.has(this.listHover)))) continue;
      for (const m of s.moons.values()) if (!m.hidden && m.match && m.sr > 1.5 && (live || this.showNames || m.id === this.listHover)) {
        const w = (this.tagW && this.tagW.get(m.id)) || 140; let left = m.sx < s.sx;
        if (left && m.sx - m.sr - 8 - w < 6) left = false; else if (!left && m.sx + m.sr + 8 + w > this.W - 6) left = true;
        items.push({ m, s, left, live, x: left ? m.sx - m.sr - 8 : m.sx + m.sr + 8, y: m.sy, a: live ? 1 : 0.72 });
      }
    }
    items.sort((a, b) => a.y - b.y);
    for (let i = 1; i < items.length; i++) for (let j = 0; j < i; j++) { const a = items[j], b = items[i]; if (a.left === b.left && Math.abs(a.x - b.x) < 150 && b.y - a.y < 24) b.y = a.y + 24; }
    while (pool.length < items.length) {
      const el = document.createElement("div"); el.className = "mtag";
      el.innerHTML = `<span class="mt-t"></span><button type="button" class="mt-go" aria-label="태양에 올려 집중 시작" title="태양에 올려 집중 시작">${ico("flame", 13)}</button>`;
      el._tt = el.firstChild; this.tags.appendChild(el); pool.push(el);
    }
    pool.forEach((el, i) => {
      const it = items[i]; if (!it) { if (!el.hidden) el.hidden = true; return; }
      el.hidden = false; const tk = it.m.task, txt = tk.title;
      if (el._t !== txt || el._live !== it.live) { el._t = txt; el._live = it.live; el._tt.textContent = txt.length > 20 ? txt.slice(0, 19) + "…" : txt; el._w = 0; }
      if (el.dataset.id !== it.m.id) { el.dataset.id = it.m.id; el.dataset.sys = it.s.id; el._w = 0; }
      el.classList.toggle("late", Store.isOverdue(tk)); el.classList.toggle("p1", tk.priority === 1); el.classList.toggle("p2", tk.priority === 2); el.classList.toggle("p3", tk.priority === 3); el.classList.toggle("live", it.live); el.classList.toggle("left", it.left);
      el.classList.toggle("sel", !!((this.hover && this.hover.id === it.m.id) || this.listHover === it.m.id || (Panel.mode === "task" && Panel.id === it.m.id)));
      el.style.opacity = it.a; el.style.transform = `translate3d(${it.x.toFixed(1)}px, ${it.y.toFixed(1)}px, 0) translate(${it.left ? -100 : 0}%, -50%)`;
    });
    /* 폭은 글자가 바뀔 때만 다시 잰다 */
    const tw = this.tagW || (this.tagW = new Map());
    pool.forEach((el, i) => { const it = items[i]; if (it && !el._w) { el._w = el.offsetWidth; tw.set(it.m.id, el._w); } });
  },
  /* 꾹 누르는 동안 위성 둘레에 차오르는 고리 */
  drawHold(ctx, d) {
    const p = (performance.now() - d.t0) / this.HOLD; if (p < 0.15 || p > 1.05) return;
    let o = d.kind === "orb" ? this.orbs.get(d.id) : null;
    if (!o) for (const s of this.systems.values()) if (s.moons.has(d.id)) o = s.moons.get(d.id);
    if (!o) return;
    const r = Math.max(o.sr, 5) + 8;
    ctx.save(); ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(255,255,255,.18)"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(o.sx, o.sy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,.95)"; ctx.beginPath(); ctx.arc(o.sx, o.sy, r, -Math.PI / 2, -Math.PI / 2 + Math.min(1, p) * Math.PI * 2); ctx.stroke();
    ctx.restore();
  },
  drawTargets(ctx) {
    const d = this.drag, t = this.time, sun = this.sun;
    ctx.save();
    if (d.kind === "moon") {
      const on = d.sunTarget; ctx.strokeStyle = on ? "rgba(255,220,160,.95)" : "rgba(255,200,140,.45)"; ctx.lineWidth = on ? 1.8 : 1.2;
      ctx.setLineDash([2, 6]); ctx.lineDashOffset = -t * 20; ctx.beginPath(); ctx.arc(sun.sx, sun.sy, sun.sr * (on ? 1.6 : 1.45), 0, Math.PI * 2); ctx.stroke();
    }
    for (const s of this.systems.values()) {
      if (d.kind === "moon" && s.id === d.sysId) continue;
      const on = d.target === s; ctx.strokeStyle = on ? s.body.color : "rgba(255,255,255,.22)"; ctx.globalAlpha = on ? 0.95 : 0.7;
      ctx.lineWidth = on ? 1.6 : 1; ctx.setLineDash(on ? [] : [2, 5]); ctx.lineDashOffset = t * 10;
      ctx.beginPath(); ctx.arc(s.sx, s.sy, s.sr * 1.7 + 12, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  },

  /* ── 시점 조작 · 포커스 ── */
  focusOn(id) {
    if (id && (!this.systems.has(id) || this.isOverlay())) id = null;
    this.focusId = id;
    const chip = document.getElementById("focusChip");
    if (!id) { chip.hidden = true; return; }
    const s = this.systems.get(id);
    chip.innerHTML = `<button type="button" class="fc-back" data-act="back">${ico("chevLeft", 15)}전체 보기</button><span class="fc-sep"></span>${thumbImg(s.key, 18)}<span class="fc-name">${U.esc(s.planet.name)}</span><span class="fc-en">${s.body.ko}</span>`;
    chip.hidden = false;
  },
  focusDist(s) {
    const a = this.area, hw = (a.right - a.left) / this.W, hh = (a.bottom - a.top) / this.H, asp = this.W / this.H;
    const E = (s.shells ? this.shellR(s, s.shells - 1) * 1.16 : s.R * 1.4) + s.R * 0.5 + 0.9;
    return Math.max(E * 2.2, E / (Math.tan(this.cam.fov / 2) * Math.min(hh, hw * asp) * 0.7));
  },
  areaCenter() { const a = this.area; return [(a.left + a.right) / this.W - 1, 1 - (a.top + a.bottom) / this.H]; },
  resetView() { const v = this.v3d, TAU = Math.PI * 2; v.taz = Math.round(v.az / TAU) * TAU; v.tel = 0; v.tzoom = 1; this.focusOn(null); },
  zoomBy(f) { this.v3d.tzoom = U.clamp(this.v3d.tzoom * f, 0.45, 1.8); },
  rotateBy(da, de) { this.v3d.taz += da; this.v3d.tel = U.clamp(this.v3d.tel + de, -0.38, 0.75); },
  setAutoRotate(on) { this.autoRotate = on; Store.setSetting("autoRotate", on); App.paintSpin(); },
  /* 빈 공간을 끌면 시점 회전, 제자리에서 두 번 누르면 전체 보기 */
  startOrbit(x0, y0, id, moved = false) {
    this.orbitDrag = { x0, y0, az0: this.v3d.taz, el0: this.v3d.tel, moved, id }; if (moved) document.body.classList.add("orbiting");
    const mv = ev => {
      const o = this.orbitDrag; if (!o || ev.pointerId !== o.id || this.pinch) return;
      const dx = ev.clientX - o.x0, dy = ev.clientY - o.y0; if (!o.moved && Math.hypot(dx, dy) < 4) return;
      o.moved = true; document.body.classList.add("orbiting");
      this.v3d.taz = o.az0 - dx * 0.0055; this.v3d.tel = U.clamp(o.el0 + dy * 0.0045, -0.38, 0.75);
    };
    const up = ev => {
      if (this.orbitDrag && ev.pointerId !== this.orbitDrag.id) return;
      window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
      const o = this.orbitDrag; this.orbitDrag = null; document.body.classList.remove("orbiting");
      if (o && !o.moved) { const now = performance.now(); if (now - (this._tap || 0) < 320) this.resetView(); this._tap = now; }
    };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  },

  /* ── 선택 · 호버 ── */
  pick(x, y) {
    const slop = this.touch ? 16 : 10; let best = null, bd = 1e9;
    for (const o of this.orbs.values()) { if (o.hidden) continue; const d = Math.hypot(x - o.sx, y - o.sy); if (d < o.sr + slop + 2 && d < bd) { bd = d; best = { kind: "orb", id: o.id }; } }
    for (const s of this.systems.values()) for (const m of s.moons.values()) {
      if (m.hidden || !m.match) continue; const d = Math.hypot(x - m.sx, y - m.sy);
      if (d < Math.max(m.sr, 4) + slop && d < bd) { bd = d; best = { kind: "moon", id: m.id, sys: s }; }
    }
    if (best) return best;
    const syss = [...this.systems.values()].sort((a, b) => a.w - b.w);
    for (const s of syss) if (!s.hidden && Math.hypot(x - s.sx, y - s.sy) < s.sr + 4) return { kind: "planet", id: s.id, sys: s };
    if (Math.hypot(x - this.sun.sx, y - this.sun.sy) < this.sun.sr * 1.05) return { kind: "sun", id: "sun" };
    return null;
  },
  nearSystem(x, y) { let best = null, bd = 1e9; for (const s of this.systems.values()) { const d = Math.hypot(x - s.sx, y - s.sy); if (d < s.ext + 24 && d < bd) { bd = d; best = s; } } return best; },
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
    if (t.priority) meta.push(`<span style="color:${PRIO[t.priority].color}">${prioSvg(t.priority, 12)}${PRIO[t.priority].ko}</span>`);
    if (t.steps.length) meta.push(`<span>${ico("list", 12)}${t.steps.filter(s => s.done).length}/${t.steps.length}</span>`);
    if (t.repeat && t.repeat !== "none") meta.push(`<span>${ico("repeat", 12)}반복</span>`);
    this.tip.innerHTML = `<div class="tt-top"><i style="--c:${p ? pColor(p) : "#fff"}"></i>${U.esc(p ? p.name : "")}</div><div class="tt-title">${U.esc(t.title)}</div>${meta.length ? `<div class="tt-meta">${meta.join("")}</div>` : ""}<div class="tt-hint">${h.kind === "orb" ? "클릭: 열기 · 두 번 클릭하거나 꾹 눌러 잡고 행성에 놓으면 궤도 복귀" : "클릭: 열기 · 두 번 클릭하거나 꾹 눌러 잡기"}</div>`;
    this.tip.hidden = false;
  },

  /* ── 포인터 · 드래그 앤 드롭 ── */
  bind() {
    window.addEventListener("resize", () => this.measure());
    const st = this.stage;
    st.addEventListener("pointermove", e => this.onMove(e));
    st.addEventListener("pointerleave", () => { this.systems.forEach(s => { s.hover = false; }); if (!this.drag) this.setHover(null); st.style.cursor = ""; });
    st.addEventListener("pointerdown", e => this.onDown(e));
    st.addEventListener("wheel", e => { e.preventDefault(); this.zoomBy(Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0012))); }, { passive: false });
    st.addEventListener("pointermove", e => {
      const p = this.ptrs.get(e.pointerId); if (p) { p.x = e.clientX; p.y = e.clientY; }
      if (this.pinch && this.ptrs.size >= 2) { const [a, b] = [...this.ptrs.values()]; this.v3d.tzoom = U.clamp(this.pinch.z0 * this.pinch.d0 / (Math.hypot(a.x - b.x, a.y - b.y) || 1), 0.45, 1.8); }
    });
    const lift = e => { this.ptrs.delete(e.pointerId); if (this.ptrs.size < 2) this.pinch = null; };
    window.addEventListener("pointerup", lift); window.addEventListener("pointercancel", lift);
    this.tags.addEventListener("pointerdown", e => {
      const tag = e.target.closest(".mtag"); if (!tag) return; e.stopPropagation();
      if (e.target.closest(".mt-go")) return;
      this.startPending(e, { kind: "moon", id: tag.dataset.id, sysId: tag.dataset.sys });
    });
    this.tags.addEventListener("click", e => {
      const b = e.target.closest(".mt-go"); if (!b) return;
      const tag = b.closest(".mtag"), r = tag.getBoundingClientRect();
      this.lastPos.set(tag.dataset.id, { x: r.left + r.width / 2, y: r.top + r.height / 2, t0: this.time }); App.startTask(tag.dataset.id);
    });
    window.addEventListener("pointermove", e => { this.par.tx = e.clientX / window.innerWidth - 0.5; this.par.ty = e.clientY / window.innerHeight - 0.5; }, { passive: true });
    this.focus.addEventListener("pointerdown", e => { if (e.target.closest(".f-done, .f-more")) return; const card = e.target.closest(".fcard"); if (card) this.startPending(e, { kind: "orb", id: card.dataset.id, sysId: null }); });
    this.focus.addEventListener("click", e => { const b = e.target.closest("[data-act]"); if (!b) return; if (b.dataset.act === "done") App.completeTask(b.closest(".fcard").dataset.id); else if (b.dataset.act === "more") App.openToday(); });
    this.focus.addEventListener("keydown", e => { const m = e.target.closest(".f-main"); if (m && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); App.openTask(m.closest(".fcard").dataset.id); } });
  },
  onMove(e) {
    if (this.drag || this.orbitDrag || e.pointerType !== "mouse") return;
    const tag = e.target.closest(".mtag");
    if (tag) { for (const s of this.systems.values()) s.hover = s.id === tag.dataset.sys; this.hover = { kind: "moon", id: tag.dataset.id, sys: this.systems.get(tag.dataset.sys) }; this.tip.hidden = true; this.stage.style.cursor = "grab"; return; }
    const x = e.clientX, y = e.clientY, ns = this.nearSystem(x, y);
    for (const s of this.systems.values()) s.hover = s === ns;
    if (e.target.closest("button, .fcard, .p-label")) { this.setHover(null); this.stage.style.cursor = ""; return; }
    const hit = this.pick(x, y); this.setHover(hit);
    this.stage.style.cursor = hit ? (hit.kind === "moon" || hit.kind === "orb" ? "grab" : "pointer") : "";
  },
  onDown(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.target.closest("button, a, input, .fcard, .p-label, .mtag")) return;
    const x = e.clientX, y = e.clientY;
    this.ptrs.set(e.pointerId, { x, y });
    if (this.ptrs.size >= 2) {
      if (this.drag) this.endDrag(); this.orbitDrag = null; document.body.classList.remove("orbiting");
      const [a, b] = [...this.ptrs.values()]; this.pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: this.v3d.tzoom }; return;
    }
    if (e.pointerType !== "mouse") { const ns = this.nearSystem(x, y); this.systems.forEach(s => { s.pinned = s === ns; }); }
    let hit = this.pick(x, y); const c = this._click;
    if (c && performance.now() - c.t < this.DBL && Math.hypot(x - c.x, y - c.y) < 18 && (!hit || hit.id !== c.id)) hit = { kind: c.kind, id: c.id, sys: c.sysId ? this.systems.get(c.sysId) : null };
    if (!hit) { e.preventDefault(); this.startOrbit(x, y, e.pointerId); return; }
    this.startPending(e, { kind: hit.kind, id: hit.id, sysId: hit.sys ? hit.sys.id : null });
  },
  startPending(e, o) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    const hold = o.kind === "moon" || o.kind === "orb", c = this._click, now = performance.now();
    if (hold && c && c.id === o.id && now - c.t < this.DBL) {
      clearTimeout(this._clickT); this._click = null; clearTimeout(this._hold);
      const d = this.drag = Object.assign({ pending: false, dbl: true, x0: e.clientX, y0: e.clientY, lx: e.clientX, ly: e.clientY, target: null, sunTarget: false, hold, t0: now }, o);
      this.beginDrag(d); this.ghost.style.transform = `translate3d(${d.lx}px, ${d.ly}px, 0)`; this.ghost.classList.add("lift"); this.updateHint();
      try { if (navigator.vibrate) navigator.vibrate(12); } catch (_) { /* 지원 안 함 */ }
      this._mv = ev => this.onDragMove(ev); this._up = ev => this.onUp(ev);
      window.addEventListener("pointermove", this._mv); window.addEventListener("pointerup", this._up); window.addEventListener("pointercancel", this._up);
      return;
    }
    this.drag = Object.assign({ pending: true, x0: e.clientX, y0: e.clientY, lx: e.clientX, ly: e.clientY, target: null, sunTarget: false, hold, t0: performance.now() }, o);
    clearTimeout(this._hold);
    if (hold) this._hold = setTimeout(() => {
      const d = this.drag; if (!d || !d.pending) return;
      this.beginDrag(d); this.ghost.style.transform = `translate3d(${d.lx}px, ${d.ly}px, 0)`; this.ghost.classList.add("lift");
      try { if (navigator.vibrate) navigator.vibrate(12); } catch (_) { /* 지원 안 함 */ }
    }, this.HOLD);
    this._mv = ev => this.onDragMove(ev); this._up = ev => this.onUp(ev);
    window.addEventListener("pointermove", this._mv); window.addEventListener("pointerup", this._up); window.addEventListener("pointercancel", this._up);
  },
  beginDrag(d) {
    d.pending = false;
    const t = Store.task(d.id), p = t && Store.planet(t.planetId); d.color = p ? pColor(p) : "#ffffff";
    this.ghost.className = "drag-ghost" + (d.kind === "orb" ? " is-orb" : ""); this.ghost.style.setProperty("--c", d.color);
    this.ghost.innerHTML = `<span class="g-orb"></span><span class="g-title">${U.esc(t ? t.title : "")}</span>`;
    this.ghost.hidden = false; document.body.classList.add("dragging"); this.setHover(null);
    if (d.kind === "orb") this.focus.querySelector(`.fcard[data-id="${d.id}"]`)?.classList.add("lifted");
  },
  onDragMove(e) {
    const d = this.drag; if (!d) return;
    const x = e.clientX, y = e.clientY;
    if (d.pending) {
      d.lx = x; d.ly = y;
      if (Math.hypot(x - d.x0, y - d.y0) < (e.pointerType === "mouse" ? 6 : 10)) return;
      const o = d; this.endDrag(); this.startOrbit(o.x0, o.y0, e.pointerId, true); return;
    }
    this.ghost.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    const sunT = d.kind === "moon" && Math.hypot(x - this.sun.sx, y - this.sun.sy) < this.sun.sr * 1.3 + 40;
    let target = null, bd = 1e9;
    if (!sunT) for (const s of this.systems.values()) { const dd = Math.hypot(x - s.sx, y - s.sy); if (dd < s.sr * 1.7 + 34 && dd < bd) { bd = dd; target = s; } }
    if (target && d.kind === "moon" && target.id === d.sysId) target = null;
    if (sunT !== d.sunTarget) { d.sunTarget = sunT; this.ghost.classList.toggle("over-sun", sunT); }
    d.target = target; this.updateHint();
    if (!this.reduced && Math.random() < 0.55) FX.trail(x, y, sunT ? "#ffd08a" : d.color);
  },
  onUp(e) {
    const d = this.drag; if (!d) return;
    /* 두 번 눌러 잡고 그대로 떼면: 손을 떼도 위성이 따라다니고, 다음 클릭 자리에 놓인다 */
    if (d.dbl && !d.sticky && e.type === "pointerup" && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 12) { this.carry(d); return; }
    this.endDrag();
    if (d.pending) {
      if (d.kind === "moon" || d.kind === "orb") {
        clearTimeout(this._clickT); const id = d.id;
        this._click = { id, kind: d.kind, sysId: d.sysId, x: d.x0, y: d.y0, t: performance.now() };
        this._clickT = setTimeout(() => { this._click = null; App.openTask(id); }, this.DBL);
      } else if (d.kind === "planet") App.openPlanet(d.id); else if (d.kind === "sun") App.openToday();
      return;
    }
    if (e.type === "pointercancel") return;
    this.drop(d, e);
  },
  carry(d) {
    d.sticky = true; document.body.classList.add("carrying");
    window.removeEventListener("pointerup", this._up); window.removeEventListener("pointercancel", this._up);
    this._cd = ev => {
      ev.preventDefault(); ev.stopPropagation();
      const swallow = c => { c.stopPropagation(); c.preventDefault(); };
      window.addEventListener("click", swallow, { capture: true, once: true }); setTimeout(() => window.removeEventListener("click", swallow, true), 450);
      if (ev.pointerType === "mouse" && ev.button !== 0) { this.endDrag(); return; }
      this.onDragMove(ev); const dd = this.drag; this.endDrag(); if (dd) this.drop(dd, ev);
    };
    window.addEventListener("pointerdown", this._cd, true);
    this.updateHint();
  },
  cancelCarry() { if (this.drag && this.drag.sticky) { this.endDrag(); return true; } return false; },
  drop(d, e) {
    this.ghost.classList.remove("lift");
    const t = Store.task(d.id); if (!t) return;
    const pos = { x: e.clientX, y: e.clientY, t0: this.time };
    if (d.sunTarget && d.kind === "moon") { this.lastPos.set(t.id, pos); App.startTask(t.id); return; }
    if (!d.target) return;
    const pid = d.target.id, moved = pid !== t.planetId, name = d.target.planet.name;
    this.lastPos.set(t.id, pos);
    if (d.kind === "orb") { if (moved) Store.updateTask(t.id, { planetId: pid }); Store.stopTask(t.id); App.toast("orbitBack", moved ? `${name} 궤도로 옮기고 타이머를 멈췄어요` : "궤도로 돌아왔어요. 타이머는 일시정지돼요"); }
    else if (moved) { const from = t.planetId; Store.updateTask(t.id, { planetId: pid }); App.toast("orbit", `「${t.title}」${U.josa(t.title, "을", "를")} ${name}${U.josa(name, "으로", "로")} 옮겼어요`, () => Store.updateTask(t.id, { planetId: from })); }
  },
  endDrag() {
    clearTimeout(this._hold);
    window.removeEventListener("pointermove", this._mv); window.removeEventListener("pointerup", this._up); window.removeEventListener("pointercancel", this._up);
    if (this._cd) { window.removeEventListener("pointerdown", this._cd, true); this._cd = null; } document.body.classList.remove("carrying");
    this.drag = null; this.ghost.classList.remove("lift"); this.ghost.hidden = true; this.ghost.classList.remove("over-sun"); document.body.classList.remove("dragging");
    this.systems.forEach(s => { s.hover = false; });
    this.focus.querySelectorAll(".lifted").forEach(c => c.classList.remove("lifted"));
    this.updateHint();
  },

  /* ── WebGL 미지원 기기용 2D 대체 렌더 ── */
  loadFallback() { this.fb = {}; ["sun", "moon", ...BODY_ORDER].forEach(k => { const im = new Image(); im.src = thumbOf(k); this.fb[k] = im; }); },
  render2D(ctx) {
    if (this.isOverlay() || !this.fb) return;
    const img = (k, x, y, r, sat) => { const im = this.fb[k]; if (!im || !im.complete || !im.naturalWidth) return; const h = r / (sat ? 0.42 : 0.8); ctx.drawImage(im, x - h, y - h, h * 2, h * 2); };
    const items = [{ w: this.sun.w, f: () => img("sun", this.sun.sx, this.sun.sy, this.sun.sr) }];
    for (const s of this.systems.values()) { items.push({ w: s.w, f: () => img(s.key, s.sx, s.sy, s.sr, !!s.body.ring) }); for (const m of s.moons.values()) items.push({ w: m.w, f: () => img("moon", m.sx, m.sy, m.sr) }); }
    for (const o of this.orbs.values()) items.push({ w: o.w, f: () => { ctx.fillStyle = "#ffb050"; ctx.beginPath(); ctx.arc(o.sx, o.sy, o.sr, 0, Math.PI * 2); ctx.fill(); } });
    items.sort((a, b) => b.w - a.w).forEach(i => i.f());
  },
};
function hexRGB(h) { const n = parseInt(h.replace("#", ""), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }
