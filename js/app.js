/* ═══════════════ 앱: 초기화 · 보기 전환 · 헤더 · 단축키 · 동작 · 토스트 ═══════════════ */
"use strict";

const $ = sel => document.querySelector(sel);

const App = {
  view: "today", day: null, installPrompt: null, _sub: "", _hold: 0, _done: -1, _completing: new Set(),
  init() {
    Store.load(); this.day = U.today(); Juice.init();
    document.querySelectorAll("[data-ico]").forEach(el => { el.outerHTML = ico(el.dataset.ico, 18); });
    Scene.init(); Panel.init(); Calendar.init(); QuickAdd.init(); Palette.init(); Board.init(); Now.init(); ListView.init(); GCal.init(); Native.init();
    $("#gcalBtn").addEventListener("click", () => GCal.headClick());
    document.querySelectorAll(".seg-btn").forEach(b => b.addEventListener("click", () => this.setView(b.dataset.view)));
    $("#searchBtn").addEventListener("click", () => Palette.open());
    $("#settingsBtn").addEventListener("click", () => Modal.settings());
    $("#progressBtn").addEventListener("click", () => this.openToday());
    $("#modal").addEventListener("click", e => { if (e.target.closest("[data-close]")) Modal.close(); });
    $("#viewCtl").addEventListener("click", e => {
      const b = e.target.closest("[data-vc]"); if (!b) return; const a = b.dataset.vc;
      if (a === "in") Scene.zoomBy(0.82); else if (a === "out") Scene.zoomBy(1.22); else if (a === "reset") Scene.resetView();
      else if (a === "spin") Scene.setAutoRotate(!Scene.autoRotate); else if (a === "help") this.coach(true);
    });
    $("#focusChip").addEventListener("click", e => { if (e.target.closest("[data-act=back]")) Scene.focusOn(null); });
    $("#coach").addEventListener("click", e => { if (e.target.closest("[data-act]")) this.coach(false); });
    this.paintSpin();
    if (!Store.state.settings.coachSeen) Intro.after(() => setTimeout(() => { if (!Store.state.settings.coachSeen && $("#coach").hidden) this.coach(true); }, 1400));
    document.addEventListener("keydown", e => this.onKey(e));
    Store.on(d => this.onChange(d));
    const hash = location.hash.replace("#", "");
    this.setView(["today", "all", "list", "calendar"].includes(hash) ? hash : (Store.state.settings.view || "today"));
    this.renderHeader();
    setInterval(() => { Panel.tick(); Board.tick(); Now.tick(); ListView.tick(); this.renderHeader(); }, 1000);
    Board.render();
    setInterval(() => this.checkDay(), 30000);
    this.away(); setInterval(() => this.away(), 60000);
    window.addEventListener("resize", () => this.placeSeg());
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => this.placeSeg());
    Intro.run();

  },
  /* 다시 그리기 전 줄 자리를 재 두었다가, 그린 뒤 새 자리로 미끄러지게 한다 */
  onChange(d) {
    const snap = d.silent ? null : Juice.snap();
    Scene.sync(d);
    if (!d.silent) { Panel.refresh(); Calendar.render(); Board.render(); ListView.render(); }
    Now.render();
    this.renderHeader(); QuickAdd.refresh();
    Juice.flip(snap, d.type === "task-add" ? new Set([d.id]) : null);
  },
  setView(v) {
    if (!["today", "all", "list", "calendar"].includes(v)) v = "today";
    this.view = v; document.body.dataset.view = v;
    document.querySelectorAll(".seg-btn").forEach(b => b.setAttribute("aria-selected", b.dataset.view === v ? "true" : "false"));
    this.placeSeg();
    const cal = $("#calendar");
    if (v === "calendar") { cal.hidden = false; Calendar.render(); } else cal.hidden = true;
    const lv = $("#listView"); lv.hidden = v !== "list"; if (v === "list") ListView.render();
    Scene.setView(v);
    Store.setSetting("view", v); QuickAdd.onView(v); if (Board.el) Board.render(); if (Now.el) Now.render();
  },
  placeSeg() {
    const b = document.querySelector(`.seg-btn[aria-selected="true"]`), th = $(".seg-thumb"); if (!b || !th) return;
    const pad = window.innerWidth < 640 ? Math.max(0, (b.offsetWidth - 44) / 2) : 14;
    th.style.width = `${b.offsetWidth - pad * 2}px`; th.style.transform = `translateX(${b.offsetLeft + pad}px)`;
  },
  renderHeader() {
    if (!$("#todayDate")) return;
    const today = U.today(), d = U.parseDate(today);
    const date = `${d.getMonth() + 1}월 ${d.getDate()}일 ${U.weekday(today)}요일`;
    const s = Store.todayStats(), remain = s.total - s.done, burn = Store.burnedToday();
    const sub = `<span>남은 일 <b>${remain}</b></span><span>완료 <b>${s.done}</b></span>${burn >= 60 || s.doing ? `<span class="s-fire">집중 <b>${U.fmtDuration(burn)}</b></span>` : ""}${s.overdue ? `<span class="s-late">기한 지남 <b>${s.overdue}</b></span>` : ""}`;
    const dEl = $("#todayDate"); if (dEl.textContent !== date) dEl.textContent = date;
    if (sub !== this._sub) { $("#todaySub").innerHTML = sub; this._sub = sub; }
    if (this._hold > 0) return;   /* 완료 빛이 링에 닿을 때 숫자를 올린다 */
    const pct = s.total ? s.done / s.total : 0, ring = $("#progressRing"), btn = $("#progressBtn");
    if (this._done >= 0 && s.done > this._done) { btn.classList.remove("bump"); void btn.offsetWidth; btn.classList.add("bump"); }
    this._done = s.done;
    ring.style.strokeDashoffset = (103.67 * (1 - pct)).toFixed(2);
    const txt = s.total ? `${s.done}/${s.total}` : "0"; const num = $("#progressText"); if (num.textContent !== txt) num.textContent = txt;
    btn.classList.toggle("complete", s.total > 0 && s.done === s.total);
    btn.title = s.total ? `오늘 ${s.total}개 중 ${s.done}개 완료` : "오늘의 미션";
  },
  paintSpin() {
    const b = $("#vcSpin"); if (!b) return; const on = Scene.autoRotate;
    b.innerHTML = ico(on ? "pause" : "play", 16); b.setAttribute("aria-pressed", on); b.title = on ? "자동 회전 멈추기  R" : "자동 회전 켜기  R";
  },
  /* 첫 실행 조작 안내 (언제든 ? 버튼으로 다시 열기) */
  coach(show) {
    const el = $("#coach"); if (!show) { el.hidden = true; Store.setSetting("coachSeen", true); return; }
    const touch = Scene.touch, rows = touch
      ? [["한 손가락 드래그", "빈 공간을 끌면 시점이 돌아가요"], ["두 손가락", "오므리거나 벌려서 확대·축소해요"], ["행성 탭", "가까이 다가가 할 일을 보여 줘요"], ["위성 끌기", "태양에 놓으면 집중, 다른 행성에 놓으면 이동해요. 잘못 옮기면 알림에서 실행 취소"], ["행성 끌기", "다른 궤도에 놓으면 행성 순서가 바뀌어요"], ["이름표의 불꽃", "누르면 바로 집중을 시작해요"], ["두 번 탭", "전체 보기로 돌아가요"]]
      : [["드래그", "빈 공간을 끌면 시점이 돌아가요"], ["휠", "확대하고 축소해요"], ["행성 클릭", "가까이 다가가 할 일을 보여 줘요"], ["위성 끌기", "태양에 놓으면 집중, 다른 행성에 놓으면 이동해요. 잘못 옮기면 알림에서 실행 취소"], ["행성 끌기", "다른 궤도에 놓으면 행성 순서가 바뀌어요"], ["이름표의 불꽃", "누르면 바로 집중을 시작해요"], ["두 번 클릭", "전체 보기로 돌아가요"]];
    el.innerHTML = `<div class="coach-h"><span>조작 안내</span><button type="button" class="icon-btn plain sm" data-act="close" aria-label="닫기">${ico("x", 16)}</button></div>
      <ul class="coach-list">${rows.map(([k, v]) => `<li><span class="ck">${k}</span><span>${v}</span></li>`).join("")}</ul>
      ${touch ? "" : `<div class="coach-keys"><kbd>N</kbd> 새 할 일 <kbd>/</kbd> 검색 <kbd>3</kbd> 목록 <kbd>0</kbd> 전체 보기 <kbd>R</kbd> 자동 회전</div>`}
      <div class="coach-foot"><button type="button" class="btn sol sm" data-act="ok">알겠어요</button></div>`;
    el.hidden = false;
  },
  /* 앱이 꺼져 있었거나 컴퓨터가 잠든 동안은 집중 시간에서 뺀다.
     앱이 켜져 있으면(다른 창에서 일해도) 그대로 센다. 1분마다 「마지막으로 살아 있던 때」를 적어 두고, 20분 넘게 비면 그만큼 뺀다 */
  away() {
    const now = Date.now(), seen = +Store.state.settings.seen || now, gap = now - seen;
    Store.setSetting("seen", now);
    if (gap < 20 * 60000) return;
    const doing = Store.tasks().filter(t => t.status === "doing" && t.startedAt && t.startedAt < seen);
    if (!doing.length) return;
    const before = doing.map(t => [t.id, t.startedAt]);
    doing.forEach(t => { t.startedAt = Math.min(now, t.startedAt + gap); });
    Store.emit({ type: "away" });
    this.toast("pause", `자리를 비운 ${U.fmtDuration(gap / 1000)}은 집중 시간에서 뺐어요`, () => { before.forEach(([id, st]) => { const t = Store.task(id); if (t) t.startedAt = st; }); Store.emit({ type: "away" }); });
  },
  checkDay() { if (this.day !== U.today()) { this.day = U.today(); Scene.sync({ type: "day" }); Panel.refresh(); Calendar.render(); this.renderHeader(); QuickAdd.onView(this.view); } },
  onKey(e) {
    const ae = document.activeElement, typing = ae && (/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) || ae.isContentEditable);
    if (e.key === "Escape") {
      if (Scene.cancelDrag()) return;
      if (Board.closeM()) return;
      if (!$("#palette").hidden) return Palette.close();
      if (!$("#modal").hidden) return Modal.close();
      if (QuickAdd.closePops()) return;
      if (typing) { ae.blur(); return; }
      if (!$("#coach").hidden) return this.coach(false);
      if (!$("#sheet").hidden) return Panel.close();
      if (Scene.focusId) return Scene.focusOn(null);
      return;
    }
    if (!$("#modal").hidden || !$("#palette").hidden) return;
    if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) { e.preventDefault(); Palette.open(); return; }
    if (typing || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    const k = e.key;
    if (k === "n" || k === "N" || k === "ㅜ") { e.preventDefault(); QuickAdd.input.focus(); }
    else if (k === "/") { e.preventDefault(); Palette.open(); }
    else if (k === "1") this.setView("today"); else if (k === "2") this.setView("all"); else if (k === "3") this.setView("list"); else if (k === "4") this.setView("calendar");
    else if (k === "t" || k === "T" || k === "ㅅ") this.openToday();
    else if (k === "+" || k === "=") Scene.zoomBy(0.82); else if (k === "-" || k === "_") Scene.zoomBy(1.22);
    else if (k === "0") Scene.resetView(); else if (k === "r" || k === "R" || k === "ㄱ") Scene.setAutoRotate(!Scene.autoRotate);
    else if (k === "?") this.coach($("#coach").hidden);
    else if (k === "ArrowLeft" || k === "ArrowRight") { e.preventDefault(); if (this.view === "calendar") Calendar.move(k === "ArrowLeft" ? -1 : 1); else Scene.rotateBy(k === "ArrowLeft" ? 0.22 : -0.22, 0); }
    else if (k === "ArrowUp" || k === "ArrowDown") { e.preventDefault(); Scene.rotateBy(0, k === "ArrowUp" ? 0.1 : -0.1); }
  },
  /* 할 일·행성을 열면 카메라가 그 행성으로 다가가고, 목록 화면은 전체 보기로 돌아간다 */
  openTask(id) { const t = Store.task(id); if (!t) return; Panel.open("task", id); Scene.focusOn(t.status === "doing" ? null : t.planetId); },
  openPlanet(id) { if (!Store.planet(id)) return; Panel.open("planet", id); Scene.focusOn(id); },
  openDay(date) { Panel.open("day", null, date); Scene.focusOn(null); },
  openToday() { Panel.open("today"); Scene.focusOn(null); },
  openNoDue() { Panel.open("nodue"); Scene.focusOn(null); },

  /* 점화: 누른 자리에서 불덩이가 곡선을 그리며 태양으로 날아가 터진다. 3D 위성도 제자리에서 태양으로 날아간다 */
  startTask(id, src) {
    const t = Store.task(id); if (!t || t.status === "doing") return;
    const el = src && src.isConnected ? src : null, from = el ? Juice.center(el) : null;
    if (el) { el.classList.remove("j-ign"); void el.offsetWidth; el.classList.add("j-ign"); }
    if (!Scene.lastPos.has(id)) { const m = this.moonAt(id); if (m) Scene.lastPos.set(id, { x: m.x, y: m.y, t0: Scene.time }); }
    Store.startTask(id);
    Juice.ignite(from, () => Now.ignite());
    this.toast("flame", `「${t.title}」 점화 · 집중을 시작해요`);
  },
  stopTask(id) {
    const t = Store.task(id); if (!t || t.status !== "doing") return;
    Store.stopTask(id); Juice.sfx("pause"); Juice.buzz("pause");
    this.toast("orbitBack", `「${t.title}」${U.josa(t.title, "을", "를")} 멈추고 궤도로 돌려보냈어요`, () => Store.startTask(id));
  },
  /* 완료: 누른 즉시 체크가 터지고(소리 · 진동), 잠깐 뒤 줄이 옆으로 빠져나가며 빛이 상단 진행 링으로 날아가 숫자를 올린다 */
  completeTask(id, src) {
    const t = Store.task(id); if (!t || t.status === "done" || this._completing.has(id)) return;
    const btn = src && src.isConnected ? src : null, row = btn && btn.closest(".b-row, .lv-card, .row, .nowbar, .cal-task, .wk-task");
    const combo = Juice.check(btn, row && !row.classList.contains("nowbar") ? row : null);
    if (!btn) { this.commitDone(id, null, null, combo); return; }
    this._completing.add(id);
    setTimeout(() => { this._completing.delete(id); this.commitDone(id, btn, row); }, 300);
  },
  commitDone(id, btn, row) {
    const t = Store.task(id); if (!t || t.status === "done") return;
    const from = btn && btn.isConnected && btn.getClientRects().length ? Juice.center(btn) : this.moonAt(id);
    const ghost = row && !row.classList.contains("nowbar") ? Juice.ghost(row) : null;
    this._hold++;
    const title = t.title, res = Store.completeTask(id); if (!res) { this._hold--; return; }
    Juice.playGhost(ghost);
    const sp = res.spawned ? res.spawned.id : null;
    this.toast("check", `「${title}」 완료${res.spawned ? ` · 다음 반복 ${U.relDate(res.spawned.due)}` : ""}`, () => Store.uncompleteTask(id, sp));
    const s = Store.todayStats(), all = s.total > 0 && s.done === s.total;
    Juice.toRing(from, () => {
      this._hold = Math.max(0, this._hold - 1); this.renderHeader();
      if (all && !this._hold) { const n = Store.todayStats(); if (n.total && n.done === n.total) setTimeout(() => Juice.celebrate({ sub: `완료 ${n.done}개${Store.burnedToday() >= 60 ? ` · 집중 ${U.fmtDuration(Store.burnedToday())}` : ""}` }), 140); }
    });
  },
  /* 3D 위성(또는 태양 곁 불덩이)의 화면 위치 */
  moonAt(id) {
    for (const s of Scene.systems.values()) { const m = s.moons.get(id); if (m && !m.hidden && !Scene.isOverlay()) return { x: m.sx, y: m.sy }; }
    const o = Scene.orbs.get(id); return o && !Scene.isOverlay() ? { x: o.sx, y: o.sy } : null;
  },
  deleteTask(id) {
    const t = Store.removeTask(id); if (!t) return;
    if (Panel.mode === "task" && Panel.id === id) Panel.close();
    this.toast("trash", `「${t.title}」 삭제`, () => Store.restoreTask(t));
  },
  toast(icon, msg, undo) {
    const box = $("#toasts");
    while (box.children.length >= 3) box.firstElementChild.remove();
    const el = document.createElement("div"); el.className = "toast";
    el.innerHTML = `${ico(icon, 17)}<span class="msg">${U.esc(msg)}</span>${undo ? `<button type="button" class="undo">실행 취소</button>` : ""}`;
    if (undo) el.querySelector(".undo").addEventListener("click", () => { undo(); el.remove(); });
    box.appendChild(el);
    setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 300); }, undo ? 6000 : 3200);
  },
};

