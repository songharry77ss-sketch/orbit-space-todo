/* Browser regression for the conditions behind iOS focus zoom and viewport jumps.
   Real WKWebView keyboard behavior still needs an iPhone device check. */
const assert = require("node:assert/strict");
const path = require("node:path"), os = require("node:os"), fs = require("node:fs");
const puppeteer = require("../android/tools/node_modules/puppeteer-core");
const url = process.argv[2] || "http://127.0.0.1:8080/";
const out = path.join(os.tmpdir(), "orbit-mobile-stability"); fs.mkdirSync(out, { recursive: true });
let count = 0;
function check(ok, message) { assert.ok(ok, message); console.log(`ok ${++count} - ${message}`); }
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function safeFields(page, screen) {
  const unsafe = await page.evaluate(() => [...document.querySelectorAll('input:not([type="hidden"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]), textarea, select')].filter(el => el.getClientRects().length && parseFloat(getComputedStyle(el).fontSize) < 16).map(el => `${el.id || el.className}: ${getComputedStyle(el).fontSize}`));
  check(unsafe.length === 0, `${screen} has no undersized focus-zoom fields: ${unsafe.join(", ")}`);
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const errors = [];
  try {
    const context = await browser.createBrowserContext(), page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    await page.goto(url, { waitUntil: "domcontentloaded" }); await page.waitForSelector('[data-welcome="demo"]');
    await page.click('[data-welcome="demo"]');
    await page.evaluate(() => Scene.setAutoRotate(false));
    for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
      await page.setViewport({ ...size, isMobile: true, hasTouch: true });
      await page.waitForFunction((w, h) => Math.abs(Scene.W - w) <= 1 && Math.abs(Scene.H - h) <= 1, { polling: 100, timeout: 5000 }, size.width, size.height);
      check(await page.evaluate((w, h) => Math.abs(Scene.W - w) <= 1 && Math.abs(Scene.H - h) <= 1, size.width, size.height), `scene dimensions follow the settled ${size.width}×${size.height} orientation`);
      await page.evaluate(() => { Panel.close(); Modal.close(); Palette.close(); App.coach(false); App.setView("today"); });
      await safeFields(page, `${size.width}px command`);
      await page.evaluate(() => Palette.open()); await pause(30); await safeFields(page, `${size.width}px search`);
      await page.evaluate(() => { Palette.close(); Modal.planet(Store.planets()[0].id); }); await pause(30);
      await safeFields(page, `${size.width}px planet editor`);
      check(await page.evaluate(() => document.activeElement.id !== "pName"), `${size.width}px editor does not summon a keyboard on open`);
      await page.evaluate(() => { Modal.close(); App.openTask(Store.tasks().find(t => t.steps.length).id); }); await pause(30);
      await safeFields(page, `${size.width}px task title, steps, notes, date, time and repeat`);
      check(await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector("#taskTitle")).fontSize) >= 19), "task title retains its larger typography");
      await page.evaluate(() => { Panel.close(); App.openPlanet(Store.planets()[0].id); }); await safeFields(page, `${size.width}px category quick add`);
      await page.evaluate(() => { Panel.close(); QuickAdd.toggle("date"); }); await safeFields(page, `${size.width}px date popup`);
      await page.evaluate(() => { QuickAdd.closePops(); App.setView("list"); ListView.addKey = Store.planets()[0].id; ListView.renderCols(); }); await safeFields(page, `${size.width}px list search and inline add`);
      await page.evaluate(() => { App.setView("calendar"); Calendar.setMode("week"); Calendar.addDate = U.today(); Calendar.render(); }); await safeFields(page, `${size.width}px calendar add`);
      await page.evaluate(() => {
        App.setView("today"); const box = document.createElement("div"); box.className = "gc-key"; box.id = "testFields"; box.style.cssText = "position:fixed;top:150px;left:20px;z-index:90";
        box.innerHTML = '<input id="futureField" aria-label="New field"><input id="testGoogleKey" type="text" aria-label="Google key">'; document.body.appendChild(box);
      }); await safeFields(page, `${size.width}px Google key and future default inputs`);
      await page.evaluate(() => { document.querySelector("#testFields").remove(); App.coach(true); }); await pause(80);
      check(await page.evaluate(() => { const r = document.querySelector("#coach").getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; }), `${size.width}px help stays fully inside the viewport`);
      await page.$eval("#coach", el => { el.scrollTop = el.scrollHeight; });
      check(await page.evaluate(() => { const r = document.querySelector(".coach-foot button").getBoundingClientRect(), card = document.querySelector("#coach").getBoundingClientRect(); return r.top >= card.top && r.bottom <= card.bottom; }), "help footer remains reachable after scrolling");
      await page.screenshot({ path: path.join(out, `help-${size.width}.png`) });
    }
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.waitForFunction(() => Scene.W === 390 && Scene.H === 844, { polling: 100, timeout: 5000 });
    await page.evaluate(() => { App.coach(false); Panel.close(); Scene.focusOn(null); App.openTask(Store.tasks()[0].id); });
    check(await page.evaluate(() => Scene.focusId === null), "opening task details does not zoom toward a planet");
    await page.evaluate(() => { Scene.focusOn(Store.planets()[0].id); Panel.close(); });
    check(await page.evaluate(() => Scene.focusId === Store.planets()[0].id), "closing details preserves a deliberately selected scene");
    await page.evaluate(() => {
      Scene.focusOn(null); const vv = window.visualViewport;
      window.testViewportHeight = 844; window.testViewportScale = 1;
      Object.defineProperties(vv, { height: { configurable: true, get: () => window.testViewportHeight }, scale: { configurable: true, get: () => window.testViewportScale }, offsetTop: { configurable: true, get: () => 0 } });
      ViewportState.height = 844; ViewportState.keyboard = false;
      document.querySelector("#cmdInput").focus({ preventScroll: true }); ViewportState.update();
      window.testCamera = { distance: Scene.cam.tDist, height: Scene.H, zoom: Scene.v3d.tzoom };
      window.testViewportHeight = 480; ViewportState.update(); Scene.layout();
    });
    const keyboardState = await page.evaluate(() => ({ keyboard: ViewportState.keyboard, bottom: document.querySelector("#cmd").getBoundingClientRect().bottom, height: Scene.H, before: window.testCamera, distance: Scene.cam.tDist, client: document.documentElement.clientHeight, visible: visualViewport.height, inset: document.documentElement.style.getPropertyValue("--keyboard-inset"), active: document.activeElement.id }));
    check(keyboardState.keyboard && keyboardState.bottom <= 480 && keyboardState.height === keyboardState.before.height && keyboardState.distance === keyboardState.before.distance, `keyboard lifts input without refitting or enlarging the scene (${JSON.stringify(keyboardState)})`);
    await page.screenshot({ path: path.join(out, "keyboard-layout.png") });
    await page.evaluate(() => { window.testViewportScale = 1.5; window.testViewportHeight = 300; window.beforePinch = document.documentElement.style.cssText; ViewportState.update(); });
    check(await page.evaluate(() => document.documentElement.style.cssText === window.beforePinch && window.visualViewport.scale === 1.5), "intentional page pinch does not get reset or relaid out");
    await page.evaluate(() => { window.testViewportScale = 1; window.testViewportHeight = 844; document.querySelector("#cmdInput").blur(); ViewportState.update(); });
    check(await page.evaluate(() => !ViewportState.keyboard && parseFloat(document.documentElement.style.getPropertyValue("--keyboard-inset")) === 0 && window.scrollX === 0 && window.scrollY === 0), "keyboard close restores the original app surface");
    await page.close();
    const fine = await context.newPage();
    await fine.setViewport({ width: 500, height: 900, isMobile: false, hasTouch: false });
    await fine.goto(url, { waitUntil: "domcontentloaded" }); await fine.waitForFunction(() => typeof App !== "undefined" && Store.state);
    await fine.evaluate(() => { document.querySelector("#cmdInput").focus(); });
    await fine.setViewport({ width: 500, height: 650, isMobile: false, hasTouch: false });
    await fine.waitForFunction(() => !ViewportState.keyboard && ViewportState.height === 650, { polling: 100, timeout: 5000 });
    check(await fine.evaluate(() => !ViewportState.keyboard && ViewportState.height === 650), "narrow desktop resize is not mistaken for a phone keyboard");
    check(errors.length === 0, `no runtime errors: ${errors.join("; ")}`);
    console.log(`${count} mobile stability checks passed. Screenshots: ${out}`);
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
