/* 휴대폰 안정성 검사: iOS 입력칸 확대(16px 미만) · 키보드가 열릴 때 입력창 · 의도한 확대 유지 · 회전.
   실제 WKWebView 키보드 동작은 iPhone에서 따로 확인해야 한다.
   실행: 로컬 서버를 띄운 뒤  node tests/mobile-stability.cjs [http://127.0.0.1:8080/] */
"use strict";
const assert = require("node:assert/strict");
const path = require("node:path"), os = require("node:os"), fs = require("node:fs");
const puppeteer = require("../android/tools/node_modules/puppeteer-core");
const url = (process.argv[2] || "http://127.0.0.1:8080/").replace(/\/?$/, "/") + "?nointro";
const out = path.join(os.tmpdir(), "orbit-mobile-stability"); fs.mkdirSync(out, { recursive: true });
let count = 0;
function check(ok, message) { assert.ok(ok, message); console.log(`ok ${++count} - ${message}`); }
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function safeFields(page, screen) {
  const unsafe = await page.evaluate(() => [...document.querySelectorAll('input:not([type="hidden"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]), textarea, select')]
    .filter(el => el.getClientRects().length && !el.closest("[hidden]") && getComputedStyle(el).visibility !== "hidden" && parseFloat(getComputedStyle(el).fontSize) < 16).map(el => el.id || el.className || el.tagName));
  check(unsafe.length === 0, `${screen}: 16px 미만 입력칸 없음 ${unsafe.join(", ")}`);
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const errors = [];
  try {
    const context = await browser.createBrowserContext(), page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    await page.goto(url, { waitUntil: "networkidle0" });
    await page.evaluate(() => { Store.reset(true); Store.setSetting("welcomePending", false); Store.setSetting("coachSeen", true); Modal.close(); App.setTab("today"); });
    for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
      await page.setViewport({ ...size, isMobile: true, hasTouch: true }); await pause(250);
      await page.evaluate(() => { Panel.close(); Modal.close(); Palette.close(); QuickAdd.close(); App.setTab("today"); });
      await page.evaluate(() => QuickAdd.open()); await pause(60); await safeFields(page, `${size.width}px 추가 시트`);
      await page.evaluate(() => QuickAdd.toggle("date")); await pause(40); await safeFields(page, `${size.width}px 추가 시트 날짜 고르기`);
      await page.evaluate(() => { QuickAdd.closePops(); QuickAdd.close(); Palette.open(); }); await pause(40); await safeFields(page, `${size.width}px 검색`);
      await page.evaluate(() => { Palette.close(); Modal.planet(Store.planets()[0].id); }); await pause(60);
      await safeFields(page, `${size.width}px 행성 편집`);
      check(await page.evaluate(() => document.activeElement.id !== "pName"), `${size.width}px 행성 편집을 열어도 키보드가 바로 올라오지 않는다`);
      await page.evaluate(() => { Modal.close(); App.openTask(Store.tasks().find(t => t.steps.length).id); }); await pause(60);
      await safeFields(page, `${size.width}px 상세(제목 · 단계 · 메모 · 반복)`);
      await page.evaluate(() => Panel.datePop()); await pause(40); await safeFields(page, `${size.width}px 상세 날짜 · 시간`);
      check(await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector("#taskTitle")).fontSize) >= 19), "상세 제목은 큰 글자를 유지한다");
      await page.evaluate(() => { Panel.close(); Views.openPlanet(Store.planets()[0].id); }); await pause(60); await safeFields(page, `${size.width}px 행성 화면 빠른 추가`);
      await page.evaluate(() => { App.setTab("upcoming"); Views.setUpMode("cal"); Calendar.setMode("week"); Calendar.addDate = U.today(); Calendar.render(); }); await pause(60); await safeFields(page, `${size.width}px 주간 달력 추가`);
      await page.evaluate(() => { Calendar.addDate = null; Calendar.setMode("month"); Views.setUpMode("list"); Modal.settings(); }); await pause(60); await safeFields(page, `${size.width}px 설정`);
      await page.evaluate(() => { Modal.close(); App.setTab("universe"); }); await pause(600);
      check(await page.evaluate((w, h) => Math.abs(Scene.W - w) <= 1 && Math.abs(Scene.H - h) <= 1 && Scene.active, size.width, size.height), `${size.width}×${size.height}: 우주 탭 3D 크기가 화면을 따른다`);
      await page.evaluate(() => App.coach(true)); await pause(60);
      check(await page.evaluate(() => { const r = document.querySelector("#coach").getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight + 1; }), `${size.width}px 우주 조작 안내가 화면 안에 다 보인다`);
      await page.evaluate(() => { App.coach(false, true); App.setTab("today"); });
    }
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.waitForFunction(() => ViewportState.width === document.documentElement.clientWidth && document.documentElement.clientWidth === 390, { polling: 100, timeout: 5000 }); await pause(300);
    await page.evaluate(() => {
      const vv = window.visualViewport;
      window.testViewportHeight = 844; window.testViewportScale = 1;
      Object.defineProperties(vv, { height: { configurable: true, get: () => window.testViewportHeight }, scale: { configurable: true, get: () => window.testViewportScale }, offsetTop: { configurable: true, get: () => 0 } });
      ViewportState.height = 844; ViewportState.keyboard = false;
      QuickAdd.open();
    });
    await pause(200); await page.focus("#cmdInput");
    await page.evaluate(() => { ViewportState.update(); window.testViewportHeight = 480; ViewportState.update(); });
    await pause(300);
    const kb = await page.evaluate(() => ({ keyboard: ViewportState.keyboard, bottom: document.querySelector("#cmd").getBoundingClientRect().bottom, tab: getComputedStyle(document.getElementById("tabbar")).display }));
    check(kb.keyboard && kb.bottom <= 481 && kb.tab === "none", `키보드가 열리면 추가 시트가 키보드 위로 올라가고 아래 탭은 숨는다 (${JSON.stringify(kb)})`);
    await page.screenshot({ path: path.join(out, "keyboard-layout.png") });
    await page.evaluate(() => { window.testViewportScale = 1.5; window.testViewportHeight = 300; window.beforePinch = document.documentElement.style.cssText; ViewportState.update(); });
    check(await page.evaluate(() => document.documentElement.style.cssText === window.beforePinch && window.visualViewport.scale === 1.5), "일부러 확대(핀치)하면 화면을 되돌리거나 다시 배치하지 않는다");
    await page.evaluate(() => { window.testViewportScale = 1; window.testViewportHeight = 844; document.querySelector("#cmdInput").blur(); QuickAdd.close(); ViewportState.update(); });
    check(await page.evaluate(() => !ViewportState.keyboard && parseFloat(document.documentElement.style.getPropertyValue("--keyboard-inset")) === 0 && window.scrollX === 0 && window.scrollY === 0), "키보드를 닫으면 원래 화면으로 돌아간다");
    await page.close();
    const fine = await context.newPage();
    await fine.setViewport({ width: 500, height: 900, isMobile: false, hasTouch: false });
    await fine.goto(url, { waitUntil: "domcontentloaded" }); await fine.waitForFunction(() => typeof App !== "undefined" && Store.state);
    await fine.evaluate(() => { QuickAdd.open(); document.querySelector("#cmdInput").focus(); });
    await fine.setViewport({ width: 500, height: 650, isMobile: false, hasTouch: false });
    await fine.waitForFunction(() => !ViewportState.keyboard && ViewportState.height === 650, { polling: 100, timeout: 5000 });
    check(await fine.evaluate(() => !ViewportState.keyboard && ViewportState.height === 650), "좁은 데스크톱 창 크기 변경을 휴대폰 키보드로 오해하지 않는다");
    check(errors.length === 0, `실행 오류 없음: ${errors.join("; ")}`);
    console.log(`${count} mobile stability checks passed. Screenshots: ${out}`);
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
