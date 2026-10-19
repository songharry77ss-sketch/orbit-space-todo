/* ═══════════════ 3D 렌더러: 원근 카메라 · 깊이 버퍼 · 구체 메시 · 고리 · 궤도선 · 빌보드 글로우 ═══════════════ */
"use strict";

/* ── 4×4 행렬 (열 우선, WebGL 규약) ── */
const M4 = {
  mul(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    return o;
  },
  /* sx, sy: 렌즈 시프트(NDC) — 화면 한쪽이 패널로 가려질 때 장면을 옆으로 밀어 준다 */
  persp(fovy, asp, n, f, sx = 0, sy = 0) {
    const t = 1 / Math.tan(fovy / 2), m = new Float32Array(16);
    m[0] = t / asp; m[5] = t; m[8] = -sx; m[9] = -sy; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = 2 * f * n / (n - f);
    return m;
  },
  lookAt(e, c, up) {
    let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2]; let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx; l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx, m = new Float32Array(16);
    m[0] = xx; m[1] = yx; m[2] = zx; m[4] = xy; m[5] = yy; m[6] = zy; m[8] = xz; m[9] = yz; m[10] = zz;
    m[12] = -(xx * e[0] + xy * e[1] + xz * e[2]); m[13] = -(yx * e[0] + yy * e[1] + yz * e[2]); m[14] = -(zx * e[0] + zy * e[1] + zz * e[2]); m[15] = 1;
    return m;
  },
  /* T · Rz(tilt) · Ry(spin) · S */
  model(p, tilt, spin, s) {
    const cz = Math.cos(tilt), sz = Math.sin(tilt), cy = Math.cos(spin), sy = Math.sin(spin), m = new Float32Array(16);
    m[0] = cz * cy * s; m[1] = sz * cy * s; m[2] = -sy * s;
    m[4] = -sz * s; m[5] = cz * s; m[6] = 0;
    m[8] = cz * sy * s; m[9] = sz * sy * s; m[10] = cy * s;
    m[12] = p[0]; m[13] = p[1]; m[14] = p[2]; m[15] = 1;
    return m;
  },
  /* 기저 벡터(u, n, w)로 만든 변환: 로컬 XZ 평면의 원이 n 에 수직인 평면에 놓인다 */
  basis(p, u, n, w, s) {
    const m = new Float32Array(16);
    m[0] = u[0] * s; m[1] = u[1] * s; m[2] = u[2] * s; m[4] = n[0] * s; m[5] = n[1] * s; m[6] = n[2] * s;
    m[8] = w[0] * s; m[9] = w[1] * s; m[10] = w[2] * s; m[12] = p[0]; m[13] = p[1]; m[14] = p[2]; m[15] = 1;
    return m;
  },
  xf(m, x, y, z) { return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14], m[3] * x + m[7] * y + m[11] * z + m[15]]; },
  inv(m) {
    const a = m, o = new Float32Array(16);
    const b00 = a[0] * a[5] - a[1] * a[4], b01 = a[0] * a[6] - a[2] * a[4], b02 = a[0] * a[7] - a[3] * a[4], b03 = a[1] * a[6] - a[2] * a[5];
    const b04 = a[1] * a[7] - a[3] * a[5], b05 = a[2] * a[7] - a[3] * a[6], b06 = a[8] * a[13] - a[9] * a[12], b07 = a[8] * a[14] - a[10] * a[12];
    const b08 = a[8] * a[15] - a[11] * a[12], b09 = a[9] * a[14] - a[10] * a[13], b10 = a[9] * a[15] - a[11] * a[13], b11 = a[10] * a[15] - a[11] * a[14];
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06; if (!det) return null; det = 1 / det;
    o[0] = (a[5] * b11 - a[6] * b10 + a[7] * b09) * det; o[1] = (a[2] * b10 - a[1] * b11 - a[3] * b09) * det; o[2] = (a[13] * b05 - a[14] * b04 + a[15] * b03) * det; o[3] = (a[10] * b04 - a[9] * b05 - a[11] * b03) * det;
    o[4] = (a[6] * b08 - a[4] * b11 - a[7] * b07) * det; o[5] = (a[0] * b11 - a[2] * b08 + a[3] * b07) * det; o[6] = (a[14] * b02 - a[12] * b05 - a[15] * b01) * det; o[7] = (a[8] * b05 - a[10] * b02 + a[11] * b01) * det;
    o[8] = (a[4] * b10 - a[5] * b08 + a[7] * b06) * det; o[9] = (a[1] * b08 - a[0] * b10 - a[3] * b06) * det; o[10] = (a[12] * b04 - a[13] * b02 + a[15] * b00) * det; o[11] = (a[9] * b02 - a[8] * b04 - a[11] * b00) * det;
    o[12] = (a[5] * b07 - a[4] * b09 - a[6] * b06) * det; o[13] = (a[0] * b09 - a[1] * b07 + a[2] * b06) * det; o[14] = (a[13] * b01 - a[12] * b03 - a[14] * b00) * det; o[15] = (a[8] * b03 - a[9] * b01 + a[10] * b00) * det;
    return o;
  },
};
const V3 = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
};

