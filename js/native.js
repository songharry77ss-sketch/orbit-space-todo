/* ═══════════════ iOS 앱 연결: 마감 알림(기기 로컬 알림) · 촉감 피드백. 앱 밖(브라우저)에서는 아무것도 하지 않는다 ═══════════════ */
"use strict";

const Native = {
  MAX: 60,          // iOS는 예약 알림을 64개까지 들고 있다
  perm: null, _t: 0, _last: "",
  ok() { return window.ORBIT_NATIVE === "ios" && !!window.ReactNativeWebView; },
  post(m) { try { window.ReactNativeWebView.postMessage(JSON.stringify(m)); } catch (_) { /* 앱 밖 */ } },
  on() { return Store.state.settings.notify !== false; },
  init() {
    if (!this.ok()) return;
    Store.on(d => {
      if (d && d.type === "task-complete") this.haptic("success");
      else if (d && d.type === "task-start") this.haptic("light");
      this.schedule();
    });
    this.schedule(400);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) this.schedule(400); });
  },
  haptic(kind) { if (this.ok()) this.post({ type: "haptic", kind }); },
  /* 시간이 있는 할 일은 10분 전, 날짜만 있으면 그날 오전 9시 */
  items() {
    const now = Date.now(), out = [];
    for (const t of Store.tasks()) {
      if (t.status === "done" || !t.due) continue;
      const [y, mo, d] = t.due.split("-").map(Number);
      let at, body;
      if (t.time) { const [h, mi] = t.time.split(":").map(Number); at = new Date(y, mo - 1, d, h, mi).getTime() - 10 * 60000; body = `10분 뒤 ${t.time}`; }
      else { at = new Date(y, mo - 1, d, 9, 0).getTime(); body = "오늘 마감"; }
      if (at <= now + 30000) continue;
      const p = Store.planet(t.planetId); if (p) body += ` · ${p.name}`;
      out.push({ id: t.id, at, title: t.title || "할 일", body });
    }
    return out.sort((a, b) => a.at - b.at).slice(0, this.MAX);
  },
  schedule(ms = 1500) {
    if (!this.ok()) return;
    clearTimeout(this._t);
    this._t = setTimeout(() => {
      const items = this.on() ? this.items() : [], key = JSON.stringify(items);
      if (key === this._last) return;
      this._last = key;
      this.post({ type: "reminders", items });
    }, ms);
  },
  setOn(v) { Store.setSetting("notify", v); this._last = ""; this.schedule(0); },
  /* 앱이 알려 주는 것: 알림 권한 상태, 알림을 눌러 연 할 일 */
  onNative(m) {
    if (!m) return;
    if (m.type === "notify-perm") { this.perm = m.status; const el = document.getElementById("mNotifyHint"); if (el) el.textContent = this.hint(); }
    else if (m.type === "open-task" && Store.task(m.id)) App.openTask(m.id);
  },
  hint() {
    if (this.perm === "denied") return "알림이 꺼져 있어요. iPhone 설정 → ORBIT → 알림에서 켜 주세요.";
    return "시간이 있는 할 일은 10분 전, 날짜만 있으면 그날 오전 9시에 알려 드려요.";
  },
};
