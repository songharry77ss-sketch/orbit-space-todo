/* ═══════════════ 창: 설정 · 행성 편집 · 확인 · 우선순위 정리 · 첫 방문 ═══════════════ */
"use strict";

const Modal = {
  el: null, card: null,
  show(html, cls = "") {
    this.el = $("#modal"); this.card = $("#modalCard"); this.card.className = `modal-card ${cls}`;
    this.card.innerHTML = html; this.el.hidden = false; this.card.scrollTop = 0;
    const title = this.card.querySelector("h3");
    if (title) { title.id = "modalTitle"; this.card.setAttribute("aria-labelledby", title.id); } else this.card.removeAttribute("aria-labelledby");
    const touch = matchMedia("(pointer: coarse)").matches;
    const initial = this.card.querySelector("[data-autofocus]") || (touch ? this.card : this.card.querySelector('input[type="text"], [data-x], #mClose, #pCancel') || this.card.querySelector("button"));
    FocusScope.open(this.el, { initial });
  },
  close() {
    if (this.el) { this.el.hidden = true; FocusScope.close(this.el); }
    if (this.card?.classList.contains("welcome-card")) Store.setSetting("welcomePending", false);
    if (this._key) { document.removeEventListener("keydown", this._key, true); this._key = null; }
  },
  confirm({ title, desc, ok, onOk, danger = true }) {
    this.show(`<h3>${U.esc(title)}</h3><p class="desc">${desc}</p><div class="m-actions"><button type="button" class="btn" data-x>취소</button><button type="button" class="btn ${danger ? "danger" : "sol"}" data-ok>${U.esc(ok)}</button></div>`);
    this.card.querySelector("[data-x]").addEventListener("click", () => this.close());
    this.card.querySelector("[data-ok]").addEventListener("click", () => { this.close(); onOk(); });
  },
  /* 우선순위 정리: 미정인 할 일을 한 장씩 보여 주고 1 · 2 · 3 으로 정한다 */
  triage(ids) {
    const queue = ids.filter(id => Store.task(id)); let i = 0; const tally = { 1: 0, 2: 0, 3: 0 };
    if (!queue.length) { App.toast("check", "우선순위가 정해지지 않은 할 일이 없어요"); return; }
    const set = p => { const t = Store.task(queue[i]); if (t) { Store.updateTask(t.id, { priority: p }); tally[p]++; } i++; step(); };
    const step = () => {
      while (i < queue.length && !Store.task(queue[i])) i++;
      if (i >= queue.length) {
        this.show(`<h3>우선순위를 정리했어요</h3><p class="desc">${queue.length}개 중 ${tally[1] + tally[2] + tally[3]}개를 정했어요.</p>
          <div class="tri-sum">${[1, 2, 3].map(p => `<div>${prioSvg(p, 20)}<b>${PRIO[p].ko}</b><span class="num">${tally[p]}</span></div>`).join("")}</div>
          <div class="m-actions"><button type="button" class="btn sol" data-x>닫기</button></div>`);
        this.card.querySelector("[data-x]").addEventListener("click", () => this.close()); return;
      }
      const t = Store.task(queue[i]), p = Store.planet(t.planetId), late = Store.isOverdue(t);
      this.show(`<div class="tri-h"><h3>우선순위 정리</h3><span class="num">${i + 1} / ${queue.length}</span></div>
        <div class="pbar tri-bar"><i style="--w:${Math.round(i / queue.length * 100)}%;--c:var(--ac)"></i></div>
        <div class="tri-card"><div class="tri-meta">${thumbImg(bodyKey(p), 20)}<span>${U.esc(p ? p.name : "")}</span>${t.due ? `<span class="${late ? "late" : ""}">· ${U.relDate(t.due)}${t.time ? " " + U.fmtTime(t.time) : ""}</span>` : ""}</div>
          <div class="tri-title">${U.esc(t.title)}</div>${t.notes ? `<p class="tri-notes">${U.esc(t.notes.slice(0, 140))}</p>` : ""}</div>
        <div class="tri-opts">${[1, 2, 3].map(v => `<button type="button" class="tri-opt" data-p="${v}" style="--pc:${PRIO[v].color}">${prioSvg(v, 24)}<b>${PRIO[v].ko}</b><kbd>${v}</kbd></button>`).join("")}</div>
        <div class="m-actions"><button type="button" class="btn left" data-x>그만하기</button><button type="button" class="btn" data-skip>건너뛰기</button></div>`);
      const c = this.card;
      c.querySelectorAll("[data-p]").forEach(b => b.addEventListener("click", () => set(+b.dataset.p)));
      c.querySelector("[data-skip]").addEventListener("click", () => { i++; step(); });
      c.querySelector("[data-x]").addEventListener("click", () => this.close());
    };
    step();
    if (this._key) document.removeEventListener("keydown", this._key, true);
    this._key = e => {
      if (this.el.hidden) return;
      if (["1", "2", "3"].includes(e.key) && this.card.querySelector(".tri-opts")) { e.preventDefault(); e.stopPropagation(); set(+e.key); }
      else if (e.key === "ArrowRight" && this.card.querySelector("[data-skip]")) { e.preventDefault(); e.stopPropagation(); i++; step(); }
    };
    document.addEventListener("keydown", this._key, true);
  },

  /* ── 설정 ── */
  settings() {
    const st = Store.state.settings, ps = Store.planets(), ua = navigator.userAgent, ios = /iPhone|iPad|iPod/.test(ua), android = /Android/.test(ua);
    const how = App.installPrompt ? "홈 화면이나 바탕화면에 설치하면 앱처럼 열려요."
      : ios ? "Safari 아래쪽 공유 버튼 → 「홈 화면에 추가」로 설치해요."
      : android ? "브라우저 메뉴(⋮) → 「홈 화면에 추가」 또는 「앱 설치」."
      : "Chrome · Edge 주소창 오른쪽의 설치 아이콘으로 데스크톱 앱처럼 쓸 수 있어요.";
    const theme = st.theme === "light" || st.theme === "dark" ? st.theme : "system", text = st.textSize === "l" ? "l" : "m";
    const sw = (id, on, label) => `<button type="button" class="switch ${on ? "on" : ""}" id="${id}" role="switch" aria-checked="${on}" aria-label="${label}"></button>`;
    this.show(`<h3>설정</h3>
      <h4>화면</h4>
      <div class="set-group">
        <div class="set-row"><span class="lbl">테마<small>기기 설정을 따르거나 하나로 고정해요</small></span><div class="seg" id="mTheme" role="radiogroup" aria-label="테마">${[["system", "자동"], ["light", "라이트"], ["dark", "다크"]].map(([k, l]) => `<button type="button" data-v="${k}" class="${theme === k ? "on" : ""}" role="radio" aria-checked="${theme === k}">${l}</button>`).join("")}</div></div>
        <div class="set-row"><span class="lbl">글자 크기<small>목록과 상세의 글자를 키워요</small></span><div class="seg" id="mText" role="radiogroup" aria-label="글자 크기">${[["m", "보통"], ["l", "크게"]].map(([k, l]) => `<button type="button" data-v="${k}" class="${text === k ? "on" : ""}" role="radio" aria-checked="${text === k}">${l}</button>`).join("")}</div></div>
        <div class="set-row"><span class="lbl">효과음<small>완료 · 집중 시작에 짧은 소리</small></span>${sw("mSfx", Juice.on(), "효과음")}</div>
        ${Native.ok() ? `<div class="set-row"><span class="lbl">마감 알림<small id="mNotifyHint">${Native.hint()}</small></span>${sw("mNotify", Native.on(), "마감 알림")}</div>` : ""}
      </div>
      <h4>행성<span class="h4-sub">${ps.length > 1 ? "손잡이를 끌어 순서 바꾸기" : ""}</span></h4>
      <div class="plist">${ps.map(p => `<div class="pitem" data-id="${p.id}">${ps.length > 1 ? `<button type="button" class="grip" aria-label="「${U.esc(p.name)}」 순서 바꾸기 · 끌거나 위아래 화살표">${ico("grip", 18)}</button>` : ""}${thumbImg(bodyKey(p), 38)}<div class="nm">${U.esc(p.name)}<small>${bodyOf(p).ko} · 남은 할 일 ${Store.tasksOf(p.id).filter(t => t.status !== "done").length}개</small></div><button type="button" class="btn sm" data-edit="${p.id}">편집</button></div>`).join("")}</div>
      <div class="btn-row" style="margin-top:10px"><button type="button" class="btn sm" id="mAdd">${ico("plus", 18)}새 행성</button></div>
      <h4>우주</h4>
      <div class="set-group">
        <div class="set-row"><span class="lbl">우주 자동 회전<small>조작하는 동안에는 멈춰요</small></span>${sw("mSpin", Scene.autoRotate, "우주 자동 회전")}</div>
        <div class="set-row"><span class="lbl">위성 옆에 할 일 이름 항상 표시<small>끄면 행성에 올렸을 때만 보여요</small></span>${sw("mNames", Scene.showNames, "위성 이름 항상 표시")}</div>
      </div>
      <h4>연동 · 데이터</h4>
      <div class="set-group">
        <button type="button" class="set-row btnrow" id="mCal">${ico("calendar", 20)}<span class="lbl">캘린더 연동<small>Google 캘린더 연결 · .ics 내보내기 · 가져오기</small></span>${ico("chevRight", 18, "chev")}</button>
        <button type="button" class="set-row btnrow" id="mExport">${ico("download", 20)}<span class="lbl">JSON 파일로 내보내기</span>${ico("chevRight", 18, "chev")}</button>
        <button type="button" class="set-row btnrow" id="mCopy">${ico("copy", 20)}<span class="lbl">데이터 복사</span>${ico("chevRight", 18, "chev")}</button>
        <label class="set-row btnrow" for="mFile">${ico("upload", 20)}<span class="lbl">JSON 파일 가져오기</span>${ico("chevRight", 18, "chev")}</label>
      </div>
      <input type="file" id="mFile" accept="application/json,.json" hidden>
      <div class="btn-row" style="margin-top:10px"><button type="button" class="btn sm" id="mSample">예시 데이터로 시작</button><button type="button" class="btn sm danger" id="mReset">모두 지우기</button></div>
      ${window.ORBIT_NATIVE ? "" : `<h4>앱으로 쓰기</h4><p class="desc" style="margin:0 0 10px">${how}</p>${App.installPrompt ? `<div class="btn-row"><button type="button" class="btn sol sm" id="mInstall">${ico("install", 18)}앱으로 설치</button></div>` : ""}`}
      <h4>단축키</h4>
      <div class="keys"><kbd>N</kbd><span>할 일 추가</span><kbd>/</kbd><span>검색 (Ctrl+K)</span><kbd>1 2 3 4</kbd><span>오늘 · 예정 · 행성 · 우주</span><kbd>Esc</kbd><span>닫기</span></div>
      <p class="desc" style="margin:12px 0 0">입력 팁: <b>#행성이름</b>으로 행성을, <b>!1 !2 !3</b>으로 우선순위를 정해요. 「내일」「다음주 금요일」「오후 3시」「12/25」도 알아들어요.</p>
      <h4>정보</h4>
      <p class="credits">행성 · 태양 · 은하수 사진은 <a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noopener">Solar System Scope</a> 자료(CC BY 4.0)예요. · <a href="about.html" target="_blank" rel="noopener">ORBIT 소개</a> · <a href="privacy.html" target="_blank" rel="noopener">개인정보처리방침</a></p>
      <div class="m-actions"><button type="button" class="btn sol" id="mClose">닫기</button></div>`);
    const c = this.card, on = (s, f) => { const el = c.querySelector(s); if (el) el.addEventListener("click", f); };
    const seg = (id, key, after) => c.querySelector(id)?.addEventListener("click", e => {
      const b = e.target.closest("[data-v]"); if (!b) return;
      Store.setSetting(key, b.dataset.v); c.querySelectorAll(`${id} [data-v]`).forEach(x => { const o = x === b; x.classList.toggle("on", o); x.setAttribute("aria-checked", String(o)); });
      App.applyTheme(); if (after) after();
    });
    seg("#mTheme", "theme"); seg("#mText", "textSize", () => Views.render());
    c.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => this.planet(b.dataset.edit)));
    const pl = c.querySelector(".plist");
    if (ps.length > 1) sortable(pl, { item: ".pitem", handle: ".pitem", touchHandle: ".grip", onDrop: (ids, id) => { Store.reorderPlanets(ids, id); } });
    pl.addEventListener("keydown", e => {
      const g = e.target.closest(".grip"); if (!g || !["ArrowUp", "ArrowDown"].includes(e.key)) return;
      e.preventDefault(); const row = g.closest(".pitem"), ids = Store.planets().map(p => p.id), i = ids.indexOf(row.dataset.id), j = i + (e.key === "ArrowUp" ? -1 : 1);
      if (j < 0 || j >= ids.length) return;
      ids.splice(j, 0, ids.splice(i, 1)[0]); Store.reorderPlanets(ids, row.dataset.id);
      const sib = e.key === "ArrowUp" ? row.previousElementSibling : row.nextElementSibling.nextElementSibling; pl.insertBefore(row, sib); g.focus();
    });
    const tog = (id, get, set) => on(id, e => { const b = e.currentTarget, v = !get(); set(v); b.classList.toggle("on", v); b.setAttribute("aria-checked", v); });
    tog("#mSpin", () => Scene.autoRotate, v => Scene.setAutoRotate(v));
    tog("#mNames", () => Scene.showNames, v => Scene.setNames(v));
    tog("#mNotify", () => Native.on(), v => Native.setOn(v));
    tog("#mSfx", () => Juice.on(), v => { Store.setSetting("sfx", v); if (v) Juice.sfx("done"); });
    on("#mAdd", () => this.planet(null)); on("#mCal", () => CalSync.open()); on("#mClose", () => this.close());
    on("#mInstall", async () => { const p = App.installPrompt; if (!p) return; p.prompt(); try { await p.userChoice; } catch (e) { /* 무시 */ } App.installPrompt = null; this.close(); });
    on("#mExport", () => { try { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([Store.exportJSON()], { type: "application/json" })); a.download = `orbit-todo-${U.today()}.json`; a.click(); App.toast("download", "JSON 파일로 내보냈어요"); } catch (e) { App.toast("alert", "내보내지 못했어요. 「데이터 복사」를 이용해 주세요"); } });
    on("#mCopy", () => { navigator.clipboard.writeText(Store.exportJSON()).then(() => App.toast("copy", "클립보드에 복사했어요")).catch(() => App.toast("alert", "복사할 수 없는 환경이에요")); });
    c.querySelector("#mFile").addEventListener("change", e => {
      const f = e.target.files[0]; if (!f) return; const r = new FileReader();
      r.onload = () => { try { Store.importJSON(r.result); this.close(); App.toast("upload", "데이터를 가져왔어요"); } catch (err) { App.toast("alert", `가져오지 못했어요: ${err.message}`); } };
      r.readAsText(f);
    });
    on("#mSample", () => this.confirm({ title: "예시 데이터로 시작", desc: "지금 데이터를 모두 지우고 예시 행성과 할 일로 바꿔요.", ok: "바꾸기", onOk: () => { Store.reset(true); App.toast("sparkle", "예시 데이터를 불러왔어요"); } }));
    on("#mReset", () => this.confirm({ title: "모두 지우기", desc: "모든 행성과 할 일이 지워지고 되돌릴 수 없어요.", ok: "모두 지우기", onOk: () => { Store.reset(false); App.toast("orbit", "빈 우주에서 다시 시작해요"); } }));
  },
  planet(id) {
    const ex = id ? Store.planet(id) : null, used = new Set(Store.planets().filter(p => !ex || p.id !== ex.id).map(p => p.body));
    let body = ex ? bodyKey(ex) : Store.freeBody();
    this.show(`<h3>${ex ? "행성 편집" : "새 행성"}</h3><p class="desc">${ex ? "이름과 천체를 바꿀 수 있어요." : "행성은 할 일을 묶는 카테고리예요. 업무 · 공부 · 생활처럼 나눠 보세요."}</p>
      <input type="text" id="pName" value="${U.esc(ex ? ex.name : "")}" placeholder="예: 업무, 공부, 건강" maxlength="14" aria-label="행성 이름">
      <h4>천체 고르기</h4>
      <div class="bodies">${BODY_ORDER.map(k => { const b = BODIES[k]; return `<button type="button" class="body-opt ${k === body ? "on" : ""} ${used.has(k) ? "used" : ""}" data-body="${k}" aria-pressed="${k === body}">${thumbImg(k, 56)}<span class="ko">${b.ko}</span><span class="en">${b.en.toUpperCase()}</span></button>`; }).join("")}</div>
      <div class="m-actions">${ex && Store.planets().length > 1 ? `<button type="button" class="btn danger left" id="pDel">${ico("trash", 18)}삭제</button>` : ""}<button type="button" class="btn" id="pCancel">취소</button><button type="button" class="btn sol" id="pSave">${ex ? "저장" : "행성 만들기"}</button></div>`);
    const c = this.card;
    c.querySelectorAll("[data-body]").forEach(b => b.addEventListener("click", () => { body = b.dataset.body; c.querySelectorAll("[data-body]").forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b); }); }));
    const save = () => {
      const name = c.querySelector("#pName").value.trim(); if (!name) { c.querySelector("#pName").focus(); return; }
      if (ex) { Store.updatePlanet(ex.id, { name, body }); App.toast("orbit", `「${name}」 행성을 수정했어요`); }
      else { const p = Store.addPlanet({ name, body }); QuickAdd.planetId = p.id; QuickAdd.paint(); App.toast("sparkle", `「${name}」 행성이 생겼어요`); }
      this.close();
    };
    c.querySelector("#pSave").addEventListener("click", save);
    c.querySelector("#pName").addEventListener("keydown", e => { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); save(); } });
    c.querySelector("#pCancel").addEventListener("click", () => this.close());
    const del = c.querySelector("#pDel"); if (del) del.addEventListener("click", () => this.deletePlanet(ex.id));
  },
  deletePlanet(id) {
    const p = Store.planet(id), others = Store.planets().filter(x => x.id !== id), n = Store.tasksOf(id).length;
    this.show(`<h3>「${U.esc(p.name)}」 행성 삭제</h3><p class="desc">${n ? `이 행성에 할 일이 ${n}개 있어요. 어떻게 할까요?` : "이 행성에는 할 일이 없어요."}</p>
      ${n ? `<label class="radio-row"><input type="radio" name="pdel" value="move" checked>다른 행성으로 옮기기</label><select id="pMoveTo" class="field-input" aria-label="옮길 행성">${others.map(o => `<option value="${o.id}">${U.esc(o.name)}</option>`).join("")}</select><label class="radio-row"><input type="radio" name="pdel" value="del">할 일도 함께 삭제</label>` : ""}
      <div class="m-actions"><button type="button" class="btn" id="dCancel">취소</button><button type="button" class="btn danger" id="dOk">삭제</button></div>`);
    const c = this.card;
    c.querySelector("#dCancel").addEventListener("click", () => this.close());
    c.querySelector("#dOk").addEventListener("click", () => {
      const mode = n ? c.querySelector("input[name=pdel]:checked").value : "del", to = mode === "move" ? c.querySelector("#pMoveTo").value : null;
      if (Views.planetId === id) Views.planetId = null;
      Store.removePlanet(id, to); this.close(); App.toast("orbit", `「${p.name}」 행성을 지웠어요`);
    });
  },
};

