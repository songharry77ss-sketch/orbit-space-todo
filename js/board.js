/* ═══════════════ 오늘 보드: 할 일 전부를 한 화면에 (데스크톱 왼쪽 · 휴대폰 아래 고정) ═══════════════
   넘치면 줄 높이를 줄여(보통 → 촘촘 → 아주 촘촘) 스크롤 없이 다 보이게 한다.
   휴대폰에서는 입력창(과 집중 바) 바로 위에 붙어 있고, 머리를 아래로 밀면 접혀서 우주가 넓어진다. */
"use strict";

const Board = {
  el: null, collapsed: false, mini: false, showDone: false, hoverId: null,
  init() {
    this.el = $("#board"); this.pill = $("#boardPill");
    const st = Store.state.settings;
    this.collapsed = st.boardCollapsed != null ? !!st.boardCollapsed : window.innerWidth < 900;
    this.mini = !!st.dockMini; this.showDone = !!st.boardDone;
    this.el.addEventListener("click", e => this.onClick(e));
    this.el.addEventListener("pointerover", e => { const r = e.target.closest("[data-task]"); this.setHover(r ? r.dataset.task : null); });
    this.el.addEventListener("pointerleave", () => this.setHover(null));
    this.el.addEventListener("keydown", e => { const r = e.target.closest(".b-row"); if (r && e.target === r && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); App.openTask(r.dataset.task); } });
    this.el.addEventListener("pointerdown", e => this.swipeStart(e));
    window.addEventListener("resize", () => this.render());
  },
  setHover(id) { if (this.hoverId === id) return; this.hoverId = id; Scene.listHover = id; },
  list() { const all = App.view === "all"; return Store.tasks().filter(t => t.status !== "done" && (all || Store.isTodayTask(t))).sort(Store.sortTasks); },
  doneToday() { const today = U.today(); return Store.tasks().filter(t => t.status === "done" && t.completedAt && U.dateStr(new Date(t.completedAt)) === today).sort((a, b) => b.completedAt - a.completedAt); },
  isDock() { return window.innerWidth < 640; },
  render() {
    const dock = this.isDock(), overlay = App.view === "calendar" || App.view === "list";
    const collapsed = dock ? this.mini : this.collapsed;
    this.el.hidden = overlay; this.el.classList.toggle("m-dock", dock); this.el.classList.toggle("mini", dock && this.mini);
    document.body.classList.toggle("has-board", !overlay && !dock && !collapsed);
    document.body.classList.toggle("has-dock", !overlay && dock);
    Scene.setBoard(!overlay && !dock && !collapsed ? 344 : 0);
    Scene.lean = dock && !this.mini;
    if (this.pill) this.pill.hidden = true;
    if (overlay) { Scene.setDock(0); return; }
    const list = this.list(), doing = list.filter(t => t.status === "doing"), rest = list.filter(t => t.status !== "doing"), done = this.doneToday();
    /* 휴대폰은 크게 보는 집중 하나를 아래 집중 바가 보여 주므로, 함께 집중 중인 나머지만 목록에 둔다 */
    const prim = dock && doing.length ? Now.primary(doing) : null, fire = doing.filter(t => t !== prim), showDoing = fire.length > 0;
    const groups = PRIO_ORDER.map(p => [p, rest.filter(t => (t.priority || 0) === p)]).filter(([, l]) => l.length);
    const none = rest.filter(t => !t.priority).length, high = rest.filter(t => t.priority === 1).length, late = rest.filter(t => Store.isOverdue(t)).length;
    const s = Store.todayStats(), pct = s.total ? Math.round(s.done / s.total * 100) : 0, title = App.view === "all" ? "전체 할 일" : "오늘 할 일";
    const sum = [high ? `<span class="b-chip" style="--pc:${PRIO[1].color}">${prioSvg(1, 12)}높음 ${high}</span>` : "", late ? `<span class="b-chip late">지남 ${late}</span>` : "", s.total ? `<span class="b-pct num" title="오늘 ${s.total}개 중 ${s.done}개 완료">${s.done}<i>/</i>${s.total}</span>` : ""].join("");
    const chev = dock ? (this.mini ? "chevUp" : "chevDown") : collapsed ? "chevRight" : "chevDown";
    let html = `${dock ? `<div class="b-grip" data-act="collapse" aria-hidden="true"><i></i></div>` : ""}<div class="b-head"><button type="button" class="b-title" data-act="collapse" aria-expanded="${!collapsed}" title="${collapsed ? "펼치기" : "접기"}">${ico(chev, 15)}<span>${title}</span><span class="b-count num">${list.length}</span></button><div class="b-sum">${sum}</div></div>
      <div class="b-prog ${s.total && s.done === s.total ? "full" : ""}" style="--p:${pct}%"><i></i></div>`;
    const evs = GCal.eventsOn(U.today());
    if (evs.length && !collapsed) html += `<div class="b-ev"><div class="b-sh">${GCal.G.replace('width="16" height="16"', 'width="12" height="12"')}오늘 구글 일정<span class="n num">${evs.length}</span></div>${evs.slice(0, 4).map(ev => `<button type="button" class="b-evr${ev.busy ? " busy" : ""}" data-act="ev" data-ev="${U.esc(ev.id)}" style="--c:${ev.color}" title="${U.esc(ev.cal)}"><span class="tm num">${ev.time ? U.fmtTime(ev.time) : "종일"}</span><span class="t">${U.esc(ev.title)}</span></button>`).join("")}${evs.length > 4 ? `<div class="b-evm">외 ${evs.length - 4}개</div>` : ""}</div>`;
    if (!collapsed) {
      html += `<div class="b-body">`;
      if (showDoing) html += `<div class="b-sec fire"><div class="b-sh"><span class="f-dot"></span>${prim ? "함께 집중 중" : "집중 중"}<span class="n num">${fire.length}</span></div>${fire.map(t => this.row(t)).join("")}</div>`;
      groups.forEach(([p, l]) => { html += `<div class="b-sec"><div class="b-sh" style="--pc:${PRIO[p].color}">${prioSvg(p, 13)}${p ? PRIO[p].ko : "우선순위 미정"}<span class="n num">${l.length}</span></div>${l.map(t => this.row(t)).join("")}</div>`; });
      if (!rest.length && !showDoing) html += done.length
        ? `<div class="b-empty win"><b>${App.view === "all" ? "남은 할 일이 없어요" : "오늘 할 일을 모두 끝냈어요"}</b>오늘 ${done.length}개 완료 · 집중 ${U.fmtDuration(Store.burnedToday())}</div>`
        : `<div class="b-empty"><b>${App.view === "all" ? "남은 할 일이 없어요" : "오늘 남은 할 일이 없어요"}</b>아래 입력창에서 새 할 일을 추가하세요</div>`;
      if (done.length) html += `<div class="b-sec done"><button type="button" class="b-sh toggle" data-act="done-list" aria-expanded="${this.showDone}">${ico(this.showDone ? "chevDown" : "chevRight", 13)}오늘 완료<span class="n num">${done.length}</span></button>${this.showDone ? done.map(t => this.row(t)).join("") : ""}</div>`;
      html += `</div>`;
      if (none && !dock) html += `<button type="button" class="b-triage" data-act="triage">${prioSvg(0, 14)}<span>우선순위 미정 <b class="num">${none}</b>개</span><span class="go">정리하기${ico("arrowRight", 14)}</span></button>`;
    }
    this.el.innerHTML = html;
    this.place(); this.fit();
  },
  row(t) {
    const p = Store.planet(t.planetId), doing = t.status === "doing", done = t.status === "done", late = Store.isOverdue(t), pr = t.priority || 0;
    const fin = done && t.completedAt ? new Date(t.completedAt) : null;
    const when = doing ? `<span class="b-timer num" data-live="${t.id}">${U.fmtClock(Store.burned(t))}</span>`
      : fin ? `<span>${U.fmtTime(`${U.pad(fin.getHours())}:${U.pad(fin.getMinutes())}`)} 완료</span>`
      : t.due ? `<span class="${late ? "late" : ""}">${this.due(t)}${t.time ? " " + U.fmtTime(t.time) : ""}</span>` : t.time ? `<span>${U.fmtTime(t.time)}</span>` : "";
    const sd = t.steps.filter(x => x.done).length, steps = t.steps.length && !done ? `<span class="st">${ico("list", 11)}${sd}/${t.steps.length}</span>` : "";
    return `<div class="b-row p${pr} ${doing ? "doing" : ""} ${done ? "done" : ""} ${late ? "is-late" : ""} ${this.hoverId === t.id ? "hov" : ""}" data-task="${t.id}" tabindex="0">
      <button type="button" class="b-check ${done ? "on" : ""}" data-act="${done ? "undone" : "done"}" aria-label="${done ? "완료 취소" : "완료"}" title="${done ? "완료 취소" : "완료"}">${ico("check", 12)}</button>
      <div class="b-main"><div class="b-t"><span>${U.esc(t.title)}</span></div><div class="b-m"><i class="pd" style="--c:${p ? pColor(p) : "#fff"}" title="${U.esc(p ? p.name : "")}"></i><span class="pn">${U.esc(p ? p.name : "")}</span>${when ? `<span class="dot">·</span>${when}` : ""}${steps}</div></div>
      ${done ? "" : `<div class="b-acts">${doing || Scene.touch ? "" : `<button type="button" class="b-prio" data-act="prio" aria-label="우선순위: ${PRIO[pr].ko}" title="우선순위: ${PRIO[pr].ko}">${prioSvg(pr, 14)}</button>`}<button type="button" class="b-act" data-act="fire" aria-label="${doing ? "궤도로 되돌리기" : "태양에 올려 집중"}" title="${doing ? "궤도로 되돌리기" : "태양에 올려 집중"}">${ico(doing ? "orbitBack" : "flame", 15)}</button></div>`}
    </div>`;
  },
  /* 넘치면 한 단계씩 촘촘하게 */
  fit() {
    const b = this.el.querySelector(".b-body"); this.el.classList.remove("dense", "dense2"); if (!b) return;
    const over = () => b.scrollHeight > b.clientHeight + 2;
    if (over()) { this.el.classList.add("dense"); if (over()) this.el.classList.add("dense2"); }
    if (this.isDock()) this.place();
  },
  /* 휴대폰: 입력창 · 집중 바 바로 위에 붙이고, 우주가 보일 자리(170px)는 남긴다 */
  place() {
    if (!this.el.classList.contains("m-dock") || this.el.hidden) { this.el.style.bottom = this.el.style.maxHeight = ""; Scene.setDock(0); return; }
    const cmd = $("#cmd").getBoundingClientRect(), nb = Now.el && !Now.el.hidden ? Now.el.getBoundingClientRect() : null;
    const base = Math.min(cmd.top, nb && nb.height ? nb.top : 1e9), topH = $(".topbar").getBoundingClientRect().bottom;
    this.el.style.bottom = `${Math.round(innerHeight - base + 8)}px`;
    this.el.style.maxHeight = `${Math.round(Math.max(120, base - 8 - topH - 170))}px`;
    Scene.setDock(this.el.offsetHeight + 8);
  },
  closeM() { return false; },
  /* 휴대폰: 머리를 아래로 밀면 접고, 위로 밀면 편다 */
  swipeStart(e) {
    if (!this.isDock() || !e.target.closest(".b-head, .b-grip") || e.target.closest(".b-sum button")) return;
    const y0 = e.clientY, id = e.pointerId;
    const move = ev => { if (ev.pointerId !== id) return; const dy = ev.clientY - y0; if ((dy > 28 && !this.mini) || (dy < -28 && this.mini)) { end(); this._swiped = performance.now(); this.toggleMini(); } };
    const end = () => { removeEventListener("pointermove", move); removeEventListener("pointerup", end); removeEventListener("pointercancel", end); };
    addEventListener("pointermove", move); addEventListener("pointerup", end); addEventListener("pointercancel", end);
  },
  toggleMini() { this.mini = !this.mini; Store.setSetting("dockMini", this.mini); this.render(); },
  due(t) { const r = U.relDate(t.due); return Store.isOverdue(t) && !r.includes("지남") ? `${r} · 지남` : r; },
  onClick(e) {
    const b = e.target.closest("[data-act]"), row = e.target.closest("[data-task]");
    if (!b) { if (row) App.openTask(row.dataset.task); return; }
    const id = row && row.dataset.task, t = id && Store.task(id);
    switch (b.dataset.act) {
      case "collapse":
        if (performance.now() - (this._swiped || 0) < 400) break;
        if (this.isDock()) { this.toggleMini(); break; }
        this.collapsed = !this.collapsed; Store.setSetting("boardCollapsed", this.collapsed); this.render(); break;
      case "done": if (t) App.completeTask(id, b); break;
      case "undone": if (t) { Store.uncompleteTask(id); Juice.sfx("pause"); } break;
      case "prio": if (t) PrioMenu.open(b, t.priority || 0, v => Store.updateTask(id, { priority: v })); break;
      case "fire": if (!t) break; if (t.status === "doing") App.stopTask(id, b); else App.startTask(id, b); break;
      case "done-list": this.showDone = !this.showDone; Store.setSetting("boardDone", this.showDone); this.render(); break;
      case "ev": GCal.openEvent(b.dataset.ev); break;
      case "triage": Modal.triage(this.list().filter(x => x.status !== "doing" && !x.priority).map(x => x.id)); break;
    }
  },
  tick() { if (this.el.hidden) return; this.el.querySelectorAll("[data-live]").forEach(el => { const t = Store.task(el.dataset.live); if (t) el.textContent = U.fmtClock(Store.burned(t)); }); },
};

