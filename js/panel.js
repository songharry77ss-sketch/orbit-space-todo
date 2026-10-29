/* ═══════════════ 할 일 상세: 휴대폰은 아래에서 올라오는 시트, 넓은 화면은 오른쪽 패널 ═══════════════
   날짜 · 우선순위 · 오늘 할 일 · 반복은 한 줄 칩으로, 「완료」 「집중 시작」은 엄지가 닿는 아래에 고정. */
"use strict";

const Panel = {
  el: null, inner: null, mode: null, id: null, timers: {}, _key: "",
  init() {
    this.el = $("#sheet"); this.inner = $("#sheetInner");
    $("#sheetBackdrop").addEventListener("click", () => this.close());
    this.inner.addEventListener("click", e => this.onClick(e));
    this.inner.addEventListener("input", e => this.onInput(e));
    this.inner.addEventListener("change", e => this.onChange(e));
    this.inner.addEventListener("keydown", e => this.onKey(e));
    window.addEventListener("resize", () => { if (!this.el.hidden) this.updateScope(); });
    this.bindGrip();
  },
  modal() { return innerWidth < 1200; },
  open(mode, id) {
    if (mode !== "task") return;
    const was = !this.el.hidden;
    this.mode = mode; this.id = id; this._key = "";
    this.render();
    if (!was) { this.el.hidden = false; this.el.style.transform = ""; document.body.classList.add("sheet-open"); }
    this.inner.querySelectorAll("textarea.task-title").forEach(x => this.autosize(x));
    this.el.setAttribute("role", "dialog"); this.el.setAttribute("aria-label", `할 일 상세: ${Store.task(id)?.title || ""}`);
    FocusScope.open(this.el, { modal: this.modal(), initial: this.el });
    this.updateScope(); Views.render();
  },
  updateScope() {
    const modal = this.modal();
    this.el.setAttribute("aria-modal", String(modal)); document.body.classList.toggle("sheet-modal", modal);
    $("#sheetBackdrop").hidden = !modal; FocusScope.setModal(this.el, modal);
  },
  close() {
    if (this.el.hidden) return;
    this.el.hidden = true; this.mode = null; this.id = null; this._key = "";
    document.body.classList.remove("sheet-open", "sheet-modal"); $("#sheetBackdrop").hidden = true;
    FocusScope.close(this.el); Views.render();
  },
  refresh() { if (!this.mode) return; if (!Store.task(this.id)) return this.close(); this.render(); },
  render() {
    const focus = this.inner.contains(document.activeElement) ? FocusScope.remember() : null;
    const old = this.inner.querySelector(".sh-body"), st = old ? old.scrollTop : 0, key = `${this.mode}:${this.id}`;
    const pop = this.inner.querySelector(".date-pop") ? true : false;
    this.renderTask();
    const nb = this.inner.querySelector(".sh-body"); if (nb && key === this._key) nb.scrollTop = st;
    this._key = key;
    if (pop) this.datePop(false);
    this.inner.querySelectorAll("textarea.task-title").forEach(t => this.autosize(t));
    if (focus) FocusScope.restore(focus);
  },
  autosize(t) { t.style.height = "auto"; if (t.scrollHeight) t.style.height = `${t.scrollHeight}px`; },
  tick() {
    if (!this.mode) return;
    this.inner.querySelectorAll("[data-live]").forEach(el => { const t = Store.task(el.dataset.live); if (t) el.textContent = U.fmtClock(Store.burned(t)); });
  },

  renderTask() {
    const t = Store.task(this.id); if (!t) return;
    const p = Store.planet(t.planetId) || Store.planets()[0], e = U.esc, today = U.today();
    const doing = t.status === "doing", done = t.status === "done", burned = Store.burned(t), sd = t.steps.filter(s => s.done).length, pr = t.priority || 0;
    const myDay = t.myDay === today, late = Store.isOverdue(t), rep = t.repeat && t.repeat !== "none";
    const dueTxt = t.due ? `${U.relDate(t.due)}${late && !U.relDate(t.due).includes("지남") ? " · 지남" : ""}${t.time ? " " + U.fmtTime(t.time) : ""}` : "";
    const start = doing && t.startedAt ? new Date(t.startedAt).toTimeString().slice(0, 5) : "";
    const foot = done ? `<button type="button" class="btn" data-act="toggle-done" style="grid-column:1/-1">${ico("undo", 20)}다시 할 일로</button>`
      : doing ? `<button type="button" class="btn" data-act="stop">${ico("pause", 20)}멈추기</button><button type="button" class="btn ok" data-act="toggle-done">${ico("check", 20)}완료</button>`
      : `<button type="button" class="btn" data-act="toggle-done">${ico("check", 20)}완료</button><button type="button" class="btn sol" data-act="start">${ico("flame", 20)}집중 시작</button>`;
    this.inner.innerHTML = `<div class="sh-head"><button type="button" class="planet-chip" data-act="pick-planet" aria-label="행성: ${e(p.name)} · 바꾸기">${thumbImg(bodyKey(p), 30)}<span>${e(p.name)}</span>${ico("chevDown", 16)}</button><span class="grow"></span><button type="button" class="ib plain" data-act="close" aria-label="닫기" title="닫기  Esc">${ico("x", 22)}</button></div>
    <div class="sh-body">
      <div class="title-row">
        <button type="button" class="ck ${done ? "on" : "p" + pr}" data-act="toggle-done" aria-label="${done ? "완료 취소" : "완료"}">${ico("check", 17)}</button>
        <textarea class="task-title ${done ? "done" : ""}" id="taskTitle" rows="1" data-field="title" aria-label="할 일 제목">${e(t.title)}</textarea>
      </div>
      <div class="chips" style="position:relative">
        <button type="button" class="chip ${t.due ? (late ? "late" : "on") : "ghost"}" data-act="date" aria-label="마감일: ${t.due ? e(U.fmtDate(t.due, true)) : "없음"}">${ico("calendar", 18)}${t.due ? e(dueTxt) : "날짜"}</button>
        <button type="button" class="chip ${pr ? "pr" + pr : "ghost"}" data-act="prio-menu" aria-label="우선순위: ${PRIO[pr].ko}">${prioSvg(pr, 18)}${pr ? PRIO[pr].ko : "우선순위"}</button>
        ${done ? "" : `<button type="button" class="chip ${myDay ? "on" : "ghost"}" data-act="toggle-myday" aria-pressed="${myDay}">${ico("sun", 18)}오늘 할 일</button>`}
        <label class="chip ${rep ? "on" : "ghost"}">${ico("repeat", 18)}<select id="taskRepeat" data-field="repeat" class="repeat-sel" aria-label="반복" style="background:transparent;min-height:0;padding:0">${Store.REPEATS.map(([v, l]) => `<option value="${v}" ${t.repeat === v ? "selected" : ""}>${v === "none" ? "반복 없음" : l}</option>`).join("")}</select></label>
      </div>
      ${burned > 1 || doing ? `<div class="burn"><span class="sunball" aria-hidden="true"></span><div><div class="lbl">${doing ? "지금 집중 중" : "누적 집중 시간"}</div><div class="val" data-live="${t.id}">${U.fmtClock(burned)}</div></div>${start ? `<div class="side">${start} 시작</div>` : ""}</div>` : ""}
      <div class="blk"><div class="blk-h"><span>단계</span><span class="n">${t.steps.length ? `${sd}/${t.steps.length}` : ""}</span></div>
        <div class="group">${t.steps.map(s => `<div class="step ${s.done ? "done" : ""}" data-step="${s.id}"><button type="button" class="ck ${s.done ? "on" : ""}" data-act="step-toggle" aria-label="「${e(s.title)}」 ${s.done ? "완료 취소" : "완료"}">${ico("check", 14)}</button><input type="text" data-step-title value="${e(s.title)}" aria-label="단계 이름"><button type="button" class="del" data-act="step-del" aria-label="단계 삭제">${ico("x", 18)}</button></div>`).join("")}<label class="step-add">${ico("plus", 20)}<input type="text" id="stepAdd" placeholder="단계 추가" aria-label="새 단계" enterkeyhint="send"></label></div>
      </div>
      <div class="blk"><div class="blk-h"><span>메모</span></div><textarea class="notes" id="taskNotes" data-field="notes" placeholder="메모 · 링크 · 생각">${e(t.notes || "")}</textarea></div>
      <div class="sh-meta"><span>${U.fmtStamp(t.createdAt)} 만듦${t.completedAt ? ` · ${U.fmtStamp(t.completedAt)} 완료` : ""}</span><button type="button" class="del" data-act="delete">${ico("trash", 18)}삭제</button></div>
    </div>
    <div class="sh-foot">${foot}</div>`;
  },
  /* 날짜 고르기: 빠른 선택 + 날짜 · 시간 + 캘린더에 추가 */
  datePop(toggle = true) {
    const box = this.inner.querySelector(".chips"), old = box && box.querySelector(".date-pop");
    if (old) { old.remove(); if (toggle) return; }
    const t = Store.task(this.id); if (!t || !box) return;
    const today = U.today(), q = [["오늘", today], ["내일", U.addDays(today, 1)], ["모레", U.addDays(today, 2)], ["다음 주", U.addDays(today, 7)], ["기한 없음", ""]];
    const pop = document.createElement("div"); pop.className = "pop date-pop"; pop.style.top = "calc(100% + 4px)"; pop.style.left = "0";
    pop.innerHTML = `<div class="pop-title">마감일</div><div class="pop-grid">${q.map(([l, v]) => `<button type="button" class="pop-item" data-act="due" data-v="${v}"><span class="lbl">${l}</span>${v ? `<span class="sub">${U.weekday(v)}</span>` : ""}${(t.due || "") === v ? `<span class="chk">${ico("check", 18)}</span>` : ""}</button>`).join("")}</div>
      <div class="pop-sep"></div><div class="pop-row"><input type="date" id="taskDue" data-field="due" value="${t.due || ""}" aria-label="날짜"><input type="time" id="taskTime" data-field="time" value="${t.time || ""}" aria-label="시간"></div>
      ${t.due ? `<div class="cal-add"><span>캘린더에 추가</span><button type="button" data-act="cal-add" data-to="google">Google</button><button type="button" data-act="cal-add" data-to="outlook">Outlook</button><button type="button" data-act="cal-add" data-to="ics">.ics 파일</button></div>` : ""}`;
    box.appendChild(pop);
    if (toggle) requestAnimationFrame(() => pop.querySelector("button")?.focus({ preventScroll: true }));
    const off = ev => { if (!pop.isConnected) { document.removeEventListener("pointerdown", off, true); return; } if (!pop.contains(ev.target) && !ev.target.closest('[data-act="date"]')) { pop.remove(); document.removeEventListener("pointerdown", off, true); } };
    setTimeout(() => document.addEventListener("pointerdown", off, true), 0);
  },
  onClick(e) {
    const btn = e.target.closest("[data-act]"); if (!btn) return;
    const act = btn.dataset.act, tid = this.id, t = tid ? Store.task(tid) : null, today = U.today();
    switch (act) {
      case "close": this.close(); break;
      case "pick-planet": this.planetPicker(btn); break;
      case "toggle-done": if (!t) break; if (t.status === "done") { Store.uncompleteTask(t.id); Juice.sfx("pause"); } else App.completeTask(t.id, btn.classList.contains("ck") ? btn : this.inner.querySelector(".title-row .ck")); break;
      case "prio-menu": if (t) PrioMenu.open(btn, t.priority || 0, v => Store.updateTask(t.id, { priority: v })); break;
      case "start": App.startTask(tid, btn); this.close(); break;
      case "stop": App.stopTask(tid); break;
      case "toggle-myday": if (!t) break; Store.updateTask(tid, { myDay: t.myDay === today ? null : today }); App.toast("sun", t.myDay === today ? "오늘 할 일에 넣었어요" : "오늘 할 일에서 뺐어요"); break;
      case "date": this.datePop(); break;
      case "due": if (t) { Store.updateTask(tid, { due: btn.dataset.v || null, time: btn.dataset.v ? t.time : null }); this.inner.querySelector(".date-pop")?.remove(); } break;
      case "cal-add": CalSync.addOne(tid, btn.dataset.to); break;
      case "step-toggle": { const li = btn.closest("[data-step]"), s = t.steps.find(x => x.id === li.dataset.step); if (!s.done) Juice.pop(btn, "step"); Store.updateStep(tid, s.id, { done: !s.done }); break; }
      case "step-del": Store.removeStep(tid, btn.closest("[data-step]").dataset.step); break;
      case "delete": App.deleteTask(tid); break;
    }
  },
  onInput(e) {
    const el = e.target;
    if (el.matches("textarea.task-title")) this.autosize(el);
    if (el.dataset.field === "title" || el.dataset.field === "notes") {
      clearTimeout(this.timers.text);
      const f = el.dataset.field, v = el.value, id = this.id;
      this.timers.text = setTimeout(() => { if (f === "title" && !v.trim()) return; Store.updateTask(id, { [f]: f === "title" ? v.trim() : v }, { silent: true }); Views.render(); }, 250);
    }
    if (el.hasAttribute("data-step-title")) {
      clearTimeout(this.timers.step);
      const sid = el.closest("[data-step]").dataset.step, v = el.value, id = this.id;
      this.timers.step = setTimeout(() => Store.updateStep(id, sid, { title: v }, { silent: true }), 250);
    }
  },
  onChange(e) {
    const el = e.target, f = el.dataset.field, t = Store.task(this.id); if (!t) return;
    if (f === "due") Store.updateTask(t.id, { due: el.value || null, time: el.value ? t.time : null });
    else if (f === "time") Store.updateTask(t.id, { time: el.value || null, due: t.due || (el.value ? U.today() : null) });
    else if (f === "repeat") Store.updateTask(t.id, { repeat: el.value });
  },
  onKey(e) {
    if (e.isComposing || e.keyCode === 229) return;
    const el = e.target;
    if (e.key === "Enter" && el.matches("textarea.task-title")) { e.preventDefault(); el.blur(); return; }
    if (e.key === "Enter" && el.id === "stepAdd") {
      e.preventDefault(); const v = el.value.trim(); if (!v) return;
      Store.addStep(this.id, v); requestAnimationFrame(() => this.inner.querySelector("#stepAdd")?.focus()); return;
    }
    if (e.key === "Escape" && this.inner.querySelector(".date-pop")) { e.stopPropagation(); this.inner.querySelector(".date-pop").remove(); this.inner.querySelector('[data-act="date"]')?.focus(); }
  },
  planetPicker(btn) {
    const old = this.inner.querySelector(".pick-pop"); if (old) { old.remove(); return; }
    const t = Store.task(this.id); if (!t) return;
    const pop = document.createElement("div"); pop.className = "pop pick-pop";
    pop.innerHTML = `<div class="pop-title">행성 옮기기</div>` + Store.planets().map(p => `<button type="button" class="pop-item" data-pid="${p.id}">${thumbImg(bodyKey(p), 30)}<span class="lbl">${U.esc(p.name)}</span>${p.id === t.planetId ? `<span class="chk">${ico("check", 18)}</span>` : ""}</button>`).join("");
    pop.addEventListener("click", ev => { const it = ev.target.closest("[data-pid]"); if (!it) return; if (it.dataset.pid !== t.planetId) { const from = t.planetId; Store.updateTask(this.id, { planetId: it.dataset.pid }); App.toast("orbit", `「${Store.planet(it.dataset.pid).name}」 행성으로 옮겼어요`, () => Store.updateTask(t.id, { planetId: from })); } else pop.remove(); });
    btn.closest(".sh-head").appendChild(pop);
    requestAnimationFrame(() => pop.querySelector("button")?.focus({ preventScroll: true }));
    const off = ev => { if (!pop.contains(ev.target) && !btn.contains(ev.target)) { pop.remove(); document.removeEventListener("pointerdown", off, true); } };
    setTimeout(() => document.addEventListener("pointerdown", off, true), 0);
  },
  /* 휴대폰: 손잡이를 끌어내려 닫기 */
  bindGrip() {
    const grip = $("#sheetGrip"); let y0 = null, dy = 0;
    grip.addEventListener("pointerdown", e => { y0 = e.clientY; dy = 0; grip.setPointerCapture(e.pointerId); this.el.style.transition = "none"; });
    grip.addEventListener("pointermove", e => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); this.el.style.transform = `translateY(${dy}px)`; });
    const end = () => { if (y0 == null) return; y0 = null; this.el.style.transition = ""; if (dy > 110) this.close(); this.el.style.transform = ""; };
    grip.addEventListener("pointerup", end); grip.addEventListener("pointercancel", end);
  },
};
