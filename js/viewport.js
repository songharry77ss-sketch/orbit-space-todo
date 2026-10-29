/* Keep the app surface steady while a mobile keyboard changes the visual viewport.
   Intentional browser pinch zoom is left to the user. */
"use strict";

const ViewportState = {
  width: 0, height: 0, keyboard: false, frame: 0,
  editable(el) {
    return !!el && (el.isContentEditable || el.matches?.('textarea, select, input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="file"]):not([type="hidden"])'));
  },
  init() {
    this.width = document.documentElement.clientWidth;
    this.height = document.documentElement.clientHeight || window.innerHeight;
    this.update();
    this.stageObserver = new ResizeObserver(() => {
      if (typeof Scene === "undefined" || !Scene.stage) return;
      const rect = Scene.stage.getBoundingClientRect();
      if (Math.abs(Scene.W - rect.width) > 1 || Math.abs(Scene.H - rect.height) > 1) Scene.measure();
    });
    this.stageObserver.observe(document.getElementById("stage"));
    window.addEventListener("resize", () => this.schedule(), { passive: true });
    window.visualViewport?.addEventListener("resize", () => this.schedule(), { passive: true });
    window.visualViewport?.addEventListener("scroll", () => this.schedule(), { passive: true });
    window.addEventListener("scroll", () => this.pinRoot(), { passive: true });
    document.addEventListener("focusin", () => this.schedule());
    document.addEventListener("focusout", () => this.schedule());
    document.addEventListener("visibilitychange", () => { if (!document.hidden) this.schedule(); });
  },
  schedule() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => { this.frame = 0; this.update(); });
  },
  initialScale() { return Math.abs((window.visualViewport?.scale || 1) - 1) < 0.02; },
  pinRoot() {
    if (this.initialScale() && (window.scrollX || window.scrollY)) window.scrollTo({ left: 0, top: 0, behavior: "instant" });
  },
  update() {
    if (!this.initialScale()) return;
    const root = document.documentElement, vv = window.visualViewport;
    const width = root.clientWidth, layoutHeight = root.clientHeight || window.innerHeight;
    const visibleHeight = vv?.height || layoutHeight, offsetTop = vv?.offsetTop || 0;
    const editing = this.editable(document.activeElement), rotated = Math.abs(width - this.width) > 2;
    const mobile = matchMedia("(any-pointer: coarse)").matches || navigator.maxTouchPoints > 0;
    const resizedLayout = Math.abs(layoutHeight - this.height) > 2 && Math.abs(layoutHeight - visibleHeight) < 2;
    if (rotated || resizedLayout) { this.width = width; this.height = layoutHeight; this.keyboard = false; }
    const keyboard = mobile && (editing || this.keyboard) && this.height - visibleHeight > 120;
    if (!keyboard && (!editing || !mobile)) this.height = layoutHeight;
    const wasKeyboard = this.keyboard;
    this.keyboard = keyboard;
    const inset = keyboard ? Math.max(0, layoutHeight - visibleHeight - offsetTop) : 0;
    root.style.setProperty("--visible-height", `${Math.round(visibleHeight)}px`);
    root.style.setProperty("--keyboard-inset", `${Math.round(inset)}px`);
    root.style.setProperty("--scene-height", `${Math.round(this.height)}px`);
    document.body.classList.toggle("keyboard-open", keyboard);
    this.pinRoot();
    if (typeof Scene !== "undefined" && Scene.stage) {
      if (Math.abs(Scene.H - this.height) > 1 || Math.abs(Scene.W - width) > 1) Scene.measure();
      else if ((wasKeyboard && !keyboard) || (!editing && !keyboard && Scene._fitDeferred)) Scene.layout();
    }
  },
};
