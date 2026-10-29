/* ═══════════════ 앱: 탭 · 머리글 · 테마 · 단축키 · 동작 · 알림 ═══════════════
   화면은 4개 탭(오늘 · 예정 · 행성 · 우주). 휴대폰은 아래 탭과 + 버튼, 넓은 화면은 왼쪽 메뉴와 목록 위 입력창. */
"use strict";

const $ = sel => document.querySelector(sel);

const App = {
  tab: "today", day: null, installPrompt: null, _hold: 0, _done: -1, _completing: new Set(),
  TABS: [["today", "오늘", "sun"], ["upcoming", "예정", "calendar"], ["planets", "행성", "orbit"], ["universe", "우주", "sparkle"]],
  init() {
    if (window.ORBIT_NATIVE === "ios") document.documentElement.classList.add("native-ios");
    Store.load(); this.day = U.today(); this.applyTheme(); Juice.init(); FocusScope.init(); ViewportState.init();
    document.querySelectorAll("[data-ico]").forEach(el => { el.outerHTML = ico(el.dataset.ico, el.closest(".fab") ? 28 : 20); });
    Scene.init(); Panel.init(); Calendar.init(); QuickAdd.init(); Palette.init(); Views.init(); Focus.init(); GCal.init(); Native.init();
    this.renderNav();
    const on = (sel, ev, fn) => { const el = $(sel); if (el) el.addEventListener(ev, fn); };
    on("#searchBtn", "click", () => Palette.open()); on("#sideSearch", "click", () => Palette.open());
    on("#settingsBtn", "click", () => Modal.settings()); on("#sideSettings", "click", () => Modal.settings());
    on("#sideAddPlanet", "click", () => Modal.planet(null));
    on("#topBack", "click", () => Views.back());
    on("#fab", "click", () => QuickAdd.open());
    on("#composerScrim", "click", () => QuickAdd.close());
    on("#cmdClose", "click", () => QuickAdd.close());
    on("#modal", "click", e => { if (e.target.closest("[data-close]")) Modal.close(); });
    on("#tabbar", "click", e => { const b = e.target.closest("[data-tab]"); if (b) this.setTab(b.dataset.tab); });
    on("#sideNav", "click", e => { const b = e.target.closest("[data-tab]"); if (b) { if (b.dataset.tab === "planets") { Views.planetId = null; Views.allMode = false; } this.setTab(b.dataset.tab, true); } });
    on("#sidePlanets", "click", e => { const b = e.target.closest("[data-pid]"); if (b) Views.openPlanet(b.dataset.pid); });
    on("#viewCtl", "click", e => {
      const b = e.target.closest("[data-vc]"); if (!b) return; const a = b.dataset.vc;
      if (a === "in") Scene.zoomBy(0.82); else if (a === "out") Scene.zoomBy(1.22); else if (a === "reset") Scene.resetView();
      else if (a === "spin") Scene.setAutoRotate(!Scene.autoRotate); else if (a === "help") this.coach(true);
    });
    on("#focusChip", "click", e => { if (e.target.closest("[data-act=back]")) { Scene.focusOn(null); this.renderUni(); } });
    on("#coach", "click", e => { if (e.target.closest("[data-act]")) this.coach(false); });
    on("#uniFilter", "click", e => { const b = e.target.closest("[data-f]"); if (!b) return; Store.setSetting("uniFilter", b.dataset.f); Scene.setView(b.dataset.f); this.paintUniFilter(); });
    on("#uniCard", "click", e => this.onUniClick(e));
    on("#demoBanner button", "click", () => Welcome.leaveDemo());
    this.paintSpin(); this.paintUniFilter(); Scene.setView(Store.state.settings.uniFilter === "all" ? "all" : "today");
    Intro.after(() => { if (Store.state.settings.welcomePending) Welcome.open(); });
    document.addEventListener("keydown", e => this.onKey(e));
    Store.on(d => this.onChange(d));
    const hash = location.hash.replace("#", ""), st = Store.state.settings;
    const legacy = { calendar: "upcoming", list: "planets", all: "today" }[st.view] || st.view;
    this.setTab(this.TABS.some(t => t[0] === hash) ? hash : this.TABS.some(t => t[0] === st.tab) ? st.tab : this.TABS.some(t => t[0] === legacy) ? legacy : "today");
    Welcome.renderBanner();
    setInterval(() => { Panel.tick(); Views.tick(); Focus.tick(); this.renderHeader(); }, 1000);
    setInterval(() => this.checkDay(), 30000);
    this.away(); setInterval(() => this.away(), 60000);
    try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => this.applyTheme()); } catch (_) { /* 오래된 브라우저 */ }
    window.addEventListener("resize", () => { this.renderNav(); });
    Intro.run();
  },

  /* ── 테마 · 글자 크기 ── */
  applyTheme() {
    const st = Store.state.settings, root = document.documentElement, theme = st.theme === "light" || st.theme === "dark" ? st.theme : "system";
    if (theme === "system") delete root.dataset.theme; else root.dataset.theme = theme;
    if (st.textSize === "l") root.dataset.text = "l"; else delete root.dataset.text;
    const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    const m = $("#themeColor"); if (m) m.setAttribute("content", this.tab === "universe" ? "#05060a" : dark ? "#0F1115" : "#F4F5F8");
    document.body.classList.toggle("theme-dark", dark);
    if (typeof Juice !== "undefined") Juice.dark = dark || this.tab === "universe";
  },

  /* ── 탭 ── */
  setTab(tab, fromSide) {
    if (!this.TABS.some(t => t[0] === tab)) tab = "today";
    const was = this.tab; this.tab = tab; document.body.dataset.tab = tab;
    document.body.classList.toggle("tab-universe", tab === "universe");
    for (const [k] of this.TABS) { const v = $(`#v${k[0].toUpperCase()}${k.slice(1)}`); if (v) v.hidden = k !== tab; }
    Store.setSetting("tab", tab);
    if (was === tab && tab === "planets" && !fromSide && (Views.planetId || Views.allMode)) Views.back();
    Scene.setActive(tab === "universe");
    if (tab === "universe") { this.renderUni(); if (!Store.state.settings.coachSeen) setTimeout(() => { if (this.tab === "universe" && !Store.state.settings.coachSeen) this.coach(true); }, 900); }
    else this.coach(false, true);
    this.renderNav(); this.renderHeader(); Views.render(); QuickAdd.onTab(); this.applyTheme();
    if (tab !== "universe") requestAnimationFrame(() => Views.fit());
  },
  renderNav() {
    const counts = this.counts();
    const tb = $("#tabbar");
    if (tb) tb.innerHTML = this.TABS.map(([k, l, i]) => `<button type="button" class="tab ${this.tab === k ? "on" : ""}" data-tab="${k}" aria-current="${this.tab === k ? "page" : "false"}">${ico(i, 26)}<span>${l}</span></button>`).join("");
    const sn = $("#sideNav");
    if (sn) sn.innerHTML = this.TABS.map(([k, l, i]) => `<button type="button" class="nav ${this.tab === k && !(k === "planets" && Views.planetId) ? "on" : ""}" data-tab="${k}" aria-current="${this.tab === k ? "page" : "false"}">${ico(i, 22)}${l}${counts[k] ? `<span class="n">${counts[k]}</span>` : ""}</button>`).join("");
    this.renderSide();
  },
  counts() {
    const today = U.today(), wk = U.addDays(today, 7), open = Store.tasks().filter(t => t.status !== "done");
    return { today: Store.todayTasks().filter(t => t.status !== "done").length, upcoming: open.filter(t => t.due && t.due > today && t.due <= wk).length, planets: open.length };
  },
  renderSide() {
    const box = $("#sidePlanets"); if (!box || innerWidth < 900) return;
    const html = Store.planets().map(p => { const n = Store.tasksOf(p.id).filter(t => t.status !== "done").length; return `<button type="button" class="nav planet ${this.tab === "planets" && Views.planetId === p.id ? "on" : ""}" data-pid="${p.id}">${thumbImg(bodyKey(p), 22)}<span>${U.esc(p.name)}</span>${n ? `<span class="n">${n}</span>` : ""}</button>`; }).join("");
    if (box._h !== html) { box.innerHTML = html; box._h = html; }
    const c = this.counts(); $("#sideNav")?.querySelectorAll("[data-tab]").forEach(b => { const n = b.querySelector(".n"), v = c[b.dataset.tab]; if (n) n.textContent = v; });
  },
  /* 머리글: 탭 이름 · 날짜 · 오늘 진행 */
  renderHeader() {
    const tab = this.tab, title = $("#viewTitle"), sub = $("#viewSub"), back = $("#topBack"); if (!title) return;
    let t = "", s = "", backLbl = "";
    if (tab === "today") {
      const st = Store.todayStats(), burn = Store.burnedToday(), d = U.parseDate(U.today()), pct = st.total ? st.done / st.total : 0;
      t = "오늘";
      s = `<span>${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAYS[d.getDay()]}요일</span><span class="grow"></span>${st.overdue ? `<span class="late">지난 일 ${st.overdue}</span>` : ""}<span class="prog"><span class="ring" id="progressBtn" aria-hidden="true"><svg viewBox="0 0 40 40" width="26" height="26"><circle class="ring-bg" cx="20" cy="20" r="16.5"></circle><circle class="ring-fg" cx="20" cy="20" r="16.5" style="stroke-dashoffset:${(103.67 * (1 - pct)).toFixed(2)}"></circle></svg></span><b class="num">${st.done}/${st.total}</b>${burn >= 60 || st.doing ? `<span class="fire">집중 ${U.fmtDuration(burn)}</span>` : ""}</span>`;
    } else if (tab === "upcoming") { t = "예정"; const n = this.counts().upcoming; s = `<span>${n ? `앞으로 7일 동안 ${n}개` : "앞으로 7일 동안 예정된 일이 없어요"}</span>`; }
    else if (tab === "planets") {
      const p = Views.planetId && Store.planet(Views.planetId);
      if (p) { t = p.name; backLbl = "행성"; s = ""; }
      else if (Views.allMode) { t = "모든 할 일"; backLbl = "행성"; }
      else { t = "행성"; s = `<span>카테고리 ${Store.planets().length}개 · 남은 할 일 ${Store.tasks().filter(x => x.status !== "done").length}개</span>`; }
    } else { t = "우주"; }
    if (title.textContent !== t) title.textContent = t;
    if (this._hold > 0 && tab === "today") return;
    if (sub._h !== s) {
      const ring = sub.querySelector(".ring-fg"), prevDone = this._done;
      sub.innerHTML = s; sub._h = s; sub.hidden = !s;
      const st = Store.todayStats();
      if (tab === "today" && prevDone >= 0 && st.done > prevDone && ring) { const r = $("#progressBtn"); if (r) { r.classList.remove("bump"); void r.offsetWidth; r.classList.add("bump"); } }
    }
    if (tab === "today") this._done = Store.todayStats().done;
    back.hidden = !backLbl; if (backLbl) $("#topBackLbl").textContent = backLbl;
  },
  paintSpin() { const b = $("#vcSpin"); if (!b) return; const on = Scene.autoRotate; b.innerHTML = ico(on ? "pause" : "play", 18); b.setAttribute("aria-pressed", on); b.title = on ? "자동 회전 멈추기  R" : "자동 회전 켜기  R"; },
  paintUniFilter() { const f = Store.state.settings.uniFilter === "all" ? "all" : "today"; $("#uniFilter")?.querySelectorAll("[data-f]").forEach(b => { const on = b.dataset.f === f; b.classList.toggle("on", on); b.setAttribute("aria-selected", String(on)); }); },

  /* ── 우주 탭: 고른 행성의 할 일 카드 ── */
  renderUni() {
    const box = $("#uniCard"); if (!box) return;
    const id = Scene.focusId, p = id && Store.planet(id);
    if (!p) {
      const doing = Store.tasks().filter(t => t.status === "doing");
      box.hidden = !doing.length;
      box.innerHTML = doing.length ? Focus.card(doing.sort((a, b) => b.startedAt - a.startedAt)[0]) : "";
      return;
    }
    const list = Store.tasksOf(p.id).filter(t => t.status !== "done").sort(Store.sortTasks);
    box.hidden = false;
    box.innerHTML = `<div class="hdr">${thumbImg(bodyKey(p), 36)}<div><b>${U.esc(p.name)}</b><br><span>남은 할 일 ${list.length}개</span></div><span class="grow"></span><button type="button" class="btn sm" data-act="uni-list">목록으로</button></div>${list.length ? `<div class="group">${list.slice(0, 3).map(t => Views.row(t, { planet: false })).join("")}</div>` : ""}`;
  },
  onUniClick(e) {
    const a = e.target.closest("[data-act]"), row = e.target.closest("[data-task]"), fc = e.target.closest(".fcard");
    const act = a && a.dataset.act, t = row && Store.task(row.dataset.task);
    if (act === "uni-list") { const id = Scene.focusId; Scene.focusOn(null); Views.openPlanet(id); return; }
    if (act === "f-done" && fc) { this.completeTask(fc.dataset.id, a); return; }
    if (act === "f-stop" && fc) { this.stopTask(fc.dataset.id); return; }
    if (fc) { Focus.open(fc.dataset.id); return; }
    if (act === "check" && t) { this.completeTask(t.id, a); return; }
    if (act === "fire" && t) { if (t.status === "doing") this.stopTask(t.id); else this.startTask(t.id, a); return; }
    if (row) this.openTask(row.dataset.task);
  },
  /* 3D 조작 안내 (우주 탭에서 처음 한 번, 이후 ? 버튼) */
  coach(show, silent) {
    const el = $("#coach"); if (!el) return;
    if (!show) { if (!el.hidden) { el.hidden = true; if (!silent) Store.setSetting("coachSeen", true); } return; }
    const touch = Scene.touch, rows = touch
      ? [["한 손가락", "빈 곳을 끌면 시점이 돌아가요"], ["두 손가락", "오므리거나 벌려 확대·축소"], ["행성 누르기", "가까이 다가가 할 일을 보여 줘요"], ["위성 끌기", "태양에 놓으면 집중, 다른 행성에 놓으면 옮겨져요"], ["행성 끌기", "궤도를 따라 다른 자리에 놓으면 순서가 바뀌어요"]]
      : [["끌기", "빈 곳을 끌면 시점이 돌아가요"], ["휠", "확대·축소"], ["행성 클릭", "가까이 다가가 할 일을 보여 줘요"], ["위성 끌기", "태양에 놓으면 집중, 다른 행성에 놓으면 옮겨져요"], ["행성 끌기", "궤도를 따라 다른 자리에 놓으면 순서가 바뀌어요"]];
    el.innerHTML = `<div class="coach-h"><span>우주 조작 안내</span><button type="button" class="icon-btn sm" data-act="close" aria-label="닫기">${ico("x", 18)}</button></div>
      <ul class="coach-list">${rows.map(([k, v]) => `<li><span class="ck">${k}</span><span>${v}</span></li>`).join("")}</ul>
      <div class="coach-foot"><button type="button" class="btn sol sm" data-act="ok">알겠어요</button></div>`;
    el.hidden = false;
  },

  /* ── 데이터가 바뀌면 ── */
  onChange(d) {
    const snap = d.silent ? null : Juice.snap();
    Scene.sync(d);
    if (!d.silent) { Panel.refresh(); Views.render(); if (this.tab === "universe") this.renderUni(); }
    Focus.refresh();
    this.renderHeader(); this.renderNav(); QuickAdd.refresh(); Welcome.renderBanner();
    Juice.flip(snap, d.type === "task-add" ? new Set([d.id]) : null);
  },
  checkDay() { if (this.day !== U.today()) { this.day = U.today(); Scene.sync({ type: "day" }); Panel.refresh(); Views.render(); this.renderHeader(); QuickAdd.onTab(); } },
  /* 앱이 꺼져 있었거나 컴퓨터가 잠든 시간은 집중 시간에서 뺀다 */
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

  /* ── 단축키 ── */
  onKey(e) {
    if (e.defaultPrevented || e.isComposing) return;
    const ae = document.activeElement, typing = ae && (/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) || ae.isContentEditable);
    if (e.key === "Escape") {
      if (Scene.cancelDrag()) return;
      if (PrioMenu.el) return PrioMenu.close();
      if (!$("#palette").hidden) return Palette.close();
      if (!$("#modal").hidden) return Modal.close();
      if (QuickAdd.closePops(true)) return;
      if (QuickAdd.isOpen()) return QuickAdd.close();
      if (!$("#focusScreen").hidden) return Focus.close();
      if (!$("#coach").hidden) return this.coach(false);
      if (!$("#sheet").hidden) return Panel.close();
      if (typing) { ae.blur(); return; }
      if (Scene.focusId) { Scene.focusOn(null); this.renderUni(); return; }
      if (this.tab === "planets" && (Views.planetId || Views.allMode)) return Views.back();
      return;
    }
    if (!$("#modal").hidden || !$("#palette").hidden || !$("#focusScreen").hidden) return;
    if (!$("#sheet").hidden && $("#sheet").getAttribute("aria-modal") === "true") return;
    if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) { e.preventDefault(); Palette.open(); return; }
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (k === "n" || k === "N" || k === "ㅜ") { e.preventDefault(); QuickAdd.open(); }
    else if (k === "/") { e.preventDefault(); Palette.open(); }
    else if (k === "1") this.setTab("today"); else if (k === "2") this.setTab("upcoming"); else if (k === "3") this.setTab("planets"); else if (k === "4") this.setTab("universe");
    else if (this.tab === "universe") {
      if (k === "+" || k === "=") Scene.zoomBy(0.82); else if (k === "-" || k === "_") Scene.zoomBy(1.22);
      else if (k === "0") Scene.resetView(); else if (k === "r" || k === "R" || k === "ㄱ") Scene.setAutoRotate(!Scene.autoRotate);
      else if (k === "?") this.coach($("#coach").hidden);
      else if (k === "ArrowLeft" || k === "ArrowRight") { e.preventDefault(); Scene.rotateBy(k === "ArrowLeft" ? 0.22 : -0.22, 0); }
      else if (k === "ArrowUp" || k === "ArrowDown") { e.preventDefault(); Scene.rotateBy(0, k === "ArrowUp" ? 0.1 : -0.1); }
    } else if (this.tab === "upcoming" && Views.upMode === "cal" && (k === "ArrowLeft" || k === "ArrowRight") && !e.target.closest(".cal-cell")) { e.preventDefault(); Calendar.move(k === "ArrowLeft" ? -1 : 1); }
  },

  /* ── 열기 ── */
  openTask(id) { if (!Store.task(id)) return; Panel.open("task", id); },
  openPlanet(id) {
    if (!Store.planet(id)) return;
    if (this.tab === "universe") { Scene.focusOn(id); this.renderUni(); return; }
    Views.openPlanet(id);
  },
  openDay(date) { Views.showDate(date); },
  openToday() { if (this.tab === "universe") { Scene.focusOn(null); this.renderUni(); } else this.setTab("today"); },
  openNoDue() { Views.openAll("nodue"); },

  /* ── 집중 시작 · 멈춤 ── */
  startTask(id, src) {
    const t = Store.task(id); if (!t || t.status === "doing") return;
    const el = src && src.isConnected ? src : null, from = el ? Juice.center(el) : this.moonAt(id);
    if (el) { el.classList.remove("j-ign"); void el.offsetWidth; el.classList.add("j-ign"); }
    if (!Scene.lastPos.has(id)) { const m = this.moonAt(id); if (m) Scene.lastPos.set(id, { x: m.x, y: m.y, t0: Scene.time }); }
    Store.startTask(id);
    const target = () => { const s = document.querySelector(`.fcard[data-id="${id}"] .sunball`); return s && s.getClientRects().length ? Juice.center(s) : null; };
    Juice.ignite(from, () => { const c = document.querySelector(`.fcard[data-id="${id}"]`); if (c) { c.classList.remove("ignite"); void c.offsetWidth; c.classList.add("ignite"); } }, target());
    this.toast("flame", `「${t.title}」 집중 시작`);
  },
  stopTask(id) {
    const t = Store.task(id); if (!t || t.status !== "doing") return;
    Store.stopTask(id); Juice.sfx("pause"); Juice.buzz("pause");
    this.toast("pause", `「${t.title}」 집중을 멈췄어요`, () => Store.startTask(id));
  },
  /* 완료: 누른 즉시 체크가 터지고(소리 · 진동), 잠깐 뒤 줄이 빠져나가며 빛이 진행 링으로 날아간다 */
  completeTask(id, src) {
    const t = Store.task(id); if (!t || t.status === "done" || this._completing.has(id)) return;
    const btn = src && src.isConnected ? src : null, row = btn && btn.closest(".tk, .fcard, .cal-task, .wk-task, .cal-agenda-task");
    Juice.check(btn, row && !row.classList.contains("fcard") ? row : null);
    if (!btn) { this.commitDone(id, null, null); return; }
    this._completing.add(id);
    setTimeout(() => { this._completing.delete(id); this.commitDone(id, btn, row); }, 280);
  },
  commitDone(id, btn, row) {
    const t = Store.task(id); if (!t || t.status === "done") return;
    const from = btn && btn.isConnected && btn.getClientRects().length ? Juice.center(btn) : this.moonAt(id);
    const ghost = row && !row.classList.contains("fcard") ? Juice.ghost(row) : null;
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
  /* 내일로 미루기 (휴대폰에서 줄을 왼쪽으로 밀기) */
  postpone(id) {
    const t = Store.task(id); if (!t) return;
    const prev = { due: t.due, myDay: t.myDay }, tm = U.addDays(U.today(), 1);
    Store.updateTask(id, { due: tm, myDay: null }); Juice.sfx("pause"); Juice.buzz("pause");
    this.toast("calendar", `「${t.title}」 내일로 미뤘어요`, () => Store.updateTask(id, prev));
  },
  /* 3D 위성(또는 태양 곁 불덩이)의 화면 위치 (우주 탭일 때만) */
  moonAt(id) {
    if (!Scene.active) return null;
    for (const s of Scene.systems.values()) { const m = s.moons.get(id); if (m && !m.hidden) return { x: m.sx, y: m.sy }; }
    const o = Scene.orbs.get(id); return o ? { x: o.sx, y: o.sy } : null;
  },
  deleteTask(id) {
    const t = Store.removeTask(id); if (!t) return;
    if (Panel.mode === "task" && Panel.id === id) Panel.close();
    this.toast("trash", `「${t.title}」 삭제`, () => Store.restoreTask(t));
  },
  toast(icon, msg, undo) {
    const box = $("#toasts");
    while (box.children.length >= 2) box.firstElementChild.remove();
    const el = document.createElement("div"); el.className = "toast"; el.setAttribute("role", "status");
    el.innerHTML = `${ico(icon, 20)}<span class="msg">${U.esc(msg)}</span>${undo ? `<button type="button" class="undo">되돌리기</button>` : ""}`;
    if (undo) el.querySelector(".undo").addEventListener("click", () => { undo(); el.remove(); });
    box.appendChild(el);
    setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 300); }, undo ? 5000 : 2600);
  },
};

