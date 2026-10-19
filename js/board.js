/* ═══════════════ 오늘 보드: 집중 중 + 우선순위별 할 일을 한눈에 (데스크톱 왼쪽) ═══════════════ */
"use strict";

const Board = {
  el: null, collapsed: false, hoverId: null,
  init() {
    this.el = $("#board");
    const saved = Store.state.settings.boardCollapsed;
    this.collapsed = saved != null ? !!saved : window.innerWidth < 1100;
    this.el.addEventListener("click", e => this.onClick(e));
    this.el.addEventListener("pointerover", e => { const r = e.target.closest("[data-task]"); this.setHover(r ? r.dataset.task : null); });
    this.el.addEventListener("pointerleave", () => this.setHover(null));
    this.el.addEventListener("keydown", e => { const r = e.target.closest(".b-row"); if (r && e.target === r && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); App.openTask(r.dataset.task); } });
    window.addEventListener("resize", () => this.render());
  },
  setHover(id) { if (this.hoverId === id) return; this.hoverId = id; Scene.listHover = id; },
  list() { const all = App.view === "all"; return Store.tasks().filter(t => t.status !== "done" && (all || Store.isTodayTask(t))).sort(Store.sortTasks); },
  render() {
    const hide = App.view === "calendar" || window.innerWidth < 640;
    this.el.hidden = hide;
    document.body.classList.toggle("has-board", !hide && !this.collapsed);
    Scene.setBoard(!hide && !this.collapsed ? 344 : 0);
    if (hide) return;
    const list = this.list(), doing = list.filter(t => t.status === "doing"), rest = list.filter(t => t.status !== "doing");
    const groups = PRIO_ORDER.map(p => [p, rest.filter(t => (t.priority || 0) === p)]).filter(([, l]) => l.length);
    const none = rest.filter(t => !t.priority).length, high = rest.filter(t => t.priority === 1).length, late = rest.filter(t => Store.isOverdue(t)).length;
    const title = App.view === "all" ? "전체 할 일" : "오늘 할 일";
    const sum = [high ? `<span class="b-chip" style="--pc:${PRIO[1].color}">${prioSvg(1, 12)}높음 ${high}</span>` : "", late ? `<span class="b-chip late">지남 ${late}</span>` : ""].join("");
    let html = `<div class="b-head"><button type="button" class="b-title" data-act="collapse" aria-expanded="${!this.collapsed}" title="${this.collapsed ? "펼치기" : "접기"}">${ico(this.collapsed ? "chevRight" : "chevDown", 15)}<span>${title}</span><span class="b-count num">${list.length}</span></button><div class="b-sum">${sum}</div></div>`;
    if (doing.length) html += `<div class="b-sec fire"><div class="b-sh"><span class="f-dot"></span>집중 중<span class="n num">${doing.length}</span></div>${doing.map(t => this.row(t)).join("")}</div>`;
    if (!this.collapsed) {
      html += `<div class="b-body">`;
      groups.forEach(([p, l]) => { html += `<div class="b-sec"><div class="b-sh" style="--pc:${PRIO[p].color}">${prioSvg(p, 13)}${p ? PRIO[p].ko : "우선순위 미정"}<span class="n num">${l.length}</span></div>${l.map(t => this.row(t)).join("")}</div>`; });
      if (!list.length) html += `<div class="b-empty"><b>${App.view === "all" ? "남은 할 일이 없어요" : "오늘 남은 할 일이 없어요"}</b>아래 입력창에서 새 할 일을 추가하세요</div>`;
      html += `</div>`;
      if (none) html += `<button type="button" class="b-triage" data-act="triage">${prioSvg(0, 14)}<span>우선순위 미정 <b class="num">${none}</b>개</span><span class="go">정리하기${ico("arrowRight", 14)}</span></button>`;
    }
    this.el.innerHTML = html;
  },
  row(t) {
    const p = Store.planet(t.planetId), doing = t.status === "doing", late = Store.isOverdue(t), pr = t.priority || 0;
    const when = doing ? `<span class="b-timer num" data-live="${t.id}">${U.fmtClock(Store.burned(t))}</span>`
      : t.due ? `<span class="${late ? "late" : ""}">${Board.due(t)}${t.time ? " " + U.fmtTime(t.time) : ""}</span>` : t.time ? `<span>${U.fmtTime(t.time)}</span>` : "";
    return `<div class="b-row ${doing ? "doing" : ""} ${this.hoverId === t.id ? "hov" : ""}" data-task="${t.id}" tabindex="0">
      <button type="button" class="b-check" data-act="done" aria-label="완료" title="완료">${ico("check", 12)}</button>
      ${doing ? "" : `<button type="button" class="b-prio" data-act="prio" aria-label="우선순위: ${PRIO[pr].ko}" title="우선순위: ${PRIO[pr].ko}">${prioSvg(pr, 14)}</button>`}
      <div class="b-main"><div class="b-t">${U.esc(t.title)}</div><div class="b-m"><i class="pd" style="--c:${p ? pColor(p) : "#fff"}"></i><span>${U.esc(p ? p.name : "")}</span>${when ? `<span class="dot">·</span>${when}` : ""}</div></div>
      <button type="button" class="b-act" data-act="fire" aria-label="${doing ? "궤도로 되돌리기" : "태양에 올려 집중"}" title="${doing ? "궤도로 되돌리기" : "태양에 올려 집중"}">${ico(doing ? "orbitBack" : "flame", 15)}</button>
    </div>`;
  },
  due(t) { const r = U.relDate(t.due); return Store.isOverdue(t) && !r.includes("지남") ? `${r} · 지남` : r; },
  onClick(e) {
    const b = e.target.closest("[data-act]"), row = e.target.closest("[data-task]");
    if (!b) { if (row) App.openTask(row.dataset.task); return; }
    const id = row && row.dataset.task, t = id && Store.task(id);
    switch (b.dataset.act) {
      case "collapse": this.collapsed = !this.collapsed; Store.setSetting("boardCollapsed", this.collapsed); this.render(); break;
      case "done": if (t) App.completeTask(id); break;
      case "prio": if (t) PrioMenu.open(b, t.priority || 0, v => Store.updateTask(id, { priority: v })); break;
      case "fire": if (!t) break; if (t.status === "doing") { Store.stopTask(id); App.toast("orbitBack", "궤도로 돌아왔어요"); } else App.startTask(id); break;
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
