"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = ["scene.js", "intro.js"].map(file => fs.readFileSync(path.join(__dirname, "..", "js", file), "utf8")).join("\n");

class Surface {
  constructor() {
    this.listeners = new Map(); this.style = { setProperty() {} }; this.hidden = false;
    this.classList = { add() {}, remove() {}, toggle() {} };
  }
  addEventListener(name, callback) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name).add(callback); }
  removeEventListener(name, callback) { this.listeners.get(name)?.delete(callback); }
  emit(name, event) { event.type = name; for (const callback of [...(this.listeners.get(name) || [])]) callback(event); }
  count(name) { return this.listeners.get(name)?.size || 0; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
}

function setup() {
  const win = new Surface(), body = new Surface(), nodes = new Map(), activations = [], mutations = [], timers = new Map();
  let now = 1000, timerId = 0;
  const doc = { body, activeElement: { matches: () => false }, getElementById: id => { if (!nodes.has(id)) nodes.set(id, new Surface()); return nodes.get(id); } };
  Object.assign(win, { innerWidth: 390, innerHeight: 844 });
  const context = vm.createContext({
    window: win, document: doc, navigator: {}, performance: { now: () => now },
    setTimeout: fn => { timers.set(++timerId, fn); return timerId; }, clearTimeout: id => timers.delete(id),
    U: { clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)), lerp: (a, b, t) => a + (b - a) * t, esc: value => value },
    App: { openTask: id => activations.push(["task", id]), openPlanet: id => activations.push(["planet", id]), openToday: () => activations.push(["today"]) },
    Store: { task: id => ({ id, title: "Task", planetId: "p" }), planet: id => ({ id }), reorderPlanets: (...args) => mutations.push(args) },
    ViewportState: { keyboard: false, editable: el => !!el?.matches?.() },
    pColor: () => "#fff", FX: { trail() {} }, ico: () => "", thumbImg: () => "",
  });
  vm.runInContext(source + "\nglobalThis.subject = { Scene, Intro };", context);
  const { Scene: scene, Intro: intro } = context.subject;
  Object.assign(scene, { stage: doc.getElementById("stage"), tags: doc.getElementById("tags"), focus: doc.getElementById("focus"), ghost: doc.getElementById("ghost"), tip: doc.getElementById("tip"), touch: true });
  scene.updateHint = scene.setHover = () => {};
  scene.bind();
  const event = (id, x = 0, y = 0, pointerType = "touch") => ({ pointerId: id, clientX: x, clientY: y, pointerType, button: 0, target: { closest: () => null }, preventDefault() {}, stopPropagation() {} });
  return { scene, intro, win, doc, context, activations, mutations, timers, event, advance: ms => { now += ms; }, flush: () => { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(fn => fn()); } };
}

let passed = 0;
function test(name, run) { run(); console.log(`ok ${++passed} - ${name}`); }

test("cancelled pending moon, planet and sun never open a task or panel", () => {
  for (const kind of ["moon", "planet", "sun"]) {
    const h = setup();
    h.scene.startPending(h.event(1), { kind, id: "cancelled", sysId: "p" });
    h.win.emit("pointercancel", h.event(1)); h.flush();
    assert.equal(h.scene.drag, null); assert.deepEqual(h.activations, []); assert.equal(h.timers.size, 0);
  }
});

test("cancelled active moon never drops and cancelled planet never reorders", () => {
  for (const kind of ["moon", "planet"]) {
    const h = setup(); let drops = 0, layouts = 0;
    h.scene.drop = () => drops++; h.scene.layout = () => layouts++;
    h.scene.startPending(h.event(1), { kind, id: "moving", sysId: "p" });
    Object.assign(h.scene.drag, { pending: false, sunTarget: true, from: 0, slot: 1 });
    h.win.emit("pointercancel", h.event(1)); h.flush();
    assert.equal(drops, 0); assert.deepEqual(h.mutations, []); assert.deepEqual(h.activations, []);
    assert.equal(layouts, kind === "planet" ? 1 : 0);
  }
});

test("another pointer cannot move, end or activate a pending gesture", () => {
  const h = setup();
  h.scene.startPending(h.event(1), { kind: "moon", id: "owned", sysId: "p" });
  h.win.emit("pointermove", h.event(77, 200, 200));
  h.win.emit("pointerup", h.event(77, 200, 200));
  assert.equal(h.scene.drag.pointerId, 1); assert.equal(h.scene.drag.pending, true);
  assert.equal(h.timers.size, 0);
  h.win.emit("pointerup", h.event(1)); h.flush();
  assert.deepEqual(h.activations, [["task", "owned"]]);
});

