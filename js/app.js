/* ═══════════════ 앱: 초기화, 보기 전환, 빠른 추가, 검색, 단축키, 토스트, 모달 ═══════════════ */
"use strict";

const App = {
  view: "today", day: null,
  init() {
    Store.load(); this.day = U.today();
    Sky.init(document.getElementById("sky")); FX.init(document.getElementById("fx"));
    Scene.init(); Panel.init(); Calendar.init(); QuickAdd.init(); Search.init();
    document.querySelectorAll(".view-tabs .tab").forEach(b => b.addEventListener("click", () => this.setView(b.dataset.view)));
    document.getElementById("settingsBtn").addEventListener("click", () => Modal.settings());
    document.getElementById("progressBtn").addEventListener("click", () => this.openToday());
    document.getElementById("modal").addEventListener("click", e => { if (e.target.closest("[data-action='modal-close']")) Modal.close(); });
    document.addEventListener("keydown", e => this.onKey(e));
    Store.on(d => this.onChange(d));
    const hash = (location.hash || "").replace("#", "");
    this.setView(["today", "all", "calendar"].includes(hash) ? hash : (Store.state.settings.view || "today"));
    this.renderDate(); this.updateProgress();
    setInterval(() => Panel.tickSecond(), 1000);
    setInterval(() => this.checkDay(), 30000);
    if (!Store.state.settings.hintSeen) { this.hint("🪐 위성(할 일)을 가운데 태양으로 끌어다 놓으면 집중이 시작됩니다", 9000); Store.setSetting("hintSeen", true); }
  },
  onChange(d) {
    Scene.sync(d);
    if (!d.silent) { Panel.refresh(d); Calendar.render(); }
    this.updateProgress(); QuickAdd.refreshPlanets();
  },
  setView(v) {
    if (!["today", "all", "calendar"].includes(v)) v = "today";
    this.view = v; document.body.dataset.view = v;
    document.querySelectorAll(".view-tabs .tab").forEach(b => b.setAttribute("aria-selected", b.dataset.view === v ? "true" : "false"));
    const cal = document.getElementById("calendar");
    if (v === "calendar") { cal.hidden = false; Calendar.render(); }
    else { cal.hidden = true; Scene.setFilter(v === "today" ? "today" : "all"); }
    Store.setSetting("view", v); QuickAdd.onView(v);
  },
  renderDate() { document.getElementById("todayLabel").textContent = U.fmtLong(U.today()); },
  updateProgress() {
    const s = Store.todayStats(), ring = document.getElementById("progressRing"), btn = document.getElementById("progressBtn");
    const pct = s.total ? s.done / s.total : 0;
    ring.style.strokeDashoffset = (113.1 * (1 - pct)).toFixed(1);
    document.getElementById("progressText").textContent = `${s.done}/${s.total}`;
    btn.classList.toggle("complete", s.total > 0 && s.done === s.total);
    btn.title = s.total ? `오늘 ${s.total}개 중 ${s.done}개 완료${s.doing ? ` · ${s.doing}개 진행 중` : ""}${s.overdue ? ` · ${s.overdue}개 지남` : ""}` : "오늘의 미션";
  },
  checkDay() { if (this.day !== U.today()) { this.day = U.today(); this.renderDate(); Scene.sync({ type: "day" }); Panel.refresh(); Calendar.render(); this.updateProgress(); QuickAdd.onView(this.view); } },
  onKey(e) {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    if (e.key === "Escape") {
      if (!document.getElementById("modal").hidden) { Modal.close(); return; }
      if (QuickAdd.closePops()) return;
      if (typing) { document.activeElement.blur(); Search.clear(); return; }
      if (!document.getElementById("panel").hidden) { Panel.close(); return; }
      return;
    }
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "n" || e.key === "N" || e.key === "ㅜ") { e.preventDefault(); QuickAdd.input.focus(); }
    else if (e.key === "/") { e.preventDefault(); Search.input.focus(); }
    else if (e.key === "1") this.setView("today");
    else if (e.key === "2") this.setView("all");
    else if (e.key === "3") this.setView("calendar");
    else if (e.key === "t" || e.key === "T") this.openToday();
  },

  /* ── 열기 ── */
  openTask(id) { if (Store.task(id)) Panel.open("task", id); },
  openPlanet(id) { if (Store.planet(id)) Panel.open("planet", id); },
  openDay(date) { Panel.open("day", null, date); },
  openToday() { Panel.open("today"); },
  openNoDue() { Panel.open("nodue"); },

  /* ── 동작 ── */
  startTask(id) {
    const t = Store.task(id); if (!t || t.status === "doing") return;
    Store.startTask(id);
    FX.ring(Scene.cx, Scene.cy, Scene.sunR, "#ffd166", 240, .9); FX.burst(Scene.cx, Scene.cy, "#ff9f43", 36, 1.5);
    this.toast("🔥", `「${t.title}」 집중 시작!`);
  },
  completeTask(id) {
    const t = Store.task(id); if (!t || t.status === "done") return;
    const title = t.title, res = Store.completeTask(id); if (!res) return;
    const spawnedId = res.spawned ? res.spawned.id : null;
    this.toast("✅", `「${title}」 완료!${res.spawned ? ` 다음 반복: ${U.relDate(res.spawned.due)}` : ""}`, () => Store.uncompleteTask(id, spawnedId));
    const s = Store.todayStats(); if (s.total && s.done === s.total) setTimeout(() => this.toast("🎉", "오늘 할 일을 모두 마쳤어요!"), 600);
  },
  deleteTask(id) {
    const t = Store.removeTask(id); if (!t) return;
    if (Panel.mode === "task" && Panel.id === id) Panel.close();
    this.toast("🗑", `「${t.title}」 삭제`, () => Store.restoreTask(t));
  },

  /* ── 토스트 / 힌트 ── */
  toast(ico, msg, undo) {
    const box = document.getElementById("toasts");
    while (box.children.length >= 3) box.firstElementChild.remove();
    const el = document.createElement("div"); el.className = "toast";
    el.innerHTML = `<span class="ico">${ico}</span><span class="msg">${U.esc(msg)}</span>${undo ? `<button type="button" class="undo">실행 취소</button>` : ""}`;
    if (undo) el.querySelector(".undo").addEventListener("click", () => { undo(); el.remove(); });
    box.appendChild(el);
    setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 300); }, undo ? 6000 : 3500);
  },
  hint(msg, ms) { const h = document.getElementById("hint"); h.textContent = msg; h.hidden = false; clearTimeout(this._hint); this._hint = setTimeout(() => { h.hidden = true; }, ms || 5000); },
};

