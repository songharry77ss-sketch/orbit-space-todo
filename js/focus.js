/* ═══════════════ 집중: 오늘 화면 맨 위의 집중 카드 · 전체 화면 집중(실사 태양) ═══════════════
   불꽃 버튼을 누르면 할 일이 태양으로 날아가 카드가 되고, 카드를 누르면 태양이 타오르는 집중 화면이 열린다. */
"use strict";

const Focus = {
  el: null, id: null,
  init() {
    this.el = $("#focusScreen");
    this.el.addEventListener("click", e => this.onClick(e));
    this.el.addEventListener("keydown", e => {
      if (e.key === "Enter" && e.target.id === "fsStepAdd" && !e.isComposing) { e.preventDefault(); const v = e.target.value.trim(); if (!v || !this.id) return; Store.addStep(this.id, v); requestAnimationFrame(() => this.el.querySelector("#fsStepAdd")?.focus()); }
    });
  },
  doing() { return Store.tasks().filter(t => t.status === "doing").sort((a, b) => b.startedAt - a.startedAt); },
  card(t) {
    const p = Store.planet(t.planetId), e = U.esc;
    return `<div class="fcard" data-id="${t.id}" role="group" aria-label="지금 집중 중: ${e(t.title)}">
      <span class="sunball" aria-hidden="true"></span>
      <div class="f-t"><small>지금 집중 중${p ? ` · ${e(p.name)}` : ""}</small><b>${e(t.title)}</b></div>
      <span class="f-tm" data-live="${t.id}">${U.fmtClock(Store.burned(t))}</span>
      <button type="button" class="f-btn f-stop" data-act="f-stop" aria-label="「${e(t.title)}」 집중 멈추기" title="멈추기">${ico("pause", 20)}</button>
      <button type="button" class="f-btn f-done" data-act="f-done" aria-label="「${e(t.title)}」 완료" title="완료">${ico("check", 20)}</button>
    </div>`;
  },
  open(id) {
    const t = Store.task(id); if (!t || t.status !== "doing") return;
    this.id = id; this.render(); this.el.hidden = false;
    FocusScope.open(this.el, { initial: this.el.querySelector(".fs-close") });
    try { navigator.wakeLock?.request("screen").then(l => { this.lock = l; }).catch(() => {}); } catch (_) { /* 지원 안 함 */ }
  },
  close() {
    if (this.el.hidden) return;
    this.el.hidden = true; this.id = null; FocusScope.close(this.el);
    try { this.lock?.release(); } catch (_) { /* 없음 */ } this.lock = null;
  },
  refresh() {
    if (this.el.hidden) return;
    const t = Store.task(this.id);
    if (!t || t.status !== "doing") { const next = this.doing()[0]; if (next && !this._ending) { this.id = next.id; this.render(); } else if (!this._ending) this.close(); return; }
    this.render();
  },
  render() {
    const t = Store.task(this.id); if (!t) return;
    const p = Store.planet(t.planetId), e = U.esc, others = this.doing().filter(x => x.id !== t.id), sd = t.steps.filter(s => s.done).length;
    const focusEl = this.el.contains(document.activeElement) ? document.activeElement.id || document.activeElement.dataset.act : null;
    this.el.innerHTML = `<div class="fs-top"><button type="button" class="top-back fs-close" data-act="close">${ico("chevDown", 22)}접기</button><button type="button" class="ib plain" data-act="detail" aria-label="할 일 상세 열기">${ico("edit", 20)}</button></div>
      <div class="fs-in">
        <span class="sunball" aria-hidden="true"></span>
        <div class="fs-time" data-live="${t.id}" role="timer" aria-live="off">${U.fmtClock(Store.burned(t))}</div>
        <div class="fs-lbl">${p ? `${thumbImg(bodyKey(p), 20)}${e(p.name)} · ` : ""}오늘 집중 <span id="fsToday">${U.fmtDuration(Store.burnedToday())}</span></div>
        <h2 class="fs-title">${e(t.title)}</h2>
        ${others.length ? `<div class="fs-others">${others.map(o => `<button type="button" data-act="switch" data-id="${o.id}">${ico("flame", 14)} ${e(o.title)}</button>`).join("")}</div>` : ""}
        <div class="fs-steps">
          <div class="blk-h"><span>단계</span><span class="n">${t.steps.length ? `${sd}/${t.steps.length}` : ""}</span></div>
          <div class="group">${t.steps.map(s => `<div class="step ${s.done ? "done" : ""}" data-step="${s.id}"><button type="button" class="ck ${s.done ? "on" : ""}" data-act="step" aria-label="「${e(s.title)}」 ${s.done ? "완료 취소" : "완료"}">${ico("check", 14)}</button><span class="st">${e(s.title)}</span></div>`).join("")}<label class="step-add">${ico("plus", 20)}<input type="text" id="fsStepAdd" placeholder="단계 추가" aria-label="단계 추가" enterkeyhint="send"></label></div>
        </div>
        <div class="fs-act"><button type="button" class="btn" data-act="stop">${ico("pause", 20)}잠시 멈춤</button><button type="button" class="btn ok" data-act="done">${ico("check", 20)}완료</button></div>
      </div>`;
    if (focusEl) (this.el.querySelector(`#${focusEl}`) || this.el.querySelector(`[data-act="${focusEl}"]`))?.focus({ preventScroll: true });
  },
  onClick(e) {
    const a = e.target.closest("[data-act]"); if (!a || !this.id) return;
    const id = this.id;
    switch (a.dataset.act) {
      case "close": this.close(); break;
      case "detail": this.close(); App.openTask(id); break;
      case "switch": this.id = a.dataset.id; this.render(); break;
      case "step": { const sid = a.closest("[data-step]").dataset.step, t = Store.task(id), s = t && t.steps.find(x => x.id === sid); if (!s) break; if (!s.done) Juice.pop(a, "step"); Store.updateStep(id, sid, { done: !s.done }); break; }
      case "stop": this.close(); App.stopTask(id); break;
      case "done": {
        this._ending = true; const sun = this.el.querySelector(".sunball");
        if (sun) { sun.classList.remove("flare"); void sun.offsetWidth; sun.classList.add("flare"); }
        App.completeTask(id, a);
        setTimeout(() => { this._ending = false; if (!this.doing().length) this.close(); else this.refresh(); }, 900);
        break;
      }
    }
  },
  tick() {
    if (this.el.hidden) return;
    this.el.querySelectorAll("[data-live]").forEach(el => { const t = Store.task(el.dataset.live); if (t) el.textContent = U.fmtClock(Store.burned(t)); });
    const td = this.el.querySelector("#fsToday"); if (td) td.textContent = U.fmtDuration(Store.burnedToday());
  },
};
