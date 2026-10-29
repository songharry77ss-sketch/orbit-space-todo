/* ORBIT 화면 회귀 테스트 (2026-10 개편 화면)
   실행: 로컬 서버를 띄운 뒤  node tests/ui-regression.cjs [http://127.0.0.1:8080/]
   - 글자 대비 검사: 주요 화면(다크 · 라이트)의 보이는 글자 전부가 WCAG 기준(본문 4.5:1, 큰 글자 3:1) 이상인지
   - 휴대폰에서 오늘 할 일이 스크롤 없이 보이는지, 좁은 화면에서 가로로 넘치지 않는지
   - 추가 · 완료 · 밀어서 완료/내일로 · 집중 · 상세 편집 · 예정 · 행성 · 설정 · 검색 · 우주 탭이 동작하는지 */
"use strict";
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const puppeteer = require("../android/tools/node_modules/puppeteer-core");
const BASE = (process.argv[2] || "http://127.0.0.1:8080/").replace(/\/?$/, "/");
const URL = BASE + "?nointro";
const shots = path.join(os.tmpdir(), "orbit-ui");
fs.mkdirSync(shots, { recursive: true });
let count = 0;
function check(value, message) { assert.ok(value, message); console.log(`ok ${++count} - ${message}`); }
const pause = ms => new Promise(r => setTimeout(r, ms));
const PHONE = { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 };
const DESK = { width: 1440, height: 900, isMobile: false, hasTouch: false };

