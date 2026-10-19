/* ═══════════════ 시트: 할 일 상세 · 행성 · 날짜 · 오늘의 미션 · 기한 없는 할 일 ═══════════════ */
"use strict";

const Panel = {
  el: null, inner: null, mode: null, id: null, date: null, showDone: false, timers: {}, _key: "",
  init() {
    this.el = document.getElementById("sheet"); this.inner = document.getElementById("sheetInner");
    this.inner.addEventListener("click", e => this.onClick(e));
    this.inner.addEventListener("input", e => this.onInput(e));
    this.inner.addEventListener("change", e => this.onChange(e));
    this.inner.addEventListener("keydown", e => this.onKey(e));
    this.bindGrip();
  },
  open(mode, id, date) {
    const was = !this.el.hidden;
    this.mode = mode; this.id = id || null; this.date = date || null;
    this.render();
    if (!was) { this.el.hidden = false; this.el.style.transform = ""; document.body.classList.add("sheet-open"); Scene.setPanel(true); }
    this.inner.querySelectorAll("textarea.task-title").forEach(x => this.autosize(x));
  },
  close() {
    if (this.el.hidden) return;
    this.el.hidden = true; this.mode = null; this.id = null; this._key = "";
    document.body.classList.remove("sheet-open"); Scene.setPanel(false);
  },
  refresh() {
    if (!this.mode) return;
    if (this.mode === "task" && !Store.task(this.id)) return this.close();
    if (this.mode === "planet" && !Store.planet(this.id)) return this.close();
    this.render();
  },
  render() {
    const old = this.inner.querySelector(".sh-body"), st = old ? old.scrollTop : 0, key = `${this.mode}:${this.id}:${this.date}`;
    if (this.mode === "task") this.renderTask();
    else if (this.mode === "planet") this.renderPlanet();
    else if (this.mode === "day") this.renderDay();
    else if (this.mode === "today") this.renderToday();
    else if (this.mode === "nodue") this.renderNoDue();
    const nb = this.inner.querySelector(".sh-body"); if (nb && key === this._key) nb.scrollTop = st;
    this._key = key;
    this.inner.querySelectorAll("textarea.task-title").forEach(t => this.autosize(t));
  },
  autosize(t) { t.style.height = "auto"; if (t.scrollHeight) t.style.height = `${t.scrollHeight}px`; },
  tick() {
    if (!this.mode) return;
    this.inner.querySelectorAll("[data-live]").forEach(el => { const t = Store.task(el.dataset.live); if (t) el.textContent = U.fmtClock(Store.burned(t)); });
    const tb = this.inner.querySelector("#todayBurn"); if (tb) tb.textContent = U.fmtDuration(Store.burnedToday());
  },
  head(left, right = "") { return `<div class="sh-head">${left}<span class="grow"></span>${right}<button type="button" class="icon-btn plain sm" data-act="close" aria-label="닫기" title="닫기  Esc">${ico("x", 18)}</button></div>`; },

  /* ── 할 일 상세 ── */
  renderTask() {
    const t = Store.task(this.id); if (!t) return;
    const p = Store.planet(t.planetId) || Store.planets()[0], key = bodyKey(p), e = U.esc, today = U.today();
    const doing = t.status === "doing", done = t.status === "done", burned = Store.burned(t), sd = t.steps.filter(s => s.done).length, myDay = t.myDay === today;
    const cta = doing ? `<button type="button" class="cta ghost" data-act="stop">${ico("orbitBack", 18)}궤도로 되돌리기</button>`
      : done ? `<button type="button" class="cta ghost" data-act="toggle-done">${ico("undo", 18)}다시 할 일로</button>`
      : `<button type="button" class="cta sol" data-act="start">${ico("flame", 18)}태양에 올려 집중 시작</button>`;
    const start = doing && t.startedAt ? new Date(t.startedAt).toTimeString().slice(0, 5) : "";
    const qd = [["오늘", today], ["내일", U.addDays(today, 1)], ["다음 주", U.addDays(today, 7)], ["없음", ""]];
    this.inner.innerHTML = this.head(`<button type="button" class="planet-chip" data-act="pick-planet" style="--c:${pColor(p)}">${thumbImg(key, 26)}<span class="nm">${e(p.name)}</span>${ico("chevDown", 14)}</button>`) + `
    <div class="sh-body">
      <div class="title-row">
        <button type="button" class="check ${done ? "on" : ""}" data-act="toggle-done" aria-label="${done ? "완료 취소" : "완료"}">${ico("check", 16)}</button>
        <textarea class="task-title ${done ? "done" : ""}" id="taskTitle" rows="1" data-field="title" aria-label="할 일 제목">${e(t.title)}</textarea>
        <button type="button" class="star-btn ${t.important ? "on" : ""}" data-act="toggle-imp" aria-label="중요 표시" title="중요">${ico("star", 20)}</button>
      </div>
      ${cta}
      ${burned > 1 || doing ? `<div class="burn ${doing ? "live" : ""}"><span class="hot">${ico("flame", 22)}</span><div><div class="lbl">${doing ? "지금 타오르는 중" : "누적 집중 시간"}</div><div class="val" data-live="${t.id}">${U.fmtClock(burned)}</div></div>${start ? `<div class="side">${start} 시작</div>` : ""}</div>` : ""}
      <div class="props">
        <div class="prop">${ico("sun", 18)}<span class="k">오늘 할 일</span><div class="v end"><button type="button" class="switch ${myDay ? "on" : ""}" data-act="toggle-myday" role="switch" aria-checked="${myDay}" aria-label="오늘 할 일에 추가" ${done ? "disabled" : ""}></button></div></div>
        <div class="prop">${ico("calendar", 18)}<span class="k">마감</span><div class="v">
          <div class="date-pair"><input type="date" id="taskDue" data-field="due" value="${t.due || ""}" aria-label="마감일"><input type="time" id="taskTime" data-field="time" value="${t.time || ""}" aria-label="시간"></div>
          <div class="pills">${qd.map(([l, v]) => `<button type="button" class="pill ${(t.due || "") === v ? "on" : ""}" data-act="due" data-v="${v}">${l}</button>`).join("")}${t.due && !qd.some(([, v]) => v === t.due) ? `<span class="due-rel ${Store.isOverdue(t) ? "late" : ""}">${U.relDate(t.due)}</span>` : ""}</div>
        </div></div>
        <div class="prop">${ico("repeat", 18)}<span class="k">반복</span><div class="v"><select id="taskRepeat" data-field="repeat" aria-label="반복">${Store.REPEATS.map(([v, l]) => `<option value="${v}" ${t.repeat === v ? "selected" : ""}>${l}</option>`).join("")}</select></div></div>
      </div>
      <div>
        <div class="lbl-h"><span>단계</span><span class="n">${t.steps.length ? `${sd}/${t.steps.length}` : ""}</span></div>
        ${t.steps.length ? `<div class="bar" style="--p:${Math.round(sd / t.steps.length * 100)}%"><i></i></div>` : ""}
        <ul class="steps">${t.steps.map(s => `<li class="step ${s.done ? "done" : ""}" data-step="${s.id}"><button type="button" class="check ${s.done ? "on" : ""}" data-act="step-toggle" aria-label="단계 완료">${ico("check", 12)}</button><input type="text" data-step-title value="${e(s.title)}" aria-label="단계 이름"><button type="button" class="del" data-act="step-del" aria-label="단계 삭제">${ico("x", 14)}</button></li>`).join("")}</ul>
        <label class="step-add">${ico("plus", 16)}<input type="text" id="stepAdd" placeholder="단계 추가" aria-label="새 단계"></label>
      </div>
      <div><div class="lbl-h"><span>메모</span></div><textarea class="notes" id="taskNotes" data-field="notes" placeholder="메모, 링크, 생각">${e(t.notes || "")}</textarea></div>
    </div>
    <div class="sh-foot"><span>${U.fmtStamp(t.createdAt)} 만듦${t.completedAt ? ` · ${U.fmtStamp(t.completedAt)} 완료` : ""}</span><button type="button" class="danger-btn" data-act="delete">${ico("trash", 15)}삭제</button></div>`;
  },

  /* ── 목록 공통 ── */
  row(t, showPlanet, extra = "") {
    const p = Store.planet(t.planetId), late = Store.isOverdue(t), doing = t.status === "doing", burned = Store.burned(t), sd = t.steps.filter(s => s.done).length;
    const meta = [
      showPlanet && p ? `<span><i class="pd" style="--c:${pColor(p)}"></i>${U.esc(p.name)}</span>` : "",
      doing ? `<span class="hot">${ico("flame", 12)}<span data-live="${t.id}">${U.fmtClock(burned)}</span></span>` : "",
      t.due ? `<span class="${late ? "late" : ""}">${late ? ico("alert", 12) : ""}${U.relDate(t.due)}${t.time ? " " + U.fmtTime(t.time) : ""}</span>` : t.time ? `<span>${U.fmtTime(t.time)}</span>` : "",
      t.steps.length ? `<span>${ico("list", 12)}${sd}/${t.steps.length}</span>` : "",
      t.repeat && t.repeat !== "none" ? `<span>${ico("repeat", 12)}</span>` : "",
      !doing && burned > 59 ? `<span>${ico("flame", 12)}${U.fmtDuration(burned)}</span>` : "",
    ].filter(Boolean).join("");
    return `<div class="row ${t.status} ${this.mode === "task" && this.id === t.id ? "active" : ""}" data-task="${t.id}" tabindex="0">
      <button type="button" class="check ${t.status === "done" ? "on" : ""}" data-act="row-check" aria-label="${t.status === "done" ? "완료 취소" : "완료"}">${ico("check", 13)}</button>
      <div class="body"><div class="t">${U.esc(t.title)}</div>${meta ? `<div class="m">${meta}</div>` : ""}</div>
      ${t.important ? `<span class="star">${ico("star", 15)}</span>` : ""}${extra}
      ${t.status !== "done" ? `<button type="button" class="act" data-act="row-fire" title="${doing ? "궤도로 되돌리기" : "태양에 올리기"}" aria-label="${doing ? "궤도로 되돌리기" : "태양에 올리기"}">${ico(doing ? "orbitBack" : "flame", 16)}</button>` : ""}
    </div>`;
  },
  section(title, list, cls, showPlanet, icon) {
    if (!list.length) return "";
    return `<div class="sec"><div class="sec-h ${cls || ""}">${icon ? ico(icon, 14) : ""}${title}<span class="n">${list.length}</span></div>${list.map(t => this.row(t, showPlanet)).join("")}</div>`;
  },
  doneSection(list, showPlanet) {
    if (!list.length) return "";
    return `<div class="sec"><div class="sec-h toggle" data-act="toggle-done-list" role="button" tabindex="0">${ico(this.showDone ? "chevDown" : "chevRight", 14)}완료됨<span class="n">${list.length}</span></div>${this.showDone ? list.map(t => this.row(t, showPlanet)).join("") : ""}</div>`;
  },
  miniAdd(attrs, ph) { return `<label class="mini-add">${ico("plus", 16)}<input type="text" id="miniAdd" ${attrs} placeholder="${ph}" aria-label="${ph}" enterkeyhint="send"></label>`; },

  /* ── 행성 ── */
  renderPlanet() {
    const p = Store.planet(this.id); if (!p) return;
    const b = bodyOf(p), list = Store.tasksOf(p.id);
    const done = list.filter(t => t.status === "done"), doing = list.filter(t => t.status === "doing"), todo = list.filter(t => t.status === "todo");
    const pct = list.length ? Math.round(done.length / list.length * 100) : 0;
    this.inner.innerHTML = this.head(`<span class="sh-sub">카테고리 행성</span>`, `<button type="button" class="icon-btn plain sm" data-act="edit-planet" aria-label="행성 편집" title="편집">${ico("edit", 17)}</button>`) + `
    <div class="sh-body">
      <div class="p-hero">${thumbImg(bodyKey(p), 72)}<div><div class="nm">${U.esc(p.name)}</div><div class="en">${b.en.toUpperCase()}</div><div class="sh-sub">${b.ko} · 남은 할 일 ${todo.length + doing.length}개</div></div></div>
      <div><div class="lbl-h"><span>진행</span><span class="n">${done.length}/${list.length}</span></div><div class="bar" style="--p:${pct}%;--bc:linear-gradient(90deg, ${b.color}, #ffffff)"><i></i></div></div>
      ${this.miniAdd(`data-planet="${p.id}"`, `${U.esc(p.name)}에 할 일 추가`)}
      ${this.section("집중 중", doing, "fire", false, "flame")}
      ${this.section("할 일", todo, "", false)}
      ${!list.length ? `<div class="empty"><b>아직 위성이 없어요</b>위 입력칸에서 첫 할 일을 띄워 보세요</div>` : ""}
      ${this.doneSection(done, false)}
    </div>`;
  },

  /* ── 날짜 (캘린더) ── */
  renderDay() {
    const ds = this.date, today = U.today(), list = Store.tasks().filter(t => t.due === ds).sort(Store.sortTasks);
    const done = list.filter(t => t.status === "done"), active = list.filter(t => t.status !== "done"), diff = U.diffDays(today, ds);
    const rel = diff === 0 ? "오늘" : diff === 1 ? "내일" : diff === -1 ? "어제" : diff > 0 ? `${diff}일 후` : `${-diff}일 전`;
    this.inner.innerHTML = this.head(`<div><h3 class="sh-title">${U.fmtDate(ds, true)}</h3><div class="sh-sub">${rel}</div></div>`, diff !== 0 ? `<button type="button" class="pill-btn" data-act="goto-today">오늘</button>` : "") + `
    <div class="sh-body">
      ${this.miniAdd(`data-due="${ds}"`, `${U.fmtDate(ds)}에 할 일 추가`)}
      ${this.section("할 일", active, "", true)}
      ${!list.length ? `<div class="empty"><b>비어 있는 날이에요</b>할 일을 추가하거나 캘린더에서 끌어다 놓으세요</div>` : ""}
      ${this.doneSection(done, true)}
    </div>`;
  },

  /* ── 오늘의 미션 ── */
  renderToday() {
    const today = U.today(), list = Store.todayTasks();
    const doing = list.filter(t => t.status === "doing"), done = list.filter(t => t.status === "done");
    const late = list.filter(t => t.status === "todo" && Store.isOverdue(t)), todo = list.filter(t => t.status === "todo" && !Store.isOverdue(t));
    const remain = doing.length + late.length + todo.length, in3 = U.addDays(today, 3);
    const suggest = Store.tasks().filter(t => t.status === "todo" && !Store.isTodayTask(t) && ((t.due && t.due <= in3) || (t.important && !t.due))).sort(Store.sortTasks).slice(0, 5);
    const add = `<button type="button" class="add-today" data-act="suggest-add">+ 오늘</button>`;
    this.inner.innerHTML = this.head(`<div><h3 class="sh-title">오늘의 미션</h3><div class="sh-sub">${U.fmtLong(today)}</div></div>`) + `
    <div class="sh-body">
      <div class="stats">
        <div class="stat"><div class="v">${remain}</div><div class="l">남은 할 일</div></div>
        <div class="stat ok"><div class="v">${done.length}</div><div class="l">완료</div></div>
        <div class="stat fire"><div class="v" id="todayBurn">${U.fmtDuration(Store.burnedToday())}</div><div class="l">오늘 집중</div></div>
      </div>
      ${this.miniAdd(`data-myday="1"`, "오늘 할 일 추가")}
      ${this.section("집중 중", doing, "fire", true, "flame")}
      ${this.section("지난 할 일", late, "late", true, "alert")}
      ${this.section("오늘", todo, "", true, "sun")}
      ${!list.length ? `<div class="empty"><b>오늘 계획된 할 일이 없어요</b>위에서 추가하거나 아래 제안을 살펴보세요</div>` : remain === 0 ? `<div class="empty"><b>오늘 할 일을 모두 끝냈어요</b>태양이 조용히 빛나고 있어요</div>` : ""}
      ${suggest.length ? `<div class="sec"><div class="sec-h">${ico("sparkle", 14)}제안<span class="n">${suggest.length}</span></div>${suggest.map(t => this.row(t, true, add)).join("")}</div>` : ""}
      ${this.doneSection(done, true)}
    </div>`;
  },
  renderNoDue() {
    const list = Store.tasks().filter(t => !t.due && t.status !== "done").sort(Store.sortTasks);
    this.inner.innerHTML = this.head(`<div><h3 class="sh-title">기한 없는 할 일</h3><div class="sh-sub">${list.length}개</div></div>`) + `
    <div class="sh-body">${this.section("할 일", list, "", true)}${!list.length ? `<div class="empty"><b>모든 할 일에 기한이 있어요</b></div>` : `<div class="empty">열어서 마감일을 정하면 캘린더에 나타나요</div>`}</div>`;
  },

  /* ── 이벤트 ── */
  onClick(e) {
    const btn = e.target.closest("[data-act]"), row = e.target.closest("[data-task]");
    if (!btn) { if (row) App.openTask(row.dataset.task); return; }
    const act = btn.dataset.act, tid = row ? row.dataset.task : this.id, t = tid ? Store.task(tid) : null, today = U.today();
    switch (act) {
      case "close": this.close(); break;
      case "pick-planet": this.planetPicker(btn); break;
      case "toggle-done": case "row-check": if (!t) break; if (t.status === "done") Store.uncompleteTask(t.id); else App.completeTask(t.id); break;
      case "toggle-imp": if (t) Store.updateTask(tid, { important: !t.important }); break;
      case "start": App.startTask(tid); break;
      case "stop": Store.stopTask(tid); App.toast("orbitBack", "궤도로 돌아왔어요 · 타이머 일시정지"); break;
      case "row-fire": if (!t) break; if (t.status === "doing") { Store.stopTask(t.id); App.toast("orbitBack", "궤도로 돌아왔어요"); } else App.startTask(t.id); break;
      case "toggle-myday": if (!t) break; Store.updateTask(tid, { myDay: t.myDay === today ? null : today }); App.toast("sun", t.myDay === today ? "오늘 할 일에 추가했어요" : "오늘 할 일에서 뺐어요"); break;
      case "suggest-add": if (!t) break; Store.updateTask(tid, { myDay: today }); App.toast("sun", `「${t.title}」 오늘 할 일에 추가`); break;
      case "due": if (t) Store.updateTask(tid, { due: btn.dataset.v || null, time: btn.dataset.v ? t.time : null }); break;
      case "step-toggle": { const li = btn.closest("[data-step]"), s = t.steps.find(x => x.id === li.dataset.step); Store.updateStep(tid, s.id, { done: !s.done }); break; }
      case "step-del": Store.removeStep(tid, btn.closest("[data-step]").dataset.step); break;
      case "delete": App.deleteTask(tid); break;
      case "edit-planet": Modal.planet(this.id); break;
      case "toggle-done-list": this.showDone = !this.showDone; this.render(); break;
      case "goto-today": App.openDay(today); break;
    }
  },
  onInput(e) {
    const el = e.target;
    if (el.matches("textarea.task-title")) this.autosize(el);
    if (el.dataset.field === "title" || el.dataset.field === "notes") {
      clearTimeout(this.timers.text);
      const f = el.dataset.field, v = el.value, id = this.id;
      this.timers.text = setTimeout(() => { if (f === "title" && !v.trim()) return; Store.updateTask(id, { [f]: f === "title" ? v.trim() : v }, { silent: true }); }, 250);
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
    const el = e.target;
    if ((e.key === "Enter" || e.key === " ") && el.matches(".row, .sec-h.toggle") && e.target === document.activeElement) { e.preventDefault(); el.click(); return; }
    if (e.key === "Enter" && el.matches("textarea.task-title")) { e.preventDefault(); el.blur(); return; }
    if (e.key === "Enter" && el.id === "stepAdd") {
      e.preventDefault(); const v = el.value.trim(); if (!v) return;
      Store.addStep(this.id, v); requestAnimationFrame(() => this.inner.querySelector("#stepAdd")?.focus()); return;
    }
    if (e.key === "Enter" && el.id === "miniAdd" && !e.isComposing) {
      e.preventDefault();
      const q = U.parseQuick(el.value, Store.planets()); if (!q.title) return;
      const data = { title: q.title, important: q.important, time: q.time, due: q.due };
      data.planetId = q.planetId || el.dataset.planet || QuickAdd.planetId;
      if (el.dataset.due && !q.due) data.due = el.dataset.due;
      if (el.dataset.myday) data.myDay = U.today();
      Store.addTask(data); requestAnimationFrame(() => this.inner.querySelector("#miniAdd")?.focus());
    }
  },
  planetPicker(btn) {
    const old = this.inner.querySelector(".pick-pop"); if (old) { old.remove(); return; }
    const t = Store.task(this.id); if (!t) return;
    const pop = document.createElement("div"); pop.className = "pop pick-pop";
    pop.innerHTML = `<div class="pop-title">행성 옮기기</div>` + Store.planets().map(p => `<button type="button" class="pop-item" data-pid="${p.id}">${thumbImg(bodyKey(p), 28)}<span class="lbl">${U.esc(p.name)}</span><span class="sub">${bodyOf(p).en.toUpperCase()}</span>${p.id === t.planetId ? `<span class="chk">${ico("check", 16)}</span>` : ""}</button>`).join("");
    pop.addEventListener("click", ev => { const it = ev.target.closest("[data-pid]"); if (!it) return; if (it.dataset.pid !== t.planetId) Store.updateTask(this.id, { planetId: it.dataset.pid }); else pop.remove(); });
    btn.closest(".sh-head").appendChild(pop);
    const off = ev => { if (!pop.contains(ev.target) && !btn.contains(ev.target)) { pop.remove(); document.removeEventListener("pointerdown", off, true); } };
    setTimeout(() => document.addEventListener("pointerdown", off, true), 0);
  },
  /* 모바일: 손잡이를 끌어내려 닫기 */
  bindGrip() {
    const grip = document.getElementById("sheetGrip"); let y0 = null, dy = 0;
    grip.addEventListener("pointerdown", e => { y0 = e.clientY; dy = 0; grip.setPointerCapture(e.pointerId); this.el.style.transition = "none"; });
    grip.addEventListener("pointermove", e => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); this.el.style.transform = `translateY(${dy}px)`; });
    const end = () => { if (y0 == null) return; y0 = null; this.el.style.transition = ""; if (dy > 110) this.close(); this.el.style.transform = ""; };
    grip.addEventListener("pointerup", end); grip.addEventListener("pointercancel", end);
  },
};
