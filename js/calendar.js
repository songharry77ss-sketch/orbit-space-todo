/* ═══════════════ 캘린더 보기: 월간 · 주간 ═══════════════ */
"use strict";

const Calendar = {
  el: null, grid: null, title: null, sub: null, foot: null, wd: null, seg: null,
  ym: null, anchor: null, mode: "month", selected: null, dragTask: null, addDate: null,
  init() {
    this.el = document.getElementById("calendar"); this.grid = document.getElementById("calGrid");
    this.title = document.getElementById("calTitle"); this.sub = document.getElementById("calSub"); this.foot = document.getElementById("calFoot");
    this.wd = this.el.querySelector(".cal-weekdays"); this.seg = document.getElementById("calMode");
    const t = U.parseDate(U.today()); this.ym = { y: t.getFullYear(), m: t.getMonth() }; this.anchor = U.today();
    this.mode = Store.state.settings.calMode === "week" ? "week" : "month";
    document.getElementById("calPrev").addEventListener("click", () => this.move(-1));
    document.getElementById("calNext").addEventListener("click", () => this.move(1));
    document.getElementById("calToday").addEventListener("click", () => this.goToday());
    this.seg.addEventListener("click", e => { const b = e.target.closest("[data-mode]"); if (b) this.setMode(b.dataset.mode); });
    this.grid.addEventListener("click", e => this.onClick(e));
    this.grid.addEventListener("keydown", e => this.onKey(e));
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
  setMode(m) {
    if (m === this.mode) return;
    if (m === "week") {
      const t = U.today(), same = s => { const x = U.parseDate(s); return x.getFullYear() === this.ym.y && x.getMonth() === this.ym.m; };
      this.anchor = this.selected && same(this.selected) ? this.selected : same(t) ? t : U.dateStr(new Date(this.ym.y, this.ym.m, 1));
    } else { const a = U.parseDate(this.anchor); this.ym = { y: a.getFullYear(), m: a.getMonth() }; }
    this.mode = m; Store.setSetting("calMode", m); this.addDate = null; this._scrolled = null; this.render();
  },
  move(n) {
    if (this.mode === "week") this.anchor = U.addDays(this.anchor, 7 * n);
    else { const d = new Date(this.ym.y, this.ym.m + n, 1); this.ym = { y: d.getFullYear(), m: d.getMonth() }; }
    this.addDate = null; this._scrolled = null; this.render();
  },
  goToday() { const t = U.today(), d = U.parseDate(t); this.ym = { y: d.getFullYear(), m: d.getMonth() }; this.anchor = t; this.addDate = null; this._scrolled = null; this.render(); },
  weekStart(ds) { const d = U.parseDate(ds); d.setDate(d.getDate() - d.getDay()); return U.dateStr(d); },
  byDate() { const m = new Map(); for (const t of Store.tasks()) { if (!t.due) continue; if (!m.has(t.due)) m.set(t.due, []); m.get(t.due).push(t); } return m; },
  render() {
    if (this.el.hidden) return;
    const week = this.mode === "week";
    this.seg.querySelectorAll("[data-mode]").forEach(b => { const on = b.dataset.mode === this.mode; b.classList.toggle("on", on); b.setAttribute("aria-selected", String(on)); });
    this.el.classList.toggle("week", week);
    document.getElementById("calPrev").setAttribute("aria-label", week ? "이전 주" : "이전 달");
    document.getElementById("calNext").setAttribute("aria-label", week ? "다음 주" : "다음 달");
    if (week) this.renderWeek(); else this.renderMonth();
    this.renderFoot();
  },
  renderMonth() {
    this.wd.hidden = false; this.grid.className = "cal-grid";
    const { y, m } = this.ym, today = U.today(), narrow = window.innerWidth < 640;
    this.title.textContent = `${y}년 ${m + 1}월`;
    const first = new Date(y, m, 1), start = new Date(y, m, 1 - first.getDay()), byDate = this.byDate();
    const rows = Math.ceil((first.getDay() + new Date(y, m + 1, 0).getDate()) / 7);
    const cellH = (this.grid.clientHeight || 420) / rows;
    const max = narrow ? U.clamp(Math.floor((cellH - 24) / 8), 1, 5) : U.clamp(Math.floor((cellH - 30) / 23), 1, 5);
    let html = "", total = 0, done = 0;
    for (let i = 0; i < rows * 7; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const ds = U.dateStr(d), list = (byDate.get(ds) || []).sort(Store.sortTasks), other = d.getMonth() !== m, dn = list.filter(t => t.status === "done").length;
      if (!other) { total += list.length; done += dn; }
      const cls = ["cal-cell", other && "other", ds === today && "today", ds === this.selected && "sel", d.getDay() === 0 && "sun", d.getDay() === 6 && "sat"].filter(Boolean).join(" ");
      const shown = list.slice(0, max);
      html += `<div class="${cls}" data-date="${ds}" role="button" tabindex="-1" aria-label="${U.fmtDate(ds)} 할 일 ${list.length}개">
        <div class="cal-day"><span class="d">${d.getDate()}</span>${list.length ? `<span class="cnt ${dn === list.length ? "alldone" : ""}">${dn}/${list.length}</span>` : ""}</div>
        ${shown.map(t => { const p = Store.planet(t.planetId); return `<div class="cal-task ${t.status} ${t.priority === 1 ? "p1" : ""}" draggable="true" data-id="${t.id}" style="--c:${p ? pColor(p) : "#fff"}" title="${U.esc(t.title)}">${t.priority === 1 ? prioSvg(1, 10) : ""}<span class="t">${U.esc(t.title)}</span></div>`; }).join("")}
        ${list.length > max ? `<div class="cal-more">+${list.length - max}</div>` : ""}
      </div>`;
    }
    this.grid.innerHTML = html;
    this.sub.textContent = total ? `이번 달 ${total}개 중 ${done}개 완료` : "이번 달에 예정된 할 일이 없어요";
  },
  /* 주간: 7일을 열로(휴대폰은 날짜별 세로 목록). 시간 있는 일 먼저, 시간순 */
  renderWeek() {
    this.wd.hidden = true;
    const s0 = this.weekStart(this.anchor), days = [0, 1, 2, 3, 4, 5, 6].map(i => U.addDays(s0, i)), today = U.today(), by = this.byDate(), narrow = window.innerWidth < 640;
    const a = U.parseDate(days[0]), b = U.parseDate(days[6]), ym = d => `${d.getMonth() + 1}월 ${d.getDate()}일`;
    const range = a.getMonth() === b.getMonth() ? `${ym(a)} – ${b.getDate()}일` : `${ym(a)} – ${ym(b)}`;
    this.title.textContent = narrow || a.getFullYear() === new Date().getFullYear() ? range : `${a.getFullYear()}년 ${range}`;
    const order = (x, y) => ((x.status === "done") - (y.status === "done")) || ((!x.time) - (!y.time)) || (x.time || "").localeCompare(y.time || "") || Store.sortTasks(x, y);
    const keepTop = this.grid.scrollTop, keep = {}; this.grid.querySelectorAll(".wk-col").forEach(c => { keep[c.dataset.date] = c.querySelector(".wk-list").scrollTop; });
    let total = 0, done = 0;
    const html = days.map(ds => {
      const d = U.parseDate(ds), list = (by.get(ds) || []).sort(order), dn = list.filter(t => t.status === "done").length;
      total += list.length; done += dn;
      const cls = ["wk-col", ds === today && "today", ds < today && "past", ds === this.selected && "sel", d.getDay() === 0 && "sun", d.getDay() === 6 && "sat"].filter(Boolean).join(" ");
      return `<section class="${cls}" data-date="${ds}">
        <button type="button" class="wk-head" data-act="day" aria-label="${U.fmtDate(ds)} 하루 보기"><span class="wd">${WEEKDAYS[d.getDay()]}</span><span class="d">${d.getDate()}</span>${ds === today ? `<span class="tdy">오늘</span>` : ""}${list.length ? `<span class="cnt ${dn === list.length ? "alldone" : ""}">${dn}/${list.length}</span>` : ""}</button>
        <div class="wk-list">${list.map(t => this.card(t)).join("")}${this.addDate === ds
          ? `<div class="wk-addrow"><input id="calAdd" type="text" placeholder="새 할 일 · Enter" enterkeyhint="send" autocomplete="off" aria-label="${U.fmtDate(ds)}에 할 일 추가"></div>`
          : `<button type="button" class="wk-add" data-act="add" aria-label="${U.fmtDate(ds)}에 할 일 추가">${ico("plus", 14)}<span>추가</span></button>`}</div>
      </section>`;
    }).join("");
    this.grid.className = "cal-grid wk"; this.grid.innerHTML = html;
    this.grid.querySelectorAll(".wk-col").forEach(c => { if (keep[c.dataset.date]) c.querySelector(".wk-list").scrollTop = keep[c.dataset.date]; });
    this.grid.scrollTop = keepTop;
    if (narrow && this._scrolled !== s0) { this._scrolled = s0; const td = this.grid.querySelector(".wk-col.today"); if (td) this.grid.scrollTop += td.getBoundingClientRect().top - this.grid.getBoundingClientRect().top; }
    const cur = days.includes(today) ? "이번 주" : "이 주";
    this.sub.textContent = total ? `${cur} ${total}개 중 ${done}개 완료` : `${cur}에 예정된 할 일이 없어요`;
    if (this.addDate) this.grid.querySelector("#calAdd")?.focus();
  },
  card(t) {
    const p = Store.planet(t.planetId), late = Store.isOverdue(t), pr = t.priority || 0, done = t.status === "done", doing = t.status === "doing";
    const meta = [
      t.time ? `<span class="tm">${U.fmtTime(t.time)}</span>` : "",
      p ? `<span><i class="pd"></i>${U.esc(p.name)}</span>` : "",
      doing ? `<span class="hot">${ico("flame", 11)}집중 중</span>` : late ? `<span class="late">지남</span>` : "",
      t.steps.length ? `<span>${ico("list", 11)}${t.steps.filter(s => s.done).length}/${t.steps.length}</span>` : "",
    ].join("");
    return `<div class="wk-task ${t.status} ${pr ? "p" + pr : ""}" data-id="${t.id}" draggable="${!done && !Scene.touch}" tabindex="0" style="--c:${p ? pColor(p) : "#fff"}">
      <button type="button" class="check ${done ? "on" : ""}" data-act="check" aria-label="${done ? "완료 취소" : "완료"}">${ico("check", 11)}</button>
      <div class="wk-main"><div class="wk-t">${pr ? prioSvg(pr, 10) : ""}<span>${U.esc(t.title)}</span></div><div class="wk-m">${meta}</div></div>
    </div>`;
  },
  renderFoot() {
    const noDue = Store.tasks().filter(t => !t.due && t.status !== "done").length;
    const legend = Store.planets().map(p => `<span>${thumbImg(bodyKey(p), 16)}${U.esc(p.name)}</span>`).join("");
    this.foot.innerHTML = `<div class="cal-legend">${legend}</div><div class="cal-fr">${noDue ? `<button type="button" class="link-btn" id="calNoDue">기한 없는 할 일 ${noDue}개</button><span class="sep">·</span>` : ""}<span class="hint">${Scene.touch ? "할 일을 누르면 날짜를 바꿀 수 있어요" : "할 일을 다른 날짜로 끌어 옮길 수 있어요"}</span><button type="button" class="pill-btn sm" id="calSync">${ico("calendar", 14)}캘린더 연동</button></div>`;
    const nd = document.getElementById("calNoDue"); if (nd) nd.addEventListener("click", () => App.openNoDue());
    document.getElementById("calSync").addEventListener("click", () => CalSync.open());
  },
  onClick(e) {
    const act = e.target.closest("[data-act]"), task = e.target.closest(".cal-task, .wk-task"), col = e.target.closest(".cal-cell, .wk-col");
    if (act && act.dataset.act === "check" && task) {
      e.stopPropagation(); const t = Store.task(task.dataset.id); if (!t) return;
      if (t.status === "done") Store.uncompleteTask(t.id); else App.completeTask(t.id); return;
    }
    if (task) { e.stopPropagation(); App.openTask(task.dataset.id); return; }
    if (act && act.dataset.act === "add" && col) { this.addDate = col.dataset.date; this.render(); return; }
    if (e.target.closest(".wk-addrow")) return;
    if (col) { this.selected = col.dataset.date; App.openDay(col.dataset.date); this.render(); }
  },
  onKey(e) {
    if (e.target.id === "calAdd") {
      if (e.key === "Escape") { e.stopPropagation(); this.addDate = null; this.render(); return; }
      if (e.key !== "Enter" || e.isComposing) return;
      e.preventDefault();
      const q = U.parseQuick(e.target.value, Store.planets()); if (!q.title) return;
      Store.addTask({ title: q.title, planetId: q.planetId || QuickAdd.planetId, priority: q.priority, due: this.addDate, time: q.time });
      return;
    }
    const task = e.target.closest(".wk-task");
    if (task && e.target === task && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); App.openTask(task.dataset.id); }
  },
};