/* ═══════════════ 빠른 추가 ═══════════════ */
const QuickAdd = {
  form: null, input: null, planetBtn: null, dateBtn: null, planetPop: null, datePop: null, planetId: null, due: null, time: null,
  init() {
    this.form = document.getElementById("quickAdd"); this.input = document.getElementById("qaInput");
    this.planetBtn = document.getElementById("qaPlanet"); this.dateBtn = document.getElementById("qaDate");
    this.planetPop = document.getElementById("qaPlanetPop"); this.datePop = document.getElementById("qaDatePop");
    this.form.addEventListener("submit", e => { e.preventDefault(); this.submit(); });
    this.planetBtn.addEventListener("click", () => this.togglePop("planet"));
    this.dateBtn.addEventListener("click", () => this.togglePop("date"));
    document.addEventListener("pointerdown", e => { if (!this.form.contains(e.target)) this.closePops(); }, true);
    this.planetPop.addEventListener("click", e => {
      const it = e.target.closest("[data-pid]"); if (it) { this.setPlanet(it.dataset.pid); this.closePops(); this.input.focus(); return; }
      if (e.target.closest("[data-add-planet]")) { this.closePops(); Modal.planet(null); }
    });
    this.datePop.addEventListener("click", e => {
      const it = e.target.closest("[data-due]"); if (it) { this.setDue(it.dataset.due || null); this.closePops(); this.input.focus(); }
    });
    this.datePop.addEventListener("change", e => {
      if (e.target.id === "qaDateInput") this.setDue(e.target.value || null);
      if (e.target.id === "qaTimeInput") { this.time = e.target.value || null; if (this.time && !this.due) this.setDue(U.today()); else this.renderDateChip(); }
    });
    this.refreshPlanets(); this.setDue(U.today());
  },
  onView(v) { this.setDue(v === "today" ? U.today() : null); this.input.placeholder = v === "calendar" ? "선택한 날짜에 할 일 추가…  #행성  !중요" : "할 일 추가…  #행성  !중요  내일 오후 3시"; },
  refreshPlanets() {
    const ps = Store.planets(); if (!ps.length) return;
    if (!ps.find(p => p.id === this.planetId)) this.planetId = ps[0].id;
    this.setPlanet(this.planetId);
    if (!this.planetPop.hidden) this.renderPlanetPop();
  },
  setPlanet(id) {
    const p = Store.planet(id); if (!p) return; this.planetId = id;
    this.planetBtn.style.setProperty("--c", p.color); this.planetBtn.querySelector(".qa-chip-text").textContent = `${p.emoji || ""} ${p.name}`.trim();
  },
  setDue(d) { this.due = d; if (!d) this.time = null; this.renderDateChip(); },
  renderDateChip() {
    const txt = this.due ? `${U.relDate(this.due)}${this.time ? " " + U.fmtTime(this.time) : ""}` : "기한 없음";
    this.dateBtn.querySelector(".qa-chip-text").textContent = txt; this.dateBtn.classList.toggle("has-date", !!this.due);
    this.dateBtn.title = `마감일: ${txt}`;
  },
  togglePop(which) {
    const pop = which === "planet" ? this.planetPop : this.datePop, open = pop.hidden;
    this.closePops();
    if (open) { if (which === "planet") this.renderPlanetPop(); else this.renderDatePop(); pop.hidden = false; (which === "planet" ? this.planetBtn : this.dateBtn).classList.add("open"); }
  },
  closePops() { const was = !this.planetPop.hidden || !this.datePop.hidden; this.planetPop.hidden = true; this.datePop.hidden = true; this.planetBtn.classList.remove("open"); this.dateBtn.classList.remove("open"); return was; },
  renderPlanetPop() {
    this.planetPop.innerHTML = `<div class="pop-title">어느 행성에 추가할까요?</div>` + Store.planets().map(p => `<button type="button" class="pop-item ${p.id === this.planetId ? "sel" : ""}" data-pid="${p.id}" style="--c:${p.color}"><span class="dot"></span><span class="lbl">${U.esc(p.emoji || "")} ${U.esc(p.name)}</span><span class="sub">${Store.tasksOf(p.id).filter(t => t.status !== "done").length}</span></button>`).join("") + `<div class="pop-sep"></div><button type="button" class="pop-item" data-add-planet><span class="dot" style="background:transparent;box-shadow:none;border:1px dashed var(--line-2)"></span><span class="lbl">+ 새 행성 만들기</span></button>`;
  },
  renderDatePop() {
    const t = U.today(), opts = [["오늘", t], ["내일", U.addDays(t, 1)], ["모레", U.addDays(t, 2)], ["다음 주", U.addDays(t, 7)], ["기한 없음", ""]];
    this.datePop.innerHTML = `<div class="pop-title">마감일</div><div class="pop-grid">${opts.map(([l, v]) => `<button type="button" class="pop-item ${(this.due || "") === v ? "sel" : ""}" data-due="${v}"><span class="lbl">${l}</span>${v ? `<span class="sub">${U.weekday(v)}</span>` : ""}</button>`).join("")}</div><div class="pop-sep"></div><div class="pop-row"><input type="date" id="qaDateInput" value="${this.due || ""}" aria-label="날짜"><input type="time" id="qaTimeInput" value="${this.time || ""}" aria-label="시간"></div>`;
  },
  submit() {
    const parsed = U.parseQuick(this.input.value, Store.planets());
    if (!parsed.title) { this.input.focus(); return; }
    let due = parsed.due || this.due;
    if (App.view === "calendar" && !parsed.due && Calendar.selected) due = Calendar.selected;
    const data = { title: parsed.title, planetId: parsed.planetId || this.planetId, important: parsed.important, due, time: parsed.time || this.time || null };
    if (App.view === "today" && !due) data.myDay = U.today();
    const t = Store.addTask(data); if (!t) return;
    this.input.value = "";
    const p = Store.planet(t.planetId);
    App.toast("🛰", `「${t.title}」 → ${p ? p.name : ""}${t.due ? ` · ${U.relDate(t.due)}` : ""}`);
    if (App.view === "all" || (App.view === "today" && !Store.isTodayTask(t))) { if (App.view === "today") App.hint("오늘이 아닌 할 일은 「전체」 보기에서 볼 수 있어요", 4000); }
  },
};