/* ═══════════════ 커맨드 바: 빠른 추가 (입력하는 동안 행성·날짜를 미리 보여 줌) ═══════════════ */
const QuickAdd = {
  form: null, input: null, planetBtn: null, dateBtn: null, popP: null, popD: null, planetId: null, due: null, time: null, preview: null,
  init() {
    this.form = $("#cmd"); this.input = $("#cmdInput"); this.planetBtn = $("#cmdPlanet"); this.dateBtn = $("#cmdDate"); this.popP = $("#popPlanet"); this.popD = $("#popDate");
    this.form.addEventListener("submit", e => { e.preventDefault(); this.submit(); });
    this.input.addEventListener("input", () => this.live());
    this.prioBtn = $("#cmdPrio"); this.popPr = $("#popPrio"); this.prio = 0;
    this.prioBtn.addEventListener("click", () => this.toggle("prio"));
    this.popPr.addEventListener("click", e => { const it = e.target.closest("[data-p]"); if (it) { this.prio = +it.dataset.p; this.paint(); this.closePops(); this.input.focus(); } });
    this.planetBtn.addEventListener("click", () => this.toggle("planet"));
    this.dateBtn.addEventListener("click", () => this.toggle("date"));
    document.addEventListener("pointerdown", e => { if (!this.form.contains(e.target)) this.closePops(); }, true);
    this.popP.addEventListener("click", e => {
      const it = e.target.closest("[data-pid]");
      if (it) { this.planetId = it.dataset.pid; this.paint(); this.closePops(); this.input.focus(); }
      else if (e.target.closest("[data-new]")) { this.closePops(); Modal.planet(null); }
    });
    this.popD.addEventListener("click", e => { const it = e.target.closest("[data-due]"); if (it) { this.setDue(it.dataset.due || null); this.closePops(); this.input.focus(); } });
    this.popD.addEventListener("change", e => {
      if (e.target.id === "qaDate") this.setDue(e.target.value || null);
      if (e.target.id === "qaTime") { this.time = e.target.value || null; if (this.time && !this.due) this.due = U.today(); this.paint(); }
    });
    this.refresh(); this.setDue(U.today());
  },
  onView(v) {
    this.setDue(v === "today" ? U.today() : null);
    this.input.placeholder = window.innerWidth < 640 ? "새 할 일" : v === "list" ? "새 할 일  ·  #행성  !1  내일" : v === "calendar" ? "선택한 날짜에 할 일 추가  ·  #행성  !1" : "새 할 일  ·  #행성  !1  내일 오후 3시";
  },
  refresh() { const ps = Store.planets(); if (!ps.length) return; if (!ps.find(p => p.id === this.planetId)) this.planetId = ps[0].id; this.paint(); if (!this.popP.hidden) this.renderPlanets(); },
  setDue(d) { this.due = d; if (!d) this.time = null; this.paint(); },
  paint() {
    const pv = this.preview || {}, p = Store.planet(pv.planetId || this.planetId) || Store.planets()[0]; if (!p) return;
    this.planetBtn.innerHTML = `${thumbImg(bodyKey(p), 28)}<span class="nm">${U.esc(p.name)}</span>${ico("chevDown", 14)}`;
    this.planetBtn.title = `${p.name} 행성에 추가`;
    const due = pv.due || this.due, time = pv.time || this.time;
    const txt = due ? `${U.relDate(due)}${time ? " " + U.fmtTime(time) : ""}` : "기한 없음";
    this.dateBtn.querySelector(".txt").textContent = txt; this.dateBtn.classList.toggle("on", !!due);
    const pr = pv.priority || this.prio || 0;
    this.prioBtn.innerHTML = `${prioSvg(pr, 15)}<span class="txt">${pr ? PRIO[pr].ko : "우선순위"}</span>`;
    this.prioBtn.classList.toggle("on", !!pr); this.prioBtn.style.setProperty("--pc", PRIO[pr].color); this.prioBtn.title = `우선순위: ${PRIO[pr].ko}`;
  },
  live() { const q = U.parseQuick(this.input.value, Store.planets()); this.preview = q.planetId || q.due || q.time || q.priority ? { planetId: q.planetId, due: q.due, time: q.time, priority: q.priority } : null; this.paint(); },
  toggle(which) {
    const map = { planet: [this.popP, this.planetBtn, () => this.renderPlanets()], date: [this.popD, this.dateBtn, () => this.renderDates()], prio: [this.popPr, this.prioBtn, () => this.renderPrio()] };
    const [pop, btn, render] = map[which], open = pop.hidden;
    this.closePops();
    if (open) { render(); pop.hidden = false; btn.classList.add("open"); }
  },
  closePops() {
    const pops = [this.popP, this.popD, this.popPr], was = pops.some(p => p && !p.hidden);
    pops.forEach(p => { if (p) p.hidden = true; }); [this.planetBtn, this.dateBtn, this.prioBtn].forEach(b => b && b.classList.remove("open")); return was;
  },
  renderPrio() { this.popPr.innerHTML = `<div class="pop-title">우선순위 <span class="sub">입력창에 !1 !2 !3</span></div>` + PRIO_ORDER.map(p => `<button type="button" class="pop-item" data-p="${p}">${prioSvg(p, 15)}<span class="lbl">${PRIO[p].ko}</span>${p ? `<span class="sub">!${p}</span>` : ""}${(this.prio || 0) === p ? `<span class="chk">${ico("check", 15)}</span>` : ""}</button>`).join(""); },
  renderPlanets() {
    this.popP.innerHTML = `<div class="pop-title">어느 행성에 띄울까요</div>` + Store.planets().map(p => `<button type="button" class="pop-item" data-pid="${p.id}">${thumbImg(bodyKey(p), 30)}<span class="lbl">${U.esc(p.name)}</span><span class="sub">${Store.tasksOf(p.id).filter(t => t.status !== "done").length}</span>${p.id === this.planetId ? `<span class="chk">${ico("check", 16)}</span>` : ""}</button>`).join("")
      + `<div class="pop-sep"></div><button type="button" class="pop-item" data-new>${ico("plus", 18)}<span class="lbl">새 행성 만들기</span></button>`;
  },
  renderDates() {
    const t = U.today(), opts = [["오늘", t], ["내일", U.addDays(t, 1)], ["모레", U.addDays(t, 2)], ["다음 주", U.addDays(t, 7)], ["기한 없음", ""]];
    this.popD.innerHTML = `<div class="pop-title">마감일</div><div class="pop-grid">${opts.map(([l, v]) => `<button type="button" class="pop-item" data-due="${v}"><span class="lbl">${l}</span>${v ? `<span class="sub">${U.weekday(v)}</span>` : ""}${(this.due || "") === v ? `<span class="chk">${ico("check", 15)}</span>` : ""}</button>`).join("")}</div><div class="pop-sep"></div><div class="pop-row"><input type="date" id="qaDate" value="${this.due || ""}" aria-label="날짜"><input type="time" id="qaTime" value="${this.time || ""}" aria-label="시간"></div>`;
  },
  submit() {
    const q = U.parseQuick(this.input.value, Store.planets()); if (!q.title) { this.input.focus(); return; }
    let due = q.due || this.due;
    if (App.view === "calendar" && !q.due && Calendar.selected) due = Calendar.selected;
    const data = { title: q.title, planetId: q.planetId || this.planetId, priority: q.priority || this.prio || 0, due, time: q.time || this.time || null };
    if (App.view === "today" && !due) data.myDay = U.today();
    const r = this.form.getBoundingClientRect(); Scene.launch = { x: r.left + 40, y: r.top + 8, t0: Scene.time };
    const t = Store.addTask(data); if (!t) return;
    Juice.pop(this.form.querySelector(".cmd-go"), "add");
    this.input.value = ""; this.preview = null; this.prio = 0; this.paint();
    const p = Store.planet(t.planetId);
    App.toast("orbit", `「${t.title}」 → ${p ? p.name : ""}${t.due ? ` · ${U.relDate(t.due)}` : ""}`);
    if (App.view === "today" && !Store.isTodayTask(t)) setTimeout(() => App.toast("info", "오늘이 아닌 할 일은 「전체」에서 볼 수 있어요"), 500);
  },
};

