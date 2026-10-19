/* ═══════════════ 사이드 패널: 상세 / 행성 목록 / 날짜 / 오늘의 미션 ═══════════════ */
"use strict";

const Panel = {
  el: null, inner: null, mode: null, id: null, date: null, showDone: false, timers: {},
  init() {
    this.el = document.getElementById("panel"); this.inner = document.getElementById("panelInner");
    this.inner.addEventListener("click", e => this.onClick(e));
    this.inner.addEventListener("input", e => this.onInput(e));
    this.inner.addEventListener("change", e => this.onChange(e));
    this.inner.addEventListener("keydown", e => this.onKey(e));
  },
  open(mode, id, date) {
    const was = !this.el.hidden;
    this.mode = mode; this.id = id || null; this.date = date || null;
    this.render();
    this.el.hidden = false; document.body.classList.add("panel-open");
    if (!was) this.afterResize();
  },
  close() {
    if (this.el.hidden) return;
    this.el.hidden = true; this.mode = null; this.id = null; document.body.classList.remove("panel-open");
    this.afterResize();
  },
  afterResize() { [120, 300, 480].forEach(ms => setTimeout(() => { Scene.measure(); Scene.layout(); FX.resize(); }, ms)); },
  refresh(detail = {}) {
    if (!this.mode) return;
    if (this.mode === "task" && !Store.task(this.id)) { this.close(); return; }
    if (this.mode === "planet" && !Store.planet(this.id)) { this.close(); return; }
    this.render();
  },
  render() {
    const m = this.mode;
    if (m === "task") this.renderTask();
    else if (m === "planet") this.renderPlanet();
    else if (m === "day") this.renderDay();
    else if (m === "today") this.renderToday();
    else if (m === "nodue") this.renderNoDue();
    this.inner.querySelectorAll("textarea.task-title").forEach(t => this.autosize(t));
  },
  autosize(t) { t.style.height = "auto"; t.style.height = `${t.scrollHeight}px`; },
  tickSecond() {
    if (!this.mode) return;
    this.inner.querySelectorAll("[data-live]").forEach(el => { const t = Store.task(el.dataset.live); if (t) el.textContent = U.fmtClock(Store.burned(t)); });
    const tb = this.inner.querySelector("#todayBurn"); if (tb) tb.textContent = U.fmtDuration(Store.burnedToday());
  },
  head(html) { return `<div class="panel-head">${html}<div class="spacer"></div><button class="icon-btn" data-act="close" aria-label="닫기" title="닫기 (Esc)">✕</button></div>`; },

  /* ── 할 일 상세 ── */
  renderTask() {
    const t = Store.task(this.id); if (!t) return;
    const p = Store.planet(t.planetId) || Store.planets()[0];
    const doing = t.status === "doing", done = t.status === "done", today = U.today();
    const burned = Store.burned(t), sd = t.steps.filter(s => s.done).length, e = U.esc;
    const startStr = doing && t.startedAt ? new Date(t.startedAt).toTimeString().slice(0, 5) : "";
    this.inner.innerHTML = this.head(`<button class="planet-pick" data-act="pick-planet" style="--c:${p.color}"><span class="dot"></span><span class="nm">${e(p.emoji || "")} ${e(p.name)}</span><span class="car">▼</span></button>`) + `
    <div class="panel-body">
      <div class="title-row">
        <button class="check-big ${done ? "on" : ""}" data-act="toggle-done" aria-label="완료 토글" title="${done ? "다시 할 일로" : "완료"}">✓</button>
        <textarea class="task-title ${done ? "done" : ""}" id="taskTitle" rows="1" data-field="title" aria-label="제목">${e(t.title)}</textarea>
        <button class="star-btn ${t.important ? "on" : ""}" data-act="toggle-imp" aria-label="중요 표시" title="중요">★</button>
      </div>
      <div class="action-row">
        ${doing ? `<button class="btn" data-act="stop">🪐 궤도로 되돌리기</button>` : done ? `<button class="btn" data-act="toggle-done">↩ 다시 할 일로</button>` : `<button class="btn fire" data-act="start">🔥 태양에 올리기</button>`}
        ${done ? "" : `<button class="btn ${t.myDay === today ? "active" : ""}" data-act="toggle-myday">☀ ${t.myDay === today ? "오늘 할 일에서 제거" : "오늘 할 일에 추가"}</button>`}
      </div>
      ${(burned > 0 || doing) ? `<div class="stat-burn ${doing ? "live" : ""}"><span class="ico">🔥</span><div><div class="lbl">${doing ? "지금 불타는 중" : "누적 집중 시간"}</div><div class="val" data-live="${t.id}">${U.fmtClock(burned)}</div></div>${doing ? `<div class="sub">${startStr} 시작</div>` : ""}</div>` : ""}
      <div class="field">
        <label class="field-label"><span>마감일</span>${t.due ? `<span class="${Store.isOverdue(t) ? "late" : ""}">${U.relDate(t.due)}</span>` : ""}</label>
        <div class="date-row"><input type="date" id="taskDue" data-field="due" value="${t.due || ""}" aria-label="마감일"><input type="time" id="taskTime" data-field="time" value="${t.time || ""}" aria-label="시간"></div>
        <div class="quick-dates">
          <button class="pill ${t.due === today ? "on" : ""}" data-act="due" data-v="${today}">오늘</button>
          <button class="pill ${t.due === U.addDays(today, 1) ? "on" : ""}" data-act="due" data-v="${U.addDays(today, 1)}">내일</button>
          <button class="pill ${t.due === U.addDays(today, 7) ? "on" : ""}" data-act="due" data-v="${U.addDays(today, 7)}">다음 주</button>
          <button class="pill ${!t.due ? "on" : ""}" data-act="due" data-v="">없음</button>
        </div>
      </div>
      <div class="field">
        <label class="field-label" for="taskRepeat"><span>반복</span></label>
        <select id="taskRepeat" data-field="repeat">${Store.REPEATS.map(([v, l]) => `<option value="${v}" ${t.repeat === v ? "selected" : ""}>${l}</option>`).join("")}</select>
      </div>
      <div class="field">
        <label class="field-label"><span>단계</span><span>${t.steps.length ? `${sd}/${t.steps.length}` : ""}</span></label>
        ${t.steps.length ? `<div class="steps-bar" style="--p:${Math.round(sd / t.steps.length * 100)}%"><i></i></div>` : ""}
        <ul class="steps">${t.steps.map(s => `<li class="step ${s.done ? "done" : ""}" data-step="${s.id}"><button class="chk" data-act="step-toggle" aria-label="단계 완료">✓</button><input type="text" data-step-title value="${e(s.title)}" aria-label="단계 이름"><button class="del" data-act="step-del" aria-label="단계 삭제">✕</button></li>`).join("")}</ul>
        <div class="step-add"><span class="plus">+</span><input type="text" id="stepAdd" placeholder="단계 추가 후 Enter" aria-label="새 단계"></div>
      </div>
      <div class="field">
        <label class="field-label" for="taskNotes"><span>메모</span></label>
        <textarea class="notes" id="taskNotes" data-field="notes" placeholder="메모, 링크, 생각…">${e(t.notes || "")}</textarea>
      </div>
    </div>
    <div class="panel-foot">
      <span>${U.fmtStamp(t.createdAt)} 생성${t.completedAt ? ` · ${U.fmtStamp(t.completedAt)} 완료` : ""}</span>
      <button class="btn small danger" data-act="delete">삭제</button>
    </div>`;
  },

  /* ── 이벤트 ── */
  onClick(e) {
    const btn = e.target.closest("[data-act]");
    const row = e.target.closest("[data-task]");
    if (!btn) { if (row) App.openTask(row.dataset.task); return; }
    const act = btn.dataset.act, tid = row ? row.dataset.task : this.id, t = tid ? Store.task(tid) : null, today = U.today();
    switch (act) {
      case "close": this.close(); break;
      case "pick-planet": this.planetPicker(btn); break;
      case "toggle-done": case "row-check":
        if (!t) break; if (t.status === "done") Store.uncompleteTask(t.id); else App.completeTask(t.id); break;
      case "toggle-imp": Store.updateTask(tid, { important: !t.important }); break;
      case "start": App.startTask(tid); break;
      case "stop": Store.stopTask(tid); App.toast("🪐", "궤도로 돌아왔어요 · 타이머 일시정지"); break;
      case "row-fire": if (!t) break; if (t.status === "doing") { Store.stopTask(t.id); App.toast("🪐", "궤도로 돌아왔어요"); } else App.startTask(t.id); break;
      case "toggle-myday": Store.updateTask(tid, { myDay: t.myDay === today ? null : today }); App.toast("☀", t.myDay === today ? "오늘 할 일에서 뺐어요" : "오늘 할 일에 추가했어요"); break;
      case "suggest-add": Store.updateTask(tid, { myDay: today }); App.toast("☀", `「${t.title}」 오늘 할 일에 추가`); break;
      case "due": Store.updateTask(tid, { due: btn.dataset.v || null, time: btn.dataset.v ? t.time : null }); break;
      case "step-toggle": { const li = btn.closest("[data-step]"); const s = t.steps.find(s => s.id === li.dataset.step); Store.updateStep(tid, li.dataset.step, { done: !s.done }); break; }
      case "step-del": { const li = btn.closest("[data-step]"); Store.removeStep(tid, li.dataset.step); break; }
      case "delete": App.deleteTask(tid); break;
      case "edit-planet": Modal.planet(this.id); break;
      case "toggle-done-list": this.showDone = !this.showDone; this.render(); break;
      case "goto-today": App.openDay(today); break;
      case "open-planet": App.openPlanet(btn.dataset.id); break;
      case "add-planet": Modal.planet(null); break;
    }
  },
  onInput(e) {
    const el = e.target;
    if (el.matches("textarea.task-title")) this.autosize(el);
    if (el.dataset.field === "title" || el.dataset.field === "notes") {
      clearTimeout(this.timers.text);
      const field = el.dataset.field, v = el.value, id = this.id;
      this.timers.text = setTimeout(() => { if (field === "title" && !v.trim()) return; Store.updateTask(id, { [field]: field === "title" ? v.trim() : v }, { silent: true }); }, 250);
    }
    if (el.hasAttribute("data-step-title")) {
      clearTimeout(this.timers.step);
      const sid = el.closest("[data-step]").dataset.step, v = el.value, id = this.id;
      this.timers.step = setTimeout(() => Store.updateStep(id, sid, { title: v }, { silent: true }), 250);
    }
  },
  onChange(e) {
    const el = e.target, f = el.dataset.field;
    if (f === "due") Store.updateTask(this.id, { due: el.value || null, time: el.value ? Store.task(this.id).time : null });
    else if (f === "time") Store.updateTask(this.id, { time: el.value || null, due: Store.task(this.id).due || (el.value ? U.today() : null) });
    else if (f === "repeat") Store.updateTask(this.id, { repeat: el.value });
  },
  onKey(e) {
    const el = e.target;
    if (e.key === "Enter" && el.matches("textarea.task-title")) { e.preventDefault(); el.blur(); return; }
    if (e.key === "Enter" && el.id === "stepAdd") { e.preventDefault(); const v = el.value.trim(); if (v) { Store.addStep(this.id, v); setTimeout(() => { const n = this.inner.querySelector("#stepAdd"); if (n) n.focus(); }, 0); } return; }
    if (e.key === "Enter" && el.id === "miniAdd") {
      e.preventDefault(); const parsed = U.parseQuick(el.value, Store.planets()); if (!parsed.title) return;
      const data = { title: parsed.title, important: parsed.important, time: parsed.time };
      if (el.dataset.planet) data.planetId = parsed.planetId || el.dataset.planet; else if (parsed.planetId) data.planetId = parsed.planetId;
      if (el.dataset.due) data.due = parsed.due || el.dataset.due; else if (parsed.due) data.due = parsed.due;
      if (el.dataset.myday) data.myDay = U.today();
      Store.addTask(data); setTimeout(() => { const n = this.inner.querySelector("#miniAdd"); if (n) n.focus(); }, 0);
    }
  },
  planetPicker(btn) {
    const old = this.inner.querySelector(".pick-pop"); if (old) { old.remove(); return; }
    const t = Store.task(this.id); if (!t) return;
    const pop = document.createElement("div"); pop.className = "popover pick-pop";
    pop.innerHTML = `<div class="pop-title">행성 이동</div>` + Store.planets().map(p => `<button type="button" class="pop-item ${p.id === t.planetId ? "sel" : ""}" data-pid="${p.id}" style="--c:${p.color}"><span class="dot"></span><span class="lbl">${U.esc(p.emoji || "")} ${U.esc(p.name)}</span></button>`).join("");
    pop.addEventListener("click", e => { const it = e.target.closest("[data-pid]"); if (!it) return; Store.updateTask(this.id, { planetId: it.dataset.pid }); });
    btn.closest(".panel-head").appendChild(pop);
    const off = ev => { if (!pop.contains(ev.target) && ev.target !== btn) { pop.remove(); document.removeEventListener("pointerdown", off, true); } };
    setTimeout(() => document.addEventListener("pointerdown", off, true), 0);
  },

  /* ── 목록 공통 ── */
  row(t, showPlanet) {
    const p = Store.planet(t.planetId), late = Store.isOverdue(t), doing = t.status === "doing", burned = Store.burned(t), sd = t.steps.filter(s => s.done).length;
    const meta = [
      showPlanet && p ? `<span><i class="pdot" style="--c:${p.color}"></i>${U.esc(p.name)}</span>` : "",
      t.due ? `<span class="${late ? "late" : ""}">${late ? "⚠ " : ""}${U.relDate(t.due)}${t.time ? " " + U.fmtTime(t.time) : ""}</span>` : (t.time ? `<span>${U.fmtTime(t.time)}</span>` : ""),
      t.steps.length ? `<span>☑ ${sd}/${t.steps.length}</span>` : "",
      t.repeat && t.repeat !== "none" ? "<span>↻</span>" : "",
      burned > 30 ? `<span>🔥 ${doing ? `<span data-live="${t.id}">${U.fmtClock(burned)}</span>` : U.fmtDuration(burned)}</span>` : (doing ? `<span>🔥 <span data-live="${t.id}">${U.fmtClock(burned)}</span></span>` : ""),
    ].filter(Boolean).join("");
    return `<div class="task-row ${t.status} ${this.mode === "task" && this.id === t.id ? "active" : ""}" data-task="${t.id}">
      <button class="chk" data-act="row-check" aria-label="${t.status === "done" ? "다시 할 일로" : "완료"}">✓</button>
      <div class="body"><div class="t">${U.esc(t.title)}</div>${meta ? `<div class="m">${meta}</div>` : ""}</div>
      ${t.important ? `<span class="star">★</span>` : ""}
      ${t.status !== "done" ? `<button class="fire-btn" data-act="row-fire" title="${doing ? "궤도로 되돌리기" : "태양에 올리기"}" aria-label="${doing ? "궤도로" : "시작"}">${doing ? "🪐" : "🔥"}</button>` : ""}
    </div>`;
  },
  section(title, list, cls, showPlanet, extra = "") {
    if (!list.length) return "";
    return `<div class="list-section"><div class="list-title ${cls || ""}">${title} <span class="cnt">${list.length}</span>${extra}</div>${list.map(t => this.row(t, showPlanet)).join("")}</div>`;
  },
  doneSection(list, showPlanet) {
    if (!list.length) return "";
    return `<div class="list-section"><div class="list-title toggle" data-act="toggle-done-list">${this.showDone ? "▾" : "▸"} 완료됨 <span class="cnt">${list.length}</span></div>${this.showDone ? list.map(t => this.row(t, showPlanet)).join("") : ""}</div>`;
  },
  miniAdd(attrs, placeholder) { return `<div class="mini-add"><span class="plus">+</span><input type="text" id="miniAdd" ${attrs} placeholder="${placeholder}" aria-label="${placeholder}"></div>`; },

  /* ── 행성 목록 ── */
  renderPlanet() {
    const p = Store.planet(this.id); if (!p) return;
    const list = Store.tasksOf(p.id), done = list.filter(t => t.status === "done"), doing = list.filter(t => t.status === "doing"), todo = list.filter(t => t.status === "todo");
    const pct = list.length ? Math.round(done.length / list.length * 100) : 0;
    this.inner.innerHTML = this.head(`<h3 style="--c:${p.color}"><span class="dot"></span><span class="n">${U.esc(p.emoji || "")} ${U.esc(p.name)}</span></h3><span class="sub">${todo.length + doing.length}개 남음</span><button class="icon-btn" data-act="edit-planet" title="행성 편집" aria-label="행성 편집">✎</button>`) + `
    <div class="panel-body">
      <div class="planet-progress" style="--c:${p.color};--p:${pct}%"><div class="bar"><i></i></div><span>${done.length}/${list.length} 완료</span></div>
      ${this.miniAdd(`data-planet="${p.id}"`, `${p.name}에 할 일 추가`)}
      ${this.section("🔥 진행 중", doing, "fire", false)}
      ${this.section("할 일", todo, "", false)}
      ${!list.length ? `<div class="empty"><b>아직 위성이 없어요</b>위에서 첫 할 일을 추가해 보세요</div>` : ""}
      ${this.doneSection(done, false)}
    </div>`;
  },

  /* ── 날짜 (캘린더) ── */
  renderDay() {
    const ds = this.date, today = U.today();
    const list = Store.tasks().filter(t => t.due === ds).sort(Store.sortTasks);
    const done = list.filter(t => t.status === "done"), active = list.filter(t => t.status !== "done");
    const diff = U.diffDays(today, ds);
    const rel = diff === 0 ? "오늘" : diff === 1 ? "내일" : diff === -1 ? "어제" : diff > 0 ? `${diff}일 후` : `${-diff}일 전`;
    this.inner.innerHTML = this.head(`<h3><span class="n">${U.fmtDate(ds, true)}</span></h3><span class="sub">${rel}</span>${diff !== 0 ? `<button class="btn small ghost" data-act="goto-today">오늘</button>` : ""}`) + `
    <div class="panel-body">
      ${this.miniAdd(`data-due="${ds}"`, `${U.fmtDate(ds)}에 할 일 추가`)}
      ${this.section("할 일", active, "", true)}
      ${!list.length ? `<div class="empty"><b>이 날은 비어 있어요</b>할 일을 추가하거나 캘린더에서 끌어다 놓으세요</div>` : ""}
      ${this.doneSection(done, true)}
    </div>`;
  },

  /* ── 오늘의 미션 ── */
  renderToday() {
    const today = U.today(), list = Store.todayTasks();
    const doing = list.filter(t => t.status === "doing"), done = list.filter(t => t.status === "done");
    const late = list.filter(t => t.status === "todo" && Store.isOverdue(t)), todo = list.filter(t => t.status === "todo" && !Store.isOverdue(t));
    const remain = doing.length + late.length + todo.length;
    const in3 = U.addDays(today, 3);
    const suggest = Store.tasks().filter(t => t.status === "todo" && !Store.isTodayTask(t) && ((t.due && t.due <= in3) || (t.important && !t.due))).sort(Store.sortTasks).slice(0, 5);
    this.inner.innerHTML = this.head(`<h3><span class="n">☀ 오늘의 미션</span></h3><span class="sub">${U.fmtDate(today)}</span>`) + `
    <div class="panel-body">
      <div class="summary-cards">
        <div class="sum-card"><div class="v">${remain}</div><div class="l">남은 할 일</div></div>
        <div class="sum-card ok"><div class="v">${done.length}</div><div class="l">완료</div></div>
        <div class="sum-card fire"><div class="v" id="todayBurn">${U.fmtDuration(Store.burnedToday())}</div><div class="l">오늘 집중</div></div>
      </div>
      ${this.miniAdd(`data-myday="1"`, "오늘 할 일 추가")}
      ${this.section("🔥 진행 중", doing, "fire", true)}
      ${this.section("⚠ 지난 할 일", late, "late", true)}
      ${this.section("☀ 오늘", todo, "", true)}
      ${!list.length ? `<div class="empty"><b>오늘 계획된 할 일이 없어요</b>위에서 추가하거나 아래 제안을 살펴보세요</div>` : (remain === 0 ? `<div class="empty"><b>오늘 할 일을 모두 마쳤어요 🎉</b>태양이 조용히 빛나고 있어요</div>` : "")}
      ${suggest.length ? `<div class="list-section"><div class="list-title">💡 제안 <span class="cnt">${suggest.length}</span></div>${suggest.map(t => this.row(t, true).replace(`<button class="fire-btn"`, `<button class="btn small" data-act="suggest-add">+ 오늘</button><button class="fire-btn"`)).join("")}</div>` : ""}
      ${this.doneSection(done, true)}
    </div>`;
  },

  /* ── 기한 없는 할 일 ── */
  renderNoDue() {
    const list = Store.tasks().filter(t => !t.due && t.status !== "done").sort(Store.sortTasks);
    this.inner.innerHTML = this.head(`<h3><span class="n">기한 없는 할 일</span></h3><span class="sub">${list.length}개</span>`) + `
    <div class="panel-body">
      ${this.section("할 일", list, "", true)}
      ${!list.length ? `<div class="empty"><b>모든 할 일에 기한이 있어요</b></div>` : `<div class="empty" style="padding-top:4px">열어서 마감일을 정하면 캘린더에 나타나요</div>`}
    </div>`;
  },
};