/* ═══════════════ 첫 방문: 깨끗하게 시작하거나 예시로 둘러보기 ═══════════════ */
const Welcome = {
  open() {
    Modal.show(`<button type="button" class="welcome-close ib plain" data-welcome="start" aria-label="안내 닫고 시작하기">${ico("x", 20)}</button>
      <span class="welcome-eyebrow">ORBIT</span>
      <h3>할 일은 가볍게,<br>집중은 깊게.</h3>
      <p class="welcome-lead">오늘 할 일을 한눈에 보고, 하나를 골라 태양에 올리듯 집중해요.</p>
      <div class="welcome-steps">
        <div><span>${ico("plus", 20)}</span><p><b>적고</b><small>행성(카테고리)별로 할 일을 모아요</small></p></div>
        <div><span>${ico("flame", 20)}</span><p><b>집중하고</b><small>불꽃 버튼을 누르면 타이머가 시작돼요</small></p></div>
        <div><span>${ico("check", 20)}</span><p><b>끝내요</b><small>동그라미를 누르거나 줄을 오른쪽으로 밀면 완료</small></p></div>
      </div>
      <div class="welcome-actions"><button type="button" class="btn sol" data-welcome="start" data-autofocus>첫 할 일 적기</button><button type="button" class="btn" data-welcome="demo">예시로 둘러보기</button></div>`, "welcome-card");
    Modal.card.querySelectorAll("[data-welcome]").forEach(b => b.addEventListener("click", () => {
      if (b.dataset.welcome === "demo") {
        Store.reset(true); Store.setSetting("welcomePending", false);
        Modal.close(); App.setTab("today"); this.renderBanner();
      } else {
        Store.setSetting("welcomePending", false); Modal.close(); QuickAdd.open();
      }
    }));
  },
  renderBanner() {
    const banner = $("#demoBanner"); if (!banner) return;
    const demo = !!Store.state.settings.demoMode;
    banner.hidden = !demo; document.body.classList.toggle("demo-mode", demo);
  },
  leaveDemo() {
    Modal.confirm({ title: "내 할 일로 시작할까요?", desc: "예시 할 일을 비우고 새로 시작해요. 둘러보는 동안 추가한 할 일도 함께 지워져요.", ok: "비우고 시작하기", onOk: () => {
      Panel.close(); const settings = { ...Store.state.settings, demoMode: false, welcomePending: false, tab: "today" };
      Store.state = Store.fresh(); Object.assign(Store.state.settings, settings); Store.emit({ type: "reset" });
      App.setTab("today"); this.renderBanner(); QuickAdd.open();
    } });
  },
};
