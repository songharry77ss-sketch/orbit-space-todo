/* ═══════════════ 유틸리티: 날짜, 포맷, 파서 ═══════════════ */
"use strict";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const U = {
  uid() { return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4); },
  pad(n) { return String(n).padStart(2, "0"); },
  clamp(v, a, b) { return Math.max(a, Math.min(b, v)); },
  lerp(a, b, t) { return a + (b - a) * t; },
  rand(a, b) { return a + Math.random() * (b - a); },
  esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); },

  dateStr(d) { return `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}-${U.pad(d.getDate())}`; },
  today() { return U.dateStr(new Date()); },
  parseDate(s) { if (!s) return null; const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); },
  addDays(s, n) { const d = U.parseDate(s); d.setDate(d.getDate() + n); return U.dateStr(d); },
  addMonths(s, n) { const d = U.parseDate(s); const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(day, last)); return U.dateStr(d); },
  diffDays(a, b) { return Math.round((U.parseDate(b) - U.parseDate(a)) / 86400000); },
  weekday(s) { return WEEKDAYS[U.parseDate(s).getDay()]; },

  fmtDate(s, withYear) {
    if (!s) return "";
    const d = U.parseDate(s);
    const y = withYear || d.getFullYear() !== new Date().getFullYear() ? `${d.getFullYear()}년 ` : "";
    return `${y}${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
  },
  fmtLong(s) { const d = U.parseDate(s); return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAYS[d.getDay()]}요일`; },
  relDate(s) {
    if (!s) return "기한 없음";
    const diff = U.diffDays(U.today(), s);
    if (diff === 0) return "오늘";
    if (diff === 1) return "내일";
    if (diff === 2) return "모레";
    if (diff === -1) return "어제";
    if (diff < 0) return `${-diff}일 지남`;
    if (diff <= 6) return `${U.weekday(s)}요일`;
    return U.fmtDate(s);
  },
  fmtTime(t) {
    if (!t) return "";
    const [h, m] = t.split(":").map(Number);
    const ap = h < 12 ? "오전" : "오후";
    const hh = h % 12 === 0 ? 12 : h % 12;
    return m ? `${ap} ${hh}:${U.pad(m)}` : `${ap} ${hh}시`;
  },
  fmtClock(sec) {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h ? `${h}:${U.pad(m)}:${U.pad(s)}` : `${U.pad(m)}:${U.pad(s)}`;
  },
  fmtDuration(sec) {
    sec = Math.floor(sec);
    if (sec < 60) return `${sec}초`;
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    return h ? `${h}시간 ${m}분` : `${m}분`;
  },
  fmtStamp(ts) { const d = new Date(ts); return `${d.getFullYear()}.${U.pad(d.getMonth() + 1)}.${U.pad(d.getDate())}`; },


  /* 빠른 추가 파서: "#행성 !중요 내일 오후 3시 보고서 작성" */
  parseQuick(text, planets) {
    let t = " " + text + " ";
    const out = { title: "", planetId: null, priority: 0, due: null, time: null };
    t = t.replace(/\s#(\S+)/g, (m, name) => {
      const p = planets.find(p => p.name === name) || planets.find(p => p.name.startsWith(name));
      if (p) { out.planetId = p.id; return " "; }
      return m;
    });
    /* 우선순위: !1 !2 !3 또는 !높음 !보통 !낮음, !만 쓰면 높음 */
    t = t.replace(/\s!(1|2|3|높음|보통|낮음)?(?=\s)/, (m, v) => { out.priority = !v ? 1 : ({ 1: 1, 2: 2, 3: 3, "높음": 1, "보통": 2, "낮음": 3 })[v]; return " "; });
    const today = U.today();
    const dateRules = [
      [/\s오늘(?=\s)/, () => today],
      [/\s내일(?=\s)/, () => U.addDays(today, 1)],
      [/\s모레(?=\s)/, () => U.addDays(today, 2)],
      [/\s글피(?=\s)/, () => U.addDays(today, 3)],
      [/\s다음\s?주(?=\s)/, () => U.addDays(today, 7)],
      [/\s(\d{1,2})\s?\/\s?(\d{1,2})(?=\s)/, (m) => { const [mm, dd] = m.slice(1).map(Number); return U.makeDate(mm, dd); }],
      [/\s(\d{1,2})월\s?(\d{1,2})일(?=\s)/, (m) => { const [mm, dd] = m.slice(1).map(Number); return U.makeDate(mm, dd); }],
      [/\s(\d{1,2})일(?=\s)/, (m) => { const d = U.parseDate(today); return U.makeDate(d.getMonth() + 1, Number(m[1])); }],
      [/\s(다음\s?주\s?)?([일월화수목금토])요일(?=\s)/, (m) => { const wd = WEEKDAYS.indexOf(m[2]); return U.nextWeekday(today, wd, !!m[1]); }],
    ];
    for (const [re, fn] of dateRules) {
      const m = t.match(re);
      if (m) { const v = fn(m); if (v) { out.due = v; t = t.replace(re, " "); break; } }
    }
    const timeRules = [
      [/\s(오전|오후|아침|저녁|밤|새벽)\s?(\d{1,2})(?:시|:)\s?(\d{1,2})?분?(?=\s)/, (m) => { let h = Number(m[2]); const mi = Number(m[3] || 0); if (/오후|저녁|밤/.test(m[1]) && h < 12) h += 12; if (/오전|아침|새벽/.test(m[1]) && h === 12) h = 0; return `${U.pad(h)}:${U.pad(mi)}`; }],
      [/\s(\d{1,2}):(\d{2})(?=\s)/, (m) => `${U.pad(Number(m[1]))}:${m[2]}`],
      [/\s(\d{1,2})시(?:\s?(\d{1,2})분)?(?=\s)/, (m) => `${U.pad(Number(m[1]))}:${U.pad(Number(m[2] || 0))}`],
    ];
    for (const [re, fn] of timeRules) {
      const m = t.match(re);
      if (m) { out.time = fn(m); t = t.replace(re, " "); break; }
    }
    if (out.time && !out.due) out.due = today;
    out.title = t.replace(/\s+/g, " ").trim();
    return out;
  },
  makeDate(mm, dd) {
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    const now = new Date();
    let d = new Date(now.getFullYear(), mm - 1, dd);
    if (d.getMonth() !== mm - 1) return null;
    if (U.dateStr(d) < U.today()) d = new Date(now.getFullYear() + 1, mm - 1, dd);
    return U.dateStr(d);
  },
};

/* 요일 계산: 이번 주 다음 해당 요일 또는 다음 주 해당 요일 */
U.nextWeekday = function (fromStr, wd, forceNextWeek) {
  const d = U.parseDate(fromStr);
  let delta = (wd - d.getDay() + 7) % 7;
  if (forceNextWeek) delta = (7 - d.getDay()) + wd;
  d.setDate(d.getDate() + delta);
  return U.dateStr(d);
};