/* ═══════════════ 빠른 추가: 넓은 화면은 목록 위 입력창, 휴대폰은 + 버튼으로 여는 시트 ═══════════════ */
const QuickAdd = {
  form: null, input: null, planetBtn: null, dateBtn: null, popP: null, popD: null, planetId: null, due: null, time: null, preview: null,
  init() {
    this.form = $("#cmd"); this.input = $("#cmdInput"); this.planetBtn = $("#cmdPlanet"); this.dateBtn = $("#cmdDate"); this.popP = $("#popPlanet"); this.popD = $("#popDate");
    this.form.addEventListener("submit", e => { e.preventDefault(); if (!this.composing) this.submit(); });
    this.input.addEventListener("compositionstart", () => { this.composing = true; });
    this.input.addEventListener("compositionend", () => { this.composing = false; this.live(); });
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
  mobile() { return innerWidth < 900; },
  isOpen() { return document.body.classList.contains("composing"); },
  open() {
    if (App.tab === "universe" && !this.mobile()) App.setTab("today");
    if (this.mobile()) { document.body.classList.add("composing"); $("#composerScrim").hidden = false; }
    /* iOS는 누른 순간(같은 이벤트 안)에 초점을 줘야 키보드가 올라온다 */
    this.onTab(); this.input.focus({ preventScroll: true });
    requestAnimationFrame(() => { if (document.activeElement !== this.input) this.input.focus({ preventScroll: true }); });
  },
  openWith(o = {}) { this.open(); if ("due" in o) this.setDue(o.due); if (o.planetId) { this.planetId = o.planetId; this.paint(); } },
  close() { this.closePops(); document.body.classList.remove("composing"); $("#composerScrim").hidden = true; if (document.activeElement === this.input) this.input.blur(); },
  /* 탭에 맞는 기본값: 오늘 탭은 오늘, 예정은 고른 날짜, 행성 화면은 그 행성 */
  onTab() {
    const tab = App.tab;
    if (tab === "today") this.setDue(U.today());
    else if (tab === "upcoming") this.setDue(Views.upMode === "cal" ? (Calendar.selected || U.today()) : (Views.upSel || U.addDays(U.today(), 1)));
    else this.setDue(null);
    if (tab === "planets" && Views.planetId) { this.planetId = Views.planetId; this.paint(); }
    this.input.placeholder = this.mobile() ? "할 일을 적어 주세요" : tab === "upcoming" ? "할 일 추가  ·  #행성  !1  날짜는 오른쪽에서" : "할 일 추가  ·  #행성  !1  내일 오후 3시";
  },
  refresh() { const ps = Store.planets(); if (!ps.length) return; if (!ps.find(p => p.id === this.planetId)) this.planetId = ps[0].id; this.paint(); if (!this.popP.hidden) this.renderPlanets(); },
  setDue(d) { this.due = d; if (!d) this.time = null; this.paint(); },
  paint() {
    const pv = this.preview || {}, p = Store.planet(pv.planetId || this.planetId) || Store.planets()[0]; if (!p) return;
    this.planetBtn.innerHTML = `${thumbImg(bodyKey(p), 28)}<span class="nm">${U.esc(p.name)}</span>${ico("chevDown", 16)}`;
    this.planetBtn.setAttribute("aria-label", `${p.name}에 추가 · 행성 선택`);
    const due = pv.due || this.due, time = pv.time || this.time;
    const txt = due ? `${U.relDate(due)}${time ? " " + U.fmtTime(time) : ""}` : "기한 없음";
    this.dateBtn.querySelector(".txt").textContent = txt; this.dateBtn.classList.toggle("on", !!due);
    this.dateBtn.setAttribute("aria-label", `마감일: ${due ? U.fmtDate(due, true) : "기한 없음"}${time ? " " + U.fmtTime(time) : ""}`);
    const pr = pv.priority || this.prio || 0;
    this.prioBtn.innerHTML = `${prioSvg(pr, 16)}<span class="txt">${pr ? PRIO[pr].ko : "우선순위"}</span>`;
    this.prioBtn.classList.toggle("on", !!pr); this.prioBtn.style.setProperty("--pc", PRIO[pr].color);
    this.prioBtn.setAttribute("aria-label", `우선순위: ${PRIO[pr].ko}`);
    this.form.classList.toggle("has-preview", !!this.preview);
    const hint = $("#cmdHint"); if (hint) hint.textContent = this.preview ? `${p.name} · ${pr ? PRIO[pr].ko + " 우선순위 · " : ""}${txt}에 추가됩니다` : "";
    const line = $("#cmdHintLine"); if (line) line.textContent = this.preview ? `「${p.name}」 · ${txt}${pr ? ` · ${PRIO[pr].ko}` : ""}에 추가돼요` : "#행성 · !1 · 「내일 오후 3시」처럼 써도 알아들어요";
  },
  live() { const q = U.parseQuick(this.input.value, Store.planets()); this.preview = q.planetId || q.due || q.time || q.priority ? { planetId: q.planetId, due: q.due, time: q.time, priority: q.priority } : null; this.paint(); },
  toggle(which) {
    const map = { planet: [this.popP, this.planetBtn, () => this.renderPlanets()], date: [this.popD, this.dateBtn, () => this.renderDates()], prio: [this.popPr, this.prioBtn, () => this.renderPrio()] };
    const [pop, btn, render] = map[which], open = pop.hidden;
    this.closePops();
    if (open) { render(); pop.hidden = false; btn.classList.add("open"); btn.setAttribute("aria-expanded", "true"); requestAnimationFrame(() => pop.querySelector("button")?.focus({ preventScroll: true })); }
  },
  closePops(restoreFocus = false) {
    const pops = [this.popP, this.popD, this.popPr], was = pops.some(p => p && !p.hidden);
    const active = pops.findIndex(p => p && !p.hidden && p.contains(document.activeElement));
    pops.forEach(p => { if (p) p.hidden = true; }); [this.planetBtn, this.dateBtn, this.prioBtn].forEach(b => { if (b) { b.classList.remove("open"); b.setAttribute("aria-expanded", "false"); } });
    if (restoreFocus && active >= 0) [this.planetBtn, this.dateBtn, this.prioBtn][active]?.focus();
    return was;
  },
  renderPrio() { this.popPr.innerHTML = `<div class="pop-title">우선순위 <span class="sub">입력창에 !1 !2 !3</span></div>` + PRIO_ORDER.map(p => `<button type="button" class="pop-item" data-p="${p}">${prioSvg(p, 18)}<span class="lbl">${PRIO[p].ko}</span>${p ? `<span class="sub">!${p}</span>` : ""}${(this.prio || 0) === p ? `<span class="chk">${ico("check", 18)}</span>` : ""}</button>`).join(""); },
  renderPlanets() {
    this.popP.innerHTML = `<div class="pop-title">어느 행성에 넣을까요</div>` + Store.planets().map(p => `<button type="button" class="pop-item" data-pid="${p.id}">${thumbImg(bodyKey(p), 30)}<span class="lbl">${U.esc(p.name)}</span><span class="sub">${Store.tasksOf(p.id).filter(t => t.status !== "done").length}</span>${p.id === this.planetId ? `<span class="chk">${ico("check", 18)}</span>` : ""}</button>`).join("")
      + `<div class="pop-sep"></div><button type="button" class="pop-item" data-new>${ico("plus", 20)}<span class="lbl">새 행성 만들기</span></button>`;
  },
  renderDates() {
    const t = U.today(), opts = [["오늘", t], ["내일", U.addDays(t, 1)], ["모레", U.addDays(t, 2)], ["다음 주", U.addDays(t, 7)], ["기한 없음", ""]];
    this.popD.innerHTML = `<div class="pop-title">마감일</div><div class="pop-grid">${opts.map(([l, v]) => `<button type="button" class="pop-item" data-due="${v}"><span class="lbl">${l}</span>${v ? `<span class="sub">${U.weekday(v)}</span>` : ""}${(this.due || "") === v ? `<span class="chk">${ico("check", 18)}</span>` : ""}</button>`).join("")}</div><div class="pop-sep"></div><div class="pop-row"><input type="date" id="qaDate" value="${this.due || ""}" aria-label="날짜"><input type="time" id="qaTime" value="${this.time || ""}" aria-label="시간"></div>`;
  },
  submit() {
    const q = U.parseQuick(this.input.value, Store.planets()); if (!q.title) { this.input.focus(); return; }
    const due = q.due || this.due;
    const data = { title: q.title, planetId: q.planetId || this.planetId, priority: q.priority || this.prio || 0, due, time: q.time || this.time || null };
    if (App.tab === "today" && !due) data.myDay = U.today();
    const t = Store.addTask(data); if (!t) return;
    Juice.pop(this.form.querySelector(".cmd-go"), "add");
    this.input.value = ""; this.preview = null; this.prio = 0; this.closePops(); this.paint();
    const p = Store.planet(t.planetId);
    App.toast("orbit", `「${t.title}」 추가 · ${p ? p.name : ""}${t.due ? ` · ${U.relDate(t.due)}` : ""}`);
    if (App.tab === "today" && !Store.isTodayTask(t)) setTimeout(() => App.toast("calendar", "오늘이 아닌 할 일은 「예정」 탭에 있어요"), 500);
  },
};

/* ═══════════════ 검색 (/ 또는 Ctrl+K) ═══════════════ */
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
  open() { this.el.hidden = false; this.input.value = ""; this.idx = 0; this.run(); FocusScope.open(this.el, { initial: this.input }); },
  close() { this.el.hidden = true; FocusScope.close(this.el); },
  mark() { this.list.querySelectorAll(".pal-item").forEach((it, i) => { it.classList.toggle("active", i === this.idx); if (i === this.idx) it.scrollIntoView({ block: "nearest" }); }); },
  run() {
    const q = this.input.value.trim().toLowerCase();
    let list = q ? Store.tasks().filter(t => t.title.toLowerCase().includes(q) || (t.notes || "").toLowerCase().includes(q)) : Store.todayTasks().filter(t => t.status !== "done");
    list = list.sort(Store.sortTasks).slice(0, 14); this.items = list.map(t => t.id);
    const hl = s => { if (!q) return U.esc(s); const i = s.toLowerCase().indexOf(q); return i < 0 ? U.esc(s) : U.esc(s.slice(0, i)) + "<mark>" + U.esc(s.slice(i, i + q.length)) + "</mark>" + U.esc(s.slice(i + q.length)); };
    this.list.innerHTML = list.length ? (q ? "" : `<div class="pop-title">오늘 남은 할 일</div>`) + list.map((t, i) => {
      const p = Store.planet(t.planetId);
      return `<button type="button" class="pal-item ${i === this.idx ? "active" : ""}" data-id="${t.id}">${thumbImg(bodyKey(p), 28)}<span class="t ${t.status === "done" ? "done" : ""}">${hl(t.title)}</span><span class="m">${p ? U.esc(p.name) : ""}${t.due ? " · " + U.relDate(t.due) : ""}${t.status === "doing" ? " · 집중 중" : ""}</span></button>`;
    }).join("") : `<div class="pal-empty">${q ? `「${U.esc(q)}」와 맞는 할 일이 없어요` : "오늘 남은 할 일이 없어요"}</div>`;
  },
  pick(id) { this.close(); App.openTask(id); },
};

