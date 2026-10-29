/* ═══════════════ 화면: 오늘 · 예정 · 행성 (목록이 주인공) ═══════════════
   - 할 일 한 줄(.tk)은 어디서나 같다: 왼쪽 동그라미(우선순위 색) 완료 · 가운데 누르면 상세 · 오른쪽 불꽃 집중.
   - 휴대폰에서는 줄을 오른쪽으로 밀면 완료, 왼쪽으로 밀면 내일로(손을 떼는 순간 동작, 알림에서 되돌리기).
   - 오늘 화면은 넘치면 줄 높이를 줄여 한 화면에 다 보이게 한다. */
"use strict";

const Views = {
  el: {}, planetId: null, allMode: false, allGroup: "planet", allFilter: "open", showDone: false,
  upMode: "list", upSel: null, upWeek: null,
  init() {
    this.el = { today: $("#vToday"), upcoming: $("#vUpcoming"), planets: $("#vPlanets"), upList: $("#upList") };
    const st = Store.state.settings;
    this.upMode = st.upMode === "cal" ? "cal" : "list"; this.allGroup = ["planet", "priority", "due"].includes(st.allGroup) ? st.allGroup : "planet";
    for (const k of ["today", "upcoming", "planets"]) {
      const v = this.el[k];
      v.addEventListener("click", e => this.onClick(e));
      v.addEventListener("keydown", e => this.onKey(e));
      v.addEventListener("pointerdown", e => Swipe.start(e));
    }
    $("#upMode").addEventListener("click", e => { const b = e.target.closest("[data-mode]"); if (b) this.setUpMode(b.dataset.mode); });
    let rt = 0; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => this.fit(), 120); });
  },

  /* ── 공통 조각 ── */
  meta(t, o = {}) {
    const p = Store.planet(t.planetId), doing = t.status === "doing", done = t.status === "done", late = Store.isOverdue(t), e = U.esc, bits = [];
    if (o.planet !== false && p) bits.push(`<span>${thumbImg(bodyKey(p), 16)}${e(p.name)}</span>`);
    if (doing) bits.push(`<span class="hot">${ico("flame", 14)}<span data-live="${t.id}">${U.fmtClock(Store.burned(t))}</span></span>`);
    if (t.due && o.due !== false) { const r = U.relDate(t.due); bits.push(`<span class="${late ? "late" : ""}">${late && !r.includes("지남") ? r + " · 지남" : r}${t.time ? " " + U.fmtTime(t.time) : ""}</span>`); }
    else if (t.time) bits.push(`<span>${U.fmtTime(t.time)}</span>`);
    if (t.steps.length) bits.push(`<span>${ico("list", 14)}${t.steps.filter(s => s.done).length}/${t.steps.length}</span>`);
    if (t.repeat && t.repeat !== "none") bits.push(`<span>${ico("repeat", 14)}${(Store.REPEATS.find(r => r[0] === t.repeat) || [, ""])[1]}</span>`);
    const burned = Store.burned(t); if (!doing && !done && burned >= 60) bits.push(`<span>${ico("flame", 14)}${U.fmtDuration(burned)}</span>`);
    return bits.join('<span class="dot" aria-hidden="true">·</span>');
  },
  row(t, o = {}) {
    const done = t.status === "done", doing = t.status === "doing", pr = t.priority || 0, e = U.esc, meta = this.meta(t, o);
    const key = Store.isOverdue(t) || !!t.time || doing;
    const right = o.right != null ? o.right : done ? "" : `<button type="button" class="tk-go ${doing ? "on" : ""}" data-act="fire" aria-label="${doing ? "집중 멈추기" : "집중 시작"}" title="${doing ? "집중 멈추기" : "집중 시작"}">${ico(doing ? "pause" : "flame", 21)}</button>`;
    return `<div class="tk ${t.status} ${key ? "has-key" : ""} ${Panel.mode === "task" && Panel.id === t.id ? "active" : ""}" data-task="${t.id}" tabindex="0">
      <button type="button" class="ck ${done ? "on" : "p" + pr}" data-act="check" aria-label="「${e(t.title)}」 ${done ? "완료 취소" : "완료"}">${ico("check", 15)}</button>
      <div class="tk-b"><div class="tk-t">${e(t.title)}</div>${meta ? `<div class="tk-m">${meta}</div>` : ""}</div>${right}</div>`;
  },
  group(list, o) { return list.length ? `<div class="group">${list.map(t => this.row(t, o)).join("")}</div>` : ""; },
  sec(title, n, cls = "", extra = "") { return `<div class="sec-h ${cls}">${title}${n != null ? `<span class="n">${n}</span>` : ""}${extra}</div>`; },
  evRow(ev) { return `<div class="ev ${ev.busy ? "busy" : ""}" data-ev="${U.esc(ev.id)}" style="--c:${ev.color}" title="${U.esc(ev.cal)} · 누르면 구글 캘린더에서 열려요"><span class="bar"></span><span class="tm">${ev.time ? U.fmtTime(ev.time) : "종일"}</span><span class="t">${U.esc(ev.title)}</span></div>`; },
  doneSec(list, o) {
    if (!list.length) return "";
    return `<div class="sec-h toggle" data-act="toggle-done" role="button" tabindex="0" aria-expanded="${this.showDone}">${ico(this.showDone ? "chevDown" : "chevRight", 16)}완료<span class="n">${list.length}</span></div>${this.showDone ? this.group(list, o) : ""}`;
  },

  /* ── 그리기 ── */
  render() {
    const tab = App.tab;
    if (tab === "today") this.renderToday();
    else if (tab === "upcoming") this.renderUpcoming();
    else if (tab === "planets") this.renderPlanets();
    App.renderSide();
  },
  keepScroll(v, fn) { const y = v.scrollTop; fn(); v.scrollTop = y; },

  renderToday() {
    const v = this.el.today, all = Store.todayTasks();
    const doing = all.filter(t => t.status === "doing").sort((a, b) => b.startedAt - a.startedAt);
    const late = all.filter(t => t.status === "todo" && Store.isOverdue(t)).sort(Store.sortTasks);
    const todo = all.filter(t => t.status === "todo" && !Store.isOverdue(t)).sort(Store.sortTasks);
    const done = all.filter(t => t.status === "done").sort((a, b) => b.completedAt - a.completedAt);
    const evs = GCal.eventsOn(U.today()), remain = doing.length + late.length + todo.length;
    let h = `<div class="view-in">` + doing.map(t => Focus.card(t)).join("");
    if (late.length) h += this.sec("지난 일", late.length, "bad") + this.group(late);
    if (todo.length || evs.length) h += this.sec("오늘", todo.length) + `<div class="group">${evs.map(ev => this.evRow(ev)).join("")}${todo.map(t => this.row(t)).join("")}</div>`;
    if (!remain) {
      const narrow = innerWidth < 900;
      h += all.length
        ? `<div class="empty">${ico("check", 28)}<b>오늘 할 일을 모두 끝냈어요</b>${done.length}개를 마쳤어요${Store.burnedToday() >= 60 ? ` · 집중 ${U.fmtDuration(Store.burnedToday())}` : ""}</div>`
        : `<div class="empty">${ico("sun", 28)}<b>오늘은 아직 비어 있어요</b>${narrow ? "아래 + 버튼으로" : "위 입력창에"} 첫 할 일을 적어 보세요</div>`;
      const in3 = U.addDays(U.today(), 3);
      const sug = Store.tasks().filter(t => t.status === "todo" && !Store.isTodayTask(t) && ((t.due && t.due <= in3) || (t.priority === 1 && !t.due))).sort(Store.sortTasks).slice(0, 4);
      if (sug.length) h += this.sec("곧 다가오는 일", sug.length) + `<div class="group">${sug.map(t => this.row(t, { right: `<button type="button" class="add-today" data-act="add-today">오늘로</button>` })).join("")}</div>`;
    }
    const untriaged = [...late, ...todo].filter(t => !t.priority).length;
    if (untriaged >= 3) h += `<button type="button" class="triage-link" data-act="triage">${prioSvg(0, 16)}우선순위 미정 <b>${untriaged}개</b> 정리하기${ico("arrowRight", 16)}</button>`;
    h += this.doneSec(done) + `</div>`;
    this.keepScroll(v, () => { v.innerHTML = h; });
    this.fit();
  },
  /* 넘치면 촘촘하게 → 더 촘촘하게(보조 줄은 지난 일 · 시간 · 집중 중일 때만) */
  fit() {
    const v = this.el.today; if (!v || v.hidden) return;
    v.classList.remove("dense", "dense2");
    if (v.scrollHeight <= v.clientHeight + 2) return;
    v.classList.add("dense"); if (v.scrollHeight <= v.clientHeight + 2) return;
    v.classList.add("dense2");
  },

  /* ── 예정 ── */
  setUpMode(m) { this.upMode = m === "cal" ? "cal" : "list"; Store.setSetting("upMode", this.upMode); this.renderUpcoming(); QuickAdd.onTab(); },
  showDate(ds) { this.upSel = ds; this.upWeek = this.weekStart(ds); if (App.tab !== "upcoming") App.setTab("upcoming"); this.setUpMode("list"); requestAnimationFrame(() => this.scrollToDay(ds)); },
  weekStart(ds) { const d = U.parseDate(ds); d.setDate(d.getDate() - d.getDay()); return U.dateStr(d); },
  scrollToDay(ds) { const h = this.el.upList.querySelector(`[data-day="${ds}"]`); if (h) this.el.upcoming.scrollTo({ top: h.offsetTop - 8, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); },
  dayLabel(ds) {
    const diff = U.diffDays(U.today(), ds), d = U.parseDate(ds), md = `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAYS[d.getDay()]}`;
    const rel = diff === 0 ? "오늘" : diff === 1 ? "내일" : diff === 2 ? "모레" : diff > 0 && diff <= 6 ? `${WEEKDAYS[d.getDay()]}요일` : "";
    return rel ? `<em>${rel}</em><span class="w">${md}</span>` : `<span>${md}</span>`;
  },
  renderUpcoming() {
    const cal = $("#calendar"), list = this.el.upList, mode = this.upMode;
    $("#upMode").querySelectorAll("[data-mode]").forEach(b => { const on = b.dataset.mode === mode; b.classList.toggle("on", on); b.setAttribute("aria-selected", String(on)); });
    cal.hidden = mode !== "cal"; list.hidden = mode === "cal";
    if (mode === "cal") { Calendar.render(); return; }
    const today = U.today(), sel = this.upSel || today, ws = this.upWeek || this.weekStart(sel);
    const open = Store.tasks().filter(t => t.status !== "done" && t.due), by = new Map();
    open.forEach(t => { if (!by.has(t.due)) by.set(t.due, []); by.get(t.due).push(t); });
    const days = [0, 1, 2, 3, 4, 5, 6].map(i => U.addDays(ws, i));
    let h = `<div class="wstrip" role="group" aria-label="이번 주"><button type="button" class="nav-arrow" data-act="week" data-d="-1" aria-label="이전 주">${ico("chevLeft", 20)}</button>`;
    h += days.map(ds => {
      const d = U.parseDate(ds), n = (by.get(ds) || []).length + GCal.eventsOn(ds).length, late = ds < today && (by.get(ds) || []).length;
      return `<button type="button" class="wday ${ds === today ? "today" : ""} ${ds === sel ? "sel" : ""} ${d.getDay() === 0 ? "sun" : d.getDay() === 6 ? "sat" : ""}" data-act="day" data-date="${ds}" aria-label="${U.fmtDate(ds)}${n ? `, ${n}개` : ""}" aria-pressed="${ds === sel}">${WEEKDAYS[d.getDay()]}<b>${d.getDate()}</b><i class="${late ? "late" : n ? "" : "no"}"></i></button>`;
    }).join("") + `<button type="button" class="nav-arrow" data-act="week" data-d="1" aria-label="다음 주">${ico("chevRight", 20)}</button></div>`;
    const late = open.filter(t => t.due < today).sort(Store.sortTasks);
    if (late.length) h += this.sec("지난 일", late.length, "bad") + this.group(late);
    const end = U.addDays(today, 60), dates = new Set([...by.keys()].filter(d => d >= today && d <= end));
    for (let d = today; d <= U.addDays(today, 13); d = U.addDays(d, 1)) if (GCal.eventsOn(d).length) dates.add(d);
    if (sel >= today) dates.add(sel);
    const sorted = [...dates].sort();
    if (!sorted.length && !late.length) h += `<div class="empty">${ico("calendar", 28)}<b>예정된 할 일이 없어요</b>마감일을 정하면 날짜별로 여기에 모여요</div>`;
    for (const ds of sorted) {
      const items = (by.get(ds) || []).sort((a, b) => ((!a.time) - (!b.time)) || (a.time || "").localeCompare(b.time || "") || Store.sortTasks(a, b));
      const evs = GCal.eventsOn(ds);
      h += `<div class="day-h ${ds === sel ? "sel" : ""}" data-day="${ds}">${this.dayLabel(ds)}<button type="button" class="add" data-act="add-day" data-date="${ds}" aria-label="${U.fmtDate(ds)}에 할 일 추가">${ico("plus", 18)}</button></div>`;
      h += items.length || evs.length ? `<div class="group">${evs.map(ev => this.evRow(ev)).join("")}${items.map(t => this.row(t, { due: false })).join("")}</div>` : `<div class="note-line">비어 있는 날이에요 · 오른쪽 + 로 추가</div>`;
    }
    const noDue = Store.tasks().filter(t => !t.due && t.status !== "done").length;
    if (noDue) h += `<button type="button" class="triage-link" data-act="nodue">${ico("orbit", 16)}기한 없는 할 일 <b>${noDue}개</b> 보기${ico("arrowRight", 16)}</button>`;
    this.keepScroll(this.el.upcoming, () => { list.innerHTML = h; });
    GCal.need(today, U.addDays(today, 60));
  },

  /* ── 행성 ── */
  openPlanet(id) { this.planetId = id; this.allMode = false; if (App.tab !== "planets") App.setTab("planets"); else { this.renderPlanets(); App.renderHeader(); } this.el.planets.scrollTop = 0; },
  openAll(filter) { this.allMode = true; this.planetId = null; if (filter) this.allFilter = filter; if (App.tab !== "planets") App.setTab("planets"); else { this.renderPlanets(); App.renderHeader(); } this.el.planets.scrollTop = 0; },
  back() { this.planetId = null; this.allMode = false; this.renderPlanets(); App.renderHeader(); QuickAdd.onTab(); },
  renderPlanets() {
    if (this.allMode) return this.renderAll();
    if (this.planetId && !Store.planet(this.planetId)) this.planetId = null;
    if (this.planetId) return this.renderPlanet();
    const v = this.el.planets, ps = Store.planets(), open = Store.tasks().filter(t => t.status !== "done");
    let h = `<div class="view-in"><button type="button" class="all-row" data-act="all"><span class="ico-box">${ico("list", 24)}</span>모든 할 일<span class="n">${open.length}</span>${ico("chevRight", 20, "chev")}</button>`;
    h += this.sec("행성", ps.length, "", ps.length > 1 ? `<span class="n" style="margin-left:auto;font-family:var(--f-ui);font-size:13px">손잡이를 끌어 순서 바꾸기</span>` : "");
    h += `<div class="group" id="plGroup">${ps.map(p => {
      const list = Store.tasksOf(p.id), rest = list.filter(t => t.status !== "done").length, today = list.filter(t => t.status !== "done" && Store.isTodayTask(t)).length, dn = list.filter(t => t.status === "done").length;
      const pct = list.length ? Math.round(dn / list.length * 100) : 0;
      return `<div class="pl" data-pid="${p.id}" data-id="${p.id}" tabindex="0" role="button" aria-label="${U.esc(p.name)}, 남은 할 일 ${rest}개">${thumbImg(bodyKey(p), 46)}<div class="tk-b"><div class="tk-t">${U.esc(p.name)}</div><div class="tk-m">남은 일 ${rest}<span class="dot">·</span>오늘 ${today}${dn ? `<span class="dot">·</span>완료 ${dn}` : ""}</div><div class="pbar" style="--c:${pColor(p)}"><i style="--w:${pct}%"></i></div></div>${ps.length > 1 ? `<span class="grip" aria-hidden="true">${ico("grip", 22)}</span>` : ""}</div>`;
    }).join("")}</div><button type="button" class="new-row" data-act="new-planet">${ico("plus", 20)}새 행성</button></div>`;
    this.keepScroll(v, () => { v.innerHTML = h; });
    const g = v.querySelector("#plGroup");
    if (g && ps.length > 1) sortable(g, { item: ".pl", handle: ".pl", touchHandle: ".grip", onDrop: (ids, id) => { Store.reorderPlanets(ids, id); } });
  },
  renderPlanet() {
    const v = this.el.planets, p = Store.planet(this.planetId), b = bodyOf(p), list = Store.tasksOf(p.id);
    const doing = list.filter(t => t.status === "doing"), todo = list.filter(t => t.status === "todo"), done = list.filter(t => t.status === "done").sort((a, b) => b.completedAt - a.completedAt);
    const pct = list.length ? Math.round(done.length / list.length * 100) : 0;
    let h = `<div class="view-in"><div class="p-hero" style="--c:${b.color}">${thumbImg(bodyKey(p), 72)}<div class="info"><div class="en">${b.en.toUpperCase()} · ${b.ko}</div><div class="sub">남은 일 ${todo.length + doing.length}개 · 완료 ${done.length}개</div><div class="pbar" style="--c:${b.color}"><i style="--w:${pct}%"></i></div></div><button type="button" class="ib" data-act="edit-planet" aria-label="행성 편집">${ico("edit", 20)}</button></div>`;
    h += `<label class="mini-add">${ico("plus", 20)}<input type="text" class="mini-input" data-planet="${p.id}" placeholder="${U.esc(p.name)}에 할 일 추가" aria-label="${U.esc(p.name)}에 할 일 추가" enterkeyhint="send"></label>`;
    if (doing.length) h += this.sec("집중 중", doing.length, "fire") + this.group(doing, { planet: false });
    if (todo.length) h += this.sec("할 일", todo.length) + this.group(todo, { planet: false });
    if (!list.length) h += `<div class="empty">${thumbImg(bodyKey(p), 40)}<b>아직 할 일이 없어요</b>위 칸에 적으면 이 행성의 위성이 돼요</div>`;
    h += this.doneSec(done, { planet: false }) + `</div>`;
    this.keepScroll(v, () => { v.innerHTML = h; });
  },
  allGroups() {
    const today = U.today(), d = n => U.addDays(today, n), diff = t => (t.due ? U.diffDays(today, t.due) : null);
    if (this.allGroup === "planet") return Store.planets().map(p => ({ title: `${thumbImg(bodyKey(p), 20)}${U.esc(p.name)}`, test: t => t.planetId === p.id, o: { planet: false } }));
    if (this.allGroup === "priority") return PRIO_ORDER.map(v => ({ title: `${prioSvg(v, 16)}${v ? PRIO[v].ko : "우선순위 미정"}`, test: t => (t.priority || 0) === v }));
    return [
      { title: "지난 일", cls: "bad", test: t => !!t.due && t.due < today },
      { title: "오늘", test: t => t.due === today },
      { title: "내일", test: t => diff(t) === 1 },
      { title: "이번 주", test: t => { const x = diff(t); return x != null && x >= 2 && x <= 7; } },
      { title: "나중에", test: t => diff(t) > 7 },
      { title: "기한 없음", test: t => !t.due },
    ];
  },
  renderAll() {
    const v = this.el.planets, f = this.allFilter;
    const FIL = [["open", "남은 일"], ["high", "높음"], ["late", "지난 일"], ["nodue", "기한 없음"], ["done", "완료"]];
    const pass = t => f === "done" ? t.status === "done" : t.status !== "done" && (f === "open" || (f === "high" && t.priority === 1) || (f === "late" && Store.isOverdue(t)) || (f === "nodue" && !t.due));
    const list = Store.tasks().filter(pass);
    let h = `<div class="view-in"><div class="filters" role="group" aria-label="거르기">${FIL.map(([k, l]) => `<button type="button" class="${f === k ? "on" : ""}" data-act="filter" data-f="${k}" aria-pressed="${f === k}">${l}</button>`).join("")}</div>`;
    h += `<div class="up-tools"><div class="seg" role="tablist" aria-label="묶는 기준">${[["planet", "행성별"], ["priority", "우선순위별"], ["due", "기한별"]].map(([k, l]) => `<button type="button" class="${this.allGroup === k ? "on" : ""}" data-act="group" data-g="${k}" role="tab" aria-selected="${this.allGroup === k}">${l}</button>`).join("")}</div></div>`;
    if (!list.length) h += `<div class="empty">${ico("check", 28)}<b>해당하는 할 일이 없어요</b></div>`;
    for (const g of this.allGroups()) {
      const items = list.filter(g.test).sort((a, b) => ((a.status === "done") - (b.status === "done")) || Store.sortTasks(a, b));
      if (!items.length) continue;
      h += this.sec(g.title, items.length, g.cls || "") + this.group(items, g.o);
    }
    this.keepScroll(v, () => { v.innerHTML = h + `</div>`; });
  },

  /* ── 동작 ── */
  onClick(e) {
    if (Swipe.recent()) { e.preventDefault(); return; }
    const a = e.target.closest("[data-act]"), row = e.target.closest("[data-task]"), fc = e.target.closest(".fcard");
    const t = row ? Store.task(row.dataset.task) : null, act = a && a.dataset.act, today = U.today();
    if (fc && act !== "f-done" && act !== "f-stop") { Focus.open(fc.dataset.id); return; }
    switch (act) {
      case "check": if (t) { if (t.status === "done") { Store.uncompleteTask(t.id); Juice.sfx("pause"); } else App.completeTask(t.id, a); } return;
      case "fire": if (t) { if (t.status === "doing") App.stopTask(t.id); else App.startTask(t.id, a); } return;
      case "f-done": App.completeTask(fc.dataset.id, a); return;
      case "f-stop": App.stopTask(fc.dataset.id); return;
      case "add-today": if (t) { Store.updateTask(t.id, { myDay: today }); App.toast("sun", `「${t.title}」 오늘 할 일로 옮겼어요`, () => Store.updateTask(t.id, { myDay: null })); } return;
      case "toggle-done": this.showDone = !this.showDone; this.render(); return;
      case "triage": Modal.triage(Store.todayTasks().filter(x => x.status === "todo" && !x.priority).map(x => x.id)); return;
      case "all": this.openAll(); return;
      case "new-planet": Modal.planet(null); return;
      case "edit-planet": Modal.planet(this.planetId); return;
      case "filter": this.allFilter = a.dataset.f; this.renderAll(); return;
      case "group": this.allGroup = a.dataset.g; Store.setSetting("allGroup", this.allGroup); this.renderAll(); return;
      case "day": this.upSel = a.dataset.date; this.renderUpcoming(); this.scrollToDay(this.upSel); QuickAdd.onTab(); return;
      case "week": { const n = +a.dataset.d; this.upWeek = U.addDays(this.upWeek || this.weekStart(this.upSel || today), 7 * n); this.upSel = this.upWeek < today && U.addDays(this.upWeek, 6) >= today ? today : this.upWeek < today ? U.addDays(this.upWeek, 6) : this.upWeek; this.renderUpcoming(); this.scrollToDay(this.upSel); return; }
      case "add-day": QuickAdd.openWith({ due: a.dataset.date }); return;
      case "nodue": this.openAll("nodue"); return;
    }
    const ev = e.target.closest(".ev"); if (ev) { GCal.openEvent(ev.dataset.ev); return; }
    const pl = e.target.closest(".pl[data-pid]"); if (pl && !e.target.closest(".grip")) { this.openPlanet(pl.dataset.pid); return; }
    if (row) App.openTask(row.dataset.task);
  },
  onKey(e) {
    if (e.isComposing || e.keyCode === 229) return;
    const el = e.target;
    if ((e.key === "Enter" || e.key === " ") && el.matches(".tk, .pl, .sec-h.toggle") && el === document.activeElement) { e.preventDefault(); el.click(); return; }
    if (e.key === "Enter" && el.matches(".mini-input")) {
      e.preventDefault(); const q = U.parseQuick(el.value, Store.planets()); if (!q.title) return;
      const t = Store.addTask({ title: q.title, priority: q.priority || 0, time: q.time, due: q.due, planetId: q.planetId || el.dataset.planet || QuickAdd.planetId });
      if (t) { Juice.sfx("add"); Juice.buzz("add"); }
      requestAnimationFrame(() => { const n = this.el.planets.querySelector(".mini-input"); if (n) n.focus(); });
    }
  },
  tick() {
    const tab = App.tab, v = this.el[tab]; if (!v) return;
    v.querySelectorAll("[data-live]").forEach(el => { const t = Store.task(el.dataset.live); if (t) el.textContent = U.fmtClock(Store.burned(t)); });
  },
};