/* 페이지 안에서: 보이는 글자의 대비를 재고 기준에 못 미치는 것을 돌려준다 */
function auditInPage(rootSel) {
  const parse = c => {
    let m = c.match(/^rgba?\(([^)]+)\)/);
    if (m) { const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] == null ? 1 : p[3]]; }
    m = c.match(/^color\(srgb ([^)]+)\)/);
    if (m) { const p = m[1].split(/[\s/]+/).filter(Boolean).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p[3] == null ? 1 : p[3]]; }
    return null;
  };
  const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const blend = (t, b) => [t[0] * t[3] + b[0] * (1 - t[3]), t[1] * t[3] + b[1] * (1 - t[3]), t[2] * t[3] + b[2] * (1 - t[3]), 1];
  const bodyBg = parse(getComputedStyle(document.body).backgroundColor) || [255, 255, 255, 1];
  const bgOf = el => {
    const stack = [];
    for (let n = el; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c[3] > 0.01) { stack.push(c); if (c[3] >= 0.99) break; } }
    let base = stack.length && stack[stack.length - 1][3] >= 0.99 ? stack.pop() : bodyBg;
    for (let i = stack.length - 1; i >= 0; i--) base = blend(stack[i], base);
    return base;
  };
  const opacityOf = el => { let o = 1; for (let n = el; n; n = n.parentElement) o *= +getComputedStyle(n).opacity; return o; };
  const root = document.querySelector(rootSel) || document.body, fails = [];
  let n = 0, min = 99;
  for (const el of root.querySelectorAll("*")) {
    if (!el.getClientRects().length || el.closest("[hidden], [inert], #stage, svg, .intro")) continue;
    const txt = [...el.childNodes].filter(x => x.nodeType === 3).map(x => x.textContent).join("").trim();
    if (!txt) continue;
    const st = getComputedStyle(el); if (st.visibility === "hidden" || opacityOf(el) < 0.95) continue;
    const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight) continue;
    const fg = parse(st.color); if (!fg || fg[3] < 0.05) continue;
    const bg = bgOf(el), c = blend(fg, bg), a = lum(c), b = lum(bg), ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const size = parseFloat(st.fontSize), large = size >= 24 || (size >= 18.6 && +st.fontWeight >= 700), need = large ? 3 : 4.5;
    n++; min = Math.min(min, ratio);
    if (ratio < need) fails.push(`${txt.slice(0, 24)} (${ratio.toFixed(2)} < ${need}, ${st.color} on rgb(${bg.slice(0, 3).map(Math.round)}))`);
  }
  return { n, min: +min.toFixed(2), fails };
}
async function audit(page, label, rootSel = "body") {
  const r = await page.evaluate(auditInPage, rootSel);
  check(r.n > 0 && !r.fails.length, `글자 대비: ${label} — ${r.n}개 중 최저 ${r.min}:1${r.fails.length ? " · 미달 " + r.fails.slice(0, 4).join(" | ") : ""}`);
}
async function fresh(browser, viewport, scheme = "dark", sample = true) {
  const ctx = await browser.createBrowserContext(), page = await ctx.newPage(), errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.setViewport(viewport); await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);
  await page.goto(URL, { waitUntil: "networkidle0", timeout: 60000 });
  if (sample) await page.evaluate(() => { Store.reset(true); Store.setSetting("welcomePending", false); Store.setSetting("demoMode", false); Store.setSetting("coachSeen", true); Modal.close(); Welcome.renderBanner(); App.setTab("today"); });
  await pause(250);
  return { ctx, page, errors };
}
async function touchSwipe(page, sel, dx) {
  await page.evaluate((sel, dx) => {
    const row = document.querySelector(sel), r = row.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    const ev = (type, px, tgt) => (tgt || window).dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: px, clientY: y, pointerId: 21, pointerType: "touch", isPrimary: true, button: 0, buttons: type === "pointerup" ? 0 : 1 }));
    ev("pointerdown", x, row.querySelector(".tk-t"));
    for (let i = 1; i <= 8; i++) ev("pointermove", x + dx * i / 8);
    ev("pointerup", x + dx);
  }, sel, dx);
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--lang=ko-KR"] });
  const allErrors = [];
  try {
    /* ── 첫 방문 ── */
    {
      const { ctx, page, errors } = await fresh(browser, PHONE, "dark", false);
      await pause(400);
      check(await page.evaluate(() => !document.getElementById("modal").hidden && !!document.querySelector(".welcome-card") && Store.tasks().length === 0), "첫 방문은 빈 상태로 환영 카드를 보여 준다");
      await audit(page, "환영 카드 · 다크", "#modal");
      await page.click('[data-welcome="start"][data-autofocus]'); await pause(450);
      check(await page.evaluate(() => document.body.classList.contains("composing") && document.activeElement.id === "cmdInput"), "「첫 할 일 적기」는 추가 시트를 열고 입력칸에 바로 커서를 둔다");
      await page.type("#cmdInput", "보고서 쓰기 !1 내일"); await page.keyboard.press("Enter"); await pause(300);
      check(await page.evaluate(() => { const t = Store.tasks()[0]; return t && t.title === "보고서 쓰기" && t.priority === 1 && t.due === U.addDays(U.today(), 1); }), "자연어 입력(!1 · 내일)으로 우선순위와 마감일이 정해진다");
      await page.reload({ waitUntil: "networkidle0" }); await pause(300);
      check(await page.evaluate(() => document.getElementById("modal").hidden && Store.tasks().length === 1), "다시 열어도 환영 카드는 다시 뜨지 않고 할 일은 남아 있다");
      allErrors.push(...errors); await ctx.close();
    }

    /* ── 휴대폰 · 다크: 오늘 화면 ── */
    {
      const { ctx, page, errors } = await fresh(browser, PHONE, "dark");
      check(await page.evaluate(() => { const v = document.getElementById("vToday"), vr = v.getBoundingClientRect(), rows = [...v.querySelectorAll(".tk")]; return rows.length >= 9 && rows.every(r => r.getBoundingClientRect().bottom <= vr.bottom + 1) && v.scrollHeight <= v.clientHeight + 2; }), "390×844: 오늘 할 일 9개가 스크롤 없이 한 화면에 보인다");
      check(await page.evaluate(() => getComputedStyle(document.getElementById("tabbar")).display !== "none" && getComputedStyle(document.getElementById("side")).display === "none" && !!document.querySelector(".fab")), "휴대폰은 아래 탭과 + 버튼, 왼쪽 메뉴 없음");
      check(await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector(".tk-t")).fontSize) >= 16 && parseFloat(getComputedStyle(document.querySelector(".tk-m")).fontSize) >= 13), "할 일 제목 16px 이상 · 보조 글자 13px 이상");
      await audit(page, "오늘 · 다크");
      await page.screenshot({ path: path.join(shots, "phone-today-dark.png") });
      // 완료(동그라미)
      const first = await page.evaluate(() => document.querySelector("#vToday .tk").dataset.task);
      await page.click(`#vToday .tk[data-task="${first}"] .ck`); await pause(500);
      check(await page.evaluate(id => Store.task(id).status === "done" && !!document.querySelector(".toast .undo"), first), "동그라미를 누르면 완료되고 되돌리기 알림이 뜬다");
      await page.click(".toast .undo"); await pause(200);
      check(await page.evaluate(id => Store.task(id).status === "todo", first), "알림의 「되돌리기」로 완료를 취소한다");
      // 밀어서 완료 · 내일로
      const sw1 = await page.evaluate(() => document.querySelectorAll("#vToday .tk")[1].dataset.task);
      await touchSwipe(page, `#vToday .tk[data-task="${sw1}"]`, 260); await pause(700);
      check(await page.evaluate(id => Store.task(id).status === "done", sw1), "줄을 오른쪽으로 밀면 바로 완료된다(기다림 없음)");
      const sw2 = await page.evaluate(() => [...document.querySelectorAll("#vToday .tk")].find(r => !r.classList.contains("done")).dataset.task);
      await touchSwipe(page, `#vToday .tk[data-task="${sw2}"]`, -260); await pause(600);
      check(await page.evaluate(id => Store.task(id).due === U.addDays(U.today(), 1) && !Store.isTodayTask(Store.task(id)), sw2), "줄을 왼쪽으로 밀면 내일로 미뤄진다");
      // 집중
      const fid = await page.evaluate(() => { const t = Store.tasks().find(t => t.status === "todo" && t.steps.length && Store.isTodayTask(t)); return t.id; });
      await page.click(`#vToday .tk[data-task="${fid}"] .tk-go`); await pause(700);
      check(await page.evaluate(id => Store.task(id).status === "doing" && !!document.querySelector(`.fcard[data-id="${id}"]`), fid), "불꽃을 누르면 집중이 시작되고 맨 위에 집중 카드가 생긴다");
      await audit(page, "오늘 · 집중 카드 · 다크");
      await page.click(`.fcard[data-id="${fid}"] .f-t`); await pause(400);
      check(await page.evaluate(() => !document.getElementById("focusScreen").hidden && document.getElementById("focusScreen").contains(document.activeElement)), "집중 카드를 누르면 전체 화면 집중이 열리고 초점이 그 안에 있다");
      await audit(page, "집중 화면", "#focusScreen");
      await page.screenshot({ path: path.join(shots, "phone-focus-screen.png") });
      await page.click('#focusScreen [data-act="step"]'); await pause(200);
      check(await page.evaluate(id => Store.task(id).steps[0].done, fid), "집중 화면에서 단계를 바로 체크한다");
      await page.click('#focusScreen [data-act="done"]'); await pause(1200);
      check(await page.evaluate(id => Store.task(id).status === "done" && document.getElementById("focusScreen").hidden, fid), "집중 화면의 「완료」로 끝내면 화면이 닫힌다");
      // 상세
      const did = await page.evaluate(() => Store.tasks().find(t => t.status === "todo" && Store.isTodayTask(t)).id);
      await page.click(`#vToday .tk[data-task="${did}"] .tk-t`); await pause(400);
      check(await page.evaluate(() => !document.getElementById("sheet").hidden && document.getElementById("sheet").getAttribute("aria-modal") === "true" && document.getElementById("app").inert), "할 일을 누르면 아래에서 상세 시트가 열리고 뒤 화면은 잠긴다");
      await audit(page, "상세 시트 · 다크", "#sheet");
      await page.click('#sheet [data-act="prio-menu"]'); await pause(150);
      await page.click('.prio-menu [data-p="3"]'); await pause(200);
      check(await page.evaluate(id => Store.task(id).priority === 3, did), "상세의 우선순위 칩에서 「낮음」을 고른다");
      await page.click('#sheet [data-act="date"]'); await pause(150);
      await page.click('#sheet .date-pop [data-v]:nth-child(2)'); await pause(200);
      check(await page.evaluate(id => Store.task(id).due === U.addDays(U.today(), 1), did), "날짜 칩 → 「내일」로 마감일을 바꾼다");
      await page.evaluate(() => { const t = document.getElementById("taskTitle"); t.focus(); t.select(); }); await page.type("#taskTitle", "새 제목 테스트"); await pause(450);
      check(await page.evaluate(id => Store.task(id).title === "새 제목 테스트", did), "상세에서 제목을 고치면 저장된다");
      await page.keyboard.press("Escape"); await page.keyboard.press("Escape"); await pause(200);
      check(await page.evaluate(() => document.getElementById("sheet").hidden && !document.getElementById("app").inert), "Esc로 상세를 닫으면 뒤 화면이 다시 열린다");
      // 추가 시트
      await page.click("#fab"); await pause(400);
      check(await page.evaluate(() => document.body.classList.contains("composing") && document.activeElement.id === "cmdInput"), "+ 버튼은 추가 시트를 열고 입력칸에 커서를 둔다");
      await audit(page, "추가 시트 · 다크", "#cmd");
      await page.type("#cmdInput", "장 보기 2"); await page.keyboard.press("Enter"); await pause(250);
      check(await page.evaluate(() => Store.tasks().some(t => t.title === "장 보기 2" && Store.isTodayTask(t))), "오늘 탭에서 추가하면 오늘 할 일이 된다");
      await page.keyboard.press("Escape"); await pause(200);
      check(await page.evaluate(() => !document.body.classList.contains("composing")), "Esc로 추가 시트를 닫는다");
      allErrors.push(...errors); await ctx.close();
    }

    /* ── 휴대폰 · 예정 · 행성 · 설정 · 우주 (다크 · 라이트) ── */
    for (const scheme of ["dark", "light"]) {
      const { ctx, page, errors } = await fresh(browser, PHONE, scheme);
      if (scheme === "light") await audit(page, "오늘 · 라이트");
      await page.click('#tabbar [data-tab="upcoming"]'); await pause(300);
      check(await page.evaluate(() => !document.getElementById("vUpcoming").hidden && document.querySelectorAll("#upList .day-h").length > 0), `예정 탭(${scheme})은 날짜별 목록을 보여 준다`);
      await audit(page, `예정 · ${scheme}`, "#vUpcoming");
      if (scheme === "dark") {
        const ds = await page.evaluate(() => U.addDays(U.today(), 1));
        await page.click(`.wday[data-date="${ds}"]`); await pause(250);
        check(await page.evaluate(ds => Views.upSel === ds && QuickAdd.due === ds, ds), "주간 줄에서 날짜를 고르면 추가 기본 날짜도 그날이 된다");
      }
      await page.click('#upMode [data-mode="cal"]'); await pause(300);
      check(await page.evaluate(() => !document.getElementById("calendar").hidden && document.querySelectorAll(".cal-cell").length >= 28), `달력으로 바꾸면 월간 달력이 나온다(${scheme})`);
      await audit(page, `달력 · ${scheme}`, "#vUpcoming");
      const cellDate = await page.evaluate(() => U.addDays(U.today(), 2));
      await page.evaluate(ds => document.querySelector(`.cal-cell[data-date="${ds}"]`)?.click(), cellDate); await pause(250);
      check(await page.evaluate(ds => Views.upMode === "cal" && Calendar.selected === ds, cellDate), "달력에서 날짜를 눌러도 달력에 머물고 그날을 고른다");
      await page.click('#upMode [data-mode="list"]'); await pause(150);
      await page.click('#tabbar [data-tab="planets"]'); await pause(300);
      await audit(page, `행성 · ${scheme}`, "#vPlanets");
      await page.click("#vPlanets .pl .tk-t"); await pause(300);
      check(await page.evaluate(() => !!Views.planetId && document.getElementById("viewTitle").textContent === Store.planet(Views.planetId).name && !document.getElementById("topBack").hidden), "행성을 누르면 그 행성 화면과 뒤로 버튼이 나온다");
      await audit(page, `행성 상세 · ${scheme}`, "#vPlanets");
      await page.click("#topBack"); await pause(200);
      await page.click('#vPlanets [data-act="all"]'); await pause(300);
      await audit(page, `모든 할 일 · ${scheme}`, "#vPlanets");
      await page.click('#vPlanets [data-act="filter"][data-f="nodue"]'); await pause(200);
      check(await page.evaluate(() => [...document.querySelectorAll("#vPlanets .tk")].every(r => !Store.task(r.dataset.task).due)), "「기한 없음」으로 거르면 기한 없는 할 일만 남는다");
      await page.click("#settingsBtn"); await pause(350);
      check(await page.evaluate(() => document.getElementById("modal").contains(document.activeElement) || document.activeElement === document.getElementById("modalCard")), "설정을 열면 초점이 창 안으로 들어간다");
      await audit(page, `설정 · ${scheme}`, "#modal");
      await page.keyboard.press("Escape"); await pause(150);
      await page.click('#tabbar [data-tab="universe"]'); await pause(1500);
      check(await page.evaluate(() => Scene.active && getComputedStyle(document.getElementById("stage")).visibility === "visible" && [...Scene.systems.values()].every(s => s.sx > 0 && s.sx < innerWidth && s.sy > 0 && s.sy < innerHeight)), `우주 탭(${scheme})에서는 3D 행성이 화면 안에 보인다`);
      await page.click('#tabbar [data-tab="today"]'); await pause(200);
      check(await page.evaluate(() => !Scene.active), "다른 탭으로 가면 3D 그리기를 멈춘다(배터리 절약)");
      allErrors.push(...errors); await ctx.close();
    }

    /* ── 설정: 테마 · 글자 크기 · 행성 순서 ── */
    {
      const { ctx, page, errors } = await fresh(browser, PHONE, "dark");
      await page.click("#settingsBtn"); await pause(300);
      await page.click('#mTheme [data-v="light"]'); await pause(150);
      check(await page.evaluate(() => document.documentElement.dataset.theme === "light" && getComputedStyle(document.body).backgroundColor === "rgb(244, 245, 248)"), "설정에서 라이트로 고정하면 기기가 다크여도 밝게 보인다");
      const fs0 = await page.evaluate(() => { document.getElementById("vToday").classList.remove("dense", "dense2"); return parseFloat(getComputedStyle(document.querySelector(".tk-t")).fontSize); });
      await page.click('#mText [data-v="l"]'); await pause(150);
      check(await page.evaluate(f0 => { document.getElementById("vToday").classList.remove("dense", "dense2"); return document.documentElement.dataset.text === "l" && parseFloat(getComputedStyle(document.querySelector(".tk-t")).fontSize) >= f0 * 1.1; }, fs0), "「글자 크게」를 고르면 목록 글자가 커진다");
      const before = await page.evaluate(() => Store.planets().map(p => p.id).join());
      await page.focus(".plist .grip"); await page.keyboard.press("ArrowDown"); await pause(150);
      check(await page.evaluate(b => Store.planets().map(p => p.id).join() !== b, before), "설정의 행성 손잡이에서 아래 화살표로 순서를 바꾼다");
      await page.click('#mTheme [data-v="system"]'); await page.click('#mText [data-v="m"]'); await pause(100);
      await page.keyboard.press("Escape"); await pause(150);
      check(await page.evaluate(() => !document.documentElement.dataset.theme && document.getElementById("modal").hidden), "「자동」으로 되돌리고 Esc로 닫는다");
      // 검색
      await page.keyboard.press("/"); await pause(200);
      await page.type("#palInput", "장보기"); await pause(150); await page.keyboard.press("Enter"); await pause(300);
      check(await page.evaluate(() => !document.getElementById("sheet").hidden && Store.task(Panel.id).title === "장보기"), "/ 로 검색해 Enter를 누르면 그 할 일 상세가 열린다");
      allErrors.push(...errors); await ctx.close();
    }

    /* ── 좁은 화면: 가로 넘침 없음 ── */
    for (const [w, h] of [[320, 640], [360, 740], [390, 844], [820, 1180]]) {
      const { ctx, page, errors } = await fresh(browser, { width: w, height: h, isMobile: true, hasTouch: true }, "dark");
      for (const tab of ["today", "upcoming", "planets"]) {
        await page.evaluate(t => App.setTab(t), tab); await pause(150);
        const ok = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll(".view:not([hidden])")].every(v => v.scrollWidth <= v.clientWidth + 1));
        check(ok, `${w}×${h} ${tab}: 가로로 넘치지 않는다`);
      }
      if (w === 320) await page.screenshot({ path: path.join(shots, "phone-320.png") });
      allErrors.push(...errors); await ctx.close();
    }

    /* ── 데스크톱 ── */
    for (const scheme of ["dark", "light"]) {
      const { ctx, page, errors } = await fresh(browser, DESK, scheme);
      check(await page.evaluate(() => getComputedStyle(document.getElementById("side")).display !== "none" && getComputedStyle(document.getElementById("tabbar")).display === "none" && getComputedStyle(document.getElementById("cmd")).visibility !== "hidden"), `데스크톱(${scheme}): 왼쪽 메뉴와 목록 위 입력창`);
      await audit(page, `데스크톱 오늘 · ${scheme}`);
      await page.evaluate(() => App.openTask(Store.tasks()[0].id)); await pause(350);
      check(await page.evaluate(() => !document.getElementById("sheet").hidden && document.getElementById("sheet").getAttribute("aria-modal") === "false" && document.getElementById("app").getBoundingClientRect().right <= innerWidth - 400), "1440px: 상세는 목록 옆 오른쪽 패널로 열린다(목록을 가리지 않음)");
      await audit(page, `데스크톱 상세 · ${scheme}`, "#sheet");
      await page.screenshot({ path: path.join(shots, `desk-${scheme}.png`) });
      await page.keyboard.press("Escape"); await pause(150);
      await page.keyboard.press("2"); await pause(200);
      check(await page.evaluate(() => App.tab === "upcoming"), "숫자 키 2로 예정 탭으로 간다");
      await page.click("#cmdInput"); await page.type("#cmdInput", "데스크톱 추가 #운동"); await page.keyboard.press("Enter"); await pause(250);
      check(await page.evaluate(() => { const t = Store.tasks().find(t => t.title === "데스크톱 추가"); return t && Store.planet(t.planetId).name === "운동" && !!t.due; }), "데스크톱 입력창: #행성으로 행성을 고르고 예정 탭의 날짜가 붙는다");
      allErrors.push(...errors); await ctx.close();
    }
    check(!allErrors.length, `실행 오류 없음${allErrors.length ? ": " + allErrors.join(" | ") : ""}`);
  } finally { await browser.close(); }
  console.log(`${count} browser checks passed. Screenshots: ${shots}`);
})().catch(e => { console.error(e); process.exit(1); });