test("cancelling orbit cannot become a double tap or reset explicit zoom", () => {
  const h = setup(); let resets = 0;
  h.scene.resetView = () => resets++;
  h.scene.v3d.tzoom = 0.6; h.scene._tap = 950; h.scene._tapPos = { x: 20, y: 20 };
  h.scene.startOrbit(20, 20, 1); h.win.emit("pointercancel", h.event(1, 20, 20));
  assert.equal(resets, 0); assert.equal(h.scene.v3d.tzoom, 0.6); assert.equal(h.scene._tap, 0);
  h.advance(50); h.scene.startOrbit(20, 20, 2); h.win.emit("pointerup", h.event(2, 20, 20));
  h.advance(50); h.scene.startOrbit(22, 20, 3); h.win.emit("pointerup", h.event(3, 22, 20));
  assert.equal(resets, 1, "an actual nearby double tap still works");
});

test("pinch removes orbit listeners and leaves no delayed task opening", () => {
  const h = setup(), baselineMove = h.win.count("pointermove"), baselineUp = h.win.count("pointerup");
  h.scene.startPending(h.event(1), { kind: "moon", id: "late", sysId: "p" });
  h.win.emit("pointerup", h.event(1)); assert.equal(h.timers.size, 1);
  h.scene.trackPointer(h.event(2)); h.scene.startOrbit(0, 0, 2);
  h.scene.trackPointer(h.event(3, 100)); h.flush();
  assert.equal(h.scene.orbitDrag, null); assert.equal(h.scene.drag, null); assert.deepEqual(h.activations, []);
  assert.equal(h.win.count("pointermove"), baselineMove); assert.equal(h.win.count("pointerup"), baselineUp);
});

test("two fingers starting on labels cancel safely even without stage bubbling", () => {
  const h = setup();
  h.scene.startPending(h.event(1), { kind: "planet", id: "planet-label", label: true });
  h.scene.startPending(h.event(2, 80), { kind: "moon", id: "tag", sysId: "p" });
  assert.equal(h.scene.drag, null); assert.equal(h.scene.pinch.active, true);
  h.win.emit("pointerup", h.event(1)); h.win.emit("pointerup", h.event(2)); h.flush();
  assert.deepEqual(h.activations, []); assert.equal(h.scene.ptrs.size, 0);
});

test("pinch cancels an armed delayed click even when the next fingers hit labels", () => {
  const h = setup();
  h.scene.startPending(h.event(1), { kind: "moon", id: "late", sysId: "p" }); h.win.emit("pointerup", h.event(1));
  assert.equal(h.timers.size, 1);
  h.scene.startPending(h.event(2, 40), { kind: "planet", id: "label", label: true });
  h.scene.startPending(h.event(3, 100), { kind: "moon", id: "tag", sysId: "p" });
  h.flush(); assert.deepEqual(h.activations, []); assert.equal(h.timers.size, 0);
});

test("close fingers establish a real pinch baseline without a zoom jump", () => {
  const h = setup();
  h.scene.v3d.zoom = 0.9; h.scene.v3d.tzoom = 0.6;
  h.scene.trackPointer(h.event(1)); h.scene.trackPointer(h.event(2, 2));
  assert.equal(h.scene.pinch.active, false); assert.equal(h.scene.v3d.tzoom, 0.9);
  h.scene.movePointer(h.event(2, 10)); assert.equal(h.scene.v3d.zoom, 0.9);
  h.scene.movePointer(h.event(2, 30)); assert.equal(h.scene.v3d.zoom, 0.9);
  h.scene.movePointer(h.event(2, 60)); assert.equal(h.scene.v3d.zoom, 0.45); assert.equal(h.scene.v3d.tzoom, 0.45);
  h.win.emit("pointerup", h.event(2, 60)); h.win.emit("pointerup", h.event(1));
  assert.equal(h.scene.v3d.zoom, h.scene.v3d.tzoom, "no delayed zoom remains after release");
});

test("changing a three-finger pinch pair rebases the visible zoom", () => {
  const h = setup();
  h.scene.trackPointer(h.event(1)); h.scene.trackPointer(h.event(2, 100));
  h.scene.movePointer(h.event(2, 200)); assert.equal(h.scene.v3d.zoom, 0.5);
  const baseline = h.scene.pinch; h.scene.releasePointer(h.event(99)); assert.equal(h.scene.pinch, baseline, "an unrelated finger cannot rebase the pinch");
  h.scene.trackPointer(h.event(3, 500)); h.win.emit("pointerup", h.event(1));
  h.scene.movePointer(h.event(3, 500)); assert.equal(h.scene.v3d.zoom, 0.5);
});

