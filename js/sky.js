/* ═══════════════ 별하늘 배경 + 이펙트 파티클 ═══════════════ */
"use strict";

const Sky = {
  cv: null, ctx: null, W: 0, H: 0, dpr: 1, stars: [], neb: null, shoot: null, nextShoot: 0,
  par: { x: 0, y: 0, tx: 0, ty: 0 }, orbits: [], reduced: false,
  init(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext("2d");
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.resize();
    window.addEventListener("resize", () => this.resize());
    window.addEventListener("pointermove", e => { this.par.tx = e.clientX / this.W - .5; this.par.ty = e.clientY / this.H - .5; }, { passive: true });
  },
  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.W = window.innerWidth; this.H = window.innerHeight;
    this.cv.width = this.W * this.dpr; this.cv.height = this.H * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.makeStars(); this.makeNebula();
  },
  makeStars() {
    const area = this.W * this.H / 1e6;
    const layers = [[Math.round(420 * area), 0.6, 1.1, .25], [Math.round(160 * area), 1.0, 1.6, .5], [Math.round(50 * area), 1.4, 2.4, 1]];
    const tints = ["#ffffff", "#dfe9ff", "#fff4d6", "#c9d8ff", "#ffe2e2"];
    this.stars = [];
    layers.forEach(([n, smin, smax, depth], li) => {
      for (let i = 0; i < n; i++) this.stars.push({
        x: Math.random() * this.W, y: Math.random() * this.H, r: U.rand(smin, smax), depth,
        a: U.rand(.3, 1), tw: U.rand(.4, 2.2), ph: Math.random() * Math.PI * 2, c: tints[Math.floor(Math.random() * tints.length)], li,
      });
    });
  },
  makeNebula() {
    const c = document.createElement("canvas"); c.width = Math.ceil(this.W / 2); c.height = Math.ceil(this.H / 2);
    const g = c.getContext("2d"); const w = c.width, h = c.height;
    const blobs = [
      [w * .18, h * .25, w * .5, "110, 60, 200", .22], [w * .82, h * .7, w * .55, "30, 80, 200", .2],
      [w * .55, h * .15, w * .35, "200, 60, 140", .12], [w * .3, h * .85, w * .4, "20, 140, 160", .14],
      [w * .9, h * .2, w * .3, "255, 120, 60", .08], [w * .5, h * .5, w * .7, "40, 30, 90", .18],
    ];
    blobs.forEach(([x, y, r, rgb, a]) => {
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(${rgb}, ${a})`); gr.addColorStop(.5, `rgba(${rgb}, ${a * .35})`); gr.addColorStop(1, `rgba(${rgb}, 0)`);
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    // 은하수 띠
    g.save(); g.translate(w / 2, h / 2); g.rotate(-.5);
    const band = g.createLinearGradient(0, -h * .22, 0, h * .22);
    band.addColorStop(0, "rgba(180,200,255,0)"); band.addColorStop(.5, "rgba(190,205,255,.07)"); band.addColorStop(1, "rgba(180,200,255,0)");
    g.fillStyle = band; g.fillRect(-w, -h * .22, w * 2, h * .44);
    g.restore();
    this.neb = c;
  },
  draw(t) {
    const { ctx, W, H } = this;
    this.par.x = U.lerp(this.par.x, this.par.tx, .04); this.par.y = U.lerp(this.par.y, this.par.ty, .04);
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#05071a"); bg.addColorStop(.5, "#070a1f"); bg.addColorStop(1, "#0a0618");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    if (this.neb) {
      const dx = -this.par.x * 20 + Math.sin(t * .00005) * 12, dy = -this.par.y * 20 + Math.cos(t * .00004) * 10;
      ctx.drawImage(this.neb, dx - 20, dy - 20, W + 40, H + 40);
    }
    for (const s of this.stars) {
      const tw = this.reduced ? 1 : .55 + .45 * Math.sin(t * .001 * s.tw + s.ph);
      const x = s.x - this.par.x * 28 * s.depth, y = s.y - this.par.y * 28 * s.depth;
      ctx.globalAlpha = s.a * tw; ctx.fillStyle = s.c;
      ctx.beginPath(); ctx.arc(x, y, s.r, 0, Math.PI * 2); ctx.fill();
      if (s.li === 2 && tw > .85) { ctx.globalAlpha = (tw - .85) * 2.2; ctx.fillRect(x - s.r * 4, y - .4, s.r * 8, .8); ctx.fillRect(x - .4, y - s.r * 4, .8, s.r * 8); }
    }
    ctx.globalAlpha = 1;
    // 행성 공전 궤도
    if (this.orbits.length) {
      ctx.save(); ctx.strokeStyle = "rgba(170,190,255,.09)"; ctx.lineWidth = 1; ctx.setLineDash([3, 9]);
      for (const o of this.orbits) { ctx.beginPath(); ctx.ellipse(o.cx, o.cy, o.rx, o.ry, 0, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
    }
    this.drawShooting(t);
  },
  drawShooting(t) {
    if (this.reduced) return;
    if (!this.shoot && t > this.nextShoot) {
      this.shoot = { x: U.rand(W0(this.W, .1), this.W * .9), y: U.rand(0, this.H * .4), vx: U.rand(-9, -5), vy: U.rand(3, 6), life: 0, max: U.rand(28, 50) };
      this.nextShoot = t + U.rand(5000, 14000);
    }
    const s = this.shoot; if (!s) return;
    s.x += s.vx; s.y += s.vy; s.life++;
    const a = Math.sin((s.life / s.max) * Math.PI);
    const g = this.ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 14, s.y - s.vy * 14);
    g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, "rgba(255,255,255,0)");
    this.ctx.strokeStyle = g; this.ctx.lineWidth = 1.6; this.ctx.beginPath(); this.ctx.moveTo(s.x, s.y); this.ctx.lineTo(s.x - s.vx * 14, s.y - s.vy * 14); this.ctx.stroke();
    if (s.life >= s.max) this.shoot = null;
  },
};
function W0(w, f) { return w * f; }

/* ── 이펙트 레이어: 파티클, 폭발, 불씨 ── */
const FX = {
  cv: null, ctx: null, W: 0, H: 0, dpr: 1, ps: [], reduced: false,
  init(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext("2d");
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.resize(); window.addEventListener("resize", () => this.resize());
  },
  resize() {
    const r = this.cv.parentElement.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.W = r.width; this.H = r.height;
    this.cv.width = this.W * this.dpr; this.cv.height = this.H * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  },
  clear() { this.ctx.clearRect(0, 0, this.W, this.H); },
  add(p) { if (this.ps.length < 900) this.ps.push(Object.assign({ life: 0, max: 1, g: 0, drag: 1, kind: "dot", a: 1 }, p)); },
  /* 초신성: 완료 폭발 */
  burst(x, y, color, n = 46, power = 1) {
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2, sp = U.rand(40, 260) * power;
      this.add({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, max: U.rand(.5, 1.2), r: U.rand(1, 3.2), c: Math.random() < .3 ? "#ffffff" : color, drag: .96, g: 20 });
    }
    this.add({ x, y, kind: "ring", max: .7, r: 6, c: color, grow: 90 * power });
    this.add({ x, y, kind: "ring", max: .5, r: 2, c: "#ffffff", grow: 50 * power });
  },
  ring(x, y, r0, color, grow = 160, max = .8) { this.add({ x, y, kind: "ring", max, r: r0, c: color, grow, lw: 3 }); },
  /* 태양 불씨 */
  ember(cx, cy, sunR, heat) {
    const ang = U.rand(0, Math.PI * 2);
    const x = cx + Math.cos(ang) * sunR * U.rand(.7, 1.0), y = cy + Math.sin(ang) * sunR * U.rand(.7, 1.0);
    this.add({ x, y, vx: Math.cos(ang) * U.rand(10, 40) + U.rand(-15, 15), vy: -U.rand(30, 90) - heat * 40, max: U.rand(.8, 1.8), r: U.rand(1, 2.6), c: Math.random() < .5 ? "#ffd166" : "#ff7a2a", g: -25, kind: "ember" });
  },
  trail(x, y, color) { this.add({ x: x + U.rand(-4, 4), y: y + U.rand(-4, 4), vx: U.rand(-15, 15), vy: U.rand(-15, 15), max: U.rand(.3, .6), r: U.rand(1, 2.4), c: color, drag: .9 }); },
  update(dt) {
    for (let i = this.ps.length - 1; i >= 0; i--) {
      const p = this.ps[i]; p.life += dt;
      if (p.life >= p.max) { this.ps.splice(i, 1); continue; }
      if (p.kind === "ring") continue;
      p.vx *= p.drag; p.vy = p.vy * p.drag + p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
  },
  draw() {
    const ctx = this.ctx;
    for (const p of this.ps) {
      const k = p.life / p.max, a = 1 - k;
      if (p.kind === "ring") {
        const r = p.r + p.grow * k;
        ctx.globalAlpha = a * .9; ctx.strokeStyle = p.c; ctx.lineWidth = (p.lw || 2) * (1 - k * .6);
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
        continue;
      }
      ctx.globalAlpha = p.kind === "ember" ? a * .85 : a;
      ctx.fillStyle = p.c;
      if (p.kind === "ember") { ctx.shadowBlur = 8; ctx.shadowColor = p.c; }
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (p.kind === "ember" ? (1 - k * .5) : 1), 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  },
};
