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
      const taskEl = e.target.closest(".cal-task");
      if (taskEl) { e.stopPropagation(); App.openTask(taskEl.dataset.id); return; }
      const cell = e.target.closest(".cal-cell");
      if (cell) { this.selected = cell.dataset.date; App.openDay(cell.dataset.date); this.render(); }
    });
    // 날짜 간 드래그 이동 (HTML5 DnD)
    this.grid.addEventListener("dragstart", e => { const t = e.target.closest(".cal-task"); if (!t) return; this.dragTask = t.dataset.id; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", t.dataset.id); });
    this.grid.addEventListener("dragover", e => { const c = e.target.closest(".cal-cell"); if (c && this.dragTask) { e.preventDefault(); c.classList.add("drop"); } });
    this.grid.addEventListener("dragleave", e => { const c = e.target.closest(".cal-cell"); if (c) c.classList.remove("drop"); });
    this.grid.addEventListener("drop", e => {
      const c = e.target.closest(".cal-cell"); if (!c || !this.dragTask) return; e.preventDefault();
      const t = Store.task(this.dragTask); this.dragTask = null;
      if (t && t.due !== c.dataset.date) { Store.updateTask(t.id, { due: c.dataset.date }); App.toast("📅", `「${t.title}」 → ${U.fmtDate(c.dataset.date)}`); }
    });
    this.grid.addEventListener("dragend", () => { this.dragTask = null; this.grid.querySelectorAll(".drop").forEach(c => c.classList.remove("drop")); });
  },
  move(n) { const d = new Date(this.ym.y, this.ym.m + n, 1); this.ym = { y: d.getFullYear(), m: d.getMonth() }; this.render(); },
  render() {
    if (this.el.hidden) return;
    const { y, m } = this.ym, today = U.today();
    this.title.textContent = `${y}년 ${m + 1}월`;
    const first = new Date(y, m, 1), start = new Date(y, m, 1 - first.getDay());
    const byDate = new Map();
    for (const t of Store.tasks()) { if (!t.due) continue; if (!byDate.has(t.due)) byDate.set(t.due, []); byDate.get(t.due).push(t); }
    const rows = (Math.ceil((first.getDay() + new Date(y, m + 1, 0).getDate()) / 7));
    let html = "", monthTotal = 0, monthDone = 0;
    for (let i = 0; i < rows * 7; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i); const ds = U.dateStr(d);
      const list = (byDate.get(ds) || []).sort(Store.sortTasks);
      const other = d.getMonth() !== m, done = list.filter(t => t.status === "done").length;
      if (!other) { monthTotal += list.length; monthDone += done; }
      const cls = ["cal-cell", other ? "other" : "", ds === today ? "today" : "", ds === this.selected ? "sel" : "", d.getDay() === 0 ? "sun" : "", d.getDay() === 6 ? "sat" : ""].filter(Boolean).join(" ");
      const max = 3, shown = list.slice(0, max);
      html += `<div class="${cls}" data-date="${ds}">
        <div class="cal-day"><span>${d.getDate()}</span>${list.length ? `<span class="cnt ${done === list.length ? "alldone" : ""}">${done}/${list.length}</span>` : ""}</div>
        ${shown.map(t => { const p = Store.planet(t.planetId); return `<div class="cal-task ${t.status} ${t.important ? "imp" : ""}" draggable="true" data-id="${t.id}" style="--c:${p ? p.color : "#fff"}" title="${U.esc(t.title)}">${t.status === "doing" ? "🔥" : ""}<span class="t">${U.esc(t.title)}</span></div>`; }).join("")}
        ${list.length > max ? `<div class="cal-more">+${list.length - max}개 더</div>` : ""}
      </div>`;
    }
    this.grid.innerHTML = html;
    this.sub.textContent = monthTotal ? `이번 달 ${monthTotal}개 중 ${monthDone}개 완료` : "이번 달에 예정된 할 일이 없어요";
    const noDue = Store.tasks().filter(t => !t.due && t.status !== "done").length;
    const legend = Store.planets().map(p => `<span style="--c:${p.color}"><i></i>${U.esc(p.name)}</span>`).join("");
    this.foot.innerHTML = `<div class="cal-legend">${legend}</div><div>${noDue ? `<button type="button" id="calNoDue">기한 없는 할 일 ${noDue}개</button> · ` : ""}할 일을 다른 날짜로 끌어다 놓을 수 있어요</div>`;
    const nd = document.getElementById("calNoDue"); if (nd) nd.addEventListener("click", () => App.openNoDue());
  },
};