test("a completed pinch suppresses synthetic label clicks but preserves keyboard activation", () => {
  const h = setup();
  h.scene.trackPointer(h.event(1)); h.scene.trackPointer(h.event(2, 100));
  h.win.emit("pointerup", h.event(1)); h.win.emit("pointerup", h.event(2));
  let blocked = 0;
  const click = detail => ({ detail, preventDefault: () => blocked++, stopImmediatePropagation() {} });
  h.scene.stage.emit("click", click(1)); assert.equal(blocked, 1);
  h.scene.stage.emit("click", click(0)); assert.equal(blocked, 1);
});

test("an intentional drag cancels a previous delayed tap", () => {
  const h = setup();
  h.scene.startPending(h.event(1), { kind: "moon", id: "old", sysId: "p" }); h.win.emit("pointerup", h.event(1));
  h.scene.startPending(h.event(2), { kind: "moon", id: "new", sysId: "p" });
  h.win.emit("pointermove", h.event(2, 20));
  assert.equal(h.scene.drag.pending, false); h.flush(); assert.deepEqual(h.activations, []);
});

test("explicit planet selection, zoom buttons and rotation still work", () => {
  const h = setup();
  h.scene.startPending(h.event(1), { kind: "planet", id: "selected" }); h.win.emit("pointerup", h.event(1));
  assert.deepEqual(h.activations, [["planet", "selected"]]);
  h.scene.zoomBy(0.82); assert.equal(h.scene.v3d.tzoom, 0.82);
  h.scene.startOrbit(0, 0, 2); h.win.emit("pointermove", h.event(2, 20, 10));
  assert.ok(Math.abs(h.scene.v3d.taz + 0.11) < 1e-10); assert.ok(Math.abs(h.scene.v3d.tel - 0.045) < 1e-10);
});

test("mobile editing freezes camera fitting while still updating orbital geometry", () => {
  const h = setup(), s = { id: "p", body: { size: 1 }, R: 1, shells: 0 };
  Object.assign(h.scene, { W: 390, H: 844, narrow: true, order: ["p"] }); h.scene.systems.set("p", s);
  let fits = 0; h.scene.fitCamera = () => { fits++; h.scene.cam.tDist = 50 + fits; h.scene.cam.tsx = fits; h.scene.cam.tsy = fits; };
  h.scene.layout();
  const snapshot = () => [h.scene.cam.fov, h.scene.cam.tEl, h.scene.cam.tDist, h.scene.cam.tsx, h.scene.cam.tsy];
  const camera = snapshot(), center = [...h.scene.areaCenter()], distance = h.scene.focusDist(s);
  h.doc.activeElement = { matches: () => true }; h.scene.setDock(320);
  assert.deepEqual(snapshot(), camera); assert.equal(h.scene._fitDeferred, true); assert.equal(fits, 1);
  assert.deepEqual([...h.scene.areaCenter()], center); assert.equal(h.scene.focusDist(s), distance);
  s.body.size = 2; h.scene.layout(); assert.equal(s.R, 2.7, "task geometry keeps updating");
  h.doc.activeElement = { matches: () => false }; h.context.ViewportState.keyboard = true;
  h.scene.setNowH(110); assert.deepEqual(snapshot(), camera);
  h.context.ViewportState.keyboard = false; h.scene.layout();
  assert.equal(fits, 2); assert.equal(h.scene._fitDeferred, false);
});

test("a tiny or inverted focus area cannot produce an invalid camera distance", () => {
  const h = setup();
  Object.assign(h.scene, { W: 390, H: 300, area: { left: 200, right: 100, top: 108, bottom: 60 } });
  const distance = h.scene.focusDist({ R: 1, shells: 0 });
  assert.ok(Number.isFinite(distance) && distance > 0);
});

test("intro exit clears any fly-in and keeps the camera still", () => {
  for (const reduced of [false, true]) {
    const h = setup(); h.scene.fly = { z: 3.2 }; h.scene.flyIn = () => assert.fail("intro must not fly the camera");
    h.intro.exit(new Surface(), reduced);
    assert.equal(h.scene.fly, null); assert.equal(h.intro.done, true);
  }
});

console.log(`${passed} motion regressions passed`);