/* ═══════════════ 우선순위 고르기 메뉴 (숫자 1 2 3 0 으로도) ═══════════════ */
const PrioMenu = {
  el: null,
  open(anchor, cur, cb) {
    this.close();
    const el = document.createElement("div"); el.className = "pop prio-menu"; el.setAttribute("role", "menu");
    el.innerHTML = `<div class="pop-title">우선순위</div>` + PRIO_ORDER.map(p => `<button type="button" class="pop-item" data-p="${p}" role="menuitemradio" aria-checked="${cur === p}">${prioSvg(p, 18)}<span class="lbl">${PRIO[p].ko}</span><kbd>${p}</kbd>${cur === p ? `<span class="chk">${ico("check", 18)}</span>` : ""}</button>`).join("");
    document.body.appendChild(el);
    const r = anchor.getBoundingClientRect(), w = 230, h = el.offsetHeight;
    let x = r.left, y = r.bottom + 6; if (x + w > innerWidth - 8) x = innerWidth - w - 8; if (y + h > innerHeight - 8) y = r.top - h - 6;
    el.style.cssText = `left:${Math.max(8, x)}px;top:${Math.max(8, y)}px;width:${w}px;z-index:96`;
    el.addEventListener("click", e => { const it = e.target.closest("[data-p]"); if (!it) return; cb(+it.dataset.p); this.close(); });
    this._off = e => { if (!el.contains(e.target) && !anchor.contains(e.target)) this.close(); };
    this._key = e => { if (["0", "1", "2", "3"].includes(e.key)) { e.preventDefault(); e.stopPropagation(); cb(+e.key); this.close(); } else if (e.key === "Escape") { e.stopPropagation(); this.close(); } };
    setTimeout(() => { document.addEventListener("pointerdown", this._off, true); document.addEventListener("keydown", this._key, true); }, 0);
    this.el = el; requestAnimationFrame(() => el.querySelector(`[data-p="${cur}"]`)?.focus());
  },
  close() { if (!this.el) return; this.el.remove(); this.el = null; document.removeEventListener("pointerdown", this._off, true); document.removeEventListener("keydown", this._key, true); },
};

/* ═══════════════ PWA: 설치 · 서비스 워커 · 시작 ═══════════════ */
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); App.installPrompt = e; });
window.addEventListener("appinstalled", () => { App.installPrompt = null; App.toast("install", "앱으로 설치됐어요"); });
if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => { /* 호스팅 환경에서만 동작 */ }); });
}
document.addEventListener("DOMContentLoaded", () => App.init());
