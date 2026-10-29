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
    if (!this.state) { this.state = this.fresh(); this.state.settings.welcomePending = true; }
    this.state = this.normalize(this.state);
  },
  /* 가져오기와 초기화는 저장된 옛 데이터를 다시 읽지 않고 같은 정리만 적용한다. */
  normalize(state) {
    state.settings = Object.assign({ view: "today", hintSeen: false }, state.settings || {});
    // 행성 → 실제 천체 매핑 (이전 버전 데이터 이전)
    const used = new Set(state.planets.filter(p => BODIES[p.body]).map(p => p.body));
    [...state.planets].sort((a, b) => a.order - b.order).forEach(p => { if (!BODIES[p.body]) { p.body = BODY_ORDER.find(k => !used.has(k)) || "earth"; used.add(p.body); } delete p.emoji; delete p.look; delete p.color; });
    state.tasks.forEach(t => { if (t.priority == null) t.priority = t.important ? 1 : 0; delete t.important; });
    const cutoff = Date.now() - 60 * 86400000;
    state.tasks = state.tasks.filter(t => !(t.status === "done" && t.completedAt && t.completedAt < cutoff));
    return state;
  },
  fresh() {
    const now = Date.now();
    return {
      planets: [["업무", "earth"], ["공부", "jupiter"], ["운동", "mars"], ["생활", "neptune"], ["취미", "saturn"]].map(([name, body], order) => ({ id: U.uid(), name, body, order, createdAt: now })),
      tasks: [], settings: { view: "today", hintSeen: false },
    };
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
      if (t.status === "doing") s += this.burned(t);
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
  /* 행성 순서(안쪽 궤도부터). ids 순서대로 order 를 다시 매긴다 */
  setPlanetOrder(ids) {
    const before = this.planets().map(p => p.id).join(",");
    const rank = new Map(ids.map((id, i) => [id, i]));
    this.planets().sort((a, b) => (rank.has(a.id) ? rank.get(a.id) : 1e9) - (rank.has(b.id) ? rank.get(b.id) : 1e9)).forEach((p, i) => { p.order = i; });
    if (this.planets().map(p => p.id).join(",") === before) return false;
    this.emit({ type: "planet-order" });
    return true;
  },
  /* 순서를 바꾸고 알림에서 되돌릴 수 있게 한다 */
  reorderPlanets(ids, movedId) {
    const prev = this.planets().map(p => p.id);
    if (!this.setPlanetOrder(ids)) return false;
    const p = this.planet(movedId), i = this.planets().findIndex(x => x.id === movedId);
    if (typeof App !== "undefined") App.toast("orbit", p ? `「${p.name}」 행성을 ${i + 1}번째 자리로 옮겼어요` : "행성 순서를 바꿨어요", () => this.setPlanetOrder(prev));
    return true;
  },
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
  updateTask(id, patch, meta = {}) { const t = this.task(id); if (!t) return; if (Object.keys(patch).some(k => t[k] !== patch[k])) this.touchRecurrence(t); Object.assign(t, patch); this.emit(Object.assign({ type: "task-update", id }, meta)); },
  removeTask(id) {
    const t = this.task(id); if (!t) return null;
    this.state.tasks = this.state.tasks.filter(x => x.id !== id);
    this.emit({ type: "task-remove", id });
    return t;
  },
  restoreTask(t) { if (!this.task(t.id)) { this.state.tasks.push(t); this.emit({ type: "task-add", id: t.id }); } },
  startTask(id) {
    const t = this.task(id); if (!t || t.status === "doing") return;
    this.touchRecurrence(t);
    if (t.status === "done") { t.completedAt = null; }
    t.status = "doing"; t.startedAt = Date.now();
    if (!t.myDay) t.myDay = U.today();
    this.state.settings.ignited = true;
    this.emit({ type: "task-start", id });
  },
  stopTask(id) {
    const t = this.task(id); if (!t || t.status !== "doing") return;
    this.touchRecurrence(t);
    t.burnSeconds = (t.burnSeconds || 0) + (Date.now() - (t.startedAt || Date.now())) / 1000;
    t.status = "todo"; t.startedAt = null;
    this.emit({ type: "task-stop", id });
  },
  completeTask(id) {
    const t = this.task(id); if (!t || t.status === "done") return null;
    this.touchRecurrence(t);
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
      /* 재완료해도 같은 회차를 두 번 만들지 않는다. 옮겨 둔 다음 회차도 원래 날짜로 찾는다.
         옛 데이터에는 회차 날짜가 없으므로 연결된 자식이 있으면 보수적으로 유지한다. */
      const existing = this.state.tasks.find(x => x.parentId === t.id && (!x.recurrenceDate || x.recurrenceDate === next));
      if (!existing) {
        spawned = {
          id: U.uid(), title: t.title, notes: t.notes, planetId: t.planetId, due: next, time: t.time, priority: t.priority || 0,
          myDay: null, status: "todo", startedAt: null, burnSeconds: 0, completedAt: null, steps: t.steps.map(s => ({ id: U.uid(), title: s.title, done: false })),
          repeat: t.repeat, createdAt: Date.now(), parentId: t.id, recurrenceDate: next,
        };
        spawned.recurrenceSnapshot = this.recurrenceSignature(spawned);
        this.state.tasks.push(spawned);
      }
    }
    this.emit({ type: "task-complete", id, spawnedId: spawned?.id });
    return { task: t, spawned };
  },
  uncompleteTask(id, spawnedId) {
    const t = this.task(id); if (!t) return;
    this.touchRecurrence(t);
    t.status = "todo"; t.completedAt = null;
    /* 사용자가 수정하거나 집중·완료한 다음 회차는 실행 취소로 지우지 않는다. */
    this.state.tasks = this.state.tasks.filter(x => !(x.parentId === id && (!spawnedId || x.id === spawnedId) && !x.recurrenceTouched && x.recurrenceSnapshot && x.recurrenceSnapshot === this.recurrenceSignature(x) && !this.state.tasks.some(child => child.parentId === x.id)));
    this.emit({ type: "task-uncomplete", id });
  },
  touchRecurrence(t) { if (t.parentId) t.recurrenceTouched = true; },
  recurrenceSignature(t) {
    return JSON.stringify([t.title, t.notes, t.planetId, t.due, t.time, t.priority, t.myDay, t.status, t.startedAt, t.burnSeconds, t.completedAt, t.steps, t.repeat]);
  },
  addStep(taskId, title) { const t = this.task(taskId); if (!t || !title.trim()) return; this.touchRecurrence(t); t.steps.push({ id: U.uid(), title: title.trim(), done: false }); this.emit({ type: "step", id: taskId }); },
  updateStep(taskId, stepId, patch, meta = {}) { const t = this.task(taskId); const s = t?.steps.find(s => s.id === stepId); if (!s) return; if (Object.keys(patch).some(k => s[k] !== patch[k])) this.touchRecurrence(t); Object.assign(s, patch); this.emit(Object.assign({ type: "step", id: taskId }, meta)); },
  removeStep(taskId, stepId) { const t = this.task(taskId); if (!t) return; this.touchRecurrence(t); t.steps = t.steps.filter(s => s.id !== stepId); this.emit({ type: "step", id: taskId }); },

  /* ── 데이터 ── */
  exportJSON() { return JSON.stringify(this.state, null, 2); },
  importJSON(text) {
    const s = JSON.parse(text);
    if (!s || !Array.isArray(s.planets) || !Array.isArray(s.tasks)) throw new Error("형식이 올바르지 않습니다");
    this.state = this.normalize(s); this.emit({ type: "reset" });
  },
  reset(withSample) {
    this.state = withSample ? this.seed() : { planets: [{ id: U.uid(), name: "할 일", body: "earth", order: 0, createdAt: Date.now() }], tasks: [], settings: {} };
    this.state = this.normalize(this.state); this.emit({ type: "reset" });
  },
};

/* ── 사용자가 선택해서 불러오는 예시 데이터 ── */
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
    K(study, "알고리즘 문제 3개 풀기", { due: T, priority: 2 }),
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
  return { planets: [work, study, fit, life, hobby], tasks, settings: { view: "today", hintSeen: false, demoMode: true } };
};
