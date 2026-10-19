/* ═══════════════ 스토어: 상태, 저장, 변경 ═══════════════ */
"use strict";

const Store = {
  KEY: "orbit.todo.v1",
  state: null,
  listeners: [],
  COLORS: ["#4f8cff", "#a66cff", "#ff6cab", "#ff5a5a", "#ff9f43", "#ffd93d", "#4ade80", "#2dd4bf", "#38bdf8", "#f472b6"],
  REPEATS: [["none", "반복 없음"], ["daily", "매일"], ["weekdays", "평일"], ["weekly", "매주"], ["monthly", "매월"]],

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) { const s = JSON.parse(raw); if (s && Array.isArray(s.planets) && Array.isArray(s.tasks)) this.state = s; }
    } catch (e) { /* 저장소 사용 불가 */ }
    if (!this.state) this.state = this.seed();
    this.state.settings = Object.assign({ view: "today", hintSeen: false }, this.state.settings || {});
    // 행성 → 실제 천체 매핑 (이전 버전 데이터 이전)
    const used = new Set(this.state.planets.filter(p => BODIES[p.body]).map(p => p.body));
    this.planets().forEach(p => { if (!BODIES[p.body]) { p.body = BODY_ORDER.find(k => !used.has(k)) || "earth"; used.add(p.body); } delete p.emoji; delete p.look; delete p.color; });
    this.state.tasks.forEach(t => { if (t.priority == null) t.priority = t.important ? 1 : 0; delete t.important; });
    const cutoff = Date.now() - 60 * 86400000;
    this.state.tasks = this.state.tasks.filter(t => !(t.status === "done" && t.completedAt && t.completedAt < cutoff));
  },
  save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.state)); } catch (e) { /* 무시 */ } },
  on(fn) { this.listeners.push(fn); },
  emit(detail = {}) { this.save(); this.listeners.forEach(fn => fn(detail)); },
  setSetting(k, v) { this.state.settings[k] = v; this.save(); },

  /* ── 조회 ── */
  planets() { return [...this.state.planets].sort((a, b) => a.order - b.order); },
  planet(id) { return this.state.planets.find(p => p.id === id); },
  tasks() { return this.state.tasks; },
  task(id) { return this.state.tasks.find(t => t.id === id); },
  tasksOf(planetId) { return this.state.tasks.filter(t => t.planetId === planetId).sort(this.sortTasks); },
  sortTasks(a, b) {
    const st = { doing: 0, todo: 1, done: 2 };
    if (st[a.status] !== st[b.status]) return st[a.status] - st[b.status];
    const pa = a.priority || 4, pb = b.priority || 4; if (pa !== pb) return pa - pb;
    if ((a.due || "9") !== (b.due || "9")) return (a.due || "9") < (b.due || "9") ? -1 : 1;
    return a.createdAt - b.createdAt;
  },
  isOverdue(t) { return t.status !== "done" && !!t.due && t.due < U.today(); },
  isTodayTask(t) {
    if (t.status === "done") return !!t.completedAt && U.dateStr(new Date(t.completedAt)) === U.today();
    const today = U.today();
    return t.status === "doing" || (!!t.due && t.due <= today) || t.myDay === today;
  },
  visibleTasks(filter) {
    return this.state.tasks.filter(t => t.status !== "done" && (filter === "all" || this.isTodayTask(t)));
  },
  todayTasks() { return this.state.tasks.filter(t => this.isTodayTask(t)).sort(this.sortTasks); },
  todayStats() {
    const list = this.todayTasks();
    return {
      total: list.length,
      done: list.filter(t => t.status === "done").length,
      doing: list.filter(t => t.status === "doing").length,
      overdue: list.filter(t => this.isOverdue(t)).length,
    };
  },
  burned(t) { return (t.burnSeconds || 0) + (t.status === "doing" && t.startedAt ? (Date.now() - t.startedAt) / 1000 : 0); },
  burnedToday() {
    const today = U.today();
    return this.state.tasks.reduce((s, t) => {
      if (t.status === "doing" && t.startedAt) s += (Date.now() - t.startedAt) / 1000;
      if (t.completedAt && U.dateStr(new Date(t.completedAt)) === today) s += t.burnSeconds || 0;
      return s;
    }, 0);
  },

  /* ── 행성 ── */
  addPlanet(data) {
    const order = this.state.planets.length ? Math.max(...this.state.planets.map(p => p.order)) + 1 : 0;
    const p = Object.assign({ id: U.uid(), name: "새 행성", body: this.freeBody(), order, createdAt: Date.now() }, data);
    this.state.planets.push(p);
    this.emit({ type: "planet-add", id: p.id });
    return p;
  },
  freeBody() { const used = new Set(this.state.planets.map(p => p.body)); return BODY_ORDER.find(k => !used.has(k)) || BODY_ORDER[this.state.planets.length % BODY_ORDER.length]; },
  updatePlanet(id, patch) { const p = this.planet(id); if (!p) return; Object.assign(p, patch); this.emit({ type: "planet-update", id }); },
  removePlanet(id, moveToId) {
    if (this.state.planets.length <= 1) return false;
    this.state.planets = this.state.planets.filter(p => p.id !== id);
    if (moveToId) this.state.tasks.forEach(t => { if (t.planetId === id) t.planetId = moveToId; });
    else this.state.tasks = this.state.tasks.filter(t => t.planetId !== id);
    this.emit({ type: "planet-remove", id });
    return true;
  },

  /* ── 할 일 ── */
  addTask(data) {
    const t = Object.assign({
      id: U.uid(), title: "", notes: "", planetId: this.planets()[0]?.id, due: null, time: null, priority: 0,
      myDay: null, status: "todo", startedAt: null, burnSeconds: 0, completedAt: null, steps: [], repeat: "none", createdAt: Date.now(),
    }, data);
    if (!t.title.trim()) return null;
    this.state.tasks.push(t);
    this.emit({ type: "task-add", id: t.id });
    return t;
  },
  updateTask(id, patch, meta = {}) { const t = this.task(id); if (!t) return; Object.assign(t, patch); this.emit(Object.assign({ type: "task-update", id }, meta)); },
  removeTask(id) {
    const t = this.task(id); if (!t) return null;
    this.state.tasks = this.state.tasks.filter(x => x.id !== id);
    this.emit({ type: "task-remove", id });
    return t;
  },
  restoreTask(t) { if (!this.task(t.id)) { this.state.tasks.push(t); this.emit({ type: "task-add", id: t.id }); } },
  startTask(id) {
    const t = this.task(id); if (!t || t.status === "doing") return;
    if (t.status === "done") { t.completedAt = null; }
    t.status = "doing"; t.startedAt = Date.now();
    if (!t.myDay) t.myDay = U.today();
    this.emit({ type: "task-start", id });
  },
  stopTask(id) {
    const t = this.task(id); if (!t || t.status !== "doing") return;
    t.burnSeconds = (t.burnSeconds || 0) + (Date.now() - (t.startedAt || Date.now())) / 1000;
    t.status = "todo"; t.startedAt = null;
    this.emit({ type: "task-stop", id });
  },
  completeTask(id) {
    const t = this.task(id); if (!t || t.status === "done") return null;
    if (t.status === "doing") t.burnSeconds = (t.burnSeconds || 0) + (Date.now() - (t.startedAt || Date.now())) / 1000;
    t.status = "done"; t.startedAt = null; t.completedAt = Date.now();
    let spawned = null;
    if (t.repeat && t.repeat !== "none") {
      const base = t.due || U.today();
      let next = base;
      if (t.repeat === "daily") next = U.addDays(base, 1);
      else if (t.repeat === "weekly") next = U.addDays(base, 7);
      else if (t.repeat === "monthly") next = U.addMonths(base, 1);
      else if (t.repeat === "weekdays") { next = U.addDays(base, 1); while ([0, 6].includes(U.parseDate(next).getDay())) next = U.addDays(next, 1); }
      spawned = {
        id: U.uid(), title: t.title, notes: t.notes, planetId: t.planetId, due: next, time: t.time, priority: t.priority || 0,
        myDay: null, status: "todo", startedAt: null, burnSeconds: 0, completedAt: null, steps: t.steps.map(s => ({ id: U.uid(), title: s.title, done: false })),
        repeat: t.repeat, createdAt: Date.now(), parentId: t.id,
      };
      this.state.tasks.push(spawned);
    }
    this.emit({ type: "task-complete", id, spawnedId: spawned?.id });
    return { task: t, spawned };
  },
  uncompleteTask(id, spawnedId) {
    const t = this.task(id); if (!t) return;
    t.status = "todo"; t.completedAt = null;
    if (spawnedId) this.state.tasks = this.state.tasks.filter(x => x.id !== spawnedId);
    this.emit({ type: "task-uncomplete", id });
  },
  addStep(taskId, title) { const t = this.task(taskId); if (!t || !title.trim()) return; t.steps.push({ id: U.uid(), title: title.trim(), done: false }); this.emit({ type: "step", id: taskId }); },
  updateStep(taskId, stepId, patch, meta = {}) { const t = this.task(taskId); const s = t?.steps.find(s => s.id === stepId); if (!s) return; Object.assign(s, patch); this.emit(Object.assign({ type: "step", id: taskId }, meta)); },
  removeStep(taskId, stepId) { const t = this.task(taskId); if (!t) return; t.steps = t.steps.filter(s => s.id !== stepId); this.emit({ type: "step", id: taskId }); },

  /* ── 데이터 ── */
  exportJSON() { return JSON.stringify(this.state, null, 2); },
  importJSON(text) {
    const s = JSON.parse(text);
    if (!s || !Array.isArray(s.planets) || !Array.isArray(s.tasks)) throw new Error("형식이 올바르지 않습니다");
    this.state = s; this.load(); this.emit({ type: "reset" });
  },
  reset(withSample) {
    this.state = withSample ? this.seed() : { planets: [{ id: U.uid(), name: "할 일", body: "earth", order: 0, createdAt: Date.now() }], tasks: [], settings: {} };
    this.load(); this.emit({ type: "reset" });
  },
};

