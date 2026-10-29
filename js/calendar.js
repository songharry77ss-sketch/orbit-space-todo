/* ═══════════════ 캘린더 보기: 월간 · 주간 ═══════════════ */
"use strict";

const Calendar = {
  el: null, grid: null, title: null, sub: null, foot: null, wd: null, seg: null, agenda: null,
  ym: null, anchor: null, mode: "month", selected: null, dragTask: null, addDate: null,
  init() {
    this.el = document.getElementById("calendar"); this.grid = document.getElementById("calGrid");
    this.title = document.getElementById("calTitle"); this.sub = document.getElementById("calSub"); this.foot = document.getElementById("calFoot");
    this.wd = this.el.querySelector(".cal-weekdays"); this.seg = document.getElementById("calMode");
    const t = U.parseDate(U.today()); this.ym = { y: t.getFullYear(), m: t.getMonth() }; this.anchor = U.today(); this.selected = U.today();
    this.agenda = document.createElement("section"); this.agenda.id = "calAgenda"; this.agenda.className = "cal-agenda"; this.agenda.hidden = true;
    this.agenda.setAttribute("aria-labelledby", "calAgendaTitle"); this.el.insertBefore(this.agenda, this.foot);
    this.mode = Store.state.settings.calMode === "week" ? "week" : "month";
    document.getElementById("calPrev").addEventListener("click", () => this.move(-1));
    document.getElementById("calNext").addEventListener("click", () => this.move(1));
    document.getElementById("calToday").addEventListener("click", () => this.goToday());
    this.seg.addEventListener("click", e => { const b = e.target.closest("[data-mode]"); if (b) this.setMode(b.dataset.mode); });
    this.seg.addEventListener("keydown", e => this.onModeKey(e));
    this.grid.addEventListener("click", e => this.onClick(e));
    this.grid.addEventListener("keydown", e => this.onKey(e));
    this.agenda.addEventListener("click", e => this.onClick(e));
    this.agenda.addEventListener("keydown", e => this.onKey(e));
    const tgt = e => e.target.closest(".cal-cell, .wk-col");
    this.grid.addEventListener("dragstart", e => { const t = e.target.closest(".cal-task, .wk-task"); if (!t) return; this.dragTask = t.dataset.id; t.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", t.dataset.id); });
    this.grid.addEventListener("dragover", e => { const c = tgt(e); if (c && this.dragTask) { e.preventDefault(); this.grid.querySelectorAll(".drop").forEach(x => x !== c && x.classList.remove("drop")); c.classList.add("drop"); } });
    this.grid.addEventListener("dragleave", e => { const c = tgt(e); if (c && !c.contains(e.relatedTarget)) c.classList.remove("drop"); });
    this.grid.addEventListener("drop", e => {
      const c = tgt(e); if (!c || !this.dragTask) return; e.preventDefault();
      const t = Store.task(this.dragTask); this.dragTask = null;
      if (t && t.due !== c.dataset.date) { const prev = t.due; Store.updateTask(t.id, { due: c.dataset.date }); App.toast("calendar", `「${t.title}」 → ${U.fmtDate(c.dataset.date)}`, () => Store.updateTask(t.id, { due: prev })); }
    });
    this.grid.addEventListener("dragend", () => { this.dragTask = null; this.grid.querySelectorAll(".drop, .dragging").forEach(c => c.classList.remove("drop", "dragging")); });
    window.addEventListener("resize", () => { if (!this.el.hidden) this.render(); });
  },
  /* 월 ↔ 주 전환: 보고 있던 날짜를 이어서 보여 준다 */
  onModeKey(e) {
    if (e.isComposing || e.altKey || e.ctrlKey || e.metaKey) return;
    const tabs = [...this.seg.querySelectorAll("[data-mode]")], current = tabs.indexOf(e.target.closest("[data-mode]"));
    if (current < 0) return;
    let next;
    if (e.key === "ArrowRight") next = (current + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (current - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    else return;
    e.preventDefault(); e.stopPropagation(); this.setMode(tabs[next].dataset.mode); tabs[next].focus({ preventScroll: true });
  },
  setMode(m) {
    if (m === this.mode) return;
    if (m === "week") {
      const t = U.today(), same = s => { const x = U.parseDate(s); return x.getFullYear() === this.ym.y && x.getMonth() === this.ym.m; };
      this.anchor = this.selected && same(this.selected) ? this.selected : same(t) ? t : U.dateStr(new Date(this.ym.y, this.ym.m, 1));
    } else { const a = U.parseDate(this.selected || this.anchor); this.ym = { y: a.getFullYear(), m: a.getMonth() }; }
    this.mode = m; Store.setSetting("calMode", m); this.addDate = null; this._scrolled = null; this.syncQuickAdd(); this.render();
  },
  move(n) {
    if (this.mode === "week") { this.anchor = U.addDays(this.anchor, 7 * n); this.selected = U.addDays(this.selected || this.anchor, 7 * n); }
    else { const base = this.selected || U.dateStr(new Date(this.ym.y, this.ym.m, 1)), ds = U.addMonths(base, n), d = U.parseDate(ds); this.ym = { y: d.getFullYear(), m: d.getMonth() }; this.selected = ds; }
    this.addDate = null; this._scrolled = null; this.syncQuickAdd(); this.render();
  },
  goToday() { const t = U.today(), d = U.parseDate(t); this.ym = { y: d.getFullYear(), m: d.getMonth() }; this.anchor = t; this.selected = t; this.addDate = null; this._scrolled = null; this.syncQuickAdd(); this.render(); },
  syncQuickAdd() { if (this.selected && typeof QuickAdd !== "undefined" && QuickAdd.input) QuickAdd.setDue(this.selected); },
  selectDate(ds, { focus = false, open = false } = {}) {
    const d = U.parseDate(ds); this.selected = ds; this.anchor = ds;
    if (this.mode === "month") this.ym = { y: d.getFullYear(), m: d.getMonth() };
    this.syncQuickAdd(); this.render();
    if (focus) this.grid.querySelector(`[data-date="${ds}"]`)?.focus({ preventScroll: true });
    if (open && this.mode === "week") App.openDay(ds);
  },
  weekStart(ds) { const d = U.parseDate(ds); d.setDate(d.getDate() - d.getDay()); return U.dateStr(d); },
  byDate() { const m = new Map(); for (const t of Store.tasks()) { if (!t.due) continue; if (!m.has(t.due)) m.set(t.due, []); m.get(t.due).push(t); } return m; },
  render() {
    if (this.el.hidden) return;
    const active = document.activeElement, key = active?.dataset.calFocus;
    const input = active?.id === "calAdd" ? { value: active.value, start: active.selectionStart, end: active.selectionEnd } : null;
    const agendaTop = this.agenda.querySelector(".cal-agenda-list")?.scrollTop || 0, agendaDate = this.agenda.dataset.date;
    const week = this.mode === "week";
    this.seg.querySelectorAll("[data-mode]").forEach(b => { const on = b.dataset.mode === this.mode; b.classList.toggle("on", on); b.setAttribute("role", "tab"); b.setAttribute("aria-selected", String(on)); b.setAttribute("aria-controls", "calGrid"); b.tabIndex = on ? 0 : -1; });
    this.el.classList.toggle("week", week);
    document.getElementById("calPrev").setAttribute("aria-label", week ? "이전 주" : "이전 달");
    document.getElementById("calNext").setAttribute("aria-label", week ? "다음 주" : "다음 달");
    this.agenda.hidden = week;   /* 월간 아래에 고른 날의 목록 */
    if (week) { this.grid.removeAttribute("role"); this.grid.removeAttribute("aria-label"); this.renderWeek(); } else this.renderMonth();
    this.renderFoot();
    if (!this.agenda.hidden && agendaDate === this.selected) this.agenda.querySelector(".cal-agenda-list").scrollTop = agendaTop;
    if (key) {
      const next = [...this.el.querySelectorAll("[data-cal-focus]")].find(x => x.dataset.calFocus === key && x.getClientRects().length);
      if (next) { next.focus({ preventScroll: true }); if (input) { next.value = input.value; next.setSelectionRange(input.start, input.end); } }
      else if (!week) this.grid.querySelector(`[data-date="${this.selected}"]`)?.focus({ preventScroll: true });
    }
  },
  renderMonth() {
    this.wd.hidden = false; this.grid.className = "cal-grid";
    const { y, m } = this.ym, today = U.today(), narrow = window.innerWidth < 640;
    if (!this.selected) { this.selected = today; this.syncQuickAdd(); }
    this.title.textContent = `${y}년 ${m + 1}월`;
    this.grid.setAttribute("role", "grid"); this.grid.setAttribute("aria-label", `${y}년 ${m + 1}월. 방향키로 날짜 이동, Enter로 선택`);
    const first = new Date(y, m, 1), start = new Date(y, m, 1 - first.getDay()), byDate = this.byDate();
    const rows = Math.ceil((first.getDay() + new Date(y, m + 1, 0).getDate()) / 7);
    this.grid.style.setProperty("--cal-rows", rows);
    const cellH = (this.grid.clientHeight || 420) / rows;
    const max = narrow ? U.clamp(Math.floor((cellH - 24) / 8), 1, 5) : U.clamp(Math.floor((cellH - 30) / 23), 1, 5);
    let html = "", total = 0, done = 0;
    for (let i = 0; i < rows * 7; i++) {
      if (i % 7 === 0) html += `<div class="cal-week-row" role="row">`;
      const d = new Date(start); d.setDate(start.getDate() + i);
      const ds = U.dateStr(d), list = (byDate.get(ds) || []).sort(Store.sortTasks), other = d.getMonth() !== m, dn = list.filter(t => t.status === "done").length;
      if (!other) { total += list.length; done += dn; }
      const cls = ["cal-cell", other && "other", ds === today && "today", ds === this.selected && "sel", d.getDay() === 0 && "sun", d.getDay() === 6 && "sat"].filter(Boolean).join(" ");
      const evs = GCal.eventsOn(ds, true), all = [...evs, ...list], shown = all.slice(0, max);
      html += `<div class="${cls}" data-date="${ds}" data-cal-focus="date-${ds}" role="gridcell" aria-selected="${ds === this.selected}" ${ds === today ? 'aria-current="date"' : ""} tabindex="${ds === this.selected ? 0 : -1}" aria-label="${U.fmtDate(ds)}, 할 일 ${list.length}개 중 ${dn}개 완료${evs.length ? `, 캘린더 일정 ${evs.length}개` : ""}">
        <div class="cal-day"><span class="d">${d.getDate()}</span>${list.length ? `<span class="cnt ${dn === list.length ? "alldone" : ""}">${dn}/${list.length}</span>` : ""}</div>
        ${narrow ? `<div class="cal-dots" aria-hidden="true">${all.slice(0, 3).map(t => { const p = t.cal === undefined ? Store.planet(t.planetId) : null; return `<i class="cal-dot ${t.status === "done" ? "done" : ""}" style="--c:${t.status === "doing" ? "var(--sol)" : t.color || (p ? pColor(p) : "var(--ink-2)")}"></i>`; }).join("")}${all.length > 3 ? `<span>+${all.length - 3}</span>` : ""}</div>` : shown.map(t => { if (t.cal !== undefined) return `<div class="cal-ev${t.busy ? " busy" : ""}" data-ev="${U.esc(t.id)}" style="--c:${t.color}" title="${U.esc(t.cal)} · ${U.esc(t.title)}"><span class="t">${t.time ? U.fmtTime(t.time) + " " : ""}${U.esc(t.title)}</span></div>`; const p = Store.planet(t.planetId); return `<div class="cal-task ${t.status} ${t.priority === 1 ? "p1" : ""}" draggable="${!Scene.touch && t.status !== "done"}" data-id="${t.id}" style="--c:${p ? pColor(p) : "#fff"}" title="${U.esc(t.title)}">${t.priority === 1 ? prioSvg(1, 10) : ""}<span class="t">${U.esc(t.title)}</span></div>`; }).join("")}
        ${!narrow && all.length > max ? `<div class="cal-more">+${all.length - max}</div>` : ""}
      </div>`;
      if (i % 7 === 6) html += `</div>`;
    }
    this.grid.innerHTML = html;
    GCal.need(U.dateStr(start), U.addDays(U.dateStr(start), rows * 7 - 1));
    this.sub.textContent = total ? `이번 달 ${total}개 중 ${done}개 완료` : "이번 달에 예정된 할 일이 없어요";
    this.renderAgenda(byDate.get(this.selected) || []);
  },
  renderAgenda(tasks) {
    const ds = this.selected, list = [...tasks].sort((a, b) => ((a.status === "done") - (b.status === "done")) || ((!a.time) - (!b.time)) || (a.time || "").localeCompare(b.time || "") || Store.sortTasks(a, b));
    const evs = GCal.eventsOn(ds), dn = list.filter(t => t.status === "done").length;
    this.agenda.dataset.date = ds;
    this.agenda.innerHTML = `<div class="cal-agenda-head"><div><h3 id="calAgendaTitle">${U.fmtDate(ds)}</h3><p>${list.length ? `할 일 ${list.length}개 · 완료 ${dn}개` : "선택한 날짜의 할 일"}</p></div><button type="button" class="cal-agenda-add" data-act="agenda-add" data-cal-focus="agenda-add" aria-label="${U.fmtDate(ds)}에 할 일 추가">${ico("plus", 16)}할 일 추가</button></div>
      <div class="cal-agenda-list">${evs.map(ev => `<button type="button" class="cal-agenda-event" data-ev="${U.esc(ev.id)}" data-cal-focus="event-${U.esc(ev.id)}" style="--c:${ev.color}" aria-label="${U.esc(ev.title)}, ${ev.time ? U.fmtTime(ev.time) : "종일"}, Google 캘린더에서 열기"><span class="cal-agenda-time">${ev.time ? U.fmtTime(ev.time) : "종일"}</span><span>${U.esc(ev.title)}<small>${U.esc(ev.cal)} · Google 캘린더 ↗</small></span></button>`).join("")}
      ${list.map(t => { const p = Store.planet(t.planetId), done = t.status === "done"; return `<div class="cal-agenda-task ${t.status}" data-id="${t.id}" style="--c:${p ? pColor(p) : "var(--ink-2)"}"><button type="button" class="cal-agenda-check ${done ? "on" : ""}" data-act="agenda-check" data-cal-focus="complete-${t.id}" aria-pressed="${done}" aria-label="${U.esc(t.title)} ${done ? "완료 취소" : "완료"}"><span>${ico("check", 13)}</span></button><button type="button" class="cal-agenda-open" data-act="agenda-open" data-cal-focus="open-${t.id}"><span class="cal-agenda-task-title">${U.esc(t.title)}</span><span class="cal-agenda-meta">${t.time ? `<span>${U.fmtTime(t.time)}</span>` : ""}${p ? `<span><i></i>${U.esc(p.name)}</span>` : ""}${t.status === "doing" ? '<span class="hot">집중 중</span>' : done ? '<span>완료</span>' : Store.isOverdue(t) ? '<span class="late">기한 지남</span>' : ""}</span></button></div>`; }).join("")}
      ${!list.length ? `<div class="cal-agenda-empty"><b>아직 할 일이 없어요</b><span>이 날짜에 할 일을 추가해 보세요.</span></div>` : ""}</div>`;
  },
  /* 주간: 7일을 열로(휴대폰은 날짜별 세로 목록). 시간 있는 일 먼저, 시간순 */
  renderWeek() {
    this.wd.hidden = true;
    const s0 = this.weekStart(this.anchor), days = [0, 1, 2, 3, 4, 5, 6].map(i => U.addDays(s0, i)), today = U.today(), by = this.byDate(), narrow = window.innerWidth < 640;
    const a = U.parseDate(days[0]), b = U.parseDate(days[6]), ym = d => `${d.getMonth() + 1}월 ${d.getDate()}일`;
    const range = a.getMonth() === b.getMonth() ? `${ym(a)} – ${b.getDate()}일` : `${ym(a)} – ${ym(b)}`;
    const short = a.getMonth() === b.getMonth() ? `${a.getMonth() + 1}월 ${a.getDate()}–${b.getDate()}일` : `${a.getMonth() + 1}.${a.getDate()}–${b.getMonth() + 1}.${b.getDate()}`;
    this.title.textContent = narrow ? short : a.getFullYear() === new Date().getFullYear() ? range : `${a.getFullYear()}년 ${range}`;
    const order = (x, y) => ((x.status === "done") - (y.status === "done")) || ((!x.time) - (!y.time)) || (x.time || "").localeCompare(y.time || "") || Store.sortTasks(x, y);
    const keepTop = this.grid.scrollTop, keep = {}; this.grid.querySelectorAll(".wk-col").forEach(c => { keep[c.dataset.date] = c.querySelector(".wk-list").scrollTop; });
    let total = 0, done = 0;
    const html = days.map(ds => {
      const d = U.parseDate(ds), list = (by.get(ds) || []).sort(order), dn = list.filter(t => t.status === "done").length;
      total += list.length; done += dn;
      const cls = ["wk-col", ds === today && "today", ds < today && "past", ds === this.selected && "sel", d.getDay() === 0 && "sun", d.getDay() === 6 && "sat"].filter(Boolean).join(" ");
      return `<section class="${cls}" data-date="${ds}">
        <button type="button" class="wk-head" data-act="day" data-cal-focus="week-day-${ds}" aria-label="${U.fmtDate(ds)} 하루 보기"><span class="wd">${WEEKDAYS[d.getDay()]}</span><span class="d">${d.getDate()}</span>${ds === today ? `<span class="tdy">오늘</span>` : ""}${list.length ? `<span class="cnt ${dn === list.length ? "alldone" : ""}">${dn}/${list.length}</span>` : ""}</button>
        <div class="wk-list">${GCal.eventsOn(ds).map(ev => `<div class="wk-ev${ev.busy ? " busy" : ""}" data-ev="${U.esc(ev.id)}" style="--c:${ev.color}" title="${U.esc(ev.cal)} · 누르면 구글 캘린더에서 열려요"><span class="tm">${ev.time ? U.fmtTime(ev.time) : "종일"}</span><span class="t">${U.esc(ev.title)}</span></div>`).join("")}${list.map(t => this.card(t)).join("")}${this.addDate === ds
          ? `<div class="wk-addrow"><input id="calAdd" data-cal-focus="week-add-input" type="text" placeholder="새 할 일 · Enter" enterkeyhint="send" autocomplete="off" aria-label="${U.fmtDate(ds)}에 할 일 추가"></div>`
          : `<button type="button" class="wk-add" data-act="add" data-cal-focus="week-add-${ds}" aria-label="${U.fmtDate(ds)}에 할 일 추가">${ico("plus", 14)}<span>추가</span></button>`}</div>
      </section>`;
    }).join("");
    this.grid.className = "cal-grid wk"; this.grid.innerHTML = html;
    this.grid.querySelectorAll(".wk-col").forEach(c => { if (keep[c.dataset.date]) c.querySelector(".wk-list").scrollTop = keep[c.dataset.date]; });
    this.grid.scrollTop = keepTop;
    if (narrow && this._scrolled !== s0) { this._scrolled = s0; const td = this.grid.querySelector(".wk-col.today"); if (td) this.grid.scrollTop += td.getBoundingClientRect().top - this.grid.getBoundingClientRect().top; }
    GCal.need(days[0], days[6]);
    const cur = days.includes(today) ? "이번 주" : "이 주";
    this.sub.textContent = total ? `${cur} ${total}개 중 ${done}개 완료` : `${cur}에 예정된 할 일이 없어요`;
  },
  card(t) {
    const p = Store.planet(t.planetId), late = Store.isOverdue(t), pr = t.priority || 0, done = t.status === "done", doing = t.status === "doing";
    const meta = [
      t.time ? `<span class="tm">${U.fmtTime(t.time)}</span>` : "",
      p ? `<span><i class="pd"></i>${U.esc(p.name)}</span>` : "",
      doing ? `<span class="hot">${ico("flame", 11)}집중 중</span>` : late ? `<span class="late">지남</span>` : "",
      t.steps.length ? `<span>${ico("list", 11)}${t.steps.filter(s => s.done).length}/${t.steps.length}</span>` : "",
    ].join("");
    return `<div class="wk-task ${t.status} ${pr ? "p" + pr : ""}" data-id="${t.id}" data-cal-focus="week-task-${t.id}" draggable="${!done && !Scene.touch}" tabindex="0" style="--c:${p ? pColor(p) : "#fff"}">
      <button type="button" class="check ${done ? "on" : ""}" data-act="check" data-cal-focus="week-check-${t.id}" aria-label="${U.esc(t.title)} ${done ? "완료 취소" : "완료"}">${ico("check", 11)}</button>
      <div class="wk-main"><div class="wk-t">${pr ? prioSvg(pr, 10) : ""}<span>${U.esc(t.title)}</span></div><div class="wk-m">${meta}</div></div>
    </div>`;
  },
  renderFoot() {
    const noDue = Store.tasks().filter(t => !t.due && t.status !== "done").length;
    const legend = Store.planets().map(p => `<span>${thumbImg(bodyKey(p), 16)}${U.esc(p.name)}</span>`).join("");
    this.foot.innerHTML = `<div class="cal-legend">${legend}</div><div class="cal-fr">${noDue ? `<button type="button" class="link-btn" id="calNoDue" data-cal-focus="no-due">기한 없는 할 일 ${noDue}개</button><span class="sep">·</span>` : ""}<span class="hint">${Scene.touch ? "할 일을 누르면 날짜를 바꿀 수 있어요" : this.mode === "month" ? "방향키로 날짜 이동 · Enter로 하루 보기 · 끌어서 날짜 변경" : "할 일을 다른 날짜로 끌어 옮길 수 있어요"}</span><button type="button" class="pill-btn sm" id="calSync" data-cal-focus="sync">${ico("calendar", 14)}캘린더 연동</button></div>`;
    const nd = document.getElementById("calNoDue"); if (nd) nd.addEventListener("click", () => App.openNoDue());
    document.getElementById("calSync").addEventListener("click", () => CalSync.open());
  },
  onClick(e) {
    const ev = e.target.closest(".cal-ev, .wk-ev, .cal-agenda-event"); if (ev) { e.stopPropagation(); GCal.openEvent(ev.dataset.ev); return; }
    const agendaAct = e.target.closest(".cal-agenda [data-act]");
    if (agendaAct) {
      const a = agendaAct.dataset.act;
      if (a === "agenda-add") { QuickAdd.openWith({ due: this.selected }); return; }
      const row = agendaAct.closest(".cal-agenda-task"), t = row && Store.task(row.dataset.id); if (!t) return;
      if (a === "agenda-open") App.openTask(t.id);
      else if (a === "agenda-check") { if (t.status === "done") Store.uncompleteTask(t.id); else App.completeTask(t.id, agendaAct); }
      return;
    }
    const act = e.target.closest("[data-act]"), task = e.target.closest(".cal-task, .wk-task"), col = e.target.closest(".cal-cell, .wk-col");
    if (act && act.dataset.act === "check" && task) {
      e.stopPropagation(); const t = Store.task(task.dataset.id); if (!t) return;
      if (t.status === "done") Store.uncompleteTask(t.id); else App.completeTask(t.id, act); return;
    }
    if (task) { e.stopPropagation(); App.openTask(task.dataset.id); return; }
    if (act && act.dataset.act === "add" && col) { this.selected = col.dataset.date; this.syncQuickAdd(); this.addDate = col.dataset.date; this.render(); this.grid.querySelector("#calAdd")?.focus(); return; }
    if (e.target.closest(".wk-addrow")) return;
    if (col) this.selectDate(col.dataset.date, { focus: this.mode === "month", open: this.mode === "week" || window.innerWidth >= 640 });
  },
  onKey(e) {
    const cell = e.target.closest(".cal-cell");
    if (this.mode === "month" && cell && e.target === cell) {
      const ds = cell.dataset.date, d = U.parseDate(ds); let next = null;
      if (e.key === "ArrowLeft") next = U.addDays(ds, -1);
      else if (e.key === "ArrowRight") next = U.addDays(ds, 1);
      else if (e.key === "ArrowUp") next = U.addDays(ds, -7);
      else if (e.key === "ArrowDown") next = U.addDays(ds, 7);
      else if (e.key === "Home") next = e.ctrlKey || e.metaKey ? U.dateStr(new Date(d.getFullYear(), d.getMonth(), 1)) : U.addDays(ds, -d.getDay());
      else if (e.key === "End") next = e.ctrlKey || e.metaKey ? U.dateStr(new Date(d.getFullYear(), d.getMonth() + 1, 0)) : U.addDays(ds, 6 - d.getDay());
      else if (e.key === "PageUp" || e.key === "PageDown") next = U.addMonths(ds, (e.key === "PageUp" ? -1 : 1) * (e.shiftKey ? 12 : 1));
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); this.selectDate(ds, { focus: true, open: window.innerWidth >= 640 }); return; }
      if (next) { e.preventDefault(); e.stopPropagation(); this.selectDate(next, { focus: true }); return; }
    }
    if (e.target.id === "calAdd") {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); const ds = this.addDate; this.addDate = null; this.render(); this.grid.querySelector(`[data-cal-focus="week-add-${ds}"]`)?.focus(); return; }
      if (e.key !== "Enter" || e.isComposing) return;
      e.preventDefault();
      const q = U.parseQuick(e.target.value, Store.planets()); if (!q.title) return;
      Store.addTask({ title: q.title, planetId: q.planetId || QuickAdd.planetId, priority: q.priority, due: this.addDate, time: q.time });
      const input = this.grid.querySelector("#calAdd"); if (input) { input.value = ""; input.focus(); }
      return;
    }
    const task = e.target.closest(".wk-task");
    if (task && e.target === task && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); App.openTask(task.dataset.id); }
  },
};
