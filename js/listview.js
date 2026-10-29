/* ═══════════════ 목록 보기: 모든 할 일을 열(행성 · 우선순위 · 기한)로 한눈에, 끌어서 옮기기 ═══════════════ */
"use strict";

const ListView = {
  el: null, by: "planet", showDone: false, q: "", dragId: null, addKey: null, layout: null,
  init() {
    this.el = $("#listView");
    const st = Store.state.settings; this.by = st.listBy || "planet"; this.showDone = !!st.listDone;
    this.layout = ["list", "board"].includes(st.listLayout) ? st.listLayout : null;
    this._mobile = window.innerWidth < 640;
    window.addEventListener("resize", () => {
      const mobile = window.innerWidth < 640;
      if (mobile !== this._mobile) { this._mobile = mobile; if (!this.layout) this.render(); }
    });
    this.el.addEventListener("click", e => this.onClick(e));
    this.el.addEventListener("input", e => { if (e.target.id === "lvSearch") { this.q = e.target.value.trim().toLowerCase(); this.renderCols(); } });
    this.el.addEventListener("keydown", e => this.onKey(e));
    /* 행성으로 묶었을 때: 열 머리를 끌면(터치는 손잡이) 행성 순서가 바뀐다 */
    sortable(this.el, { item: ".lv-col", handle: ".lv-ch", touchHandle: ".lv-grip", axis: "x", scroller: () => this.el.querySelector("#lvCols"), enabled: () => this.by === "planet" && this.mode() === "board", onDrop: (ids, id) => { Store.reorderPlanets(ids, id); } });
    this.el.addEventListener("keydown", e => {
      const g = e.target.closest(".lv-grip"); if (!g || !["ArrowLeft", "ArrowRight"].includes(e.key)) return;
      e.preventDefault(); e.stopPropagation(); const id = g.closest(".lv-col").dataset.id, ids = Store.planets().map(p => p.id), i = ids.indexOf(id), j = i + (e.key === "ArrowLeft" ? -1 : 1);
      if (j < 0 || j >= ids.length) return;
      ids.splice(j, 0, ids.splice(i, 1)[0]); Store.reorderPlanets(ids, id);
      this.el.querySelector(`.lv-col[data-id="${id}"] .lv-grip`)?.focus();
    }, true);
    this.el.addEventListener("dragstart", e => { const c = e.target.closest(".lv-card"); if (!c) return; if (this.mode() !== "board") { e.preventDefault(); return; } this.dragId = c.dataset.id; c.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", c.dataset.id); });
    this.el.addEventListener("dragend", () => { this.dragId = null; this.el.querySelectorAll(".dragging, .drop").forEach(x => x.classList.remove("dragging", "drop")); });
    this.el.addEventListener("dragover", e => {
      const col = e.target.closest(".lv-col"); if (!col || !this.dragId || col.dataset.nodrop) return;
      e.preventDefault(); this.el.querySelectorAll(".lv-col.drop").forEach(x => x !== col && x.classList.remove("drop")); col.classList.add("drop");
    });
    this.el.addEventListener("dragleave", e => { const col = e.target.closest(".lv-col"); if (col && !col.contains(e.relatedTarget)) col.classList.remove("drop"); });
    this.el.addEventListener("drop", e => { const col = e.target.closest(".lv-col"); if (!col || !this.dragId || col.dataset.nodrop) return; e.preventDefault(); const id = this.dragId; this.dragId = null; this.el.querySelectorAll(".drop").forEach(x => x.classList.remove("drop")); this.moveTo(id, col.dataset.key); });
  },
  mode() { return this.layout || (window.innerWidth < 640 ? "list" : "board"); },
  groups() {
    const today = U.today(), d = n => U.addDays(today, n), diff = t => (t.due ? U.diffDays(today, t.due) : null);
    if (this.by === "planet") return Store.planets().map(p => ({ key: p.id, title: p.name, icon: thumbImg(bodyKey(p), 18), test: t => t.planetId === p.id, patch: () => ({ planetId: p.id }), label: p.name }));
    if (this.by === "priority") return PRIO_ORDER.map(v => ({ key: "p" + v, title: v ? PRIO[v].ko : "우선순위 미정", icon: prioSvg(v, 15), color: PRIO[v].color, test: t => (t.priority || 0) === v, patch: () => ({ priority: v }), label: `우선순위 ${PRIO[v].ko}` }));
    return [
      { key: "late", title: "지난 기한", icon: ico("alert", 15), color: "#f0717d", test: t => !!t.due && t.due < today, nodrop: true },
      { key: "today", title: "오늘", icon: ico("sun", 15), color: "#f4a259", test: t => t.due === today, patch: () => ({ due: today }), label: "오늘" },
      { key: "tomorrow", title: "내일", icon: ico("calendar", 15), test: t => diff(t) === 1, patch: () => ({ due: d(1) }), label: "내일" },
      { key: "week", title: "이번 주", hint: "2~7일 뒤", icon: ico("calendar", 15), test: t => { const x = diff(t); return x != null && x >= 2 && x <= 7; }, patch: () => ({ due: d(2) }), label: U.fmtDate(d(2)) },
      { key: "later", title: "나중에", hint: "8일 이후", icon: ico("calendar", 15), test: t => diff(t) > 7, patch: () => ({ due: d(8) }), label: U.fmtDate(d(8)) },
      { key: "none", title: "기한 없음", icon: ico("orbit", 15), test: t => !t.due, patch: () => ({ due: null, time: null }), label: "기한 없음" },
    ];
  },
  render() {
    if (this.el.hidden) return;
    const all = Store.tasks(), open = all.filter(t => t.status !== "done").length, done = all.length - open;
    const mode = this.mode();
    this.el.dataset.layout = mode;
    this.el.innerHTML = `
      <div class="lv-head">
        <div class="lv-heading"><div class="lv-title"><h2>모든 할 일</h2><span class="lv-sub">남은 <b class="num">${open}</b> · 완료 <b class="num">${done}</b></span></div>
          <div class="lv-layout" role="group" aria-label="목록 표시 방식"><button type="button" data-act="layout" data-layout="list" class="${mode === "list" ? "on" : ""}" aria-pressed="${mode === "list"}">${ico("list", 15)}목록</button><button type="button" data-act="layout" data-layout="board" class="${mode === "board" ? "on" : ""}" aria-pressed="${mode === "board"}"><svg class="ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="7" height="16" rx="2"/><rect x="14" y="4" width="7" height="11" rx="2"/></svg>보드</button></div>
        </div>
        <div class="lv-tools">
          <div class="lv-seg" role="group" aria-label="할 일 묶는 기준">${[["planet", "행성"], ["priority", "우선순위"], ["due", "기한"]].map(([k, l]) => `<button type="button" class="lv-sb ${this.by === k ? "on" : ""}" data-act="by" data-by="${k}" aria-pressed="${this.by === k}">${l}</button>`).join("")}</div>
          <label class="lv-search">${ico("search", 15)}<input id="lvSearch" type="search" placeholder="${window.innerWidth < 640 ? "찾기" : "목록에서 찾기"}" value="${U.esc(this.q)}" autocomplete="off" aria-label="목록에서 찾기"></label>
          <button type="button" class="lv-toggle ${this.showDone ? "on" : ""}" data-act="done-toggle" aria-pressed="${this.showDone}">${ico("check", 14)}완료 포함</button>
        </div>
      </div>
      <div class="lv-cols" id="lvCols"></div>
      <div class="lv-foot"><span id="lvResult" role="status" aria-live="polite"></span><span>${mode === "list" || Scene.touch ? "할 일을 누르면 상세와 메모를 볼 수 있어요" : `다른 열로 끌어 놓으면 ${this.by === "planet" ? "행성이" : this.by === "priority" ? "우선순위가" : "마감일이"} 바뀌어요`}</span></div>`;
    this.renderCols();
  },
  renderCols() {
    const box = this.el.querySelector("#lvCols"); if (!box) return;
    const sl = box.scrollLeft, sy = box.scrollTop, tops = {}; box.querySelectorAll(".lv-col").forEach(c => { tops[c.dataset.key] = c.querySelector(".lv-cards").scrollTop; });
    const q = this.q, list = Store.tasks().filter(t => (this.showDone || t.status !== "done") && (!q || t.title.toLowerCase().includes(q) || (t.notes || "").toLowerCase().includes(q)));
    const status = this.el.querySelector("#lvResult"); if (status) status.textContent = `${q ? "검색 결과" : "표시 중"} ${list.length}개`;
    if (!list.length && !this.addKey) {
      const completed = Store.tasks().some(t => t.status === "done");
      box.innerHTML = `<div class="lv-zero">${ico(q ? "search" : "orbit", 32)}<h3>${q ? "일치하는 할 일이 없어요" : completed && !this.showDone ? "남은 할 일을 모두 끝냈어요" : "첫 번째 할 일을 궤도에 올려보세요"}</h3><p>${q ? "다른 검색어로 제목이나 메모를 찾아보세요." : "작은 일 하나부터 시작하면 충분해요."}</p><button type="button" class="lv-empty-action" data-act="${q ? "clear-search" : "new"}">${ico(q ? "x" : "plus", 15)}${q ? "검색 지우기" : "할 일 추가"}</button>${!q && completed && !this.showDone ? '<button type="button" class="lv-zero-link" data-act="done-toggle">완료한 할 일 보기</button>' : ""}</div>`;
      return;
    }
    box.innerHTML = this.groups().map(g => {
      const items = list.filter(g.test).sort((a, b) => ((a.status === "done") - (b.status === "done")) || Store.sortTasks(a, b));
      if (!items.length && (g.nodrop || q || this.mode() === "list") && this.addKey !== g.key) return "";
      const n = items.filter(t => t.status !== "done").length;
      return `<section class="lv-col" data-key="${g.key}" data-id="${g.key}" ${g.nodrop ? 'data-nodrop="1"' : ""} style="${g.color ? `--gc:${g.color}` : ""}">
        <header class="lv-ch">${this.by === "planet" && this.mode() === "board" ? `<button type="button" class="grip lv-grip" aria-label="「${U.esc(g.title)}」 열 순서 바꾸기 · 끌거나 좌우 화살표" title="끌어서 행성 순서 바꾸기">${ico("grip", 14)}</button>` : ""}${g.icon}<span class="nm">${U.esc(g.title)}</span>${g.hint ? `<span class="hint">${g.hint}</span>` : ""}<span class="n num" aria-label="남은 할 일 ${n}개">${n}</span>${g.nodrop ? "" : `<button type="button" class="lv-add" data-act="add" aria-label="${U.esc(g.title)}에 할 일 추가" title="여기에 추가" aria-expanded="${this.addKey === g.key}">${ico("plus", 15)}</button>`}</header>
        ${this.addKey === g.key ? `<div class="lv-addrow"><input type="text" id="lvAdd" placeholder="새 할 일 입력 후 Enter" aria-label="새 할 일" enterkeyhint="send"></div>` : ""}
        <div class="lv-cards">${items.map(t => this.card(t)).join("") || `<button type="button" class="lv-empty" data-act="add">${ico("plus", 15)}첫 할 일 추가</button>`}</div>
      </section>`;
    }).join("");
    box.scrollLeft = sl; box.scrollTop = sy; box.querySelectorAll(".lv-col").forEach(c => { if (tops[c.dataset.key]) c.querySelector(".lv-cards").scrollTop = tops[c.dataset.key]; });
    if (this.addKey) box.querySelector("#lvAdd")?.focus();
  },
  card(t) {
    const p = Store.planet(t.planetId), late = Store.isOverdue(t), doing = t.status === "doing", done = t.status === "done", pr = t.priority || 0, sd = t.steps.filter(s => s.done).length;
    const meta = [
      this.by !== "priority" && pr ? `<span style="color:${PRIO[pr].color}">${prioSvg(pr, 12)}${PRIO[pr].ko}</span>` : "",
      this.by !== "planet" && p ? `<span><i class="pd" style="--c:${pColor(p)}"></i>${U.esc(p.name)}</span>` : "",
      doing ? `<span class="hot">${ico("flame", 12)}<span class="num" data-live="${t.id}">${U.fmtClock(Store.burned(t))}</span></span>` : "",
      t.due && this.by !== "due" ? `<span class="${late ? "late" : ""}">${Board.due(t)}${t.time ? " " + U.fmtTime(t.time) : ""}</span>` : t.time ? `<span>${U.fmtTime(t.time)}</span>` : "",
      this.by === "due" && t.due && t.due > U.addDays(U.today(), 1) ? `<span>${U.fmtDate(t.due)}</span>` : "",
      t.steps.length ? `<span>${ico("list", 12)}${sd}/${t.steps.length}</span>` : "",
      t.repeat && t.repeat !== "none" ? `<span>${ico("repeat", 12)}</span>` : "",
    ].filter(Boolean).join("");
    return `<div class="lv-card ${t.status} ${pr ? "p" + pr : ""}" data-id="${t.id}" draggable="${this.mode() === "board" && !done && !Scene.touch}" tabindex="0" aria-label="${U.esc(t.title)} · 상세 보기">
      <button type="button" class="check ${done ? "on" : ""}" data-act="check" aria-label="${U.esc(t.title)} ${done ? "완료 취소" : "완료"}" aria-pressed="${done}">${ico("check", 12)}</button>
      <div class="lv-main"><div class="lv-t">${U.esc(t.title)}</div>${meta ? `<div class="lv-m">${meta}</div>` : ""}</div>
      ${done ? "" : `<button type="button" class="lv-act" data-act="fire" aria-label="${doing ? "궤도로 되돌리기" : "태양에 올려 집중"}" title="${doing ? "궤도로 되돌리기" : "태양에 올려 집중"}">${ico(doing ? "orbitBack" : "flame", 15)}</button>`}
    </div>`;
  },
  moveTo(id, key) {
    const t = Store.task(id), g = this.groups().find(x => x.key === key); if (!t || !g || g.nodrop || g.test(t)) return;
    const before = { planetId: t.planetId, priority: t.priority, due: t.due, time: t.time };
    Store.updateTask(id, g.patch());
    App.toast("orbit", `「${t.title}」 → ${g.label}`, () => Store.updateTask(id, before));
  },
  onClick(e) {
    const b = e.target.closest("[data-act]"), card = e.target.closest(".lv-card");
    if (!b) { if (card) App.openTask(card.dataset.id); return; }
    const id = card && card.dataset.id, t = id && Store.task(id);
    switch (b.dataset.act) {
      case "layout": this.layout = b.dataset.layout; Store.setSetting("listLayout", this.layout); this.render(); this.el.querySelector(`[data-layout="${this.layout}"]`)?.focus(); break;
      case "by": this.by = b.dataset.by; Store.setSetting("listBy", this.by); this.addKey = null; this.render(); this.el.querySelector(`[data-by="${this.by}"]`)?.focus(); break;
      case "done-toggle": this.showDone = !this.showDone; Store.setSetting("listDone", this.showDone); this.render(); this.el.querySelector('[data-act="done-toggle"]')?.focus(); break;
      case "add": { const col = b.closest(".lv-col"); this.addKey = this.addKey === col.dataset.key ? null : col.dataset.key; this.renderCols(); break; }
      case "clear-search": this.q = ""; this.render(); this.el.querySelector("#lvSearch")?.focus(); break;
      case "new": $("#cmdInput")?.focus(); break;
      case "check": if (!t) break; if (t.status === "done") Store.uncompleteTask(t.id); else App.completeTask(t.id, b); break;
      case "fire": if (!t) break; if (t.status === "doing") App.stopTask(t.id); else App.startTask(t.id, b); break;
    }
  },
  onKey(e) {
    if (e.target.id === "lvAdd") {
      if (e.key === "Escape") { e.stopPropagation(); const col = e.target.closest(".lv-col").dataset.key; this.addKey = null; this.renderCols(); Array.from(this.el.querySelectorAll(".lv-col")).find(c => c.dataset.key === col)?.querySelector(".lv-add")?.focus(); return; }
      if (e.key !== "Enter" || e.isComposing) return;
      e.preventDefault();
      const q = U.parseQuick(e.target.value, Store.planets()); if (!q.title) return;
      const g = this.groups().find(x => x.key === this.addKey);
      Store.addTask(Object.assign({ title: q.title, planetId: q.planetId || QuickAdd.planetId, priority: q.priority, due: q.due, time: q.time }, g && g.patch ? g.patch() : {}));
      return;
    }
    const card = e.target.closest(".lv-card"); if (card && e.target === card && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); App.openTask(card.dataset.id); }
  },
  tick() { if (this.el.hidden) return; this.el.querySelectorAll("[data-live]").forEach(el => { const t = Store.task(el.dataset.live); if (t) el.textContent = U.fmtClock(Store.burned(t)); }); },
};
