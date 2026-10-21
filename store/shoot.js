/* 스토어 이미지 만들기: 설치된 크롬을 화면 없이 띄워 실제 앱을 찍는다
   node store/shoot.js  →  store/play/*.png (1080×1920 · 대표 이미지 1024×500), store/appstore/*.png (1290×2796), store/desktop/*.png (1920×1080) */
"use strict";
const path = require("path"), fs = require("fs");
const puppeteer = require(path.join(__dirname, "..", "android", "tools", "node_modules", "puppeteer-core"));
const URL = process.env.ORBIT_URL || "https://orbit-space-todo.vercel.app/";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const HIDE = "#toasts,.toasts,#coach,.coach{display:none!important}";
const SCENES = [
  { name: "1-today", js: `App.setView("today"); Board.mOpen=false; Board.render(); const t = Store.tasks().find(x => x.priority === 1 && x.status === "todo") || Store.tasks().find(x => x.status === "todo"); if (t && !Store.tasks().some(x => x.status === "doing")) App.startTask(t.id);`, wait: 5000 },
  { name: "2-list", js: `App.setView("list");`, wait: 1800 },
  { name: "3-week", js: `App.setView("calendar"); Calendar.setMode("week");`, wait: 1800 },
  { name: "4-detail", js: `App.setView("today"); const t = Store.tasks().find(x => x.status === "todo" && x.steps && x.steps.length) || Store.tasks().find(x => x.status === "todo"); App.openTask(t.id);`, wait: 3500 },
  { name: "5-board", js: `Panel.close(); App.setView("today"); Board.mOpen = true; Board.render();`, wait: 2500 },
];
async function shoot(browser, dir, vw, vh, dpr, mobile = true) {
  fs.mkdirSync(dir, { recursive: true });
  const page = await browser.newPage();
  await page.setViewport({ width: vw, height: vh, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile });
  await page.goto(URL, { waitUntil: "networkidle2" });
  await page.addStyleTag({ content: HIDE });
  await page.evaluate(() => { App.coach(false); });
  await new Promise(r => setTimeout(r, 2500));
  const gl = await page.evaluate(() => Scene.useGL);
  for (const s of SCENES) {
    await page.evaluate("{" + s.js + "}");
    await new Promise(r => setTimeout(r, s.wait));
    await page.screenshot({ path: path.join(dir, s.name + ".png") });
    console.log(dir, s.name, "webgl=" + gl);
  }
  await page.close();
}
async function feature(browser, file) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 500, deviceScaleFactor: 1 });
  await page.goto(URL, { waitUntil: "networkidle2" });
  await page.addStyleTag({ content: HIDE + `.topbar,#board,.board,#cmd,.cmd,#viewCtl,.view-ctl,#nowbar,.nowbar,#labels,#mtags,#sunHint,#focusChip{display:none!important}
    #fg{position:fixed;left:56px;top:0;bottom:0;z-index:99;display:flex;flex-direction:column;justify-content:center;gap:14px;font-family:"Pretendard Variable",Pretendard,"Malgun Gothic",sans-serif;color:#eceef3}
    #fg b{font-size:84px;font-weight:800;letter-spacing:-.04em;line-height:1}
    #fg span{font-size:26px;font-weight:600;color:#ffcf9a;letter-spacing:-.02em}
    #fg i{font-style:normal;font-size:17px;color:#aeb4c1}` });
  await page.evaluate(() => {
    App.coach(false); App.setView("all"); Scene.setBoard(430); Scene.setAutoRotate(false);
    const d = document.createElement("div"); d.id = "fg"; d.innerHTML = "<b>ORBIT</b><span>할 일은 행성처럼, 집중은 태양처럼</span><i>3D 우주 할 일 · 집중 타이머 · Google 캘린더 연동</i>"; document.body.appendChild(d);
  });
  await new Promise(r => setTimeout(r, 5000));
  await page.screenshot({ path: file });
  await page.close();
  console.log("feature", file);
}
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--lang=ko-KR", "--window-size=1400,1000"] });
  try {
    const only = process.env.ORBIT_ONLY;
    if (!only || only === "play") { await shoot(browser, path.join(__dirname, "play"), 360, 640, 3); await feature(browser, path.join(__dirname, "play", "feature-1024x500.png")); }
    if (!only || only === "appstore") await shoot(browser, path.join(__dirname, "appstore"), 430, 932, 3);       // 1290×2796 (6.7·6.9인치)
    if (!only || only === "appstore-63") await shoot(browser, path.join(__dirname, "appstore-63"), 402, 874, 3); // 1206×2622 (6.3인치 · 중형)
    if (!only || only === "desktop") await shoot(browser, path.join(__dirname, "desktop"), 1920, 1080, 1, false); // 윈도우·맥 (Microsoft Store · PWA 설치 창)
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