/* ═══════════════ 검색 팔레트 (/ 또는 Ctrl+K) ═══════════════ */
const Palette = {
  el: null, input: null, list: null, idx: 0, items: [],
  init() {
    this.el = $("#palette"); this.input = $("#palInput"); this.list = $("#palList");
    this.el.addEventListener("click", e => { if (e.target.closest("[data-close]")) return this.close(); const it = e.target.closest(".pal-item"); if (it) this.pick(it.dataset.id); });
    this.input.addEventListener("input", () => { this.idx = 0; this.run(); });
    this.input.addEventListener("keydown", e => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); const n = this.items.length; if (!n) return; this.idx = (this.idx + (e.key === "ArrowDown" ? 1 : -1) + n) % n; this.mark(); }
      else if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); if (this.items[this.idx]) this.pick(this.items[this.idx]); }
    });
  },
  open() { this.el.hidden = false; this.input.value = ""; this.idx = 0; this.run(); requestAnimationFrame(() => this.input.focus()); },
  close() { this.el.hidden = true; },
  mark() { this.list.querySelectorAll(".pal-item").forEach((it, i) => { it.classList.toggle("active", i === this.idx); if (i === this.idx) it.scrollIntoView({ block: "nearest" }); }); },
  run() {
    const q = this.input.value.trim().toLowerCase();
    let list = q ? Store.tasks().filter(t => t.title.toLowerCase().includes(q) || (t.notes || "").toLowerCase().includes(q)) : Store.todayTasks().filter(t => t.status !== "done");
    list = list.sort(Store.sortTasks).slice(0, 14); this.items = list.map(t => t.id);
    const hl = s => { if (!q) return U.esc(s); const i = s.toLowerCase().indexOf(q); return i < 0 ? U.esc(s) : U.esc(s.slice(0, i)) + "<mark>" + U.esc(s.slice(i, i + q.length)) + "</mark>" + U.esc(s.slice(i + q.length)); };
    this.list.innerHTML = list.length ? (q ? "" : `<div class="pop-title">오늘 남은 할 일</div>`) + list.map((t, i) => {
      const p = Store.planet(t.planetId);
      return `<button type="button" class="pal-item ${i === this.idx ? "active" : ""}" data-id="${t.id}">${thumbImg(bodyKey(p), 26)}<span class="t ${t.status === "done" ? "done" : ""}">${hl(t.title)}</span><span class="m">${p ? U.esc(p.name) : ""}${t.due ? " · " + U.relDate(t.due) : ""}${t.status === "doing" ? " · 집중 중" : ""}</span></button>`;
    }).join("") : `<div class="pal-empty">${q ? `「${U.esc(q)}」와 맞는 할 일이 없어요` : "오늘 남은 할 일이 없어요"}</div>`;
  },
  pick(id) { this.close(); App.openTask(id); },
};

