/* ═══════════════ 캘린더 보기 ═══════════════ */
"use strict";

const Calendar = {
  el: null, grid: null, title: null, sub: null, foot: null, ym: null, selected: null, dragTask: null,
  init() {
    this.el = document.getElementById("calendar"); this.grid = document.getElementById("calGrid");
    this.title = document.getElementById("calTitle"); this.sub = document.getElementById("calSub"); this.foot = document.getElementById("calFoot");
    const t = U.parseDate(U.today()); this.ym = { y: t.getFullYear(), m: t.getMonth() };
    document.getElementById("calPrev").addEventListener("click", () => this.move(-1));
    document.getElementById("calNext").addEventListener("click", () => this.move(1));
    document.getElementById("calToday").addEventListener("click", () => { const d = U.parseDate(U.today()); this.ym = { y: d.getFullYear(), m: d.getMonth() }; this.render(); });
    this.grid.addEventListener("click", e => {
      const task = e.target.closest(".cal-task");
      if (task) { e.stopPropagation(); App.openTask(task.dataset.id); return; }
      const cell = e.target.closest(".cal-cell");
      if (cell) { this.selected = cell.dataset.date; App.openDay(cell.dataset.date); this.render(); }
    });
    this.grid.addEventListener("dragstart", e => { const t = e.target.closest(".cal-task"); if (!t) return; this.dragTask = t.dataset.id; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", t.dataset.id); });
    this.grid.addEventListener("dragover", e => { const c = e.target.closest(".cal-cell"); if (c && this.dragTask) { e.preventDefault(); this.grid.querySelectorAll(".drop").forEach(x => x !== c && x.classList.remove("drop")); c.classList.add("drop"); } });
    this.grid.addEventListener("dragleave", e => { const c = e.target.closest(".cal-cell"); if (c && !c.contains(e.relatedTarget)) c.classList.remove("drop"); });
    this.grid.addEventListener("drop", e => {
      const c = e.target.closest(".cal-cell"); if (!c || !this.dragTask) return; e.preventDefault();
      const t = Store.task(this.dragTask); this.dragTask = null;
      if (t && t.due !== c.dataset.date) { Store.updateTask(t.id, { due: c.dataset.date }); App.toast("calendar", `「${t.title}」 → ${U.fmtDate(c.dataset.date)}`); }
    });
    this.grid.addEventListener("dragend", () => { this.dragTask = null; this.grid.querySelectorAll(".drop").forEach(c => c.classList.remove("drop")); });
    window.addEventListener("resize", () => { if (!this.el.hidden) this.render(); });
  },
  move(n) { const d = new Date(this.ym.y, this.ym.m + n, 1); this.ym = { y: d.getFullYear(), m: d.getMonth() }; this.render(); },
  render() {
    if (this.el.hidden) return;
    const { y, m } = this.ym, today = U.today(), narrow = window.innerWidth < 640;
    this.title.textContent = `${y}년 ${m + 1}월`;
    const first = new Date(y, m, 1), start = new Date(y, m, 1 - first.getDay());
    const byDate = new Map();
    for (const t of Store.tasks()) { if (!t.due) continue; if (!byDate.has(t.due)) byDate.set(t.due, []); byDate.get(t.due).push(t); }
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
    const noDue = Store.tasks().filter(t => !t.due && t.status !== "done").length;
    const legend = Store.planets().map(p => `<span>${thumbImg(bodyKey(p), 16)}${U.esc(p.name)}</span>`).join("");
    this.foot.innerHTML = `<div class="cal-legend">${legend}</div><div>${noDue ? `<button type="button" class="link-btn" id="calNoDue">기한 없는 할 일 ${noDue}개</button> · ` : ""}할 일을 다른 날짜로 끌어 옮길 수 있어요</div>`;
    const nd = document.getElementById("calNoDue"); if (nd) nd.addEventListener("click", () => App.openNoDue());
  },
};