const G3 = {
  P: {}, M: {}, gl: null, core: null,
  setup(core) {
    this.core = core; this.gl = core.gl;
    this.P.planet = core.program(GLSL3.VS_MESH, GLSL3.noise() + GLSL3.PLANET);
    this.P.sun = core.program(GLSL3.VS_MESH, GLSL3.noise() + GLSL3.SUN);
    this.P.ring = core.program(GLSL3.VS_MESH, GLSL3.RING);
    this.P.line = core.program(GLSL3.VS_LINE, GLSL3.LINE);
    this.P.glow = core.program(GLSL3.VS_BB, GLSL3.noise() + GLSL3.GLOW);
    this.M.hi = this.sphere(72, 44); this.M.lo = this.sphere(28, 18); this.M.ring = this.ringMesh(160); this.M.circle = this.circleMesh(192);
  },
  buffer(arr, target) { const gl = this.gl, b = gl.createBuffer(); gl.bindBuffer(target || gl.ARRAY_BUFFER, b); gl.bufferData(target || gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW); return b; },
  sphere(seg, rings) {
    const pos = [], uv = [], idx = [];
    for (let j = 0; j <= rings; j++) {
      const v = j / rings, th = v * Math.PI;
      for (let i = 0; i <= seg; i++) { const u = i / seg, ph = u * Math.PI * 2; pos.push(-Math.cos(ph) * Math.sin(th), Math.cos(th), Math.sin(ph) * Math.sin(th)); uv.push(u, v); }
    }
    for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) { const a = j * (seg + 1) + i, b = a + seg + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const gl = this.gl, p = new Float32Array(pos);
    return { pos: this.buffer(p), nrm: this.buffer(p), uv: this.buffer(new Float32Array(uv)), idx: this.buffer(new Uint16Array(idx), gl.ELEMENT_ARRAY_BUFFER), n: idx.length, mode: gl.TRIANGLES, indexed: true };
  },
  ringMesh(seg) {
    const pos = [], nrm = [], uv = [];
    for (let i = 0; i <= seg; i++) {
      const a = i / seg * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      pos.push(c * 1.24, 0, s * 1.24, c * 2.27, 0, s * 2.27); nrm.push(0, 1, 0, 0, 1, 0); uv.push(0, 0, 1, 0);
    }
    return { pos: this.buffer(new Float32Array(pos)), nrm: this.buffer(new Float32Array(nrm)), uv: this.buffer(new Float32Array(uv)), n: (seg + 1) * 2, mode: this.gl.TRIANGLE_STRIP };
  },
  circleMesh(seg) {
    const pos = []; for (let i = 0; i < seg; i++) { const a = i / seg * Math.PI * 2; pos.push(Math.cos(a), 0, Math.sin(a)); }
    return { pos: this.buffer(new Float32Array(pos)), n: seg, mode: this.gl.LINE_LOOP };
  },
  use(prog, mesh) {
    const gl = this.gl, core = this.core, A = prog.attrs; gl.useProgram(prog.p); core.cur = prog; core.unit = 0;
    const locs = [];
    if (mesh) {
      [["aPos", mesh.pos, 3], ["aNrm", mesh.nrm, 3], ["aUV", mesh.uv, 2]].forEach(([name, buf, size]) => {
        if (A[name] == null || A[name] < 0 || !buf) return; locs.push(A[name]); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.vertexAttribPointer(A[name], size, gl.FLOAT, false, 0, 0);
      });
    } else if (A.aPos != null) { locs.push(A.aPos); gl.bindBuffer(gl.ARRAY_BUFFER, core.buf); gl.vertexAttribPointer(A.aPos, 2, gl.FLOAT, false, 0, 0); }
    core.attribs(locs);
    if (mesh && mesh.indexed) gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.idx);
  },
  draw(mesh) { const gl = this.gl; if (mesh.indexed) gl.drawElements(mesh.mode, mesh.n, gl.UNSIGNED_SHORT, 0); else gl.drawArrays(mesh.mode, 0, mesh.n); },

  /* ── 렌더 상태 ── */
  frame(cam) { this.cam = cam; },
  opaque() { const gl = this.gl; gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); gl.disable(gl.BLEND); },
  translucent() { const gl = this.gl; gl.enable(gl.DEPTH_TEST); gl.depthMask(false); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); },
  common() { const c = this.core, k = this.cam; c.set("uVP", k.VP); c.set("uCam", k.eye); c.set("uSun", [0, 0, 0]); },

  /* ── 그리기 ── */
  drawSun(o) {
    const c = this.core; this.use(this.P.sun, this.M.hi); this.common();
    c.set("uModel", o.model); c.set("uTex", c.texId(TEX.sun)); c.set("uTexOK", c.fadeIn(TEX.sun, 800)); c.set("uTime", o.time); c.set("uHeat", o.heat);
    this.draw(this.M.hi);
  },
  drawPlanet(o) {
    const c = this.core, mesh = o.mesh || this.M.hi; this.use(this.P.planet, mesh); this.common();
    c.set("uModel", o.model); c.set("uTex", c.texId(o.tex)); c.set("uTexOK", c.fadeIn(o.tex, 700));
    c.set("uNight", o.night ? c.texId(o.night) : null); c.set("uClouds", o.clouds ? c.texId(o.clouds) : null);
    c.set("uHasNight", o.night && c.ready(o.night) ? 1 : 0); c.set("uHasClouds", o.clouds && c.ready(o.clouds) ? 1 : 0);
    c.set("uCloudRot", o.cloudRot || 0); c.set("uAtm", o.atm || [0, 0, 0]); c.set("uAtmK", o.atmK || 0); c.set("uLimb", o.limb || 0); c.set("uSpec", o.spec || 0);
    c.set("uTint", o.tint || [1, 1, 1, 0]); c.set("uFire", o.fire || 0); c.set("uTime", o.time || 0); c.set("uLift", o.lift || 0);
    const r = o.ring;
    c.set("uRingTex", r ? c.texId(r.tex) : null); c.set("uRingOn", r && c.ready(r.tex) ? 1 : 0);
    if (r) { c.set("uRingN", r.n); c.set("uRingC", r.c); c.set("uRingR", [r.inner, r.outer]); }
    this.draw(mesh);
  },
  drawRing(o) {
    const c = this.core, t = c.texId(o.tex); if (!t) return;
    this.use(this.P.ring, this.M.ring); this.common();
    c.set("uModel", o.model); c.set("uRing", t); c.set("uPC", o.center); c.set("uPR", o.R); c.set("uAlpha", (o.alpha == null ? 1 : o.alpha) * c.fadeIn(o.tex, 700));
    this.draw(this.M.ring);
  },
  drawLine(o) {
    const c = this.core; this.use(this.P.line, this.M.circle); this.common();
    c.set("uModel", o.model); c.set("uC", o.center); c.set("uCol", o.color); c.set("uAlpha", o.alpha);
    this.draw(this.M.circle);
  },
  /* 화면을 향하는 사각형: mode 0 코로나 · 1 대기 · 2 상태 고리 · 3 불꽃 */
  drawGlow(o) {
    const c = this.core; this.use(this.P.glow, null);
    c.set("uV", this.cam.V); c.set("uP", this.cam.P); c.set("uC", o.pos); c.set("uS", o.size);
    c.set("uMode", o.mode); c.set("uScale", o.scale); c.set("uCol", o.color || [1, 1, 1]); c.set("uK", o.k == null ? 1 : o.k);
    c.set("uLd", o.ld || [0, 1]); c.set("uTime", o.time || 0); c.set("uHeat", o.heat || 0); c.set("uAlpha", o.alpha == null ? 1 : o.alpha);
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  },
};

