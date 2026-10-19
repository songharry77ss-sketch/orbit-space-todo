/* ═══════════════ 우주 씬: 태양, 행성, 위성, 드래그 앤 드롭 ═══════════════ */
"use strict";

const Scene = {
  stage: null, el: null, sysEl: null, sunWrap: null, sunEl: null, burnRing: null, tooltip: null, ghost: null,
  W: 0, H: 0, cx: 0, cy: 0, sunR: 78,
  filter: "today", systems: new Map(), chips: new Map(), order: [],
  heat: 0, heatTarget: 0, hoverMoon: null, drag: null, lastT: 0, search: "",
  RING_CAP: [6, 10, 14, 18, 24],

  init() {
    this.stage = document.getElementById("stage");
    this.el = document.getElementById("scene");
    this.sysEl = document.getElementById("systems");
    this.sunWrap = document.getElementById("sunWrap");
    this.sunEl = document.getElementById("sun");
    this.burnRing = document.getElementById("burnRing");
    this.tooltip = document.getElementById("tooltip");
    this.ghost = document.getElementById("dragGhost");
    const flames = document.getElementById("sunFlames");
    for (let i = 0; i < 12; i++) {
      const f = document.createElement("div"); f.className = "flame";
      f.style.setProperty("--a", `${i * 30 + U.rand(-8, 8)}deg`); f.style.animationDelay = `${-Math.random() * 2}s`;
      f.style.width = `${U.rand(34, 54)}px`; f.style.height = `${U.rand(80, 120)}px`; f.style.marginLeft = `${-parseFloat(f.style.width) / 2}px`;
      flames.appendChild(f);
    }
    this.sunEl.addEventListener("click", () => App.openToday());
    this.onMove = this.onMove.bind(this); this.onUp = this.onUp.bind(this);
    window.addEventListener("resize", () => { this.measure(); this.layout(); });
    this.measure();
    this.sync();
    requestAnimationFrame(t => this.loop(t));
  },

  /* ── 기하 ── */
  measure() {
    const r = this.stage.getBoundingClientRect();
    this.W = r.width; this.H = r.height;
    this.cx = this.W / 2; this.cy = this.H / 2 + 18;
    this.sunR = U.clamp(Math.min(this.W, this.H) * 0.095, 46, 78);
    this.sunWrap.style.left = `${this.cx}px`; this.sunWrap.style.top = `${this.cy}px`;
    this.sunWrap.style.setProperty("--sunR", `${this.sunR}px`);
  },
  layout() {
    const ids = this.order; const n = ids.length; if (!n) { Sky.orbits = []; return; }
    const rx = Math.max(160, Math.min(this.W * .37, this.W / 2 - 130));
    const ry = Math.max(120, Math.min(this.H * .33, this.H / 2 - 150));
    const twoRings = n > 7;
    const outerN = twoRings ? Math.ceil(n * .6) : n;
    Sky.orbits = twoRings ? [{ cx: this.cx, cy: this.cy, rx, ry }, { cx: this.cx, cy: this.cy, rx: rx * .58, ry: ry * .58 }] : [{ cx: this.cx, cy: this.cy, rx: rx * .92, ry: ry * .92 }];
    ids.forEach((id, i) => {
      const sys = this.systems.get(id); if (!sys) return;
      let k, m, ang;
      if (!twoRings) { k = i; m = n; ang = -Math.PI / 2 + (k / m) * Math.PI * 2; const f = (i % 2 === 0) ? 1 : .84; sys.x = this.cx + Math.cos(ang) * rx * f; sys.y = this.cy + Math.sin(ang) * ry * f; }
      else if (i < outerN) { ang = -Math.PI / 2 + (i / outerN) * Math.PI * 2; sys.x = this.cx + Math.cos(ang) * rx; sys.y = this.cy + Math.sin(ang) * ry; }
      else { const j = i - outerN, m2 = n - outerN; ang = -Math.PI / 2 + Math.PI / m2 + (j / m2) * Math.PI * 2; sys.x = this.cx + Math.cos(ang) * rx * .58; sys.y = this.cy + Math.sin(ang) * ry * .58; }
      sys.el.style.left = `${sys.x}px`; sys.el.style.top = `${sys.y}px`;
    });
    this.layoutChips();
  },
  layoutChips() {
    const list = [...this.chips.values()], n = list.length; if (!n) return;
    const R = this.sunR + (n <= 4 ? 128 : 150), TAU = Math.PI * 2, norm = a => Math.atan2(Math.sin(a), Math.cos(a));
    // 행성 사이의 빈 각도에 칩을 두고, 라벨이 있는 아래쪽은 피한다
    const pA = this.order.map(id => this.systems.get(id)).filter(Boolean).map(s => Math.atan2(s.y - this.cy, s.x - this.cx)).sort((a, b) => a - b);
    let cands = [];
    if (pA.length >= 2) for (let i = 0; i < pA.length; i++) { const a = pA[i], b = i + 1 < pA.length ? pA[i + 1] : pA[0] + TAU; cands.push(norm((a + b) / 2)); }
    else cands = [0, Math.PI, -Math.PI / 4, -3 * Math.PI / 4, -Math.PI / 2];
    cands = cands.filter(a => Math.abs(norm(a - Math.PI / 2)) > Math.PI * .22);
    cands.sort((a, b) => Math.abs(Math.sin(a)) - Math.abs(Math.sin(b)));
    const picked = [];
    for (const a of cands) { if (picked.length >= n) break; if (picked.every(p => Math.abs(norm(a - p)) > Math.PI / 5)) picked.push(a); }
    for (let i = 0; picked.length < n; i++) picked.push(-Math.PI / 2 + i * TAU / n);
    list.forEach((c, i) => { const a = picked[i]; c.ax = Math.cos(a) * R; c.ay = Math.sin(a) * R; c.el.style.left = `${c.ax}px`; c.el.style.top = `${c.ay}px`; });
  },
  ringOf(i) { let acc = 0; for (let r = 0; r < this.RING_CAP.length; r++) { acc += this.RING_CAP[r]; if (i < acc) return r; } return this.RING_CAP.length - 1; },
  ringR(sys, r) { return sys.pr + 24 + r * 19; },
  ringSpeed(r) { return (Math.PI * 2) / [26, 42, 60, 80, 100][r] * (r % 2 ? -1 : 1); },

  /* ── 동기화: 스토어 → DOM ── */
  setFilter(f) { this.filter = f; this.sync({ type: "filter" }); },
  setSearch(q) { this.search = (q || "").trim().toLowerCase(); this.applySearch(); },
  applySearch() {
    const q = this.search;
    for (const sys of this.systems.values()) for (const m of sys.moons.values()) m.el.classList.toggle("match", !q || m.task.title.toLowerCase().includes(q));
  },
  sync(detail = {}) {
    const planets = Store.planets(), pids = new Set(planets.map(p => p.id));
    for (const [id, sys] of this.systems) if (!pids.has(id)) { sys.el.remove(); this.systems.delete(id); }
    planets.forEach(p => { let sys = this.systems.get(p.id); if (!sys) sys = this.createSystem(p); this.updateSystem(sys, p); });
    const prevOrder = this.order.join(","); this.order = planets.map(p => p.id);

    const visible = Store.visibleTasks(this.filter);
    const moonTasks = visible.filter(t => t.status !== "doing");
    const want = new Map(moonTasks.map(t => [t.id, t]));
    for (const sys of this.systems.values()) {
      for (const [tid, moon] of sys.moons) {
        const t = want.get(tid);
        if (!t || t.planetId !== sys.id) {
          const st = Store.task(tid);
          if (st && st.status === "done" && detail.type === "task-complete" && detail.id === tid) this.burstMoon(sys, moon);
          moon.el.remove(); sys.moons.delete(tid);
        }
      }
    }
    moonTasks.forEach(t => {
      const sys = this.systems.get(t.planetId) || this.systems.get(this.order[0]); if (!sys) return;
      let moon = sys.moons.get(t.id); if (!moon) moon = this.createMoon(sys, t);
      this.updateMoon(sys, moon, t);
    });
    for (const sys of this.systems.values()) {
      const list = [...sys.moons.values()].sort((a, b) => a.task.createdAt - b.task.createdAt);
      sys.pr = 20 + Math.min(16, list.length * 2.2);
      list.forEach((m, i) => { m.ring = this.ringOf(i); m.targetR = this.ringR(sys, m.ring); if (m.r == null) m.r = m.targetR; m.speed = this.ringSpeed(m.ring); });
      sys.rings = list.length ? this.ringOf(list.length - 1) + 1 : 0;
      sys.outerR = sys.rings ? this.ringR(sys, sys.rings - 1) : sys.pr;
      sys.hitR = sys.outerR + 18;
      sys.planetEl.style.width = sys.planetEl.style.height = `${sys.pr * 2}px`;
      sys.hit.style.width = sys.hit.style.height = `${sys.hitR * 2}px`;
      const doingHere = Store.tasks().filter(t => t.planetId === sys.id && t.status === "doing").length;
      sys.countEl.innerHTML = `${this.filter === "today" ? "오늘" : "할 일"} <b>${list.length}</b>${doingHere ? ` · 🔥 ${doingHere}` : ""}`;
      sys.el.classList.toggle("dim", list.length === 0 && !doingHere);
    }

    const doing = Store.tasks().filter(t => t.status === "doing").sort((a, b) => a.startedAt - b.startedAt);
    const dset = new Set(doing.map(t => t.id));
    for (const [tid, c] of this.chips) if (!dset.has(tid)) { if (detail.type === "task-complete" && detail.id === tid) this.burstChip(c); c.el.remove(); this.chips.delete(tid); }
    doing.forEach(t => { let c = this.chips.get(t.id); if (!c) c = this.createChip(t); this.updateChip(c, t); });
    this.layoutChips();

    this.heatTarget = doing.length ? Math.min(1, .45 + .2 * (doing.length - 1)) : 0;
    this.sunWrap.classList.toggle("burning", doing.length > 0);
    this.updateSunLabel(doing.length, visible.length);
    if (prevOrder !== this.order.join(",") || detail.type === "reset" || detail.type === "init") this.layout();
    this.applySearch();
  },
  updateSunLabel(doing, visible) {
    const main = this.sunWrap.querySelector(".sun-label-main"), sub = this.sunWrap.querySelector(".sun-label-sub");
    if (doing) { main.textContent = `지금 집중 중 · ${doing}`; sub.textContent = "✓ 로 완료 · 태양 클릭 → 오늘의 미션"; }
    else if (visible) { main.textContent = "할 일을 태양으로 끌어오세요"; sub.textContent = "놓는 순간부터 불타기 시작합니다"; }
    else { main.textContent = this.filter === "today" ? "오늘 할 일이 없어요" : "할 일이 없어요"; sub.textContent = "아래 입력창에서 추가해 보세요"; }
  },

  createSystem(p) {
    const el = document.createElement("div"); el.className = "system"; el.dataset.id = p.id;
    el.innerHTML = `<div class="sys-hit"></div><div class="planet" role="button" tabindex="0"></div><div class="planet-label"><span class="name"><span class="emoji"></span><span class="nm"></span></span><span class="count"></span></div>`;
    const sys = {
      id: p.id, el, hit: el.querySelector(".sys-hit"), planetEl: el.querySelector(".planet"), label: el.querySelector(".planet-label"),
      nameEl: el.querySelector(".nm"), emojiEl: el.querySelector(".emoji"), countEl: el.querySelector(".count"),
      moons: new Map(), x: this.cx, y: this.cy, pr: 24, hoverT: 0, hover: false, rings: 0, outerR: 24, hitR: 60,
    };
    el.addEventListener("pointerenter", () => { sys.hover = true; });
    el.addEventListener("pointerleave", () => { sys.hover = false; });
    sys.planetEl.addEventListener("click", () => App.openPlanet(p.id));
    sys.planetEl.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); App.openPlanet(p.id); } });
    this.sysEl.appendChild(el); this.systems.set(p.id, sys);
    return sys;
  },
  updateSystem(sys, p) {
    sys.el.style.setProperty("--c", p.color);
    sys.planetEl.className = `planet look-${p.look || "plain"}`;
    sys.planetEl.setAttribute("aria-label", `${p.name} 행성 열기`);
    sys.nameEl.textContent = p.name; sys.emojiEl.textContent = p.emoji || "";
  },
  pickAngle(sys) {
    const existing = [...sys.moons.values()].map(m => m.angle);
    if (!existing.length) return Math.random() * Math.PI * 2;
    const TAU = Math.PI * 2; let best = 0, bestD = -1;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU + Math.random() * .2;
      const d = Math.min(...existing.map(e => { const x = Math.abs(a - e) % TAU; return Math.min(x, TAU - x); }));
      if (d > bestD) { bestD = d; best = a; }
    }
    return best;
  },
  createMoon(sys, t) {
    const el = document.createElement("div"); el.className = "moon"; el.dataset.id = t.id;
    const moon = { id: t.id, el, task: t, angle: this.pickAngle(sys), ring: 0, r: null, targetR: 0, speed: 0, px: 0, py: 0 };
    el.addEventListener("pointerdown", e => this.onDown(e, "moon", t.id, el));
    el.addEventListener("pointerenter", () => { if (this.drag) return; this.hoverMoon = moon; this.showTip(moon); });
    el.addEventListener("pointerleave", () => { if (this.hoverMoon === moon) { this.hoverMoon = null; this.hideTip(); } });
    sys.el.appendChild(el); sys.moons.set(t.id, moon);
    return moon;
  },
  updateMoon(sys, moon, t) {
    moon.task = t;
    moon.el.classList.toggle("imp", !!t.important);
    moon.el.classList.toggle("overdue", Store.isOverdue(t));
    const dot = moon.el.querySelector(".tdot");
    if (t.time && !dot) moon.el.insertAdjacentHTML("beforeend", '<i class="tdot"></i>');
    else if (!t.time && dot) dot.remove();
    moon.el.setAttribute("aria-label", t.title);
  },
  createChip(t) {
    const el = document.createElement("div"); el.className = "chip"; el.dataset.id = t.id;
    el.innerHTML = `<div class="chip-fire"><i></i><i></i></div><div class="chip-main"><div class="chip-title"></div><div class="chip-sub"><span class="dot"></span><span class="pn"></span><span>·</span><span class="timer">00:00</span></div></div><button class="chip-done" title="완료" aria-label="완료">✓</button>`;
    const c = { id: t.id, el, task: t, titleEl: el.querySelector(".chip-title"), pnEl: el.querySelector(".pn"), timerEl: el.querySelector(".timer"), ax: 0, ay: 0 };
    const done = el.querySelector(".chip-done");
    done.addEventListener("pointerdown", e => e.stopPropagation());
    done.addEventListener("click", e => { e.stopPropagation(); App.completeTask(t.id); });
    el.addEventListener("pointerdown", e => this.onDown(e, "chip", t.id, el));
    this.burnRing.appendChild(el); this.chips.set(t.id, c);
    return c;
  },
  updateChip(c, t) {
    c.task = t; const p = Store.planet(t.planetId);
    c.titleEl.textContent = t.title; c.pnEl.textContent = p ? p.name : ""; c.el.style.setProperty("--c", p ? p.color : "#fff");
    c.timerEl.textContent = U.fmtClock(Store.burned(t));
  },
  burstMoon(sys, moon) { const p = Store.planet(sys.id); FX.burst(sys.x + moon.px, sys.y + moon.py, p ? p.color : "#fff", 50, 1); },
  burstChip(c) { FX.burst(this.cx + c.ax, this.cy + c.ay, "#ffd166", 64, 1.3); FX.ring(this.cx, this.cy, this.sunR, "#ffb547", 240, 1); },

  /* ── 프레임 루프 ── */
  loop(t) {
    const dt = Math.min(.05, (t - (this.lastT || t)) / 1000); this.lastT = t;
    Sky.draw(t);
    FX.clear();
    this.tick(dt, t);
    FX.update(dt); FX.draw();
    requestAnimationFrame(tt => this.loop(tt));
  },
  tick(dt, t) {
    const ctx = FX.ctx, calendar = document.body.dataset.view === "calendar";
    this.heat += (this.heatTarget - this.heat) * Math.min(1, dt * 2.2);
    this.sunWrap.style.setProperty("--heat", this.heat.toFixed(3));
    if (!calendar && !FX.reduced && this.heat > .03) {
      const rate = (5 + this.heat * 46) * dt; let n = Math.floor(rate) + (Math.random() < rate % 1 ? 1 : 0);
      while (n-- > 0) FX.ember(this.cx, this.cy, this.sunR, this.heat);
    }
    if (!calendar) for (const c of this.chips.values()) this.drawTether(ctx, c, t);
    for (const sys of this.systems.values()) {
      const dragTarget = !!(this.drag && this.drag.target === sys);
      const target = (sys.hover || sys.pinned || dragTarget) ? 1 : 0;
      sys.hoverT += (target - sys.hoverT) * Math.min(1, dt * 6);
      const h = sys.hoverT, spin = 1 - h, ratio = U.lerp(.5, 1, h), ex = U.lerp(1, 1.22, h);
      if (!calendar && sys.rings) {
        const p = Store.planet(sys.id);
        ctx.save(); ctx.strokeStyle = p ? p.color : "#fff"; ctx.globalAlpha = .10 + h * .2; ctx.lineWidth = 1;
        for (let r = 0; r < sys.rings; r++) { const R = this.ringR(sys, r) * ex; ctx.beginPath(); ctx.ellipse(sys.x, sys.y, R, R * ratio, 0, 0, Math.PI * 2); ctx.stroke(); }
        ctx.restore();
      }
      for (const m of sys.moons.values()) {
        const held = this.drag && this.drag.taskId === m.id && !this.drag.pending;
        if (!held) m.angle += m.speed * spin * dt * (this.speedK || 1);
        m.r += (m.targetR - m.r) * Math.min(1, dt * 5);
        const s = Math.sin(m.angle), R = m.r * ex;
        m.px = Math.cos(m.angle) * R; m.py = s * R * ratio;
        const depth = (s + 1) / 2, sc = U.lerp(U.lerp(.78, 1.12, depth), 1.12, h);
        m.el.style.transform = `translate(${m.px.toFixed(1)}px, ${m.py.toFixed(1)}px) translate(-50%, -50%) scale(${sc.toFixed(3)})`;
        m.el.style.zIndex = (s < 0 && h < .5) ? 1 : 3;
      }
      const base = sys.rings ? Math.max(sys.pr + 14, sys.outerR * .5 + 12) : sys.pr + 12;
      sys.label.style.top = `${U.lerp(base, sys.outerR * 1.22 + 10, h).toFixed(1)}px`;
    }
    if (this.hoverMoon && !this.tooltip.hidden) this.placeTip(this.hoverMoon);
    if (!this._tt || t - this._tt > 500) { this._tt = t; for (const c of this.chips.values()) c.timerEl.textContent = U.fmtClock(Store.burned(c.task)); }
  },
  drawTether(ctx, c, t) {
    const x1 = this.cx, y1 = this.cy, x2 = this.cx + c.ax, y2 = this.cy + c.ay;
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
    const sx = x1 + ux * (this.sunR - 2), sy = y1 + uy * (this.sunR - 2);
    const hw = c.el.offsetWidth / 2 || 118, hh = c.el.offsetHeight / 2 || 26;
    const tEdge = Math.min(hw / (Math.abs(ux) || 1e-6), hh / (Math.abs(uy) || 1e-6));
    const ex = x2 - ux * (tEdge + 2), ey = y2 - uy * (tEdge + 2);
    const flick = .5 + .35 * Math.sin(t * .012 + c.ax);
    const g = ctx.createLinearGradient(sx, sy, ex, ey); g.addColorStop(0, `rgba(255,205,100,${flick})`); g.addColorStop(1, "rgba(255,130,40,.35)");
    ctx.save(); ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.shadowBlur = 10; ctx.shadowColor = "rgba(255,150,50,.85)";
    const mx = (sx + ex) / 2 + Math.sin(t * .004 + c.ay) * 7, my = (sy + ey) / 2 + Math.cos(t * .005 + c.ax) * 7;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(mx, my, ex, ey); ctx.stroke(); ctx.restore();
  },

  /* ── 툴팁 ── */
  showTip(moon) {
    const t = moon.task, p = Store.planet(t.planetId), meta = [];
    if (p) meta.push(`<span>${U.esc(p.emoji || "")} ${U.esc(p.name)}</span>`);
    if (t.due) meta.push(`<span class="${Store.isOverdue(t) ? "late" : ""}">${Store.isOverdue(t) ? "⚠" : "📅"} ${U.relDate(t.due)}${t.time ? " " + U.fmtTime(t.time) : ""}</span>`);
    else if (t.time) meta.push(`<span>🕒 ${U.fmtTime(t.time)}</span>`);
    if (t.important) meta.push(`<span class="imp">★ 중요</span>`);
    if (t.steps.length) meta.push(`<span>☑ ${t.steps.filter(s => s.done).length}/${t.steps.length}</span>`);
    if (t.repeat && t.repeat !== "none") meta.push(`<span>↻ ${(Store.REPEATS.find(r => r[0] === t.repeat) || [])[1] || ""}</span>`);
    const burned = Store.burned(t); if (burned > 30) meta.push(`<span>🔥 ${U.fmtDuration(burned)}</span>`);
    this.tooltip.innerHTML = `<div class="tt-title">${U.esc(t.title)}</div><div class="tt-meta">${meta.join("")}</div><div class="tt-hint">클릭 → 상세 · 태양으로 드래그 → 집중 시작</div>`;
    this.tooltip.hidden = false; this.placeTip(moon);
  },
  placeTip(moon) {
    const r = moon.el.getBoundingClientRect(), s = this.stage.getBoundingClientRect();
    const x = U.clamp(r.left + r.width / 2 - s.left, 140, this.W - 140);
    this.tooltip.style.left = `${x}px`; this.tooltip.style.top = `${r.top - s.top}px`;
  },
  hideTip() { this.tooltip.hidden = true; },

  /* ── 드래그 앤 드롭 ── */
  onDown(e, type, taskId, el) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.preventDefault();
    this.drag = { pending: true, type, taskId, el, x0: e.clientX, y0: e.clientY, target: null, sunTarget: false, color: "#fff" };
    window.addEventListener("pointermove", this.onMove);
    window.addEventListener("pointerup", this.onUp);
    window.addEventListener("pointercancel", this.onUp);
  },
  beginDrag(d) {
    d.pending = false;
    const t = Store.task(d.taskId), p = t && Store.planet(t.planetId); d.color = p ? p.color : "#fff";
    this.ghost.innerHTML = `<div class="g-moon" style="--c:${d.color}"></div><div class="g-title">${U.esc(t ? t.title : "")}</div>`;
    this.ghost.hidden = false; d.el.classList.add("dragging"); document.body.classList.add("dragging"); this.hideTip(); this.hoverMoon = null;
    const main = this.sunWrap.querySelector(".sun-label-main"), sub = this.sunWrap.querySelector(".sun-label-sub");
    if (d.type === "moon") { main.textContent = "여기에 놓으면 집중 시작"; sub.textContent = "다른 행성에 놓으면 카테고리 이동"; }
    else { main.textContent = "행성에 놓으면 궤도로 복귀"; sub.textContent = "타이머는 일시정지됩니다"; }
  },
  onMove(e) {
    const d = this.drag; if (!d) return;
    if (d.pending) { if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 7) return; this.beginDrag(d); }
    this.ghost.style.left = `${e.clientX}px`; this.ghost.style.top = `${e.clientY}px`;
    const s = this.stage.getBoundingClientRect(), px = e.clientX - s.left, py = e.clientY - s.top;
    const sunTarget = d.type === "moon" && Math.hypot(px - this.cx, py - this.cy) < this.sunR + 70;
    let target = null;
    if (!sunTarget) for (const sys of this.systems.values()) { if (Math.hypot(px - sys.x, py - sys.y) < sys.hitR + 16) { target = sys; break; } }
    if (sunTarget !== d.sunTarget) { d.sunTarget = sunTarget; this.sunWrap.classList.toggle("target", sunTarget); this.ghost.classList.toggle("over-sun", sunTarget); }
    if (target !== d.target) { if (d.target) d.target.el.classList.remove("target"); d.target = target; if (target) target.el.classList.add("target"); }
    if (!FX.reduced && Math.random() < .6) FX.trail(px, py, d.sunTarget ? "#ffd166" : d.color);
  },
  onUp() {
    const d = this.drag; if (!d) return;
    window.removeEventListener("pointermove", this.onMove);
    window.removeEventListener("pointerup", this.onUp);
    window.removeEventListener("pointercancel", this.onUp);
    this.drag = null;
    if (d.pending) { App.openTask(d.taskId); return; }
    d.el.classList.remove("dragging"); document.body.classList.remove("dragging");
    this.ghost.hidden = true; this.ghost.classList.remove("over-sun");
    this.sunWrap.classList.remove("target"); if (d.target) d.target.el.classList.remove("target");
    const t = Store.task(d.taskId);
    if (!t) { this.sync(); return; }
    if (d.sunTarget) {
      if (t.status !== "doing") {
        Store.startTask(t.id);
        FX.ring(this.cx, this.cy, this.sunR, "#ffd166", 240, .9); FX.burst(this.cx, this.cy, "#ff9f43", 36, 1.5);
        App.toast("🔥", `「${t.title}」 집중 시작!`);
      }
      return;
    }
    if (d.target) {
      const moved = d.target.id !== t.planetId, pname = (Store.planet(d.target.id) || {}).name || "";
      if (d.type === "chip") {
        Store.stopTask(t.id);
        if (moved) Store.updateTask(t.id, { planetId: d.target.id });
        App.toast("🪐", moved ? `${pname} 궤도로 이동 · 타이머 일시정지` : "궤도로 돌아왔어요 · 타이머 일시정지");
      } else if (moved) {
        Store.updateTask(t.id, { planetId: d.target.id });
        App.toast("🪐", `「${t.title}」 → ${pname}`);
      }
      return;
    }
    this.sync();
  },
};