/* ── 우선순위 선택 메뉴 (숫자 키 1 2 3 0 으로도 선택) ── */
const PrioMenu = {
  el: null,
  open(anchor, cur, cb) {
    this.close();
    const el = document.createElement("div"); el.className = "pop prio-menu"; el.setAttribute("role", "menu");
    el.innerHTML = `<div class="pop-title">우선순위</div>` + PRIO_ORDER.map(p => `<button type="button" class="pop-item" data-p="${p}" role="menuitemradio" aria-checked="${cur === p}">${prioSvg(p, 15)}<span class="lbl">${PRIO[p].ko}</span><kbd>${p}</kbd>${cur === p ? `<span class="chk">${ico("check", 15)}</span>` : ""}</button>`).join("");
    document.body.appendChild(el);
    const r = anchor.getBoundingClientRect(), w = 210, h = el.offsetHeight;
    let x = r.left, y = r.bottom + 6; if (x + w > innerWidth - 8) x = innerWidth - w - 8; if (y + h > innerHeight - 8) y = r.top - h - 6;
    el.style.cssText = `position:fixed;left:${x}px;top:${y}px;bottom:auto;width:${w}px;z-index:85`;
    el.addEventListener("click", e => { const it = e.target.closest("[data-p]"); if (!it) return; cb(+it.dataset.p); this.close(); });
    this._off = e => { if (!el.contains(e.target) && !anchor.contains(e.target)) this.close(); };
    this._key = e => { if (["0", "1", "2", "3"].includes(e.key)) { e.preventDefault(); e.stopPropagation(); cb(+e.key); this.close(); } else if (e.key === "Escape") { e.stopPropagation(); this.close(); } };
    setTimeout(() => { document.addEventListener("pointerdown", this._off, true); document.addEventListener("keydown", this._key, true); }, 0);
    this.el = el;
  },
  close() { if (!this.el) return; this.el.remove(); this.el = null; document.removeEventListener("pointerdown", this._off, true); document.removeEventListener("keydown", this._key, true); },
};