/* ═══════════════ 모달: 설정 · 행성 편집 · 확인 ═══════════════ */
const Modal = {
  el: null, card: null,
  show(html) { this.el = $("#modal"); this.card = $("#modalCard"); this.card.innerHTML = html; this.el.hidden = false; const f = this.card.querySelector("input[type=text]"); if (f) setTimeout(() => f.focus(), 40); },
  close() { if (this.el) this.el.hidden = true; if (this._key) { document.removeEventListener("keydown", this._key, true); this._key = null; } },
  /* 우선순위 정리: 미정인 할 일을 한 장씩 보여 주고 1·2·3 으로 정한다 */
  triage(ids) {
    const queue = ids.filter(id => Store.task(id)); let i = 0; const tally = { 1: 0, 2: 0, 3: 0 };
    if (!queue.length) { App.toast("check", "우선순위가 정해지지 않은 할 일이 없어요"); return; }
    const set = p => { const t = Store.task(queue[i]); if (t) { Store.updateTask(t.id, { priority: p }); tally[p]++; } i++; step(); };
    const step = () => {
      while (i < queue.length && !Store.task(queue[i])) i++;
      if (i >= queue.length) {
        this.show(`<h3>우선순위를 정리했어요</h3><p class="desc">${queue.length}개 중 ${tally[1] + tally[2] + tally[3]}개를 정했어요.</p>
          <div class="tri-sum">${[1, 2, 3].map(p => `<div style="--pc:${PRIO[p].color}">${prioSvg(p, 16)}<b>${PRIO[p].ko}</b><span class="num">${tally[p]}</span></div>`).join("")}</div>
          <div class="m-actions"><button type="button" class="btn sol" data-x>닫기</button></div>`);
        this.card.querySelector("[data-x]").addEventListener("click", () => this.close()); return;
      }
      const t = Store.task(queue[i]), p = Store.planet(t.planetId), late = Store.isOverdue(t);
      this.show(`<div class="tri-h"><h3>우선순위 정리</h3><span class="num">${i + 1} / ${queue.length}</span></div>
        <div class="bar tri-bar"><i style="--p:${Math.round(i / queue.length * 100)}%;--bc:var(--sol)"></i></div>
        <div class="tri-card">
          <div class="tri-meta">${thumbImg(bodyKey(p), 18)}<span>${U.esc(p ? p.name : "")}</span>${t.due ? `<span class="${late ? "late" : ""}">· ${Board.due(t)}${t.time ? " " + U.fmtTime(t.time) : ""}</span>` : ""}</div>
          <div class="tri-title">${U.esc(t.title)}</div>
          ${t.notes ? `<p class="tri-notes">${U.esc(t.notes.slice(0, 140))}</p>` : ""}
        </div>
        <div class="tri-opts">${[1, 2, 3].map(v => `<button type="button" class="tri-opt" data-p="${v}" style="--pc:${PRIO[v].color}">${prioSvg(v, 20)}<b>${PRIO[v].ko}</b><kbd>${v}</kbd></button>`).join("")}</div>
        <div class="m-actions"><button type="button" class="btn left" data-x>그만하기</button><button type="button" class="btn" data-skip>건너뛰기 <kbd>→</kbd></button></div>`);
      const c = this.card;
      c.querySelectorAll("[data-p]").forEach(b => b.addEventListener("click", () => set(+b.dataset.p)));
      c.querySelector("[data-skip]").addEventListener("click", () => { i++; step(); });
      c.querySelector("[data-x]").addEventListener("click", () => this.close());
    };
    step();
    if (this._key) document.removeEventListener("keydown", this._key, true);
    this._key = e => {
      if (this.el.hidden) return;
      if (["1", "2", "3"].includes(e.key) && this.card.querySelector(".tri-opts")) { e.preventDefault(); e.stopPropagation(); set(+e.key); }
      else if ((e.key === "ArrowRight" || e.key === "s" || e.key === "S") && this.card.querySelector("[data-skip]")) { e.preventDefault(); e.stopPropagation(); i++; step(); }
    };
    document.addEventListener("keydown", this._key, true);
  },
  confirm({ title, desc, ok, onOk }) {
    this.show(`<h3>${U.esc(title)}</h3><p class="desc">${desc}</p><div class="m-actions"><button type="button" class="btn" data-x>취소</button><button type="button" class="btn danger" data-ok>${U.esc(ok)}</button></div>`);
    this.card.querySelector("[data-x]").addEventListener("click", () => this.close());
    this.card.querySelector("[data-ok]").addEventListener("click", () => { this.close(); onOk(); });
  },
  settings() {
    const ps = Store.planets(), ua = navigator.userAgent, ios = /iPhone|iPad|iPod/.test(ua), android = /Android/.test(ua);
    const how = App.installPrompt ? "바탕화면이나 홈 화면에 설치하면 전체 화면 앱처럼 열려요."
      : ios ? "Safari 아래쪽 공유 버튼에서 「홈 화면에 추가」를 누르면 앱처럼 설치돼요."
      : android ? "브라우저 메뉴(⋮)에서 「홈 화면에 추가」 또는 「앱 설치」를 누르세요."
      : "Chrome이나 Edge 주소창 오른쪽의 설치 아이콘으로 데스크톱 앱처럼 설치할 수 있어요. https 주소로 열었을 때 동작해요.";
    this.show(`<h3>설정</h3><p class="desc">행성은 할 일의 카테고리예요. 실제 천체 사진으로 나만의 태양계를 꾸며 보세요.</p>
      <h4>행성<span class="h4-sub">${ps.length > 1 ? "끌어서 순서를 바꿔요 · 위가 태양에 가까운 궤도" : ""}</span></h4>
      <div class="plist">${ps.map(p => `<div class="pitem" data-id="${p.id}">${ps.length > 1 ? `<button type="button" class="grip" aria-label="「${U.esc(p.name)}」 순서 바꾸기 · 끌거나 위아래 화살표" title="끌어서 순서 바꾸기">${ico("grip", 16)}</button>` : ""}${thumbImg(bodyKey(p), 38)}<div class="nm">${U.esc(p.name)}<small>${bodyOf(p).ko} · 남은 할 일 ${Store.tasksOf(p.id).filter(t => t.status !== "done").length}개</small></div><button type="button" class="btn sm" data-edit="${p.id}">편집</button></div>`).join("")}</div>
      <div class="btn-row" style="margin-top:10px"><button type="button" class="btn sm" id="mAdd">${ico("plus", 15)}행성 추가</button></div>
      <h4>화면</h4>
      <label class="toggle-row"><span>위성 옆에 할 일 이름 항상 표시<br><small style="color:var(--ink-3)">끄면 행성에 마우스를 올렸을 때만 보여요</small></span><button type="button" class="switch ${Scene.showNames ? "on" : ""}" id="mNames" role="switch" aria-checked="${Scene.showNames}" aria-label="위성 이름 항상 표시"></button></label>
      <label class="toggle-row" style="margin-top:12px"><span>우주 자동 회전<br><small style="color:var(--ink-3)">조작하거나 패널을 열면 잠시 멈춰요</small></span><button type="button" class="switch ${Scene.autoRotate ? "on" : ""}" id="mSpin" role="switch" aria-checked="${Scene.autoRotate}" aria-label="우주 자동 회전"></button></label>
      ${Native.ok() ? `<label class="toggle-row" style="margin-top:12px"><span>마감 알림<br><small id="mNotifyHint" style="color:var(--ink-3)">${Native.hint()}</small></span><button type="button" class="switch ${Native.on() ? "on" : ""}" id="mNotify" role="switch" aria-checked="${Native.on()}" aria-label="마감 알림"></button></label>` : ""}
      <label class="toggle-row" style="margin-top:12px"><span>효과음<br><small style="color:var(--ink-3)">완료 · 점화할 때 짧은 소리를 들려줘요</small></span><button type="button" class="switch ${Juice.on() ? "on" : ""}" id="mSfx" role="switch" aria-checked="${Juice.on()}" aria-label="효과음"></button></label>
      <div class="btn-row" style="margin-top:12px"><button type="button" class="btn sm" id="mCoach">${ico("help", 15)}조작 안내 보기</button></div>
      ${window.ORBIT_NATIVE ? "" : `<h4>앱으로 쓰기</h4><p class="desc" style="margin:0 0 10px">${how}</p>${App.installPrompt ? `<div class="btn-row"><button type="button" class="btn sol sm" id="mInstall">${ico("install", 15)}앱으로 설치</button></div>` : ""}`}
      <h4>데이터</h4>
      <div class="btn-row"><button type="button" class="btn sm" id="mExport">${ico("download", 15)}JSON 내보내기</button><button type="button" class="btn sm" id="mCopy">${ico("copy", 15)}복사</button><button type="button" class="btn sm" id="mCal">${ico("calendar", 15)}캘린더 연동</button><label class="btn sm" for="mFile">${ico("upload", 15)}가져오기</label><input type="file" id="mFile" accept="application/json,.json" hidden></div>
      <div class="btn-row" style="margin-top:8px"><button type="button" class="btn sm" id="mSample">예시 데이터로 시작</button><button type="button" class="btn sm danger" id="mReset">모두 지우기</button></div>
      <h4>단축키</h4>
      <div class="keys"><kbd>N</kbd><span>새 할 일</span><kbd>/</kbd><span>검색 (Ctrl+K)</span><kbd>1 2 3 4</kbd><span>오늘 · 전체 · 목록 · 캘린더</span><kbd>T</kbd><span>오늘의 미션</span><kbd>+ −</kbd><span>확대 · 축소</span><kbd>← → ↑ ↓</kbd><span>시점 회전</span><kbd>0</kbd><span>전체 보기</span><kbd>R</kbd><span>자동 회전 켜기·끄기</span><kbd>Esc</kbd><span>닫기</span></div>
      <p class="desc" style="margin:12px 0 0">입력 팁: <b>#행성이름</b>으로 행성을, <b>!1 !2 !3</b>(또는 !높음 !보통 !낮음)으로 우선순위를 정해요. 「내일」「다음주 금요일」「오후 3시」「12/25」 같은 날짜와 시간도 알아들어요.</p>
      <h4>이미지 출처</h4>
      <p class="credits">행성·태양·은하수 텍스처는 <a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noopener">Solar System Scope</a>의 자료(CC BY 4.0)예요. NASA 탐사선과 관측 자료를 바탕으로 만든 지도입니다.</p>
      <p class="credits" style="margin-top:8px"><a href="about.html" target="_blank" rel="noopener">ORBIT 소개</a> · <a href="privacy.html" target="_blank" rel="noopener">개인정보처리방침</a></p>
      <div class="m-actions"><button type="button" class="btn" id="mClose">닫기</button></div>`);
    const c = this.card, on = (s, f) => { const el = c.querySelector(s); if (el) el.addEventListener("click", f); };
    c.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => this.planet(b.dataset.edit)));
    const pl = c.querySelector(".plist");
    sortable(pl, { item: ".pitem", handle: ".pitem", touchHandle: ".grip", onDrop: (ids, id) => { Store.reorderPlanets(ids, id); } });
    pl.addEventListener("keydown", e => {
      const g = e.target.closest(".grip"); if (!g || !["ArrowUp", "ArrowDown"].includes(e.key)) return;
      e.preventDefault(); const row = g.closest(".pitem"), ids = Store.planets().map(p => p.id), i = ids.indexOf(row.dataset.id), j = i + (e.key === "ArrowUp" ? -1 : 1);
      if (j < 0 || j >= ids.length) return;
      ids.splice(j, 0, ids.splice(i, 1)[0]); Store.reorderPlanets(ids, row.dataset.id);
      const sib = e.key === "ArrowUp" ? row.previousElementSibling : row.nextElementSibling.nextElementSibling; pl.insertBefore(row, sib); g.focus();
    });
    on("#mAdd", () => this.planet(null)); on("#mCal", () => CalSync.open()); on("#mClose", () => this.close());
    on("#mSpin", e => { const b = e.currentTarget, v = !Scene.autoRotate; Scene.setAutoRotate(v); b.classList.toggle("on", v); b.setAttribute("aria-checked", v); });
    on("#mNotify", e => { const b = e.currentTarget, v = !Native.on(); Native.setOn(v); b.classList.toggle("on", v); b.setAttribute("aria-checked", v); });
    on("#mCoach", () => { this.close(); App.coach(true); });
    on("#mSfx", e => { const b = e.currentTarget, v = !Juice.on(); Store.setSetting("sfx", v); b.classList.toggle("on", v); b.setAttribute("aria-checked", v); if (v) Juice.sfx("done"); });
    on("#mNames", e => { const b = e.currentTarget, v = !Scene.showNames; Scene.setNames(v); b.classList.toggle("on", v); b.setAttribute("aria-checked", v); });
    on("#mInstall", async () => { const p = App.installPrompt; if (!p) return; p.prompt(); try { await p.userChoice; } catch (e) { /* 무시 */ } App.installPrompt = null; this.close(); });
    on("#mExport", () => { try { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([Store.exportJSON()], { type: "application/json" })); a.download = `orbit-todo-${U.today()}.json`; a.click(); App.toast("download", "JSON 파일로 내보냈어요"); } catch (e) { App.toast("alert", "내보내지 못했어요. 복사를 이용해 주세요"); } });
    on("#mCopy", () => { navigator.clipboard.writeText(Store.exportJSON()).then(() => App.toast("copy", "클립보드에 복사했어요")).catch(() => App.toast("alert", "복사할 수 없는 환경이에요")); });
    c.querySelector("#mFile").addEventListener("change", e => {
      const f = e.target.files[0]; if (!f) return; const r = new FileReader();
      r.onload = () => { try { Store.importJSON(r.result); this.close(); App.toast("upload", "데이터를 가져왔어요"); } catch (err) { App.toast("alert", `가져오지 못했어요: ${err.message}`); } };
      r.readAsText(f);
    });
    on("#mSample", () => this.confirm({ title: "예시 데이터로 시작", desc: "지금 데이터를 모두 지우고 예시 행성과 할 일로 바꿔요.", ok: "바꾸기", onOk: () => { Store.reset(true); App.toast("sparkle", "예시 데이터를 불러왔어요"); } }));
    on("#mReset", () => this.confirm({ title: "모두 지우기", desc: "모든 행성과 할 일이 지워지고 되돌릴 수 없어요.", ok: "모두 지우기", onOk: () => { Store.reset(false); App.toast("orbit", "빈 우주에서 다시 시작해요"); } }));
  },
  planet(id) {
    const ex = id ? Store.planet(id) : null, used = new Set(Store.planets().filter(p => !ex || p.id !== ex.id).map(p => p.body));
    let body = ex ? bodyKey(ex) : Store.freeBody();
    this.show(`<h3>${ex ? "행성 편집" : "새 행성"}</h3><p class="desc">${ex ? "이름과 천체를 바꿀 수 있어요." : "새 카테고리가 태양 주위에 새 행성으로 떠올라요."}</p>
      <input type="text" id="pName" value="${U.esc(ex ? ex.name : "")}" placeholder="예: 업무, 공부, 건강" maxlength="14" aria-label="행성 이름">
      <h4>천체 고르기</h4>
      <div class="bodies">${BODY_ORDER.map(k => { const b = BODIES[k]; return `<button type="button" class="body-opt ${k === body ? "on" : ""} ${used.has(k) ? "used" : ""}" data-body="${k}" style="--c:${b.color}" aria-pressed="${k === body}">${thumbImg(k, 60)}<span class="ko">${b.ko}</span><span class="en">${b.en.toUpperCase()}</span></button>`; }).join("")}</div>
      <div class="m-actions">${ex && Store.planets().length > 1 ? `<button type="button" class="btn danger left" id="pDel">${ico("trash", 15)}삭제</button>` : ""}<button type="button" class="btn" id="pCancel">취소</button><button type="button" class="btn sol" id="pSave">${ex ? "저장" : "행성 만들기"}</button></div>`);
    const c = this.card;
    c.querySelectorAll("[data-body]").forEach(b => b.addEventListener("click", () => { body = b.dataset.body; c.querySelectorAll("[data-body]").forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b); }); }));
    const save = () => {
      const name = c.querySelector("#pName").value.trim(); if (!name) { c.querySelector("#pName").focus(); return; }
      if (ex) { Store.updatePlanet(ex.id, { name, body }); App.toast("orbit", `「${name}」 행성을 수정했어요`); }
      else { const p = Store.addPlanet({ name, body }); QuickAdd.planetId = p.id; QuickAdd.paint(); App.toast("sparkle", `「${name}」 행성이 태어났어요`); }
      this.close();
    };
    c.querySelector("#pSave").addEventListener("click", save);
    c.querySelector("#pName").addEventListener("keydown", e => { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); save(); } });
    c.querySelector("#pCancel").addEventListener("click", () => this.close());
    const del = c.querySelector("#pDel"); if (del) del.addEventListener("click", () => this.deletePlanet(ex.id));
  },
  deletePlanet(id) {
    const p = Store.planet(id), others = Store.planets().filter(x => x.id !== id), n = Store.tasksOf(id).length;
    this.show(`<h3>「${U.esc(p.name)}」 행성 삭제</h3><p class="desc">${n ? `이 행성에 할 일이 ${n}개 있어요. 어떻게 할까요?` : "이 행성에는 할 일이 없어요."}</p>
      ${n ? `<label class="radio-row"><input type="radio" name="pdel" value="move" checked>다른 행성으로 옮기기<select id="pMoveTo" class="field-input">${others.map(o => `<option value="${o.id}">${U.esc(o.name)}</option>`).join("")}</select></label><label class="radio-row"><input type="radio" name="pdel" value="del">할 일도 함께 삭제</label>` : ""}
      <div class="m-actions"><button type="button" class="btn" id="dCancel">취소</button><button type="button" class="btn danger" id="dOk">삭제</button></div>`);
    const c = this.card;
    c.querySelector("#dCancel").addEventListener("click", () => this.close());
    c.querySelector("#dOk").addEventListener("click", () => {
      const mode = n ? c.querySelector("input[name=pdel]:checked").value : "del", to = mode === "move" ? c.querySelector("#pMoveTo").value : null;
      if (Panel.mode === "planet" && Panel.id === id) Panel.close();
      Store.removePlanet(id, to); this.close(); App.toast("orbit", `「${p.name}」 행성이 사라졌어요`);
    });
  },
};

/* ═══════════════ PWA: 설치 · 서비스 워커 ═══════════════ */
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); App.installPrompt = e; });
window.addEventListener("appinstalled", () => { App.installPrompt = null; App.toast("install", "앱으로 설치됐어요"); });
if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => { /* 호스팅 환경에서만 동작 */ }); });
}
document.addEventListener("DOMContentLoaded", () => App.init());
