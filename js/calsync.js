/* ═══════════════ 캘린더 연동: .ics 내보내기 · 가져오기 · 구글/아웃룩에 바로 추가 ═══════════════
   서버 없이 동작하도록 표준 iCalendar(.ics) 파일로 주고받는다. 구글 · 애플 · 아웃룩 · 삼성 캘린더 모두 읽을 수 있다. */
"use strict";

const CalSync = {
  scope: "open", alarm: true, parsed: null, target: null, skipPast: true,
  /* ── iCalendar 만들기 ── */
  txt(s) { return String(s || "").replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;"); },
  /* 한 줄 75바이트 제한: 한글(3바이트)이 잘리지 않게 글자 단위로 접는다 */
  fold(line) {
    const enc = new TextEncoder(); let out = "", cur = "", n = 0;
    for (const ch of line) { const b = enc.encode(ch).length; if (n + b > (out ? 74 : 75)) { out += (out ? "\r\n " : "") + cur; cur = ""; n = 0; } cur += ch; n += b; }
    return out ? out + "\r\n " + cur : cur;
  },
  utc(d) { return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); },
  ymd(ds) { return ds.replace(/-/g, ""); },
  span(t) { /* 시간이 있으면 30분짜리 일정, 없으면 하루 종일 */
    if (t.time) { const s = new Date(`${t.due}T${t.time}:00`), e = new Date(s.getTime() + 30 * 60000); return { allDay: false, s, e }; }
    return { allDay: true, s: t.due, e: U.addDays(t.due, 1) };
  },
  details(t) {
    const p = Store.planet(t.planetId), lines = [];
    if (t.notes) lines.push(t.notes);
    if (t.steps.length) lines.push(t.steps.map(s => `${s.done ? "☑" : "☐"} ${s.title}`).join("\n"));
    lines.push(`ORBIT · ${p ? p.name : ""}${t.priority ? ` · 우선순위 ${PRIO[t.priority].ko}` : ""}`);
    return lines.join("\n\n");
  },
  event(t) {
    const sp = this.span(t), p = Store.planet(t.planetId);
    const L = ["BEGIN:VEVENT", `UID:${t.id}@orbit-space-todo`, `DTSTAMP:${this.utc(new Date())}`];
    if (sp.allDay) L.push(`DTSTART;VALUE=DATE:${this.ymd(sp.s)}`, `DTEND;VALUE=DATE:${this.ymd(sp.e)}`);
    else L.push(`DTSTART:${this.utc(sp.s)}`, `DTEND:${this.utc(sp.e)}`);
    L.push(`SUMMARY:${this.txt((t.status === "done" ? "✓ " : "") + t.title)}`, `DESCRIPTION:${this.txt(this.details(t))}`);
    if (p) L.push(`CATEGORIES:${this.txt(p.name)}`);
    if (t.priority) L.push(`PRIORITY:${[0, 1, 5, 9][t.priority]}`);
    const rr = { daily: "FREQ=DAILY", weekdays: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", weekly: "FREQ=WEEKLY", monthly: "FREQ=MONTHLY" }[t.repeat];
    if (rr && t.status !== "done") L.push(`RRULE:${rr}`);
    L.push("TRANSP:TRANSPARENT");
    if (this.alarm && !sp.allDay && t.status !== "done") L.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${this.txt(t.title)}`, "TRIGGER:-PT10M", "END:VALARM");
    L.push("END:VEVENT");
    return L;
  },
  ics(tasks) {
    const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone) || "Asia/Seoul";
    const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ORBIT//Space Todo//KO", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:ORBIT 할 일", `X-WR-TIMEZONE:${tz}`];
    tasks.forEach(t => L.push(...this.event(t)));
    L.push("END:VCALENDAR");
    return L.map(l => this.fold(l)).join("\r\n") + "\r\n";
  },
  save(name, text) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/calendar;charset=utf-8" })); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  },
  /* ── 할 일 하나를 바로 추가 ── */
  googleUrl(t) {
    const sp = this.span(t), dates = sp.allDay ? `${this.ymd(sp.s)}/${this.ymd(sp.e)}` : `${this.utc(sp.s)}/${this.utc(sp.e)}`;
    return "https://calendar.google.com/calendar/render?" + new URLSearchParams({ action: "TEMPLATE", text: t.title, dates, details: this.details(t) }).toString();
  },
  outlookUrl(t) {
    const sp = this.span(t), q = { path: "/calendar/action/compose", rru: "addevent", subject: t.title, body: this.details(t), allday: String(sp.allDay) };
    if (sp.allDay) { q.startdt = sp.s; q.enddt = sp.e; } else { q.startdt = sp.s.toISOString(); q.enddt = sp.e.toISOString(); }
    return "https://outlook.live.com/calendar/0/deeplink/compose?" + new URLSearchParams(q).toString();
  },
  addOne(id, where) {
    const t = Store.task(id); if (!t) return;
    if (!t.due) { App.toast("calendar", "마감일을 먼저 정해 주세요"); return; }
    if (where === "ics") { this.save(`${t.title.slice(0, 40).replace(/[\\/:*?"<>|]/g, "")}.ics`, this.ics([t])); App.toast("download", ".ics 파일을 받았어요. 열면 캘린더에 추가돼요"); return; }
    window.open(where === "google" ? this.googleUrl(t) : this.outlookUrl(t), "_blank", "noopener");
  },
  /* ── .ics 읽기 (VEVENT · VTODO) ── */
  untxt(s) { return String(s || "").replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1"); },
  parse(text) {
    const lines = String(text).replace(/\r\n?/g, "\n").replace(/\n[ \t]/g, "").split("\n"), out = [];
    let cur = null, depth = 0;
    for (const raw of lines) {
      const line = raw.trim(); if (!line) continue;
      if (line === "BEGIN:VEVENT" || line === "BEGIN:VTODO") { cur = { kind: line.slice(6), props: {} }; depth = 0; continue; }
      if (!cur) continue;
      if (line === "END:VEVENT" || line === "END:VTODO") { if (!depth) { out.push(cur); cur = null; } continue; }
      if (line.startsWith("BEGIN:")) { depth++; continue; }
      if (line.startsWith("END:")) { if (depth) depth--; continue; }
      if (depth) continue;
      const i = line.indexOf(":"); if (i < 0) continue;
      const [name, ...params] = line.slice(0, i).split(";"), key = name.toUpperCase();
      if (!(key in cur.props)) cur.props[key] = { val: line.slice(i + 1), params: params.join(";").toUpperCase() };
    }
    return out.map(c => this.item(c)).filter(Boolean);
  },
  when(dt) {
    const v = dt.val.trim(), m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/); if (!m) return null;
    if (/VALUE=DATE(?!-)/.test(dt.params) || !m[4]) return { due: `${m[1]}-${m[2]}-${m[3]}`, time: null };
    const d = m[7] ? new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0))) : new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5]);
    const pad = n => String(n).padStart(2, "0"), time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return { due: U.dateStr(d), time: time === "00:00" ? null : time };
  },
  /* 반복 일정은 오늘 이후의 가장 가까운 날로 옮기고, ORBIT 반복으로 바꾼다 */
  roll(it, rule) {
    const R = Object.fromEntries(rule.split(";").map(x => x.split("=")));
    if (R.UNTIL) { const u = this.when({ val: R.UNTIL, params: "" }); if (u && u.due < U.today()) return false; }
    const f = R.FREQ, wk = R.BYDAY === "MO,TU,WE,TH,FR";
    it.repeat = f === "DAILY" ? "daily" : f === "WEEKLY" ? (wk ? "weekdays" : "weekly") : f === "MONTHLY" ? "monthly" : "none";
    const today = U.today(); if (!it.due || it.due >= today) return true;
    const step = f === "DAILY" || wk ? 1 : f === "WEEKLY" ? 7 : 0;
    if (step) { let d = it.due; const n = Math.ceil(U.diffDays(d, today) / step); d = U.addDays(d, n * step); while (wk && [0, 6].includes(U.parseDate(d).getDay())) d = U.addDays(d, 1); it.due = d; }
    else if (f === "MONTHLY" || f === "YEARLY") { const s = U.parseDate(it.due), t = U.parseDate(today); let y = t.getFullYear(), mo = f === "MONTHLY" ? t.getMonth() : s.getMonth(); let c = new Date(y, mo, s.getDate()); if (U.dateStr(c) < today) c = f === "MONTHLY" ? new Date(y, mo + 1, s.getDate()) : new Date(y + 1, mo, s.getDate()); it.due = U.dateStr(c); }
    return true;
  },
  item(c) {
    const P = c.props, title = this.untxt(P.SUMMARY && P.SUMMARY.val).trim(); if (!title) return null;
    const st = (P.STATUS && P.STATUS.val || "").toUpperCase(); if (st === "CANCELLED") return null;
    const dt = P.DTSTART || P.DUE, w = dt ? this.when(dt) : null; if (!w && c.kind === "VEVENT") return null;
    const it = { uid: (P.UID && P.UID.val.trim()) || `${title}|${w && w.due}|${w && w.time}`, title: title.slice(0, 200), notes: this.untxt(P.DESCRIPTION && P.DESCRIPTION.val).slice(0, 2000), due: w ? w.due : null, time: w ? w.time : null, done: c.kind === "VTODO" && st === "COMPLETED", repeat: "none", rec: false };
    if (P.RRULE) { it.rec = true; if (!this.roll(it, P.RRULE.val.toUpperCase())) return null; }
    if (/@orbit-space-todo$/.test(it.uid)) it.own = it.uid.replace(/@orbit-space-todo$/, "");
    return it;
  },
  pick() { const past = this.skipPast, today = U.today(); return (this.parsed || []).filter(it => !(past && it.due && it.due < today && !it.done)); },
  doImport() {
    const items = this.pick(), byUid = new Map(Store.tasks().filter(t => t.extUid).map(t => [t.extUid, t])), add = [], now = Date.now(); let upd = 0;
    for (const it of items) {
      const ex = byUid.get(it.uid) || (it.own && Store.task(it.own));
      if (ex) { Object.assign(ex, { title: it.own ? ex.title : it.title, due: it.due, time: it.time }); upd++; continue; }
      add.push({ id: U.uid(), title: it.title, notes: it.notes, planetId: this.target, due: it.due, time: it.time, priority: 0, myDay: null, status: it.done ? "done" : "todo", startedAt: null, burnSeconds: 0, completedAt: it.done ? now : null, steps: [], repeat: it.repeat, createdAt: now, extUid: it.uid });
    }
    Store.state.tasks.push(...add); Store.emit({ type: "task-add" }); Modal.close();
    const ids = new Set(add.map(t => t.id));
    App.toast("calendar", `${add.length}개를 가져왔어요${upd ? ` · ${upd}개는 최신으로 고쳤어요` : ""}`, add.length ? () => { Store.state.tasks = Store.state.tasks.filter(t => !ids.has(t.id)); Store.emit({ type: "task-remove" }); } : null);
  },
  /* ── 연동 창 ── */
  open() {
    const all = Store.tasks().filter(t => t.due), open = all.filter(t => t.status !== "done");
    Modal.show(`<h3>캘린더 연동</h3>
      <p class="desc">구글 캘린더는 계정을 연결하면 자동으로 함께 바뀌어요. 애플 · 아웃룩 · 삼성 캘린더는 표준 캘린더 파일(.ics)로 주고받아요.</p>
      <div id="csG"></div>
      <h4>파일로 보내기 (.ics)</h4>
      <div class="cs-seg" role="radiogroup" aria-label="보낼 범위">
        <button type="button" data-scope="open" role="radio">남은 할 일 <b class="num">${open.length}</b></button>
        <button type="button" data-scope="all" role="radio">완료 포함 <b class="num">${all.length}</b></button>
      </div>
      <label class="toggle-row cs-row"><span>시간이 있는 할 일은 10분 전에 알림</span><button type="button" class="switch ${this.alarm ? "on" : ""}" id="csAlarm" role="switch" aria-checked="${this.alarm}" aria-label="10분 전 알림"></button></label>
      <div class="btn-row"><button type="button" class="btn sol sm" id="csExport">${ico("download", 15)}.ics 파일 받기</button></div>
      <ul class="cs-how">
        <li><b>구글 캘린더</b><span>웹에서 설정 → 가져오기/내보내기 → 받은 파일 선택</span></li>
        <li><b>애플 캘린더</b><span>맥 · 아이폰에서 받은 파일을 열기</span></li>
        <li><b>아웃룩</b><span>캘린더 추가 → 파일에서 업로드</span></li>
        <li><b>삼성 캘린더</b><span>받은 파일을 열고 캘린더 앱으로 가져오기</span></li>
      </ul>
      <p class="cs-note">마감일이 있는 할 일만 들어가고, 시간이 없으면 하루 종일 일정이 돼요. 같은 파일을 다시 넣으면 애플 · 아웃룩은 기존 일정을 고쳐 쓰고, 구글은 중복될 수 있어요. 할 일 하나만 보내려면 상세 화면의 「캘린더에 추가」를 쓰세요.</p>
      <h4>파일로 가져오기 (.ics)</h4>
      <div id="csImp"></div>
      <div class="m-actions"><button type="button" class="btn" id="csClose">닫기</button></div>`);
    const c = Modal.card;
    const paint = () => c.querySelectorAll("[data-scope]").forEach(b => { const on = b.dataset.scope === this.scope; b.classList.toggle("on", on); b.setAttribute("aria-checked", String(on)); });
    paint();
    c.querySelectorAll("[data-scope]").forEach(b => b.addEventListener("click", () => { this.scope = b.dataset.scope; paint(); }));
    c.querySelector("#csAlarm").addEventListener("click", e => { this.alarm = !this.alarm; e.currentTarget.classList.toggle("on", this.alarm); e.currentTarget.setAttribute("aria-checked", String(this.alarm)); });
    c.querySelector("#csExport").addEventListener("click", () => {
      const list = (this.scope === "all" ? all : open).filter(t => Store.task(t.id));
      if (!list.length) { App.toast("calendar", "마감일이 있는 할 일이 없어요"); return; }
      this.save(`orbit-${U.today()}.ics`, this.ics(list)); App.toast("download", `할 일 ${list.length}개를 .ics 파일로 받았어요`);
    });
    c.querySelector("#csClose").addEventListener("click", () => Modal.close());
    this.parsed = null; this.renderImport(); GCal.renderSection(); if (GCal.clientId()) GCal.loadGis().catch(() => {});
  },
  renderImport() {
    const box = Modal.card && Modal.card.querySelector("#csImp"); if (!box) return;
    if (!this.parsed) {
      box.innerHTML = `<div class="btn-row"><label class="btn sm" for="csFile">${ico("upload", 15)}.ics 파일 고르기</label></div><input type="file" id="csFile" accept=".ics,text/calendar" hidden>
        <p class="cs-note">구글 캘린더는 설정 → 가져오기/내보내기 → 내보내기로 받은 zip을 풀면 .ics 파일이 있어요. 애플 캘린더는 파일 → 내보내기, 아웃룩은 캘린더 저장으로 만들 수 있어요.</p>`;
      box.querySelector("#csFile").addEventListener("change", e => {
        const f = e.target.files[0]; if (!f) return; const r = new FileReader();
        r.onload = () => { try { this.parsed = this.parse(r.result); } catch (err) { this.parsed = []; } if (!this.parsed.length) { App.toast("alert", "가져올 일정을 찾지 못했어요. .ics 파일이 맞는지 확인해 주세요"); this.parsed = null; return; } if (!this.target || !Store.planet(this.target)) this.target = QuickAdd.planetId || (Store.planets()[0] || {}).id; this.renderImport(); };
        r.readAsText(f);
      });
      return;
    }
    const ps = Store.planets(), items = this.pick(), today = U.today(), total = this.parsed.length, past = this.parsed.filter(it => it.due && it.due < today && !it.done).length;
    const known = new Set(Store.tasks().map(t => t.extUid).filter(Boolean)), dup = items.filter(it => known.has(it.uid) || (it.own && Store.task(it.own))).length;
    const sample = items.slice().sort((a, b) => (a.due || "9").localeCompare(b.due || "9")).slice(0, 5);
    box.innerHTML = `<div class="cs-prev"><b>${total}개</b> 일정을 찾았어요${past ? ` · 지난 일정 ${past}개` : ""}${dup ? ` · 이미 있는 ${dup}개는 최신으로 고쳐요` : ""}</div>
      <ul class="cs-list">${sample.map(it => `<li><span class="d">${it.due ? U.fmtDate(it.due) : "기한 없음"}${it.time ? " " + U.fmtTime(it.time) : ""}</span><span class="t">${U.esc(it.title)}</span>${it.rec ? `<span class="r">${ico("repeat", 12)}</span>` : ""}</li>`).join("")}${items.length > 5 ? `<li class="more">외 ${items.length - 5}개</li>` : ""}</ul>
      <div class="cs-lbl">넣을 행성</div>
      <div class="cs-planets">${ps.map(p => `<button type="button" class="${p.id === this.target ? "on" : ""}" data-pid="${p.id}">${thumbImg(bodyKey(p), 18)}${U.esc(p.name)}</button>`).join("")}</div>
      <label class="toggle-row cs-row"><span>지난 일정은 빼기</span><button type="button" class="switch ${this.skipPast ? "on" : ""}" id="csPast" role="switch" aria-checked="${this.skipPast}" aria-label="지난 일정 빼기"></button></label>
      <div class="btn-row"><button type="button" class="btn sol sm" id="csDo" ${items.length ? "" : "disabled"}>${ico("upload", 15)}${items.length}개 가져오기</button><button type="button" class="btn sm" id="csAgain">다른 파일</button></div>`;
    box.querySelectorAll("[data-pid]").forEach(b => b.addEventListener("click", () => { this.target = b.dataset.pid; this.renderImport(); }));
    box.querySelector("#csPast").addEventListener("click", () => { this.skipPast = !this.skipPast; this.renderImport(); });
    box.querySelector("#csDo").addEventListener("click", () => this.doImport());
    box.querySelector("#csAgain").addEventListener("click", () => { this.parsed = null; this.renderImport(); });
  },
};
