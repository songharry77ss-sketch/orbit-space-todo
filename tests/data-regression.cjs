"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = ["utils.js", "store.js"].map(file => fs.readFileSync(path.join(__dirname, "..", "js", file), "utf8")).join("\n");
const fixedNow = new Date(2026, 9, 23, 12).getTime();

function setup(saved) {
  const storage = new Map(saved === undefined ? [] : [["orbit.todo.v1", typeof saved === "string" ? saved : JSON.stringify(saved)]]);
  let time = fixedNow;
  class TestDate extends Date {
    constructor(...args) { super(...(args.length ? args : [time])); }
    static now() { return time; }
  }
  const context = vm.createContext({
    Date: TestDate,
    BODIES: Object.fromEntries(["earth", "jupiter", "mars", "neptune", "saturn"].map(body => [body, {}])),
    BODY_ORDER: ["earth", "jupiter", "mars", "neptune", "saturn"],
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
  });
  vm.runInContext(source + "\nglobalThis.subject = { Store, U };", context);
  const { Store, U } = context.subject;
  let sequence = 0;
  U.uid = () => `test-${++sequence}`;
  Store.load();
  return { Store, U, storage, advance: ms => { time += ms; } };
}

function addDaily(Store, patch = {}) {
  return Store.addTask({ title: "반복 할 일", due: "2026-10-23", repeat: "daily", steps: [{ id: "step", title: "첫 단계", done: false }], ...patch });
}

let passed = 0;
function test(name, run) {
  run();
  passed++;
  console.log(`ok ${passed} - ${name}`);
}

test("next-week weekday phrases consume the whole phrase and use the requested weekday", () => {
  const { U } = setup();
  for (const [phrase, due] of [["다음주 월요일", "2026-10-26"], ["다음 주 화요일", "2026-10-27"], ["다음주 금요일", "2026-10-30"], ["다음 주 일요일", "2026-10-25"]]) {
    const parsed = U.parseQuick(`${phrase} 보고서 작성`, []);
    assert.equal(parsed.due, due, phrase);
    assert.equal(parsed.title, "보고서 작성", phrase);
  }
});

test("generic next week, plain weekdays, time, planet and priority parsing still work", () => {
  const { U } = setup();
  assert.equal(U.parseQuick("다음주 보고서", []).due, "2026-10-30");
  assert.equal(U.parseQuick("토요일 운동", []).due, "2026-10-24");
  const parsed = U.parseQuick("#업무 !1 다음 주 월요일 오후 3시 보고서", [{ id: "work", name: "업무" }]);
  assert.equal(parsed.title, "보고서");
  assert.equal(parsed.due, "2026-10-26");
  assert.equal(parsed.time, "15:00");
  assert.equal(parsed.planetId, "work");
  assert.equal(parsed.priority, 1);
});

test("a first install starts with empty named categories and requests welcome once", () => {
  const { Store } = setup();
  assert.equal(Store.tasks().length, 0);
  assert.equal(Store.planets().map(p => p.name).join(","), "업무,공부,운동,생활,취미");
  assert.equal(Store.state.settings.welcomePending, true);
  Store.setSetting("welcomePending", false);
  const loaded = setup(JSON.parse(Store.exportJSON())).Store;
  assert.equal(loaded.state.settings.welcomePending, false);
  assert.equal(loaded.tasks().length, 0);
});

test("existing data does not become an onboarding or sample session", () => {
  const { Store } = setup({ planets: [{ id: "old", name: "내 업무", body: "earth", order: 0 }], tasks: [{ id: "existing", title: "내 할 일", status: "todo" }], settings: { view: "list" } });
  assert.equal(Store.task("existing").title, "내 할 일");
  assert.equal(Store.state.settings.view, "list");
  assert.equal(Store.state.settings.welcomePending, undefined);
  assert.equal(Store.state.settings.demoMode, undefined);
});

test("invalid saved JSON falls back to the same empty first-install state", () => {
  const { Store } = setup("not-json");
  assert.equal(Store.tasks().length, 0);
  assert.equal(Store.state.settings.welcomePending, true);
});

test("reset and sample reset replace saved data without starting a timer", () => {
  const { Store, storage } = setup();
  Store.addTask({ title: "삭제할 기존 항목" });
  Store.reset(false);
  assert.equal(Store.tasks().length, 0);
  assert.equal(JSON.parse(storage.get(Store.KEY)).tasks.length, 0);
  Store.addTask({ title: "두 번째 기존 항목" });
  Store.reset(true);
  assert.ok(Store.tasks().length > 0);
  assert.ok(Store.tasks().every(t => t.status !== "doing" && !t.startedAt));
  assert.ok(Store.tasks().every(t => t.title !== "두 번째 기존 항목"));
  assert.equal(Store.state.settings.demoMode, true);
});

test("import replaces old saved data and still applies legacy normalization", () => {
  const { Store, storage } = setup();
  Store.addTask({ title: "원래 항목" });
  Store.importJSON(JSON.stringify({ planets: [{ id: "import-p", name: "가져온 행성", order: 0 }], tasks: [{ id: "import-t", title: "가져온 항목", important: true, status: "todo" }] }));
  assert.equal(Store.tasks().length, 1);
  assert.equal(Store.tasks()[0].title, "가져온 항목");
  assert.equal(Store.tasks()[0].priority, 1);
  assert.equal(Store.planets()[0].body, "earth");
  assert.equal(JSON.parse(storage.get(Store.KEY)).tasks[0].id, "import-t");
  assert.throws(() => Store.importJSON('{"tasks":[]}'), /형식/);
  assert.equal(Store.tasks()[0].id, "import-t");
});