/* ── 밀어서 완료(오른쪽) · 내일로(왼쪽): 휴대폰 손가락 · 펜 전용. 기다림 없이 바로 따라온다 ── */
const Swipe = {
  _t: 0,
  recent() { return performance.now() - this._t < 350; },
  start(e) {
    if (e.pointerType === "mouse" || e.button > 0) return;
    const row = e.target.closest(".tk"); if (!row || e.target.closest("button, input, a, .grip")) return;
    const t = Store.task(row.dataset.task); if (!t || t.status === "done") return;
    const x0 = e.clientX, y0 = e.clientY, W = row.offsetWidth; let dx = 0, live = false, dead = false, slide = null, sw = null;
    const begin = () => {
      live = true; row.classList.add("swiping");
      sw = document.createElement("div"); sw.className = "tk-sw r"; sw.setAttribute("aria-hidden", "true");
      slide = document.createElement("div"); slide.className = "tk-slide";
      while (row.firstChild) slide.appendChild(row.firstChild);
      row.append(sw, slide);
    };
    const unwrap = () => { if (!slide || !slide.isConnected) return; while (slide.firstChild) row.insertBefore(slide.firstChild, sw); sw.remove(); slide.remove(); row.classList.remove("swiping"); };
    const mv = ev => {
      if (ev.pointerId !== e.pointerId || dead) return;
      const ddx = ev.clientX - x0, ddy = ev.clientY - y0;
      if (!live) { if (Math.abs(ddy) > 10 && Math.abs(ddy) > Math.abs(ddx)) { dead = true; return; } if (Math.abs(ddx) < 12) return; begin(); }
      dx = ddx; const k = Math.min(1, Math.abs(dx) / (W * 0.35)), right = dx > 0;
      sw.className = `tk-sw ${right ? "r" : "l"}`; sw.textContent = right ? "완료" : "내일로"; sw.style.opacity = String(0.35 + k * 0.65);
      slide.style.transform = `translateX(${dx}px)`;
      if (k >= 1 && !sw.dataset.armed) { sw.dataset.armed = "1"; try { if (navigator.vibrate) navigator.vibrate(8); } catch (_) { /* 지원 안 함 */ } } else if (k < 1) delete sw.dataset.armed;
    };
    const up = ev => {
      if (ev.pointerId !== e.pointerId) return;
      window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
      if (!live) return;
      this._t = performance.now();
      const go = ev.type !== "pointercancel" && Math.abs(dx) >= W * 0.35;
      if (!go) { slide.style.transition = "transform .22s cubic-bezier(.2,.7,.1,1)"; slide.style.transform = ""; setTimeout(unwrap, 230); return; }
      slide.style.transition = "transform .2s ease-in"; slide.style.transform = `translateX(${dx > 0 ? W : -W}px)`;
      const id = t.id, ck = slide.querySelector(".ck");
      setTimeout(() => {
        if (dx > 0) App.completeTask(id, ck);
        else App.postpone(id);
      }, 160);
    };
    window.addEventListener("pointermove", mv, { passive: true }); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  },
};
