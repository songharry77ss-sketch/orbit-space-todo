/* ═══════════════ 지금 집중 중: 입력창 바로 위 고정 바 (큰 타이머 · 다음 단계 · 멈춤 · 완료) ═══════════════ */
"use strict";

const Now = {
  el: null,
  init() { this.el = $("#nowbar"); this.el.addEventListener("click", e => this.onClick(e)); },
  primary(doing) { const id = Store.state.settings.nowId; return doing.find(t => t.id === id) || doing.slice().sort((a, b) => b.startedAt - a.startedAt)[0]; },
  render() {
    const doing = Store.tasks().filter(t => t.status === "doing");
    const hide = !doing.length || App.view === "calendar" || App.view === "list";
    document.body.classList.toggle("has-now", !hide);
    if (hide) {
      /* 끝내거나 멈추면 바가 아래로 가라앉으며 사라진다 */
      if (!this.el.hidden && doing.length === 0 && !this.el.classList.contains("leaving")) { this.el.classList.add("leaving"); clearTimeout(this._lt); this._lt = setTimeout(() => { this.el.classList.remove("leaving"); if (!Store.tasks().some(x => x.status === "doing") || App.view === "calendar" || App.view === "list") this.el.hidden = true; Board.place(); }, 280); }
      else if (doing.length) this.el.hidden = true;
      this._id = null; Scene.setNowH(0); return;
    }
    clearTimeout(this._lt); this.el.classList.remove("leaving"); this.el.hidden = false;
    const t = this.primary(doing), p = Store.planet(t.planetId), others = doing.filter(x => x.id !== t.id).sort((a, b) => a.startedAt - b.startedAt);
    const next = t.steps.find(s => !s.done), sd = t.steps.filter(s => s.done).length;
    this.el.dataset.id = t.id;
    this.el.innerHTML = `
      <div class="nb-main">
        <span class="nb-live" aria-hidden="true"><i></i></span>
        <button type="button" class="nb-info" data-act="open" title="상세 보기">
          <span class="nb-k">지금 집중 중<span class="nb-pl">${thumbImg(bodyKey(p), 14)}${U.esc(p ? p.name : "")}</span>${t.priority ? `<span class="nb-pr" style="color:${PRIO[t.priority].color}">${prioSvg(t.priority, 11)}${PRIO[t.priority].ko}</span>` : ""}</span>
          <span class="nb-t">${U.esc(t.title)}</span>
        </button>
        <span class="nb-timer num" data-live="${t.id}" aria-label="집중한 시간">${U.fmtClock(Store.burned(t))}</span>
        <button type="button" class="nb-btn" data-act="pause" aria-label="멈추고 궤도로 되돌리기" title="멈추고 궤도로 되돌리기">${ico("pause", 16)}</button>
        <button type="button" class="nb-btn done" data-act="done" aria-label="완료" title="완료">${ico("check", 16)}<span>완료</span></button>
      </div>
      ${next ? `<div class="nb-step"><button type="button" class="nb-scheck" data-act="step" data-sid="${next.id}" aria-label="이 단계 완료" title="이 단계 완료">${ico("check", 11)}</button><span class="nb-sk">다음 단계</span><span class="nb-st">${U.esc(next.title)}</span><span class="num nb-sn">${sd}/${t.steps.length}</span></div>` : ""}
      ${others.length ? `<div class="nb-others"><span class="nb-ok">함께 집중 중</span>${others.map(o => { const op = Store.planet(o.planetId); return `<button type="button" class="nb-chip" data-act="switch" data-id="${o.id}" title="크게 보기"><i class="pd" style="--c:${op ? pColor(op) : "#fff"}"></i><span class="tt">${U.esc(o.title)}</span><span class="num" data-live="${o.id}">${U.fmtClock(Store.burned(o))}</span></button>`; }).join("")}</div>` : ""}`;
    requestAnimationFrame(() => { Scene.setNowH(this.el.hidden ? 0 : this.el.offsetHeight + 12); Board.place(); });
  },
  /* 불덩이가 태양에 닿는 순간 집중 바도 함께 타오른다 */
  ignite() { if (this.el.hidden) return; this.el.classList.remove("ignite"); void this.el.offsetWidth; this.el.classList.add("ignite"); clearTimeout(this._it); this._it = setTimeout(() => this.el.classList.remove("ignite"), 1400); },
  onClick(e) {
    const b = e.target.closest("[data-act]"); if (!b) return; const id = this.el.dataset.id, t = Store.task(id);
    switch (b.dataset.act) {
      case "open": App.openTask(id); break;
      case "pause": App.stopTask(id); break;
      case "done": App.completeTask(id, b); break;
      case "step": Juice.pop(b, "step"); setTimeout(() => Store.updateStep(id, b.dataset.sid, { done: true }), 220); break;
      case "switch": Store.setSetting("nowId", b.dataset.id); this.render(); break;
    }
  },
  pulse() { if (this.el.hidden) return; this.el.classList.remove("pulse"); void this.el.offsetWidth; this.el.classList.add("pulse"); },
  tick() { if (this.el.hidden) return; this.el.querySelectorAll("[data-live]").forEach(el => { const t = Store.task(el.dataset.live); if (t) el.textContent = U.fmtClock(Store.burned(t)); }); },
};
