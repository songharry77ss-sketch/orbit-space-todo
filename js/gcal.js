/* ═══════════════ 구글 캘린더 연동: 계정 연결 · 양방향 동기화 · 구글 일정 함께 보기 ═══════════════
   - 구글 캘린더에 「ORBIT 할 일」 캘린더를 따로 만들어 마감일이 있는 할 일을 일정으로 넣는다.
     ORBIT에서 고치면 구글에도, 구글에서 날짜 · 제목을 고치면 ORBIT에도 반영된다. 그 캘린더에 구글에서 만든 일정은 새 할 일이 된다.
   - 다른 캘린더 일정은 읽기만 해서 ORBIT 캘린더와 보드에 함께 보여 준다.
   - 서버 없이 Google Identity Services 토큰으로 동작한다. 토큰은 1시간짜리라 끊기면 버튼 한 번으로 다시 잇는다. */
"use strict";

/* Google Cloud 콘솔에서 만든 「웹 애플리케이션」 OAuth 클라이언트 ID. 공개해도 되는 값이다(비밀 키 아님). README의 설정 방법 참고 */
const GCAL_CLIENT_ID = "57190288153-op2qmf54d449vmqoge7roc4r1hik4ooo.apps.googleusercontent.com";

const GCal = {
  /* 기본 연결은 Google이 「민감하지 않음」으로 분류한 두 권한만 쓴다 → 심사 · 경고 없이 누구나 연결 */
  SCOPES: ["https://www.googleapis.com/auth/calendar.app.created", "https://www.googleapis.com/auth/calendar.calendarlist.readonly"],
  /* 내 다른 일정 함께 보기(선택): 사용자가 켤 때만 따로 요청한다.
     FREE(일정 있는 시간대만)는 민감하지 않은 범위라 경고 없이 바로 연결되고,
     READ(일정 제목까지)는 민감한 범위라 Google 심사 전에는 「확인되지 않은 앱」 화면을 거친다 */
  FREE: "https://www.googleapis.com/auth/calendar.events.freebusy",
  READ: "https://www.googleapis.com/auth/calendar.events.readonly",
  API: "https://www.googleapis.com/calendar/v3",
  token: null, exp: 0, scope: "", tc: null, busy: false, again: false, timer: null, err: "", listed: false,
  ext: [], extCals: [], extRange: null,
  st() { const s = Store.state.settings; if (!s.gcal || typeof s.gcal !== "object") s.gcal = { on: false, calId: null, email: "", map: {}, syncToken: null, last: 0, show: false }; if (!s.gcal.map) s.gcal.map = {}; if (s.gcal.show && !s.gcal.mode) s.gcal.mode = "read"; return s.gcal; },
  /* iOS 앱(App Store) 안에서는 구글 로그인을 앱이 대신하고 토큰만 넘겨준다(구글은 앱 내부 웹뷰 로그인을 막음) */
  native() { return window.ORBIT_NATIVE === "ios" && !!window.ReactNativeWebView; },
  post(m) { try { window.ReactNativeWebView.postMessage(JSON.stringify(m)); } catch (_) { /* 앱 밖 */ } },
  clientId() { return GCAL_CLIENT_ID || Store.state.settings.gcalClientId || ""; },
  on() { return !!(this.clientId() && this.st().on); },
  live() { return !!this.token && this.exp > Date.now() + 30000; },
  canRead() { return !!this.scope && this.scope.includes("calendar.events.readonly"); },
  canFree() { return !!this.scope && /calendar\.(events\.)?freebusy/.test(this.scope); },
  canShow() { return this.canRead() || this.canFree(); },
  /* 예전 iOS 앱은 추가 권한을 고를 수 없어 늘 제목 읽기 권한을 요청한다 */
  nativeScopes() { return this.native() && Number(window.ORBIT_NATIVE_V) >= 2; },
  state() { if (!this.clientId()) return "nokey"; if (!this.st().on) return "off"; if (!this.live()) return "expired"; if (this.busy) return "busy"; return this.err ? "error" : "ok"; },
  init() {
    try { const t = JSON.parse(sessionStorage.getItem("orbit-gtoken") || "null"); if (t && t.exp > Date.now() + 60000) { this.token = t.t; this.exp = t.exp; this.scope = t.s || ""; } } catch (_) { /* 저장소 없음 */ }
    try { const c = JSON.parse(localStorage.getItem("orbit-gcal-ext") || "null"); if (c && this.st().on) { this.ext = c.items || []; this.extCals = c.cals || []; } } catch (_) { /* 저장소 없음 */ }
    Store.on(d => { if (!d.gcal && d.type !== "settings") this.schedule(); });
    document.addEventListener("visibilitychange", () => { if (!document.hidden) this.sync(); });
    setInterval(() => this.sync(), 120000);
    if (this.clientId() && !this.native()) this.loadGis().catch(() => {});
    this.paint();
    if (this.native() && this.on() && !this.live()) this.post({ type: "gcal-auth", silent: true });
    if (this.on() && this.live()) setTimeout(() => this.sync(), 1200);
  },
  /* ── 로그인(토큰) ── */
  loadGis() {
    if (this.native()) return Promise.resolve();
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    return this._gis || (this._gis = new Promise((res, rej) => {
      const s = document.createElement("script"); s.src = "https://accounts.google.com/gsi/client"; s.async = true;
      s.onload = () => res(); s.onerror = () => { this._gis = null; rej(new Error("Google 로그인 스크립트를 불러오지 못했어요")); };
      document.head.appendChild(s);
    }));
  },
  client() {
    if (this.tc && this.tc._id === this.clientId()) return this.tc;
    this.tc = google.accounts.oauth2.initTokenClient({
      client_id: this.clientId(), scope: this.SCOPES.join(" "), include_granted_scopes: true,
      callback: r => this.onToken(r),
      error_callback: e => { if (!e || e.type !== "popup_closed") App.toast("alert", "Google 연결 창을 열지 못했어요. 팝업 차단을 확인해 주세요"); this.paint(); },
    });
    this.tc._id = this.clientId();
    return this.tc;
  },
  /* 사용자가 누른 순간에 바로 불러야 팝업이 막히지 않는다 */
  connect() {
    if (!this.clientId()) { CalSync.open(); return; }
    if (this.native()) { this.post({ type: "gcal-auth", silent: this.st().on }); return; }
    if (!(window.google && google.accounts && google.accounts.oauth2)) { this.loadGis().then(() => App.toast("calendar", "준비됐어요. 한 번 더 눌러 주세요")).catch(e => App.toast("alert", e.message)); return; }
    const st = this.st();
    this.client().requestAccessToken({ prompt: st.on ? "" : "consent", login_hint: st.email || undefined });
  },
  /* 선택 기능: 내 구글 일정을 ORBIT에 함께 보기 위한 권한을 추가로 요청.
     full = false 면 일정 있는 시간대만(경고 없음), true 면 일정 제목까지(심사 전엔 경고 화면) */
  enableShow(full) {
    const add = full ? this.READ : this.FREE;
    if (this.native()) { this._wantRead = full || !this.nativeScopes() ? "full" : "free"; this.post({ type: "gcal-auth", read: true, scopes: [add] }); return; }
    if (!(window.google && google.accounts && google.accounts.oauth2)) { this.loadGis().then(() => App.toast("calendar", "준비됐어요. 한 번 더 눌러 주세요")).catch(e => App.toast("alert", e.message)); return; }
    this._wantRead = full ? "full" : "free";
    this.client().requestAccessToken({ scope: [...this.SCOPES, add].join(" "), prompt: "consent", login_hint: this.st().email || undefined });
  },
  gotShow() {
    const want = this._wantRead, st = this.st(); this._wantRead = false;
    if (this.canShow()) st.mode = this.canRead() ? "read" : "free";   /* 연결 시간이 지나도 어떤 보기였는지 기억 */
    if (!want) return;
    st.show = this.canShow();
    if (want === "full" && !this.canRead()) App.toast("alert", st.show ? "제목 보기 권한이 체크되지 않아 일정 있는 시간만 보여 드려요" : "일정 보기 권한이 체크되지 않아 켜지 못했어요");
    else if (!st.show) App.toast("alert", "일정 보기 권한이 체크되지 않아 켜지 못했어요");
    this.titleHelp = false;
  },
  onToken(r) {
    if (!r || r.error || !r.access_token) { App.toast("alert", "Google 연결이 취소됐어요"); this.paint(); return; }
    if (!google.accounts.oauth2.hasGrantedAllScopes(r, this.SCOPES[0])) { App.toast("alert", "「ORBIT 할 일」 캘린더를 만들 권한이 필요해요. 다시 연결하면서 체크해 주세요"); this.paint(); return; }
    this.token = r.access_token; this.exp = Date.now() + (Number(r.expires_in) || 3600) * 1000; this.scope = r.scope || this.SCOPES.join(" ");
    try { sessionStorage.setItem("orbit-gtoken", JSON.stringify({ t: this.token, exp: this.exp, s: this.scope })); } catch (_) { /* 저장소 없음 */ }
    const st = this.st(), first = !st.on; st.on = true; this.err = "";
    this.gotShow();
    Store.save();
    this.sync(true).then(ok => { if (ok && first) App.toast("calendar", `Google 캘린더에 연결했어요 · 「ORBIT 할 일」에 ${Object.keys(st.map).length}개를 넣었어요`); });
  },
  /* iOS 앱이 보내 주는 결과 */
  onNative(m) {
    if (!m) return;
    if (m.type === "token") {
      if (!(m.scope || "").includes("calendar.app.created")) { App.toast("alert", "「ORBIT 할 일」 캘린더를 만들 권한이 필요해요. 다시 연결하면서 체크해 주세요"); this.paint(); return; }
      this.token = m.access_token; this.exp = Date.now() + (Number(m.expires_in) || 3300) * 1000; this.scope = m.scope;
      try { sessionStorage.setItem("orbit-gtoken", JSON.stringify({ t: this.token, exp: this.exp, s: this.scope })); } catch (_) { /* 저장소 없음 */ }
      const st = this.st(), first = !st.on; st.on = true; this.err = ""; if (m.email) st.email = m.email;
      this.gotShow();
      Store.save();
      this.sync(true).then(ok => { if (ok && first) App.toast("calendar", `Google 캘린더에 연결했어요 · 「ORBIT 할 일」에 ${Object.keys(st.map).length}개를 넣었어요`); });
    } else if (m.type === "cancel") { this._wantRead = false; App.toast("alert", "Google 연결이 취소됐어요"); this.paint(); }
    else if (m.type === "none") { this.paint(); }
    else if (m.type === "error") { this._wantRead = false; App.toast("alert", "Google 연결 중 문제가 생겼어요: " + (m.message || "")); this.paint(); }
  },
  forget() { this.token = null; this.exp = 0; try { sessionStorage.removeItem("orbit-gtoken"); } catch (_) { /* 없음 */ } },
  /* ── 구글 캘린더 API ── */
  async api(path, { method = "GET", body, query } = {}) {
    if (!this.live()) throw Object.assign(new Error("Google 연결이 만료됐어요"), { code: 401 });
    const url = this.API + path + (query ? "?" + new URLSearchParams(query).toString() : "");
    const r = await fetch(url, { method, headers: Object.assign({ Authorization: `Bearer ${this.token}` }, body ? { "Content-Type": "application/json" } : {}), body: body ? JSON.stringify(body) : undefined });
    if (r.status === 204) return null;
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) this.forget();
    if (!r.ok) throw Object.assign(new Error((j.error && j.error.message) || `HTTP ${r.status}`), { code: r.status });
    return j;
  },
  tz() { return (Intl.DateTimeFormat().resolvedOptions().timeZone) || "Asia/Seoul"; },
  cal() { return `/calendars/${encodeURIComponent(this.st().calId)}/events`; },
  /* 「ORBIT 할 일」 캘린더 찾기(다른 기기에서 만든 것 포함) · 없으면 만들기. 구글 일정을 보여 줄 캘린더 목록도 함께 */
  async ensureCal() {
    const st = this.st(); let items = [], listed = true;
    /* 캘린더 목록 권한을 빼고 연결했으면: 저장해 둔 ORBIT 캘린더를 쓰고, 구글 일정은 기본 캘린더만 읽는다 */
    try { items = (await this.api("/users/me/calendarList", { query: { maxResults: "250" } })).items || []; }
    catch (e) { if (e.code !== 403) throw e; listed = false; }
    const me = items.find(c => c.primary); if (me) st.email = me.id;
    const mine = c => (c.description || "").includes("orbit-space-todo");
    let cal = (st.calId && (items.find(c => c.id === st.calId) || (!listed && { id: st.calId }))) || items.find(mine);
    if (!cal) cal = await this.api("/calendars", { method: "POST", body: { summary: "ORBIT 할 일", description: "ORBIT 우주 할 일 앱과 함께 바뀌는 캘린더예요. (orbit-space-todo)", timeZone: this.tz() } });
    if (st.calId !== cal.id) { st.calId = cal.id; st.map = {}; st.syncToken = null; }
    this.extCals = items.filter(c => c.id !== cal.id && !mine(c) && c.selected !== false && c.accessRole !== "freeBusyReader").slice(0, 8)
      .map(c => ({ id: c.id, name: c.summaryOverride || c.summary || "", color: c.backgroundColor || "#7c9cff" }));
    if (!listed) this.extCals = [{ id: "primary", name: "내 캘린더", color: "#7c9cff" }];
    this.listed = true;
  },
  /* 할 일 → 일정. 아이디를 할 일 아이디로 정해 두어 여러 기기에서 올려도 겹치지 않는다 */
  evId(tid) { let h = "orb"; for (const ch of String(tid)) h += ch.charCodeAt(0).toString(16).padStart(4, "0"); return h; },
  body(t) {
    const p = Store.planet(t.planetId), done = t.status === "done", tz = this.tz();
    const b = {
      summary: (done ? "✓ " : "") + t.title, status: "confirmed", transparency: "transparent",
      description: CalSync.details(t) + "\n\nORBIT에서 고치면 여기도 바뀌고, 여기서 날짜를 옮기면 ORBIT에도 반영돼요.",
      colorId: done ? "8" : ({ 1: "11", 2: "5", 3: "9" }[t.priority] || null),
      extendedProperties: { private: { orbitId: t.id, planet: p ? p.name : "", prio: String(t.priority || 0), done: done ? "1" : "0" } },
      reminders: { useDefault: false, overrides: t.time && !done ? [{ method: "popup", minutes: 10 }] : [] },
    };
    if (t.time) { const s = new Date(`${t.due}T${t.time}:00`), e = new Date(s.getTime() + 30 * 60000); b.start = { dateTime: s.toISOString(), timeZone: tz, date: null }; b.end = { dateTime: e.toISOString(), timeZone: tz, date: null }; }
    else { b.start = { date: t.due, dateTime: null, timeZone: null }; b.end = { date: U.addDays(t.due, 1), dateTime: null, timeZone: null }; }
    return b;
  },
  clean(o) { if (Array.isArray(o)) return o.map(x => this.clean(x)); if (o && typeof o === "object") { const r = {}; for (const k in o) if (o[k] !== null && o[k] !== undefined) r[k] = this.clean(o[k]); return r; } return o; },
  hash(t) {
    if (!t) return ""; const p = Store.planet(t.planetId);
    const s = [t.title, t.due, t.time || "", t.status === "done" ? 1 : 0, t.priority || 0, p ? p.name : "", (t.notes || "").slice(0, 300), t.steps.map(x => x.done ? 1 : 0).join("")].join("|");
    let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return String(h);
  },
  /* ORBIT 쪽 변경을 올린다: 새로 생긴 것 · 바뀐 것 · 지워졌거나 기한이 빠진 것 */
  async push() {
    const st = this.st(), map = st.map, seen = new Set(); let n = 0;
    for (const t of Store.tasks().filter(x => x.due)) {
      seen.add(t.id); const h = this.hash(t), m = map[t.id]; if (m && m.h === h) continue;
      let ev;
      try {
        ev = m && m.e ? await this.api(`${this.cal()}/${m.e}`, { method: "PATCH", body: this.body(t) })
          : await this.api(this.cal(), { method: "POST", body: this.clean(Object.assign({ id: this.evId(t.id) }, this.body(t))) });
      } catch (e) {
        if (![404, 409, 410].includes(e.code)) throw e;
        try { ev = await this.api(`${this.cal()}/${this.evId(t.id)}`, { method: "PATCH", body: this.body(t) }); }
        catch (e2) { if (e2.code !== 404) throw e2; ev = await this.api(this.cal(), { method: "POST", body: this.clean(this.body(t)) }); }
      }
      map[t.id] = { e: ev.id, tag: ev.etag, h }; n++;
    }
    for (const tid of Object.keys(map)) if (!seen.has(tid)) {
      await this.api(`${this.cal()}/${map[tid].e}`, { method: "DELETE" }).catch(e => { if (![404, 410].includes(e.code)) throw e; });
      delete map[tid]; n++;
    }
    return n;
  },
  when(e) {
    if (e.start && e.start.date) return { due: e.start.date, time: null };
    if (e.start && e.start.dateTime) { const d = new Date(e.start.dateTime), p = n => String(n).padStart(2, "0"); return { due: U.dateStr(d), time: `${p(d.getHours())}:${p(d.getMinutes())}` }; }
    return null;
  },
  /* 구글 쪽 변경을 받는다(증분 동기화 토큰). 내가 올린 그대로인 일정은 건너뛴다 */
  async pull() {
    const st = this.st(), map = st.map, rev = new Map(Object.entries(map).map(([tid, m]) => [m.e, tid])), items = [];
    let page = null;
    for (;;) {
      const q = { showDeleted: "true", maxResults: "250" };
      if (st.syncToken) q.syncToken = st.syncToken; if (page) q.pageToken = page;
      let r;
      try { r = await this.api(this.cal(), { query: q }); }
      catch (e) { if (e.code === 410 && st.syncToken) { st.syncToken = null; page = null; items.length = 0; continue; } throw e; }
      items.push(...(r.items || [])); page = r.nextPageToken || null;
      if (!page) { if (r.nextSyncToken) st.syncToken = r.nextSyncToken; break; }
    }
    const out = { added: 0, changed: 0, removed: 0 };
    for (const e of items) {
      if (e.recurrence || e.recurringEventId) continue;
      const pv = (e.extendedProperties && e.extendedProperties.private) || {}, tid = pv.orbitId || rev.get(e.id), m = tid && map[tid];
      if (e.status === "cancelled") {
        if (m && m.e === e.id) { delete map[tid]; const t = Store.task(tid); if (t && t.due) { Store.updateTask(tid, { due: null, time: null }, { gcal: true }); out.removed++; } }
        continue;
      }
      if (m && m.tag === e.etag) continue;
      const w = this.when(e); if (!w) continue;
      const title = (e.summary || "").replace(/^✓\s*/, "").trim() || "(제목 없음)", t = tid && Store.task(tid);
      if (t) {
        const patch = {}; if (t.title !== title) patch.title = title; if (t.due !== w.due) patch.due = w.due; if ((t.time || null) !== w.time) patch.time = w.time;
        if (Object.keys(patch).length) { Store.updateTask(t.id, patch, { gcal: true }); out.changed++; }
        map[t.id] = { e: e.id, tag: e.etag, h: this.hash(Store.task(t.id)) };
      } else {
        /* 다른 기기의 ORBIT이 올린 할 일, 또는 구글 캘린더에서 이 캘린더에 직접 만든 일정 → 새 할 일 */
        const pl = Store.planets().find(p => p.name === pv.planet) || Store.planet(QuickAdd.planetId) || Store.planets()[0], done = pv.done === "1";
        const nt = Store.addTask({ id: pv.orbitId || U.uid(), title, due: w.due, time: w.time, planetId: pl && pl.id, priority: +pv.prio || 0, notes: pv.orbitId ? "" : (e.description || "").slice(0, 2000), status: done ? "done" : "todo", completedAt: done ? Date.now() : null });
        if (nt) { map[nt.id] = { e: e.id, tag: e.etag, h: pv.orbitId ? this.hash(nt) : "" }; out.added++; }
      }
    }
    return out;
  },
  schedule() { if (!this.on()) return; clearTimeout(this.timer); this.timer = setTimeout(() => this.sync(), 1800); },
  async sync(force) {
    const st = this.st(); if (!this.on()) return false;
    if (!this.live()) { if (this.native() && (!this._askT || Date.now() - this._askT > 30000)) { this._askT = Date.now(); this.post({ type: "gcal-auth", silent: true }); } this.paint(); return false; }
    if (this.busy) { this.again = true; return false; }
    this.busy = true; this.paint(); let ok = false;
    try {
      if (!st.calId || !this.listed || force) await this.ensureCal();
      const r = await this.pull(); await this.push();
      if (st.show && this.canShow()) await this.fetchExt();
      st.last = Date.now(); this.err = ""; ok = true;
      const msg = [r.added && `새 일정 ${r.added}개`, r.changed && `바뀐 일정 ${r.changed}개`, r.removed && `지운 일정 ${r.removed}개는 기한 없음으로`].filter(Boolean);
      if (msg.length) App.toast("calendar", `구글 캘린더 변경을 반영했어요 · ${msg.join(" · ")}`);
    } catch (e) {
      this.err = e.code === 401 ? "" : e.code === 403 ? "권한이 부족해요. 연결을 끊고 다시 연결해 주세요" : (e.message || "동기화하지 못했어요");
      if (e.code === 404) { st.calId = null; this.listed = false; }
    } finally {
      Store.save(); this.busy = false; this.paint();
      if (typeof Calendar !== "undefined") Calendar.render();
      if (typeof Views !== "undefined" && Views.el.today) Views.render();
      if (this.again) { this.again = false; this.schedule(); }
    }
    return ok;
  },
  /* ── 구글 일정(읽기 전용) ── */
  async fetchExt(from, to) {
    from = from || U.addDays(U.today(), -42); to = to || U.addDays(U.today(), 84);
    const tmin = new Date(`${from}T00:00:00`).toISOString(), tmax = new Date(`${to}T23:59:59`).toISOString();
    const out = this.canRead() ? await this.fetchEvents(tmin, tmax) : await this.fetchBusy(from, to);
    this.ext = out; this.extRange = [from, to];
    try { localStorage.setItem("orbit-gcal-ext", JSON.stringify({ items: out, cals: this.extCals })); } catch (_) { /* 저장소 없음 */ }
  },
  /* 일정 있는 시간대만: 제목 없이 캘린더별 '바쁜 시간'을 받아 칸으로 보여 준다. 한 번에 30일씩 묻는다 */
  async fetchBusy(from, to) {
    const out = [], seen = new Set(), cals = this.extCals.slice(0, 50), p = n => String(n).padStart(2, "0"), hm = d => `${p(d.getHours())}:${p(d.getMinutes())}`;
    if (!cals.length) return out;
    for (let a = from; a <= to; a = U.addDays(a, 30)) {
      const b = U.addDays(a, 29) < to ? U.addDays(a, 29) : to;
      const r = await this.api("/freeBusy", { method: "POST", body: { timeMin: new Date(`${a}T00:00:00`).toISOString(), timeMax: new Date(`${b}T23:59:59`).toISOString(), timeZone: this.tz(), items: cals.map(c => ({ id: c.id })) } });
      for (const c of cals) {
        const x = r && r.calendars && r.calendars[c.id]; if (!x || (x.errors && x.errors.length)) continue;
        for (const bz of x.busy || []) {
          const s = new Date(bz.start), e = new Date(bz.end), id = `fb:${c.id}:${s.getTime()}`; if (!(e > s) || seen.has(id)) continue; seen.add(id);
          const due = U.dateStr(s), last = U.dateStr(new Date(e.getTime() - 60000)), allDay = hm(s) === "00:00" && hm(e) === "00:00";
          const until = last === due ? U.fmtTime(hm(e)) : `${e.getMonth() + 1}/${e.getDate()} ${U.fmtTime(hm(e))}`;
          out.push({ id, busy: true, title: allDay ? "종일 일정 있음" : `일정 있음 ~${until}`, due, time: allDay ? null : hm(s), end: last > due ? last : due, color: c.color, cal: c.name, link: `https://calendar.google.com/calendar/r/day/${s.getFullYear()}/${s.getMonth() + 1}/${s.getDate()}` });
        }
      }
    }
    return out;
  },
  async fetchEvents(tmin, tmax) {
    const out = [];
    for (const c of this.extCals) {
      try {
        const r = await this.api(`/calendars/${encodeURIComponent(c.id)}/events`, { query: { timeMin: tmin, timeMax: tmax, singleEvents: "true", orderBy: "startTime", maxResults: "250" } });
        for (const e of r.items || []) {
          if (e.status === "cancelled") continue; const w = this.when(e); if (!w) continue;
          const end = e.end ? (e.end.date ? U.addDays(e.end.date, -1) : U.dateStr(new Date(new Date(e.end.dateTime).getTime() - 60000))) : w.due;
          out.push({ id: e.id, title: e.summary || "(제목 없음)", due: w.due, time: w.time, end: end > w.due ? end : w.due, color: c.color, cal: c.name, link: e.htmlLink || "" });
        }
      } catch (e) { if (e.code === 401) throw e; }
    }
    return out;
  },
  /* 캘린더가 받아 둔 범위 밖을 보면 그 구간을 더 불러온다 */
  need(from, to) {
    if (!this.on() || !this.live() || !this.st().show || this.busy || this._fetching) return;
    const r = this.extRange; if (r && from >= r[0] && to <= r[1]) return;
    this._fetching = true;
    this.fetchExt(U.addDays(from, -7), U.addDays(to, 7)).catch(() => {}).finally(() => { this._fetching = false; Calendar.render(); if (typeof Views !== "undefined") Views.render(); });
  },
  /* merge = true(월간 칸): 제목 없는 「일정 있음」 칸이 여럿이면 한 칸으로 묶어 할 일을 가리지 않게 한다 */
  eventsOn(ds, merge) {
    if (!this.on() || !this.st().show) return [];
    const list = this.ext.filter(e => e.due <= ds && e.end >= ds).sort((a, b) => ((!a.time) - (!b.time)) || (a.time || "").localeCompare(b.time || ""));
    const busy = list.filter(e => e.busy); if (!merge || busy.length < 2) return list;
    const f = busy[0], times = busy.map(e => (e.time ? U.fmtTime(e.time) : "종일") + " " + e.title.replace("일정 있음 ", "")).join(", ");
    return [...list.filter(e => !e.busy), { id: f.id, busy: true, title: `일정 ${busy.length}개`, time: f.time, end: ds, color: f.color, cal: times }];
  },
  openEvent(id) { const e = this.ext.find(x => x.id === id); if (e && e.link) window.open(e.link, "_blank", "noopener"); },
  /* ── 화면 ── */
  G: '<svg class="g-logo" viewBox="0 0 48 48" width="16" height="16" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>',
  ago(ms) { if (!ms) return "아직 안 했어요"; const m = Math.round((Date.now() - ms) / 60000); return m < 1 ? "방금" : m < 60 ? `${m}분 전` : m < 1440 ? `${Math.round(m / 60)}시간 전` : `${Math.round(m / 1440)}일 전`; },
  label() { return { nokey: "Google 캘린더", off: "Google 연결", expired: "다시 연결", busy: "동기화 중", error: "확인 필요", ok: "동기화됨" }[this.state()]; },
  paint() {
    const b = document.getElementById("gcalBtn");
    if (b) { const s = this.state(); b.className = `gc-btn s-${s}`; b.innerHTML = `${this.G}<span class="lbl">${this.label()}</span>${s === "nokey" || s === "off" ? "" : '<i class="gc-dot"></i>'}`; b.title = s === "ok" ? `Google 캘린더와 동기화됨 · ${this.ago(this.st().last)} · 누르면 지금 동기화` : s === "expired" ? "Google 연결 시간이 지났어요. 누르면 다시 연결해요" : "Google 캘린더 연결"; }
    if (Modal.card && Modal.card.querySelector("#csG")) this.renderSection();
  },
  headClick() { const s = this.state(); if (s === "ok") this.sync(); else if (s === "expired") this.connect(); else if (s !== "busy") CalSync.open(); },
  disconnect() {
    Modal.confirm({ title: "Google 캘린더 연결 끊기", desc: "자동으로 함께 바뀌지 않게 돼요. 구글 캘린더의 「ORBIT 할 일」 캘린더와 일정은 그대로 남아요(필요 없으면 구글에서 지우면 돼요).", ok: "연결 끊기", onOk: () => {
      if (this.native()) this.post({ type: "gcal-signout" });
      else try { if (this.token && window.google && google.accounts) google.accounts.oauth2.revoke(this.token, () => {}); } catch (_) { /* 무시 */ }
      this.forget(); const st = this.st(); st.on = false; st.map = {}; st.syncToken = null; this.listed = false; this.err = ""; this.ext = []; this.extRange = null;
      try { localStorage.removeItem("orbit-gcal-ext"); } catch (_) { /* 없음 */ }
      Store.save(); this.paint(); Calendar.render(); Views.render(); App.toast("calendar", "Google 캘린더 연결을 끊었어요");
    } });
  },
  renderSection() {
    const box = Modal.card && Modal.card.querySelector("#csG"); if (!box) return;
    const s = this.state(), st = this.st(), G = this.G;
    const top = (t, sub, dot) => `<div class="gc-top">${G.replace('width="16" height="16"', 'width="22" height="22"')}<div><b>${t}</b><span>${sub}</span></div>${dot ? `<i class="gc-dot s-${s}"></i>` : ""}</div>`;
    if (s === "nokey") {
      box.innerHTML = `<div class="gc-card">${top("Google 캘린더 바로 연결", "계정만 연결하면 할 일이 구글 캘린더와 함께 바뀌어요")}
        <p class="cs-note">이 기능을 켜려면 앱 관리자가 Google Cloud에서 무료 OAuth 클라이언트 ID를 한 번 만들어 넣어야 해요. 방법은 README의 「구글 캘린더 연결 설정」에 있어요. 아래에 붙여 넣으면 이 브라우저에서 바로 시험해 볼 수 있어요.</p>
        <div class="gc-key"><input type="text" id="gcKey" placeholder="123456789-xxxx.apps.googleusercontent.com" aria-label="Google OAuth 클라이언트 ID" autocomplete="off" spellcheck="false"><button type="button" class="btn sm" id="gcKeySave">저장</button></div></div>`;
      box.querySelector("#gcKeySave").addEventListener("click", () => {
        const v = box.querySelector("#gcKey").value.trim();
        if (!/^[0-9]+-[a-z0-9]+[.]apps[.]googleusercontent[.]com$/.test(v)) { App.toast("alert", "클라이언트 ID 형식이 아니에요. …apps.googleusercontent.com 으로 끝나요"); return; }
        Store.setSetting("gcalClientId", v); this.tc = null; this.loadGis().catch(() => {}); this.paint();
      });
      return;
    }
    if (s === "off") {
      box.innerHTML = `<div class="gc-card">${top("Google 캘린더 바로 연결", "계정만 연결하면 할 일이 구글 캘린더와 함께 바뀌어요")}
        <ul class="gc-pts"><li>구글 캘린더에 「ORBIT 할 일」 캘린더가 생기고, 마감일이 있는 할 일이 우선순위 색과 10분 전 알림으로 들어가요</li><li>ORBIT에서 고치면 구글에도, 구글에서 날짜 · 제목을 바꾸면 ORBIT에도 반영돼요. 그 캘린더에 일정을 만들면 ORBIT 할 일이 돼요</li><li>원하면 내 구글 일정도 ORBIT 캘린더와 오늘 보드에 함께 볼 수 있어요 (선택 · 읽기만)</li></ul>
        <button type="button" class="gc-connect" id="gcConnect">${G}Google 계정으로 연결</button>
        <p class="cs-note">원래 있던 구글 일정은 바꾸거나 지우지 않아요. 연결은 언제든 끊을 수 있어요. · <a href="privacy.html" target="_blank" rel="noopener">개인정보처리방침</a></p></div>`;
      box.querySelector("#gcConnect").addEventListener("click", () => this.connect());
      return;
    }
    const live = this.live(), showOn = !!st.show && (this.canShow() || !live), titles = live ? this.canRead() : st.mode === "read", n = Object.keys(st.map).length, stx = { ok: "동기화됨", busy: "동기화 중…", expired: "연결 시간이 지났어요", error: "문제가 있어요" }[s];
    box.innerHTML = `<div class="gc-card on">${top("Google 캘린더 연결됨", `${U.esc(st.email || "")}${st.email ? " · " : ""}${stx}`, true)}
      ${this.err ? `<p class="gc-err">${U.esc(this.err)}</p>` : ""}
      <label class="toggle-row cs-row"><span>내 구글 일정도 ORBIT에 함께 보기<br><small style="color:var(--ink-3)">${showOn ? (titles ? "일정 제목까지 보여요" : "일정이 있는 시간대만 보여요 (제목은 숨김)") : this.canShow() ? "꺼져 있어요" : (this.native() && !this.nativeScopes() ? "켜면 일정 읽기 권한을 한 번 더 물어봐요" : "켜면 일정 있는 시간만 읽는 권한을 물어봐요 · 경고 화면 없이 바로 연결돼요")}</small></span><button type="button" class="switch ${showOn ? "on" : ""}" id="gcShow" role="switch" aria-checked="${showOn}" aria-label="구글 일정 함께 보기"></button></label>
      ${this.titleHelp || (showOn && !titles) ? (this.titleHelp ? `<div class="gc-guide"><b>일정 제목까지 보려면</b>
        <p>제목을 읽는 권한은 Google 앱 심사가 끝날 때까지 「Google에서 확인하지 않은 앱」 화면을 한 번 거쳐요. ORBIT 개발자가 직접 만든 앱이고, 일정은 이 기기에서 읽기만 할 뿐 어디에도 보내거나 바꾸지 않아요.</p>
        <ol><li>경고 화면 왼쪽 아래 <b>고급</b>을 눌러요</li><li><b>…(으)로 이동(안전하지 않음)</b>을 눌러요</li><li><b>일정 보기</b> 권한을 체크하고 <b>계속</b></li></ol>
        <div class="btn-row"><button type="button" class="btn sm" id="gcTitleNo">그만두기</button><button type="button" class="gc-connect sm" id="gcTitleGo">${G}계속해서 제목 보기</button></div></div>`
        : `<button type="button" class="link-btn gc-more" id="gcTitles">일정 제목도 보고 싶어요</button>`) : ""}
      <div class="btn-row">${s === "expired" ? `<button type="button" class="gc-connect sm" id="gcConnect">${G}다시 연결</button>` : `<button type="button" class="btn sm" id="gcSync" ${s === "busy" ? "disabled" : ""}>${ico("repeat", 15)}지금 동기화</button>`}<a class="btn sm" href="https://calendar.google.com/" target="_blank" rel="noopener">구글 캘린더 열기</a><button type="button" class="btn sm danger" id="gcOff">연결 끊기</button></div>
      <p class="cs-note">「ORBIT 할 일」 캘린더 · 함께 바뀌는 할 일 ${n}개 · 마지막 동기화 ${this.ago(st.last)}. Google 보안 정책상 연결은 1시간마다 새로 받아야 해서, 끊기면 캘린더 위 「다시 연결」을 한 번 눌러 주세요. 그동안 바뀐 내용은 다시 연결할 때 함께 올라가요.</p></div>`;
    box.querySelector("#gcShow").addEventListener("click", () => {
      if (!this.canShow() && !(st.show && !live)) {
        /* 예전 iOS 앱은 제목 읽기 권한(경고 화면)만 요청할 수 있어 안내부터 보여 준다 */
        if (this.native() && !this.nativeScopes()) { this.titleHelp = true; this.renderSection(); } else this.enableShow(false);
        return;
      }
      st.show = !st.show; Store.save(); this.renderSection(); if (st.show) this.sync(); else { Calendar.render(); Views.render(); }
    });
    const tl = box.querySelector("#gcTitles"); if (tl) tl.addEventListener("click", () => { this.titleHelp = true; this.renderSection(); });
    const tn = box.querySelector("#gcTitleNo"); if (tn) tn.addEventListener("click", () => { this.titleHelp = false; this.renderSection(); });
    const tg = box.querySelector("#gcTitleGo"); if (tg) tg.addEventListener("click", () => this.enableShow(true));
    const c = box.querySelector("#gcConnect"); if (c) c.addEventListener("click", () => this.connect());
    const y = box.querySelector("#gcSync"); if (y) y.addEventListener("click", () => this.sync(true));
    box.querySelector("#gcOff").addEventListener("click", () => this.disconnect());
  },
};
