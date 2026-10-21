/* ═══════════════ 시작 인트로: 최소 연출 시간이 지나고 우주 사진이 준비되면 빛이 터지며 넘어간다 ═══════════════ */
"use strict";

const Intro = {
  done: false, finished: false, queue: [],
  run() {
    const el = document.getElementById("intro");
    if (!el) return this.finish();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches, quick = el.classList.contains("quick");
    const t0 = window.ORBIT_INTRO_T || 0, minT = reduced ? 350 : quick ? 1150 : 2450, maxT = minT + 1600;   // 인트로가 그려지기 시작한 때부터 잰다
    const go = () => { if (!this.done) this.exit(el, reduced); };
    el.addEventListener("pointerdown", go);
    window.addEventListener("keydown", e => { if (!this.done) { e.preventDefault(); e.stopImmediatePropagation(); go(); } }, true);
    const tick = () => {
      if (this.done) return;
      const t = performance.now() - t0, ready = !Scene.useGL || (GL.ready(Scene.skyTex()) && GL.ready(TEX.sun));
      if (t >= maxT || (t >= minT && ready)) go(); else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  },
  exit(el, reduced) {
    this.done = true;
    try { localStorage.setItem("orbit.intro", "1"); } catch (e) {}
    if (!reduced) Scene.flyIn(2600);
    el.classList.add("out");
    document.body.classList.add("intro-fade");
    setTimeout(() => { document.body.classList.remove("intro-on"); this.finish(); }, reduced ? 0 : 700);
    setTimeout(() => { el.remove(); document.body.classList.remove("intro-fade"); }, 2000);
  },
  finish() { this.done = this.finished = true; const q = this.queue; this.queue = []; q.forEach(f => f()); },
  /* 인트로가 끝난 뒤에 할 일 (첫 실행 안내 등) */
  after(fn) { if (this.finished) fn(); else this.queue.push(fn); },
};