for (const undoKind of ["checkbox", "toast"]) {
  test(`${undoKind} undo removes a pristine generated occurrence and recompletion creates only one`, () => {
    const { Store } = setup();
    const parent = addDaily(Store);
    for (let i = 0; i < 3; i++) {
      const result = Store.completeTask(parent.id);
      assert.equal(Store.tasks().filter(t => t.parentId === parent.id).length, 1);
      assert.equal(result.spawned.due, "2026-10-24");
      Store.uncompleteTask(parent.id, undoKind === "toast" ? result.spawned.id : undefined);
      assert.equal(Store.tasks().length, 1);
    }
    Store.completeTask(parent.id);
    assert.equal(Store.tasks().length, 2);
  });
}

test("a no-op autosave does not turn an untouched recurrence into user-edited work", () => {
  const { Store } = setup();
  const parent = addDaily(Store);
  const child = Store.completeTask(parent.id).spawned;
  Store.updateTask(child.id, { title: child.title });
  Store.updateStep(child.id, child.steps[0].id, { title: child.steps[0].title });
  Store.uncompleteTask(parent.id);
  assert.equal(Store.task(child.id), undefined);
});

for (const [name, modify] of [
  ["edited title", (Store, child) => Store.updateTask(child.id, { title: "사용자가 바꾼 제목" })],
  ["rescheduled due date", (Store, child) => Store.updateTask(child.id, { due: "2026-10-28" })],
  ["step progress", (Store, child) => Store.updateStep(child.id, child.steps[0].id, { done: true })],
  ["added step", (Store, child) => Store.addStep(child.id, "새 단계")],
  ["removed step", (Store, child) => Store.removeStep(child.id, child.steps[0].id)],
  ["running timer", (Store, child) => Store.startTask(child.id)],
  ["stopped timer", (Store, child, advance) => { Store.startTask(child.id); advance(60000); Store.stopTask(child.id); }],
  ["completed child", (Store, child) => Store.completeTask(child.id)],
  ["completed then reopened child", (Store, child) => { Store.completeTask(child.id); Store.uncompleteTask(child.id); }],
]) {
  test(`parent undo preserves a ${name}, and recompletion does not duplicate its occurrence`, () => {
    const { Store, advance } = setup();
    const parent = addDaily(Store);
    const child = Store.completeTask(parent.id).spawned;
    modify(Store, child, advance);
    const preserved = JSON.stringify(child);
    Store.uncompleteTask(parent.id, child.id);
    assert.equal(JSON.stringify(Store.task(child.id)), preserved);
    assert.equal(Store.completeTask(parent.id).spawned, null);
    assert.equal(Store.tasks().filter(t => t.parentId === parent.id).length, 1);
  });
}

test("legacy linked occurrences are preserved and not duplicated after reopening", () => {
  const { Store } = setup();
  const parent = addDaily(Store);
  const child = Store.completeTask(parent.id).spawned;
  delete child.recurrenceDate;
  delete child.recurrenceSnapshot;
  child.due = "2026-11-01";
  Store.uncompleteTask(parent.id);
  assert.equal(Store.task(child.id).due, "2026-11-01");
  assert.equal(Store.completeTask(parent.id).spawned, null);
  assert.equal(Store.tasks().length, 2);
});

test("recurrence origin survives export/import and preserves a moved child", () => {
  let { Store } = setup();
  const parent = addDaily(Store);
  const child = Store.completeTask(parent.id).spawned;
  Store.updateTask(child.id, { due: "2026-10-29" });
  Store = setup(JSON.parse(Store.exportJSON())).Store;
  Store.uncompleteTask(parent.id);
  Store.completeTask(parent.id);
  assert.equal(Store.tasks().filter(t => t.parentId === parent.id).length, 1);
  assert.equal(Store.task(child.id).due, "2026-10-29");
});

test("a different parent or a newly scheduled recurrence date remains independent", () => {
  const { Store } = setup();
  const first = addDaily(Store);
  const second = addDaily(Store);
  const child = Store.completeTask(first.id).spawned;
  Store.updateTask(child.id, { notes: "보존할 메모" });
  Store.completeTask(second.id);
  Store.uncompleteTask(first.id);
  Store.updateTask(first.id, { due: "2026-10-24" });
  assert.equal(Store.completeTask(first.id).spawned.due, "2026-10-25");
  assert.equal(Store.tasks().filter(t => t.parentId === first.id).length, 2);
  assert.equal(Store.tasks().filter(t => t.parentId === second.id).length, 1);
});

for (const [repeat, due, expected] of [["weekdays", "2026-10-23", "2026-10-26"], ["weekly", "2026-10-23", "2026-10-30"], ["monthly", "2026-01-31", "2026-02-28"], ["daily", null, "2026-10-24"]]) {
  test(`${repeat} recurrence retains its expected next date`, () => {
    const { Store } = setup();
    const task = addDaily(Store, { repeat, due });
    assert.equal(Store.completeTask(task.id).spawned.due, expected);
    assert.equal(Store.completeTask(task.id), null);
  });
}

console.log(`${passed} data regression checks passed.`);
