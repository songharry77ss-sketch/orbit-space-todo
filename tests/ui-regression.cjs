/* Run against a local server: node tests/ui-regression.cjs [http://127.0.0.1:8080/] */
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const puppeteer = require("../android/tools/node_modules/puppeteer-core");
const url = process.argv[2] || "http://127.0.0.1:8080/";
const screenshots = path.join(os.tmpdir(), "orbit-ux-after");
fs.mkdirSync(screenshots, { recursive: true });
let count = 0;
function check(value, message) { assert.ok(value, message); console.log(`ok ${++count} - ${message}`); }
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function reverseTab(page) { await page.keyboard.down("Shift"); await page.keyboard.press("Tab"); await page.keyboard.up("Shift"); }

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--lang=ko-KR"] });
  const errors = [];
  try {
    const context = await browser.createBrowserContext(), page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".welcome-card");
    check(await page.evaluate(() => Store.tasks().length === 0), "first visit starts empty");
    await page.screenshot({ path: path.join(screenshots, "mobile-welcome.png") });
    await page.click('[data-welcome="demo"]');
    check(await page.evaluate(() => !document.querySelector("#demoBanner").hidden && !Store.tasks().some(t => t.status === "doing")), "demo is explicit and starts no timer");
    await page.evaluate(() => { Scene.setAutoRotate(false); App.setView("list"); });
    await pause(150);
    check(await page.evaluate(() => document.querySelector("#listView").dataset.layout === "list"), "mobile defaults to a grouped vertical list");
    await page.screenshot({ path: path.join(screenshots, "mobile-list.png") });
    await page.evaluate(() => App.setView("calendar"));
    await page.waitForSelector("#calAgenda", { visible: true });
    check(await page.evaluate(() => document.querySelectorAll('.cal-cell[tabindex="0"]').length === 1 && document.querySelectorAll(".cal-agenda-task").length > 0), "month has one keyboard entry and a readable day agenda");
    await page.screenshot({ path: path.join(screenshots, "mobile-calendar.png") });
    await page.evaluate(() => Calendar.selectDate(U.addDays(U.today(), 1)));
    await page.click("#cmdDate");
    await page.$eval("#qaDate", input => { input.value = "2026-11-01"; input.dispatchEvent(new Event("change", { bubbles: true })); });
    await page.click("#cmdInput"); await page.type("#cmdInput", "선택 날짜 저장 검사"); await page.keyboard.press("Enter");
    check(await page.evaluate(() => Store.tasks().find(t => t.title === "선택 날짜 저장 검사")?.due === "2026-11-01"), "date picker value is the date actually saved");
    await page.type("#cmdInput", "다음주 월요일 파서 검사"); await page.keyboard.press("Enter");
    check(await page.evaluate(() => Store.tasks().find(t => t.title === "파서 검사")?.due === U.nextWeekday(U.today(), 1, true)), "natural-language weekday stores the requested date");
    await page.evaluate(() => { Calendar.selectDate(U.today()); document.querySelector('.cal-cell[tabindex="0"]').focus(); });
    const oldDate = await page.evaluate(() => Calendar.selected);
    await page.keyboard.press("ArrowRight");
    check(await page.evaluate(ds => Calendar.selected === U.addDays(ds, 1) && document.activeElement.dataset.date === Calendar.selected, oldDate), "calendar arrow key moves one day and retains focus");
    await page.setViewport({ width: 1440, height: 900, isMobile: false, hasTouch: false });
    await page.evaluate(() => { App.setView("today"); Board.collapsed = false; Board.render(); });
    await page.click("#settingsBtn");
    await page.waitForFunction(() => document.querySelector("#modal").contains(document.activeElement), { polling: 100, timeout: 5000 });
    check(await page.evaluate(() => document.querySelector("#modal").contains(document.activeElement)), "settings moves keyboard focus into its dialog");
    for (let i = 0; i < 35; i++) await page.keyboard.press("Tab");
    check(await page.evaluate(() => document.querySelector("#modal").contains(document.activeElement)), "Tab remains in settings");
    await page.keyboard.press("Escape");
    check(await page.evaluate(() => document.activeElement.id === "settingsBtn" && !document.querySelector(".topbar").inert), "closing settings restores focus and background access");
    await page.click("#searchBtn"); await pause(50); await reverseTab(page);
    check(await page.evaluate(() => document.querySelector("#palette").contains(document.activeElement)), "search traps reverse Tab too");
    await page.keyboard.press("Escape");
    check(await page.evaluate(() => document.activeElement.id === "searchBtn"), "search returns focus to its opener");
    await page.click("#cmdPrio"); await pause(30); await page.keyboard.press("Escape");
    check(await page.evaluate(() => document.querySelector("#popPrio").hidden && document.activeElement.id === "cmdPrio"), "Escape from quick-add popup returns to its button");
    await page.evaluate(() => { const t = Store.tasks().find(t => t.steps.length && t.status === "todo"); App.startTask(t.id); });
    await pause(120);
    for (const width of [640, 768, 820, 1024, 1440]) {
      await page.setViewport({ width, height: 900, isMobile: false, hasTouch: false }); await pause(550);
      const geometry = await page.evaluate(() => {
        const cmd = document.querySelector("#cmd").getBoundingClientRect(), input = document.querySelector("#cmdInput").getBoundingClientRect(), add = document.querySelector(".cmd-go").getBoundingClientRect();
        return { input: input.width, right: add.right, cmdRight: cmd.right, width: innerWidth, nowHeight: parseFloat(document.body.style.getPropertyValue("--now-height")) };
      });
      check(geometry.input >= 110 && geometry.right <= geometry.cmdRight + 1 && geometry.right <= geometry.width && geometry.nowHeight > 0, `expanded board keeps input and controls usable at ${width}px (${JSON.stringify(geometry)})`);
      if ([640, 768, 1440].includes(width)) await page.screenshot({ path: path.join(screenshots, `today-${width}.png`) });
    }
    await page.setViewport({ width: 768, height: 900, isMobile: false, hasTouch: false });
    await page.evaluate(() => App.openPlanet(Store.planets()[0].id)); await pause(50);
    check(await page.evaluate(() => document.querySelector("#sheet").offsetWidth >= 380 && document.querySelector(".topbar").inert), "tablet detail is wide enough to edit and has a clear modal boundary");
    await page.click('#sheet [data-act="edit-planet"]'); await pause(50);
    check(await page.evaluate(() => document.querySelector("#modal").contains(document.activeElement) && document.querySelector("#sheet").inert), "nested planet editor owns focus over the detail sheet");
    await page.keyboard.press("Escape");
    check(await page.evaluate(() => !document.querySelector("#sheet").hidden && !document.querySelector("#sheet").inert && document.querySelector(".topbar").inert), "closing nested editor returns access to its sheet only");
    await page.click("#sheetBackdrop", { offset: { x: 20, y: 200 } });
    check(await page.evaluate(() => document.querySelector("#sheet").hidden && !document.querySelector(".topbar").inert), "outside tap closes the tablet sheet and restores its workspace");
    await page.evaluate(() => { App.setView("calendar"); Calendar.setMode("week"); }); await pause(100);
    check(await page.evaluate(() => getComputedStyle(document.querySelector("#calGrid")).display === "flex" && document.querySelector(".wk-main").getBoundingClientRect().width >= 200), "narrow weekly calendar keeps full-width readable task titles");
    await page.screenshot({ path: path.join(screenshots, "tablet-week.png") });
    await page.focus('#calMode [data-mode="week"]'); await page.keyboard.press("ArrowLeft");
    check(await page.evaluate(() => Calendar.mode === "month" && document.activeElement.dataset.mode === "month"), "month/week tabs support arrow keys without changing the displayed month");
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.evaluate(() => App.openTask(Store.tasks().find(t => t.steps.length).id)); await pause(80);
    check(await page.evaluate(() => document.querySelector("#sheet").contains(document.activeElement) && document.querySelector(".topbar").inert), "mobile detail focuses its sheet and protects background");
    await page.screenshot({ path: path.join(screenshots, "mobile-detail.png") });
    await reverseTab(page);
    check(await page.evaluate(() => document.querySelector("#sheet").contains(document.activeElement)), "reverse Tab from the sheet itself wraps to its last control");
    await page.keyboard.press("Tab"); await reverseTab(page);
    check(await page.evaluate(() => document.querySelector("#sheet").contains(document.activeElement)), "mobile detail retains keyboard focus");
    await page.keyboard.press("Escape");
    check(await page.evaluate(() => document.querySelector("#sheet").hidden && !document.querySelector(".topbar").inert), "Escape closes mobile detail and releases background");
    for (const width of [320, 360, 390]) {
      await page.setViewport({ width, height: 640, isMobile: true, hasTouch: true });
      await page.evaluate(() => { App.setView("calendar"); Calendar.setMode("month"); Calendar.selectDate("2026-08-23"); }); await pause(100);
      const dimensions = await page.evaluate(() => ({ agenda: document.querySelector("#calAgenda").getBoundingClientRect().height, grid: document.querySelector("#calGrid").getBoundingClientRect().height, card: document.querySelector("#calendar").getBoundingClientRect(), overflow: document.documentElement.scrollWidth > innerWidth }));
      check(dimensions.agenda >= 150 && dimensions.grid > 120 && !dimensions.overflow, `six-week month keeps an agenda and no page overflow at ${width}px`);
      await page.screenshot({ path: path.join(screenshots, `calendar-${width}-short.png`) });
    }
    await page.close();
    const cleanContext = await browser.createBrowserContext(), clean = await cleanContext.newPage();
    clean.on("pageerror", error => errors.push(error.message));
    await clean.setViewport({ width: 360, height: 640, isMobile: true, hasTouch: true });
    await clean.goto(url, { waitUntil: "domcontentloaded" }); await clean.waitForSelector(".welcome-card");
    await clean.click('.welcome-actions [data-welcome="start"]'); await pause(30);
    check(await clean.evaluate(() => document.activeElement.id === "cmdInput" && Store.tasks().length === 0 && !Store.state.settings.demoMode), "start action focuses a clean real workspace");
    await clean.type("#cmdInput", "내 첫 번째 할 일"); await clean.keyboard.press("Enter");
    await clean.reload({ waitUntil: "domcontentloaded" }); await clean.waitForFunction(() => typeof Store !== "undefined" && Store.state);
    check(await clean.evaluate(() => Store.tasks().some(t => t.title === "내 첫 번째 할 일") && document.querySelector("#modal").hidden), "real tasks persist and welcome stays dismissed after reload");
    await cleanContext.close();
    check(errors.length === 0, `no runtime errors: ${errors.join("; ")}`);
    console.log(`${count} browser checks passed. Screenshots: ${screenshots}`);
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