/* ═══════════════ 검색 ═══════════════ */
const Search = {
  input: null, box: null, idx: -1,
  init() {
    this.input = document.getElementById("searchInput"); this.box = document.getElementById("searchResults");
    this.input.addEventListener("input", () => this.run());
    this.input.addEventListener("focus", () => this.run());
    this.input.addEventListener("keydown", e => {
      const items = [...this.box.querySelectorAll(".search-item")];
      if (e.key === "ArrowDown") { e.preventDefault(); this.idx = Math.min(items.length - 1, this.idx + 1); this.mark(items); }
      else if (e.key === "ArrowUp") { e.preventDefault(); this.idx = Math.max(0, this.idx - 1); this.mark(items); }
      else if (e.key === "Enter") { e.preventDefault(); const it = items[Math.max(0, this.idx)]; if (it) { App.openTask(it.dataset.id); this.clear(); } }
    });
    document.addEventListener("pointerdown", e => { if (!e.target.closest(".search-wrap")) this.box.hidden = true; }, true);
    this.box.addEventListener("click", e => { const it = e.target.closest(".search-item"); if (it) { App.openTask(it.dataset.id); this.clear(); } });
  },
  mark(items) { items.forEach((it, i) => it.classList.toggle("active", i === this.idx)); },
  run() {
    const q = this.input.value.trim().toLowerCase(); this.idx = -1;
    Scene.setSearch(q); document.body.classList.toggle("searching", !!q);
    if (!q) { this.box.hidden = true; return; }
    const list = Store.tasks().filter(t => t.title.toLowerCase().includes(q) || (t.notes || "").toLowerCase().includes(q)).sort(Store.sortTasks).slice(0, 10);
    this.box.innerHTML = list.length ? list.map(t => { const p = Store.planet(t.planetId); return `<button type="button" class="search-item" data-id="${t.id}" style="--c:${p ? p.color : "#fff"}"><span class="dot"></span><span class="t ${t.status === "done" ? "done" : ""}">${U.esc(t.title)}</span><span class="m">${p ? U.esc(p.name) : ""}${t.due ? " · " + U.relDate(t.due) : ""}${t.status === "doing" ? " · 🔥" : ""}</span></button>`; }).join("") : `<div class="search-empty">「${U.esc(q)}」에 해당하는 할 일이 없어요</div>`;
    this.box.hidden = false;
  },
  clear() { this.input.value = ""; this.box.hidden = true; Scene.setSearch(""); document.body.classList.remove("searching"); this.input.blur(); },
};

