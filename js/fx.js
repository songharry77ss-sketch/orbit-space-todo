/* ═══════════════ 2D 이펙트 레이어: 떠다니는 우주 먼지 · 태양 불씨 · 초신성 폭발 · 드래그 궤적 ═══════════════ */
"use strict";

const FX = {
  cv: null, ctx: null, W: 1, H: 1, dpr: 1, ps: [], motes: null, sprite: null, t: 0,
  init(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext("2d");
    const s = document.createElement("canvas"); s.width = s.height = 64;
    const g = s.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, "rgba(255,255,255,.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); this.sprite = s;
  },
  resize(W, H) {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = W; this.H = H;
    this.cv.width = Math.round(W * this.dpr); this.cv.height = Math.round(H * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.motes = null;
  },
  clear() { this.ctx.clearRect(0, 0, this.W, this.H); },
  makeMotes() {
    const n = Math.round(U.clamp(this.W * this.H / 42000, 14, 46));
    this.motes = Array.from({ length: n }, () => {
      const big = Math.random() < 0.18;
      return { x: Math.random() * this.W, y: Math.random() * this.H, r: big ? U.rand(5, 11) : U.rand(0.8, 2.4), a: big ? U.rand(0.025, 0.06) : U.rand(0.18, 0.5),
        vx: U.rand(-6, 6), vy: U.rand(-4, -10), d: big ? U.rand(1, 1.6) : U.rand(0.3, 1), f: U.rand(0.4, 1.4), p: Math.random() * 6.28,
        c: Math.random() < 0.3 ? "warm" : "cool" };
    });
  },
  dust(dt, px, py, reduced) {
    if (!this.motes) this.makeMotes();
    this.t += dt;
    const ctx = this.ctx, m0 = 24;
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (const m of this.motes) {
      if (!reduced) { m.x += m.vx * dt * 0.6; m.y += m.vy * dt * 0.6; }
      if (m.y < -m0) { m.y = this.H + m0; m.x = Math.random() * this.W; }
      if (m.x < -m0) m.x = this.W + m0; else if (m.x > this.W + m0) m.x = -m0;
      const x = m.x - px * 46 * m.d, y = m.y - py * 46 * m.d;
      ctx.globalAlpha = m.a * (0.55 + 0.45 * Math.sin(this.t * m.f + m.p));
      ctx.drawImage(this.sprite, x - m.r, y - m.r, m.r * 2, m.r * 2);
    }
    ctx.restore();
  },
  add(p) { if (this.ps.length < 700) this.ps.push(Object.assign({ life: 0, max: 1, g: 0, drag: 1, kind: "dot" }, p)); },
  burst(x, y, color, n = 46, power = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = U.rand(30, 230) * power;
      this.add({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, max: U.rand(0.5, 1.3), r: U.rand(0.8, 2.6), c: Math.random() < 0.35 ? "#ffffff" : color, drag: 0.955, g: 12 });
    }
    this.add({ x, y, kind: "flash", max: 0.45, r: 26 * power, c: color });
  },
  ring(x, y, r0, color, grow = 160, max = 0.8) { this.add({ x, y, kind: "ring", max, r: r0, c: color, grow }); },
  ember(cx, cy, R, heat) {
    const a = Math.random() * Math.PI * 2, rr = R * U.rand(0.85, 1.05);
    this.add({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr, vx: Math.cos(a) * U.rand(12, 46), vy: Math.sin(a) * U.rand(12, 46) - U.rand(6, 26) * heat,
      max: U.rand(0.9, 2.1), r: U.rand(0.7, 1.9), c: Math.random() < 0.5 ? "#ffd59a" : "#ff8a3c", g: -8, drag: 0.985, kind: "ember" });
  },
  trail(x, y, color) { this.add({ x: x + U.rand(-3, 3), y: y + U.rand(-3, 3), vx: U.rand(-14, 14), vy: U.rand(-14, 14), max: U.rand(0.3, 0.6), r: U.rand(0.7, 1.8), c: color, drag: 0.9 }); },
  update(dt) {
    for (let i = this.ps.length - 1; i >= 0; i--) {
      const p = this.ps[i]; p.life += dt;
      if (p.life >= p.max) { this.ps.splice(i, 1); continue; }
      if (p.kind === "ring" || p.kind === "flash") continue;
      p.vx *= p.drag; p.vy = p.vy * p.drag + p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    }
  },
  draw() {
    const ctx = this.ctx; if (!this.ps.length) return;
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (const p of this.ps) {
      const k = p.life / p.max, a = 1 - k;
      if (p.kind === "ring") {
        ctx.globalAlpha = a * 0.85; ctx.strokeStyle = p.c; ctx.lineWidth = 2.2 * (1 - k * 0.7);
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r + p.grow * (1 - Math.pow(1 - k, 2)), 0, Math.PI * 2); ctx.stroke(); continue;
      }
      if (p.kind === "flash") { ctx.globalAlpha = a * a * 0.9; const r = p.r * (0.6 + k); ctx.drawImage(this.sprite, p.x - r, p.y - r, r * 2, r * 2); continue; }
      ctx.globalAlpha = p.kind === "ember" ? a * 0.9 : a;
      ctx.fillStyle = p.c;
      const r = p.r * (p.kind === "ember" ? 1 - k * 0.5 : 1);
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha *= 0.35; ctx.drawImage(this.sprite, p.x - r * 4, p.y - r * 4, r * 8, r * 8);
    }
    ctx.restore();
  },
};