/* ── 3D 셰이더 ── */
const GLSL3 = {
VS_MESH: `
attribute vec3 aPos; attribute vec3 aNrm; attribute vec2 aUV;
uniform mat4 uModel; uniform mat4 uVP;
varying vec3 vW; varying vec3 vN; varying vec2 vUV;
void main() { vec4 w = uModel * vec4(aPos, 1.0); vW = w.xyz; vN = (uModel * vec4(aNrm, 0.0)).xyz; vUV = aUV; gl_Position = uVP * w; }`,
PLANET: `
varying vec3 vW; varying vec3 vN; varying vec2 vUV;
uniform sampler2D uTex, uNight, uClouds, uRingTex;
uniform float uTexOK, uHasNight, uHasClouds, uCloudRot, uAtmK, uLimb, uSpec, uFire, uTime, uRingOn, uLift;
uniform vec3 uSun, uCam, uAtm, uRingN, uRingC; uniform vec2 uRingR; uniform vec4 uTint;
void main() {
  vec3 N = normalize(vN), V = normalize(uCam - vW), Ls = normalize(uSun - vW);
  vec3 L = normalize(Ls + V * 0.9);
  vec3 raw = texture2D(uTex, vUV).rgb;
  vec3 tex = mix(vec3(0.22, 0.23, 0.28), raw, uTexOK);
  tex = mix(tex, tex * uTint.rgb * 1.45, uTint.a);
  float cl = 0.0;
  if (uHasClouds > 0.5) { cl = pow(texture2D(uClouds, vec2(vUV.x + uCloudRot, vUV.y)).r, 1.15) * 0.9; tex = mix(tex, vec3(0.96), cl); }
  float d = dot(N, L), mu = clamp(dot(N, V), 0.0, 1.0);
  float lit = smoothstep(-0.12, 0.55, d) * (0.6 + 0.4 * clamp(d, 0.0, 1.0));
  lit *= 1.0 - uLimb * pow(1.0 - mu, 1.6);
  if (uRingOn > 0.5) {
    float dn = dot(Ls, uRingN);
    if (abs(dn) > 0.001) { float t = dot(uRingC - vW, uRingN) / dn; if (t > 0.0) { float rr = length(vW + Ls * t - uRingC); float tt = (rr - uRingR.x) / (uRingR.y - uRingR.x); if (tt > 0.0 && tt < 1.0) lit *= 1.0 - texture2D(uRingTex, vec2(tt, 0.5)).a * 0.75; } }
  }
  vec3 col = tex * (0.045 + 0.955 * lit) * (1.0 + uLift);
  if (uSpec > 0.0) { float ocean = smoothstep(0.03, 0.16, raw.b - raw.r) * (1.0 - cl); col += vec3(1.0, 0.92, 0.8) * pow(max(dot(N, normalize(L + V)), 0.0), 70.0) * 0.5 * ocean * uSpec; }
  if (uHasNight > 0.5) col += texture2D(uNight, vUV).rgb * 1.25 * (1.0 - smoothstep(-0.3, 0.1, dot(N, Ls))) * (1.0 - lit) * (1.0 - cl * 0.8);
  col += uAtm * pow(1.0 - mu, 2.4) * 0.6 * uAtmK * smoothstep(-0.35, 0.6, d);
  if (uFire > 0.0) {
    vec3 q = N * 3.0;
    float f = noise3(q + vec3(0.0, -uTime * 0.9, uTime * 0.4)) * 0.6 + noise3(q * 2.3 - uTime * 1.2) * 0.4;
    col = mix(col, mix(vec3(1.0, 0.32, 0.04), vec3(1.0, 0.86, 0.5), f) * (0.85 + 0.5 * pow(mu, 0.5)), uFire);
  }
  gl_FragColor = vec4(col, 1.0);
}`,
SUN: `
varying vec3 vW; varying vec3 vN; varying vec2 vUV;
uniform sampler2D uTex; uniform float uTexOK, uTime, uHeat; uniform vec3 uCam;
void main() {
  vec3 N = normalize(vN), V = normalize(uCam - vW); float mu = clamp(dot(N, V), 0.0, 1.0), t = uTime;
  vec3 q = N * 2.2;
  vec2 w = vec2(noise3(q + vec3(t * 0.05, 0.0, 0.0)), noise3(q + vec3(5.2, t * 0.04, 1.3))) - 0.5;
  vec3 tex = texture2D(uTex, vUV + w * 0.012).rgb;
  tex = mix(vec3(1.0, 0.55, 0.12) * (0.75 + 0.5 * noise3(q * 4.0 + t * 0.1)), tex, uTexOK);
  float gran = noise3(N * 26.0 + vec3(t * 0.15, -t * 0.1, 0.0)) * 0.6 + noise3(N * 55.0 - t * 0.2) * 0.4;
  vec3 base = pow(tex, vec3(0.82)) * (1.16 + 0.4 * uHeat) + (gran - 0.5) * 0.12;
  float limb = pow(mu, 0.45);
  vec3 col = mix(vec3(0.62, 0.12, 0.01), base, limb) * (0.78 + 0.42 * limb);
  gl_FragColor = vec4(mix(col, vec3(1.0, 0.95, 0.82), 0.14 * uHeat * limb), 1.0);
}`,
RING: `
varying vec3 vW; varying vec3 vN; varying vec2 vUV;
uniform sampler2D uRing; uniform vec3 uSun, uCam, uPC; uniform float uPR, uAlpha;
void main() {
  vec4 r = texture2D(uRing, vec2(vUV.x, 0.5));
  vec3 Ls = normalize(uSun - vW), V = normalize(uCam - vW), N = normalize(vN);
  vec3 oc = vW - uPC; float b = dot(oc, Ls); float h = b * b - (dot(oc, oc) - uPR * uPR);
  float sh = b < 0.0 ? smoothstep(-0.04, 0.04, h / (uPR * uPR)) : 0.0;
  float lit = 0.5 + 0.5 * abs(dot(N, normalize(Ls + V * 0.9)));
  float a = r.a * uAlpha;
  gl_FragColor = vec4(r.rgb * lit * (1.0 - 0.85 * sh) * a, a);
}`,
VS_LINE: `
attribute vec3 aPos; uniform mat4 uModel; uniform mat4 uVP; varying vec3 vW;
void main() { vec4 w = uModel * vec4(aPos, 1.0); vW = w.xyz; gl_Position = uVP * w; }`,
LINE: `
varying vec3 vW; uniform vec3 uCol, uC, uCam; uniform float uAlpha;
void main() {
  vec3 tc = uCam - uC; tc.y = 0.0;
  float f = dot(normalize(vW - uC), normalize(tc + vec3(0.0001)));
  float a = uAlpha * (0.38 + 0.62 * (f * 0.5 + 0.5));
  gl_FragColor = vec4(uCol * a, a);
}`,
VS_BB: `
attribute vec2 aPos; uniform mat4 uV; uniform mat4 uP; uniform vec3 uC; uniform float uS; varying vec2 vUv;
void main() { vUv = aPos; vec4 v = uV * vec4(uC, 1.0); v.xy += aPos * uS; gl_Position = uP * v; }`,
GLOW: `
varying vec2 vUv;
uniform float uMode, uScale, uTime, uHeat, uK, uAlpha; uniform vec3 uCol; uniform vec2 uLd;
void main() {
  vec2 p = vUv * uScale; float r = length(p); vec3 col = vec3(0.0);
  float d = max(r - 1.0, 0.0); vec2 dir = p / max(r, 0.0001);
  if (uMode < 0.5) {
    float t = uTime;
    float rays = fbm3(vec3(dir * 2.4, d * 1.1 - t * 0.10));
    float rays2 = 0.5 + 0.5 * noise3(vec3(dir * 6.0 + 7.0, d * 2.4 - t * 0.22));
    float cor = exp(-d * mix(4.8, 2.8, uHeat)) * (0.35 + 1.25 * rays * rays2);
    vec3 cc = mix(vec3(1.0, 0.38, 0.10), vec3(1.0, 0.80, 0.50), exp(-d * 2.6));
    col = cc * (cor * (0.48 + 0.75 * uHeat) + exp(-d * 16.0) * (0.8 + 0.45 * uHeat));
    if (uHeat > 0.01 && d < 0.6) col += vec3(1.0, 0.42, 0.10) * smoothstep(0.58, 0.8, fbm3(vec3(dir * 4.5, t * 0.3))) * exp(-d * 9.0) * uHeat * 1.8;
    col += vec3(1.0, 0.56, 0.26) * exp(-d * 1.25) * (0.10 + 0.12 * uHeat);
  } else if (uMode < 1.5) {
    col = uCol * exp(-d * 16.0) * 0.6 * uK * smoothstep(-0.5, 0.7, dot(dir, uLd));
  } else if (uMode < 2.5) {
    float hr = r - 1.6; col = uCol * uK * (exp(-hr * hr / 0.012) * 0.9 + exp(-d * 4.5) * 0.3);
  } else {
    col = vec3(1.0, 0.5, 0.15) * exp(-d * 3.5) * 0.9 * uK;
  }
  col *= smoothstep(0.985, 1.025, r) * (1.0 - smoothstep(uScale * 0.72, uScale, r)) * uAlpha;
  gl_FragColor = vec4(col, 0.0);
}`,
noise() { return GLSL.LIB.replace("varying vec2 vUv; varying vec2 vPx;", ""); },
};