/* ═══════════════ 모달 ═══════════════ */
const Modal = {
  el: null, card: null,
  show(html) { this.el = this.el || document.getElementById("modal"); this.card = this.card || document.getElementById("modalCard"); this.card.innerHTML = html; this.el.hidden = false; const f = this.card.querySelector("input, select, button"); if (f) setTimeout(() => f.focus(), 30); },
  close() { if (this.el) this.el.hidden = true; },
  confirm({ title, desc, ok = "확인", danger = false, onOk }) {
    this.show(`<h3>${U.esc(title)}</h3><p class="desc">${desc}</p><div class="modal-actions"><button type="button" class="btn ghost" id="mCancel">취소</button><button type="button" class="btn ${danger ? "danger" : "primary"}" id="mOk">${U.esc(ok)}</button></div>`);
    this.card.querySelector("#mCancel").addEventListener("click", () => this.close());
    this.card.querySelector("#mOk").addEventListener("click", () => { this.close(); onOk(); });
  },
  settings() {
    const ps = Store.planets();
    this.show(`<h3>행성 관리</h3><p class="desc">행성은 할 일의 카테고리예요. 색과 표면을 바꿔 나만의 태양계를 꾸며보세요.</p>
      <div class="planet-list">${ps.map(p => { const n = Store.tasksOf(p.id).filter(t => t.status !== "done").length; return `<div class="planet-item" style="--c:${p.color}"><div class="planet look-${p.look || "plain"}"></div><div class="nm">${U.esc(p.emoji || "")} ${U.esc(p.name)}<small>남은 할 일 ${n}개</small></div><button type="button" class="btn small" data-edit="${p.id}">편집</button></div>`; }).join("")}</div>
      <div class="settings-row" style="margin-top:10px"><button type="button" class="btn" id="mAddPlanet">+ 행성 추가</button></div>
      <div class="hr"></div>
      <h3 style="font-size:16px">앱으로 사용하기</h3>
      <p class="desc" style="margin-bottom:8px">${App.installPrompt ? "홈 화면이나 바탕화면에 설치하면 전체 화면 앱처럼 열려요." : /iPhone|iPad|iPod/.test(navigator.userAgent) ? "Safari 하단 <b>공유</b> 버튼 → <b>홈 화면에 추가</b>를 누르면 앱처럼 설치돼요." : /Android/.test(navigator.userAgent) ? "브라우저 메뉴(⋮)에서 <b>홈 화면에 추가</b> 또는 <b>앱 설치</b>를 누르세요." : "Chrome/Edge 주소창 오른쪽의 <b>설치</b> 아이콘으로 데스크톱 앱처럼 설치할 수 있어요. (https 로 열었을 때)"}</p>
      ${App.installPrompt ? `<div class="settings-row"><button type="button" class="btn primary small" id="mInstall">📲 앱으로 설치</button></div>` : ""}
      <div class="hr"></div>
      <h3 style="font-size:16px">데이터</h3>
      <div class="settings-row"><button type="button" class="btn small" id="mExport">JSON 내보내기</button><button type="button" class="btn small" id="mCopy">클립보드로 복사</button><label class="btn small" for="mImportFile">JSON 가져오기</label><input type="file" id="mImportFile" accept="application/json,.json" hidden></div>
      <div class="settings-row"><button type="button" class="btn small" id="mSample">예시 데이터로 시작</button><button type="button" class="btn small danger" id="mReset">모두 지우기</button></div>
      <div class="hr"></div>
      <p class="desc" style="margin:0">단축키 · <kbd>N</kbd> 새 할 일 · <kbd>/</kbd> 검색 · <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> 보기 전환 · <kbd>T</kbd> 오늘의 미션 · <kbd>Esc</kbd> 닫기<br>입력 팁 · <code>#행성</code> 으로 행성 지정, <code>!</code> 로 중요, 「내일」「다음주 금요일」「오후 3시」「12/25」 같은 날짜와 시간을 알아들어요.</p>
      <div class="modal-actions"><button type="button" class="btn ghost" id="mClose">닫기</button></div>`);
    const c = this.card;
    c.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => this.planet(b.dataset.edit)));
    c.querySelector("#mAddPlanet").addEventListener("click", () => this.planet(null));
    c.querySelector("#mClose").addEventListener("click", () => this.close());
    const inst = c.querySelector("#mInstall"); if (inst) inst.addEventListener("click", async () => { const p = App.installPrompt; if (!p) return; p.prompt(); try { await p.userChoice; } catch (e) {} App.installPrompt = null; this.close(); });
    c.querySelector("#mExport").addEventListener("click", () => {
      try { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([Store.exportJSON()], { type: "application/json" })); a.download = `orbit-todo-${U.today()}.json`; a.click(); App.toast("📦", "JSON 파일로 내보냈어요"); } catch (e) { App.toast("⚠", "내보내기에 실패했어요. 클립보드 복사를 이용해 주세요"); }
    });
    c.querySelector("#mCopy").addEventListener("click", () => { navigator.clipboard.writeText(Store.exportJSON()).then(() => App.toast("📋", "클립보드에 복사했어요")).catch(() => App.toast("⚠", "복사할 수 없어요")); });
    c.querySelector("#mImportFile").addEventListener("change", e => {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader(); r.onload = () => { try { Store.importJSON(r.result); this.close(); App.toast("📥", "데이터를 가져왔어요"); } catch (err) { App.toast("⚠", `가져오기 실패: ${err.message}`); } }; r.readAsText(f);
    });
    c.querySelector("#mSample").addEventListener("click", () => this.confirm({ title: "예시 데이터로 시작", desc: "현재 데이터를 모두 지우고 예시 행성과 할 일로 바꿉니다.", ok: "바꾸기", danger: true, onOk: () => { Store.reset(true); App.toast("✨", "예시 데이터를 불러왔어요"); } }));
    c.querySelector("#mReset").addEventListener("click", () => this.confirm({ title: "모두 지우기", desc: "모든 행성과 할 일이 삭제됩니다. 되돌릴 수 없어요.", ok: "모두 지우기", danger: true, onOk: () => { Store.reset(false); App.toast("🌌", "빈 우주에서 다시 시작해요"); } }));
  },

  /* 행성 편집기 */
  planet(id) {
    const existing = id ? Store.planet(id) : null;
    const used = Store.planets().map(p => p.color);
    const draft = existing ? { ...existing } : { name: "", emoji: "🪐", color: Store.COLORS.find(c => !used.includes(c)) || Store.COLORS[Store.planets().length % Store.COLORS.length], look: ["plain", "banded", "ringed", "rocky", "icy"][Store.planets().length % 5] };
    const emojis = ["💼", "📚", "🏃", "🏠", "🎨", "💡", "🛒", "❤️", "✈️", "🎮", "💰", "🧪", "🎵", "🌱", "🪐"];
    this.show(`<h3>${existing ? "행성 편집" : "새 행성"}</h3><p class="desc">${existing ? "이름, 색, 표면을 바꿀 수 있어요." : "새 카테고리가 태양 주위에 새 행성으로 나타나요."}</p>
      <div class="form-grid">
        <div class="form-row"><label class="field-label" for="pName" style="margin:9px 0 0">이름</label><input type="text" id="pName" value="${U.esc(draft.name)}" placeholder="예: 업무, 공부, 건강" maxlength="14"></div>
        <div class="form-row"><label class="field-label" for="pEmoji" style="margin:9px 0 0">이모지</label><div><input type="text" id="pEmoji" value="${U.esc(draft.emoji || "")}" maxlength="4" style="width:80px"><div class="swatches" style="margin-top:8px">${emojis.map(e => `<button type="button" class="pill" data-emoji="${e}">${e}</button>`).join("")}</div></div></div>
        <div class="form-row"><span class="field-label" style="margin:6px 0 0">색상</span><div class="swatches">${Store.COLORS.map(c => `<button type="button" class="swatch ${c === draft.color ? "on" : ""}" data-color="${c}" style="--c:${c}" aria-label="${c}"></button>`).join("")}</div></div>
        <div class="form-row"><span class="field-label" style="margin:12px 0 0">표면</span><div class="looks">${Store.LOOKS.map(([v, l]) => `<button type="button" class="look-opt ${v === draft.look ? "on" : ""}" data-look="${v}"><div class="planet look-${v}" style="--c:${draft.color}"></div>${l}</button>`).join("")}</div></div>
      </div>
      <div class="modal-actions">${existing && Store.planets().length > 1 ? `<button type="button" class="btn ghost danger left" id="pDelete">행성 삭제</button>` : ""}<button type="button" class="btn ghost" id="pCancel">취소</button><button type="button" class="btn primary" id="pSave">${existing ? "저장" : "행성 만들기"}</button></div>`);
    const c = this.card;
    c.querySelectorAll("[data-emoji]").forEach(b => b.addEventListener("click", () => { c.querySelector("#pEmoji").value = b.dataset.emoji; }));
    c.querySelectorAll("[data-color]").forEach(b => b.addEventListener("click", () => { draft.color = b.dataset.color; c.querySelectorAll("[data-color]").forEach(x => x.classList.toggle("on", x === b)); c.querySelectorAll(".look-opt .planet").forEach(x => x.style.setProperty("--c", draft.color)); }));
    c.querySelectorAll("[data-look]").forEach(b => b.addEventListener("click", () => { draft.look = b.dataset.look; c.querySelectorAll("[data-look]").forEach(x => x.classList.toggle("on", x === b)); }));
    const save = () => {
      const name = c.querySelector("#pName").value.trim(); if (!name) { c.querySelector("#pName").focus(); return; }
      const data = { name, emoji: c.querySelector("#pEmoji").value.trim(), color: draft.color, look: draft.look };
      if (existing) { Store.updatePlanet(existing.id, data); App.toast("🪐", `「${name}」 행성을 수정했어요`); }
      else { const p = Store.addPlanet(data); QuickAdd.setPlanet(p.id); App.toast("🪐", `「${name}」 행성이 태어났어요`); }
      this.close();
    };
    c.querySelector("#pSave").addEventListener("click", save);
    c.querySelector("#pName").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); save(); } });
    c.querySelector("#pCancel").addEventListener("click", () => this.close());
    const del = c.querySelector("#pDelete"); if (del) del.addEventListener("click", () => this.deletePlanet(existing.id));
  },
  deletePlanet(id) {
    const p = Store.planet(id), others = Store.planets().filter(x => x.id !== id), n = Store.tasksOf(id).length;
    this.show(`<h3>「${U.esc(p.name)}」 행성 삭제</h3><p class="desc">${n ? `이 행성에는 할 일이 ${n}개 있어요. 어떻게 할까요?` : "이 행성에는 할 일이 없어요."}</p>
      ${n ? `<div class="form-grid"><label class="pill on" style="display:flex;gap:8px;align-items:center;padding:10px 12px;border-radius:12px;cursor:pointer"><input type="radio" name="pdel" value="move" checked> 다른 행성으로 옮기기 <select id="pMoveTo" style="width:auto;margin-left:auto">${others.map(o => `<option value="${o.id}">${U.esc(o.emoji || "")} ${U.esc(o.name)}</option>`).join("")}</select></label><label class="pill" style="display:flex;gap:8px;align-items:center;padding:10px 12px;border-radius:12px;cursor:pointer"><input type="radio" name="pdel" value="del"> 할 일도 함께 삭제</label></div>` : ""}
      <div class="modal-actions"><button type="button" class="btn ghost" id="pdCancel">취소</button><button type="button" class="btn danger" id="pdOk">삭제</button></div>`);
    const c = this.card;
    c.querySelector("#pdCancel").addEventListener("click", () => this.close());
    c.querySelector("#pdOk").addEventListener("click", () => {
      const mode = n ? c.querySelector("input[name=pdel]:checked").value : "del";
      const to = mode === "move" ? c.querySelector("#pMoveTo").value : null;
      if (Panel.mode === "planet" && Panel.id === id) Panel.close();
      Store.removePlanet(id, to); this.close(); App.toast("🌑", `「${p.name}」 행성이 사라졌어요`);
    });
  },
};

document.addEventListener("DOMContentLoaded", () => App.init());

/* ═══════════════ PWA: 설치 프롬프트 + 서비스 워커 ═══════════════ */
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); App.installPrompt = e; });
window.addEventListener("appinstalled", () => { App.installPrompt = null; App.toast("📲", "앱으로 설치됐어요"); });
if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => { /* 호스팅 환경에서만 동작 */ }); });
}
