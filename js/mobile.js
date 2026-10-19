/* ═══════════════ 좁은 화면 · 터치 대응 (Scene 확장) ═══════════════
   - 폭 640px 미만: 행성을 좌우 지그재그로 배치하고, 불타는 칩은 태양 아래에 세로로 쌓음
   - 터치 기기: 위성 공전 속도를 낮추고, 행성 주변(궤도 영역)을 탭하면 위성이 멈추고 펼쳐짐
   ═══════════════════════════════════════════════════════════════ */
"use strict";

(function () {
  const baseMeasure = Scene.measure, baseLayout = Scene.layout, baseLayoutChips = Scene.layoutChips, baseCreate = Scene.createSystem, baseRingR = Scene.ringR;
  const touchMQ = window.matchMedia("(hover: none) and (pointer: coarse)");

  Scene.measure = function () {
    baseMeasure.call(this);
    this.narrow = this.W < 640;
    this.touch = touchMQ.matches;
    this.speedK = this.touch ? .55 : 1;
    this.k = this.narrow ? .8 : 1;
    if (this.narrow) {
      this.cy = Math.round(this.H * .42);
      this.sunR = U.clamp(Math.min(this.W, this.H) * .11, 40, 50);
      this.sunWrap.style.top = `${this.cy}px`; this.sunWrap.style.setProperty("--sunR", `${this.sunR}px`);
    }
    this.sunWrap.classList.toggle("narrow", this.narrow);
    document.body.classList.toggle("touch", this.touch);
  };

  Scene.ringR = function (sys, r) { return sys.pr + (24 + r * 19) * (this.k || 1); };

  Scene.layout = function () {
    if (!this.narrow) return baseLayout.call(this);
    const ids = this.order, n = ids.length; if (!n) { Sky.orbits = []; return; }
    const rx = Math.round(this.W * .31);
    const top = 64 + 88, bottom = this.H - 126, span = Math.max(120, bottom - top);
    Sky.orbits = [{ cx: this.cx, cy: this.cy, rx, ry: span / 2 }];
    ids.forEach((id, i) => {
      const sys = this.systems.get(id); if (!sys) return;
      const t = n === 1 ? .5 : i / (n - 1);
      sys.x = this.cx + (i % 2 === 0 ? -1 : 1) * rx;
      sys.y = top + t * span;
      if (n === 1) sys.x = this.cx - rx;
      sys.el.style.left = `${sys.x}px`; sys.el.style.top = `${sys.y}px`;
    });
    this.layoutChips();
  };

  Scene.layoutChips = function () {
    if (!this.narrow) return baseLayoutChips.call(this);
    const list = [...this.chips.values()];
    list.forEach((c, i) => { c.ax = 0; c.ay = this.sunR + 44 + i * 54; c.el.style.left = "0px"; c.el.style.top = `${c.ay}px`; });
  };

  /* 터치: 궤도 영역을 탭하면 해당 행성계가 펼쳐진 채로 고정 */
  Scene.createSystem = function (p) {
    const sys = baseCreate.call(this, p);
    sys.hit.addEventListener("pointerdown", e => {
      if (!this.touch || e.pointerType === "mouse") return;
      const on = !sys.pinned;
      for (const s of this.systems.values()) s.pinned = false;
      sys.pinned = on;
    });
    return sys;
  };
  document.addEventListener("pointerdown", e => {
    if (!Scene.touch) return;
    if (!e.target.closest(".system")) for (const s of Scene.systems.values()) s.pinned = false;
  }, true);
  touchMQ.addEventListener?.("change", () => { Scene.measure(); Scene.layout(); });
})();