/* ── 첫 실행 예시 데이터 ── */
Store.seed = function () {
  const T = U.today(), now = Date.now(), d = n => U.addDays(T, n);
  const P = (name, body, order) => ({ id: U.uid(), name, body, order, createdAt: now });
  const work = P("업무", "earth", 0);
  const study = P("공부", "jupiter", 1);
  const fit = P("운동", "mars", 2);
  const life = P("생활", "neptune", 3);
  const hobby = P("취미", "saturn", 4);
  let i = 0;
  const K = (planet, title, o = {}) => Object.assign({
    id: U.uid(), title, notes: "", planetId: planet.id, due: null, time: null, priority: 0, myDay: null,
    status: "todo", startedAt: null, burnSeconds: 0, completedAt: null, steps: [], repeat: "none", createdAt: now - (200 - i++) * 60000,
  }, o);
  const steps = (...names) => names.map(n => ({ id: U.uid(), title: n, done: false }));
  const tasks = [
    K(work, "주간 보고서 작성", { due: T, priority: 1, steps: steps("데이터 정리", "초안 작성", "검토 요청"), notes: "지난주 지표 비교표 포함할 것" }),
    K(work, "클라이언트 미팅 준비", { due: T, time: "14:00", priority: 2 }),
    K(work, "이메일 답장 정리", { due: d(-1), priority: 2 }),
    K(work, "디자인 리뷰 피드백", { due: d(1), priority: 3 }),
    K(work, "분기 OKR 정리", { due: d(3) }),
    K(study, "알고리즘 문제 3개 풀기", { due: T, priority: 2, status: "doing", startedAt: now - 12 * 60000, myDay: T, burnSeconds: 0 }),
    K(study, "영어 단어 30개 암기", { due: T, repeat: "daily", priority: 3 }),
    K(study, "React 강의 2강 수강", { due: d(2) }),
    K(fit, "러닝 5km", { myDay: T, priority: 2 }),
    K(fit, "아침 스트레칭", { due: T, repeat: "daily", status: "done", completedAt: now - 60 * 60000, burnSeconds: 420 }),
    K(fit, "헬스 PT 예약", { due: d(5) }),
    K(life, "장보기", { due: T, priority: 2, steps: steps("우유", "계란", "채소"), notes: "두부도 떨어짐" }),
    K(life, "공과금 납부", { due: d(-2), priority: 1 }),
    K(life, "방 청소", { due: d(1), priority: 3 }),
    K(life, "치과 예약 전화"),
    K(hobby, "기타 연습 30분", { myDay: T }),
    K(hobby, "사진 정리"),
    K(hobby, "책 『코스모스』 읽기", { due: d(7) }),
  ];
  return { planets: [work, study, fit, life, hobby], tasks, settings: { view: "today", hintSeen: false } };
};
