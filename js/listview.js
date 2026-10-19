/* ═══════════════ 목록 보기: 모든 할 일을 열(행성 · 우선순위 · 기한)로 한눈에, 끌어서 옮기기 ═══════════════ */
"use strict";

const ListView = {
  el: null, by: "planet", showDone: false, q: "", dragId: null, addKey: null,
  init() {
    this.el = $("#listView");
    const st = Store.state.settings; this.by = st.listBy || "planet"; this.showDone = !!st.listDone;
    this.el.addEventListener("click", e => this.onClick(e));
    this.el.addEventListener("input", e => { if (e.target.id === "lvSearch") { this.q = e.target.value.trim().toLowerCase(); this.renderCols(); } });
    this.el.addEventListener("keydown", e => this.onKey(e));
    this.el.addEventListener("dragstart", e => { const c = e.target.closest(".lv-card"); if (!c) return; this.dragId = c.dataset.id; c.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", c.dataset.id); });
    this.el.addEventListener("dragend", () => { this.dragId = null; this.el.querySelectorAll(".dragging, .drop").forEach(x => x.classList.remove("dragging", "drop")); });
    this.el.addEventListener("dragover", e => {
      const col = e.target.closest(".lv-col"); if (!col || !this.dragId || col.dataset.nodrop) return;
      e.preventDefault(); this.el.querySelectorAll(".lv-col.drop").forEach(x => x !== col && x.classList.remove("drop")); col.classList.add("drop");
    });
    this.el.addEventListener("dragleave", e => { const col = e.target.closest(".lv-col"); if (col && !col.contains(e.relatedTarget)) col.classList.remove("drop"); });
    this.el.addEventListener("drop", e => { const col = e.target.closest(".lv-col"); if (!col || !this.dragId) return; e.preventDefault(); const id = this.dragId; this.dragId = null; this.moveTo(id, col.dataset.key); });
  },
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
    this.el.innerHTML = `
      <div class="lv-head">
        <div class="lv-title"><h2>모든 할 일</h2><span class="lv-sub">남은 <b class="num">${open}</b> · 완료 <b class="num">${done}</b></span></div>
        <div class="lv-tools">
          <div class="lv-seg" role="tablist" aria-label="묶는 기준">${[["planet", "행성"], ["priority", "우선순위"], ["due", "기한"]].map(([k, l]) => `<button type="button" class="lv-sb ${this.by === k ? "on" : ""}" data-act="by" data-by="${k}" role="tab" aria-selected="${this.by === k}">${l}</button>`).join("")}</div>
          <label class="lv-search">${ico("search", 15)}<input id="lvSearch" type="search" placeholder="${window.innerWidth < 640 ? "찾기" : "목록에서 찾기"}" value="${U.esc(this.q)}" autocomplete="off" aria-label="목록에서 찾기"></label>
          <button type="button" class="lv-toggle ${this.showDone ? "on" : ""}" data-act="done-toggle" aria-pressed="${this.showDone}">${ico("check", 14)}완료 포함</button>
        </div>
      </div>
      <div class="lv-cols" id="lvCols"></div>
      <div class="lv-foot">${Scene.touch ? "카드를 누르면 상세에서 행성 · 우선순위 · 마감일을 바꿀 수 있어요" : `카드를 다른 열로 끌어 놓으면 ${this.by === "planet" ? "행성(카테고리)이" : this.by === "priority" ? "우선순위가" : "마감일이"} 바뀌어요 · 카드를 누르면 상세가 열려요`}</div>`;
    this.renderCols();
  },
  renderCols() {
    const box = this.el.querySelector("#lvCols"); if (!box) return;
    const sl = box.scrollLeft, tops = {}; box.querySelectorAll(".lv-col").forEach(c => { tops[c.dataset.key] = c.querySelector(".lv-cards").scrollTop; });
    const q = this.q, list = Store.tasks().filter(t => (this.showDone || t.status !== "done") && (!q || t.title.toLowerCase().includes(q) || (t.notes || "").toLowerCase().includes(q)));
    box.innerHTML = this.groups().map(g => {
      const items = list.filter(g.test).sort((a, b) => ((a.status === "done") - (b.status === "done")) || Store.sortTasks(a, b));
      if (g.nodrop && !items.length) return "";
      const n = items.filter(t => t.status !== "done").length;
      return `<section class="lv-col" data-key="${g.key}" ${g.nodrop ? 'data-nodrop="1"' : ""} style="${g.color ? `--gc:${g.color}` : ""}">
        <header class="lv-ch">${g.icon}<span class="nm">${U.esc(g.title)}</span>${g.hint ? `<span class="hint">${g.hint}</span>` : ""}<span class="n num">${n}</span>${g.nodrop ? "" : `<button type="button" class="lv-add" data-act="add" aria-label="${U.esc(g.title)}에 할 일 추가" title="여기에 추가">${ico("plus", 15)}</button>`}</header>
        ${this.addKey === g.key ? `<div class="lv-addrow"><input type="text" id="lvAdd" placeholder="새 할 일 입력 후 Enter" aria-label="새 할 일" enterkeyhint="send"></div>` : ""}
        <div class="lv-cards">${items.map(t => this.card(t)).join("") || `<div class="lv-empty">${g.nodrop ? "" : "비어 있어요"}</div>`}</div>
      </section>`;
    }).join("");
    box.scrollLeft = sl; box.querySelectorAll(".lv-col").forEach(c => { if (tops[c.dataset.key]) c.querySelector(".lv-cards").scrollTop = tops[c.dataset.key]; });
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
    return `<div class="lv-card ${t.status} ${pr ? "p" + pr : ""}" data-id="${t.id}" draggable="${!done && !Scene.touch}" tabindex="0">
      <button type="button" class="check ${done ? "on" : ""}" data-act="check" aria-label="${done ? "완료 취소" : "완료"}">${ico("check", 12)}</button>
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
      case "by": this.by = b.dataset.by; Store.setSetting("listBy", this.by); this.addKey = null; this.render(); break;
      case "done-toggle": this.showDone = !this.showDone; Store.setSetting("listDone", this.showDone); this.render(); break;
      case "add": { const col = b.closest(".lv-col"); this.addKey = this.addKey === col.dataset.key ? null : col.dataset.key; this.renderCols(); break; }
      case "check": if (!t) break; if (t.status === "done") Store.uncompleteTask(t.id); else App.completeTask(t.id); break;
      case "fire": if (!t) break; if (t.status === "doing") { Store.stopTask(t.id); App.toast("orbitBack", "궤도로 돌아왔어요"); } else App.startTask(t.id); break;
    }
  },
  onKey(e) {
    if (e.target.id === "lvAdd") {
      if (e.key === "Escape") { e.stopPropagation(); this.addKey = null; this.renderCols(); return; }
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
