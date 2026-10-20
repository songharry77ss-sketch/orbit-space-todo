/* ORBIT 안드로이드 앱(TWA) 만들기 · 빌드
   사용: node twa.js init   → C:\Users\opqrt\orbit-android 에 안드로이드 프로젝트 생성(+ 서명 키 없으면 생성)
         node twa.js build  → 서명된 .aab(플레이 업로드용) · .apk(설치 시험용) 생성
         node twa.js fp     → 서명 키 SHA-256 지문 출력(assetlinks.json 용)
   경로에 한글이 있으면 Gradle이 실패하므로 프로젝트와 키는 영문 경로에 둔다. */
"use strict";
const path = require("path"), fs = require("fs"), crypto = require("crypto");
const { Config, JdkHelper, AndroidSdkTools, GradleWrapper, TwaGenerator, TwaManifest, KeyTool, JarSigner, ConsoleLog } = require("@bubblewrap/core");
const HOME = process.env.USERPROFILE || "C:\Users\opqrt";
const PROJECT = path.join(HOME, "orbit-android");
const KEYDIR = path.join(HOME, "Desktop", "ORBIT-app-keys");
const KEYSTORE = path.join(KEYDIR, "orbit-upload.keystore"), KEYINFO = path.join(KEYDIR, "keystore-info.json");
const MANIFEST_URL = "https://orbit-space-todo.vercel.app/manifest.webmanifest";
const log = new ConsoleLog("orbit");
const cfg = JSON.parse(fs.readFileSync(path.join(HOME, ".bubblewrap", "config.json"), "utf8"));
const config = new Config(cfg.jdkPath, cfg.androidSdkPath);
const jdk = new JdkHelper(process, config), sdk = new AndroidSdkTools(process, config, jdk, log);

function keyInfo() {
  if (fs.existsSync(KEYINFO)) return JSON.parse(fs.readFileSync(KEYINFO, "utf8"));
  fs.mkdirSync(KEYDIR, { recursive: true });
  const pw = crypto.randomBytes(18).toString("base64").replace(/[^A-Za-z0-9]/g, "").slice(0, 22);
  const info = { path: KEYSTORE, alias: "orbit", password: pw, keypassword: pw, note: "ORBIT 플레이 업로드 키. 이 파일과 keystore 를 안전한 곳에 백업하세요. 잃어버리면 Play Console에서 업로드 키 재설정을 요청해야 합니다." };
  fs.writeFileSync(KEYINFO, JSON.stringify(info, null, 2));
  return info;
}
async function ensureKey() {
  const k = keyInfo();
  if (!fs.existsSync(KEYSTORE)) {
    await new KeyTool(jdk, log).createSigningKey({ path: KEYSTORE, alias: k.alias, password: k.password, keypassword: k.keypassword, fullName: "ORBIT", organizationalUnit: "ORBIT", organization: "CRAVING", country: "KR" });
    log.info("서명 키를 만들었어요: " + KEYSTORE);
  }
  return k;
}
async function init() {
  const k = await ensureKey();
  const m = await TwaManifest.fromWebManifest(MANIFEST_URL);
  Object.assign(m, {
    packageId: "com.craving.orbit", name: "ORBIT 우주 할 일", launcherName: "ORBIT",
    host: "orbit-space-todo.vercel.app", startUrl: "/", display: "standalone", orientation: "default",
    themeColor: m.themeColor, navigationColor: m.navigationColor, backgroundColor: m.backgroundColor,
    enableNotifications: false, fallbackType: "customtabs", appVersionName: "1.0.0", appVersionCode: 1,
    signingKey: { path: KEYSTORE, alias: k.alias }, minSdkVersion: 24, isChromeOSOnly: false, isMetaQuest: false,
  });
  if (fs.existsSync(PROJECT)) fs.rmSync(PROJECT, { recursive: true, force: true });
  fs.mkdirSync(PROJECT, { recursive: true });
  await new TwaGenerator().createTwaProject(PROJECT, m, log);
  await m.saveToFile(path.join(PROJECT, "twa-manifest.json"));
  fs.copyFileSync(path.join(PROJECT, "twa-manifest.json"), path.join(__dirname, "..", "twa-manifest.json"));
  /* 이 PC의 Bubblewrap JDK는 32비트라 1.5GB 힙을 못 잡는다 → 1GB */
  const gp = path.join(PROJECT, "gradle.properties"); fs.writeFileSync(gp, fs.readFileSync(gp, "utf8").replace(/org[.]gradle[.]jvmargs=.*/, "org.gradle.jvmargs=-Xmx1024m -Dfile.encoding=UTF-8"));
  log.info("안드로이드 프로젝트를 만들었어요: " + PROJECT);
}
async function build() {
  /* Gradle은 프로젝트 폴더의 gradlew.bat 을 전체 경로로 실행(이 PC의 cmd 는 상대 경로로 못 찾음) */
  require("child_process").execFileSync(path.join(PROJECT, "gradlew.bat"), ["bundleRelease", "assembleRelease", "--no-daemon"], { cwd: PROJECT, stdio: "inherit", shell: true, env: Object.assign({}, process.env, { JAVA_HOME: cfg.jdkPath, ANDROID_HOME: cfg.androidSdkPath, ANDROID_SDK_ROOT: cfg.androidSdkPath, PATH: path.join(cfg.jdkPath, "bin") + ";" + process.env.PATH }) });
  await sign();
}
async function sign() {
  const k = keyInfo(), signer = new JarSigner(jdk);
  const aabIn = path.join(PROJECT, "app", "build", "outputs", "bundle", "release", "app-release.aab"), aab = path.join(PROJECT, "app-release-bundle.aab");
  await signer.sign({ path: KEYSTORE, alias: k.alias }, k.password, k.keypassword, aabIn, aab);
  const apkIn = path.join(PROJECT, "app", "build", "outputs", "apk", "release", "app-release-unsigned.apk"), aligned = path.join(PROJECT, "app-release-unsigned-aligned.apk"), apk = path.join(PROJECT, "app-release-signed.apk");
  if (fs.existsSync(aligned)) fs.unlinkSync(aligned);
  /* 설치돼 있는 가장 최신 build-tools 의 zipalign · apksigner 를 직접 쓴다 */
  const bt = path.join(cfg.androidSdkPath, "build-tools"), ver = fs.readdirSync(bt).filter(v => fs.existsSync(path.join(bt, v, "zipalign.exe"))).sort().pop(), cp = require("child_process");
  cp.execFileSync(path.join(bt, ver, "zipalign.exe"), ["-f", "-p", "4", apkIn, aligned], { stdio: "inherit" });
  cp.execFileSync(path.join(bt, ver, "apksigner.bat"), ["sign", "--ks", KEYSTORE, "--ks-key-alias", k.alias, "--ks-pass", "pass:" + k.password, "--key-pass", "pass:" + k.keypassword, "--out", apk, aligned], { stdio: "inherit", shell: true, env: Object.assign({}, process.env, { JAVA_HOME: cfg.jdkPath, PATH: path.join(cfg.jdkPath, "bin") + ";" + process.env.PATH }) });
  log.info("완료: " + aab + " · " + apk);
}
async function fp() {
  const k = keyInfo(), out = await new KeyTool(jdk, log).keyInfo({ path: KEYSTORE, alias: k.alias, password: k.password, keypassword: k.keypassword });
  console.log("SHA-256: " + out.fingerprints.get("SHA256"));
}
const cmd = process.argv[2];
({ init, build, sign, fp }[cmd] || (async () => console.log("node twa.js init | build | sign | fp")))().catch(e => { console.error(e); process.exit(1); });
