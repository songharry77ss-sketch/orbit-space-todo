/* ═══════════════ WebGL 렌더러: 은하수 배경 · 태양 · 실사 텍스처 행성 · 토성 고리 ═══════════════
   좌표는 CSS px(좌상단 원점). 각 천체는 사각 쿼드 하나에 프래그먼트 셰이더로 구를 그린다. */
"use strict";

const GL = {
  ok: false, gl: null, cv: null, W: 1, H: 1, dpr: 1, P: {}, tex: {}, buf: null, lost: false, aniso: null,
  init(canvas) {
    this.cv = canvas;
    let gl = null;
    const opts = { alpha: false, antialias: true, depth: true, stencil: false, premultipliedAlpha: true, powerPreference: "high-performance" };
    try { gl = canvas.getContext("webgl", opts) || canvas.getContext("experimental-webgl", opts); } catch (e) { gl = null; }
    if (!gl) return false;
    this.gl = gl;
    canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); this.ok = false; this.lost = true; });
    canvas.addEventListener("webglcontextrestored", () => { this.lost = false; this.tex = {}; this.fbo = null; this.setup(); });
    return this.setup();
  },
  setup() {
    const gl = this.gl;
    const hp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
    this.prec = hp && hp.precision > 0 ? "precision highp float;\n" : "precision mediump float;\n";
    try {
      this.P.bg = this.program(GLSL.VS, GLSL.LIB + GLSL.BG);
      this.P.sky = this.program(GLSL.VS, GLSL.LIB + GLSL.SKY);
      G3.setup(this);
    } catch (e) { console.warn("[ORBIT] WebGL 셰이더 오류", e); this.ok = false; return false; }
    this.buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.aniso = gl.getExtension("EXT_texture_filter_anisotropic") || gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic");
    this.blank = this.solid([12, 12, 18, 255]);
    this.fbo = null; this.skyAt = -1e9;
    this.ok = true;
    return true;
  },
  shader(type, src) {
    const gl = this.gl, s = gl.createShader(type);
    gl.shaderSource(s, (type === gl.FRAGMENT_SHADER ? this.prec : "") + src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  },
  program(vs, fs) {
    const gl = this.gl, p = gl.createProgram();
    gl.attachShader(p, this.shader(gl.VERTEX_SHADER, vs)); gl.attachShader(p, this.shader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = { loc: gl.getUniformLocation(p, info.name), type: info.type }; }
    const attrs = {}, na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
    for (let i = 0; i < na; i++) { const info = gl.getActiveAttrib(p, i); attrs[info.name] = gl.getAttribLocation(p, info.name); }
    return { p, u, a: gl.getAttribLocation(p, "aPos"), attrs };
  },
  solid(rgba) {
    const gl = this.gl, id = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, id);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(rgba));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return id;
  },
  /* 텍스처 로드: 로드 전에는 단색으로 대체, file:// 에서는 인라인 data URI 사용 */
  texture(url, repeat = true) {
    if (!url || !this.ok) return null;
    if (this.tex[url]) return this.tex[url];
    const gl = this.gl, t = { id: null, ready: false };
    this.tex[url] = t;
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      if (this.lost) return;
      const id = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, id);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      const pot = (img.width & (img.width - 1)) === 0 && (img.height & (img.height - 1)) === 0;
      if (pot) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
      else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, pot && repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (this.aniso && pot) gl.texParameterf(gl.TEXTURE_2D, this.aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(4, gl.getParameter(this.aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
      t.id = id; t.ready = true; t.born = performance.now();
    };
    img.onerror = () => { t.failed = true; };
    img.src = (window.TEX_INLINE && window.TEX_INLINE[url]) || url;
    return t;
  },
  ready(url) { const t = this.tex[url]; return !!(t && t.ready); },

  /* ── 프레임 ── */
  resize(W, H, dpr) {
    const w = Math.max(1, Math.round(W * dpr)), h = Math.max(1, Math.round(H * dpr));
    if (this.cv.width !== w || this.cv.height !== h) { this.cv.width = w; this.cv.height = h; }
    this.W = W; this.H = H; this.dpr = dpr;
  },
  begin() { const gl = this.gl; gl.viewport(0, 0, this.cv.width, this.cv.height); gl.clearColor(0.01, 0.012, 0.025, 1); gl.depthMask(true); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.disable(gl.DEPTH_TEST); },
  use(prog) {
    const gl = this.gl; gl.useProgram(prog.p);
    this.attribs(prog.attrs.aPos != null ? [prog.attrs.aPos] : []);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf); gl.vertexAttribPointer(prog.a, 2, gl.FLOAT, false, 0, 0);
    this.cur = prog; this.unit = 0;
  },
  attribs(locs) {
    const gl = this.gl; this.on = this.on || new Set();
    for (const l of this.on) if (!locs.includes(l)) { gl.disableVertexAttribArray(l); this.on.delete(l); }
    for (const l of locs) if (!this.on.has(l)) { gl.enableVertexAttribArray(l); this.on.add(l); }
  },
  set(name, v) {
    const u = this.cur.u[name]; if (!u) return; const gl = this.gl;
    switch (u.type) {
      case gl.FLOAT: gl.uniform1f(u.loc, v); break;
      case gl.FLOAT_VEC2: gl.uniform2f(u.loc, v[0], v[1]); break;
      case gl.FLOAT_VEC3: gl.uniform3f(u.loc, v[0], v[1], v[2]); break;
      case gl.FLOAT_VEC4: gl.uniform4f(u.loc, v[0], v[1], v[2], v[3]); break;
      case gl.FLOAT_MAT4: gl.uniformMatrix4fv(u.loc, false, v); break;
      case gl.SAMPLER_2D: { const unit = this.unit++; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, v || this.blank); gl.uniform1i(u.loc, unit); break; }
    }
  },
  texId(url) { const t = this.texture(url); return t && t.ready ? t.id : null; },
  fadeIn(url, ms) { const t = this.tex[url]; return t && t.ready ? Math.min(1, (performance.now() - t.born) / ms) : 0; },
  quad(cx, cy, half, kx = 1, ky = 1) {
    this.set("uRes", [this.W, this.H]); this.set("uC", [cx, cy]); this.set("uS", half); this.set("uK", [kx, ky]);
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  },

  /* ── 그리기 API ── */
  skyBuffer(w, h) {
    const gl = this.gl;
    if (this.fbo && this.fbo.w === w && this.fbo.h === h) return this.fbo;
    if (this.fbo) { gl.deleteFramebuffer(this.fbo.fb); gl.deleteTexture(this.fbo.tex); }
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach(p => gl.texParameteri(gl.TEXTURE_2D, p, gl.LINEAR));
    [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(p => gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE));
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.fbo = { fb, tex, w, h }; this.skyAt = -1e9;
    return this.fbo;
  },
  /* 은하수·성운은 천천히 변하므로 반 해상도 버퍼에 0.6초마다 다시 그리고, 별만 매 프레임 그린다 */
  drawBg(o) {
    const gl = this.gl, w = Math.max(2, Math.round(this.W * this.dpr * 0.5)), h = Math.max(2, Math.round(this.H * this.dpr * 0.5));
    const buf = this.skyBuffer(w, h), ok = this.fadeIn(o.sky, 1400);
    const rot = o.rot || [0, 0], pr = this.skyRot || [9, 9];
    if (o.time - this.skyAt > 0.6 || (ok < 1 && ok > 0) || this.skyOK !== ok || Math.abs(rot[0] - pr[0]) > 0.0004 || Math.abs(rot[1] - pr[1]) > 0.0004) {
      this.skyAt = o.time; this.skyOK = ok; this.skyRot = rot.slice();
      gl.bindFramebuffer(gl.FRAMEBUFFER, buf.fb); gl.viewport(0, 0, w, h); gl.disable(gl.BLEND);
      this.use(this.P.sky);
      this.set("uSky", this.texId(o.sky)); this.set("uSkyOK", ok); this.set("uTime", o.time); this.set("uExp", o.exp); this.set("uView", [this.W, this.H]); this.set("uRot", rot);
      this.quad(this.W / 2, this.H / 2, 1, this.W / 2, this.H / 2);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, this.cv.width, this.cv.height); gl.enable(gl.BLEND);
    }
    this.use(this.P.bg);
    this.set("uBuf", buf.tex); this.set("uTime", o.time); this.set("uOff", o.off); this.set("uDim", o.dim); this.set("uView", [this.W, this.H]); this.set("uStars", o.stars);
    this.quad(this.W / 2, this.H / 2, 1, this.W / 2, this.H / 2);
  },
};

/* ── 셰이더 소스 ── */
const GLSL = {
VS: `
attribute vec2 aPos;
uniform vec2 uRes; uniform vec2 uC; uniform float uS; uniform vec2 uK;
varying vec2 vUv; varying vec2 vPx;
void main() {
  vUv = aPos;
  vec2 px = uC + vec2(aPos.x * uK.x, -aPos.y * uK.y) * uS;
  vPx = px;
  gl_Position = vec4(px.x / uRes.x * 2.0 - 1.0, 1.0 - px.y / uRes.y * 2.0, 0.0, 1.0);
}`,
LIB: `
varying vec2 vUv; varying vec2 vPx;
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return v; }
float fbm2(vec2 p) { return 0.62 * noise(p) + 0.38 * noise(p * 2.07 + vec2(3.1, 7.7)); }
float hash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise3(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hash3(i + vec3(0.0, 1.0, 0.0)), hash3(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(hash3(i + vec3(0.0, 0.0, 1.0)), hash3(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hash3(i + vec3(0.0, 1.0, 1.0)), hash3(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z); }
float fbm3(vec3 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 3; i++) { v += a * noise3(p); p = p * 2.02 + vec3(3.1, 1.7, 4.3); a *= 0.5; } return v; }
`,
SKY: `
uniform sampler2D uSky; uniform float uSkyOK, uTime, uExp; uniform vec2 uView, uRot;
void main() {
  vec2 fc = vPx; float m = max(uView.x, uView.y);
  vec2 q = (fc - uView * 0.5) / m;
  float ca = cos(-0.42), sa = sin(-0.42);
  vec2 r = vec2(ca * q.x - sa * q.y, sa * q.x + ca * q.y);
  vec2 suv = vec2(0.47 + r.x * 0.56 + uTime * 0.00035 + uRot.x, 0.5 + r.y * 1.05 + uRot.y);
  vec3 sky = pow(texture2D(uSky, suv).rgb, vec3(0.92)) * uExp * uSkyOK;
  float n1 = fbm(r * 2.3 + vec2(uTime * 0.004, 0.0));
  float n2 = fbm(r * 3.4 - vec2(0.0, uTime * 0.003) + 4.0);
  vec3 neb = vec3(0.20, 0.09, 0.36) * smoothstep(0.42, 0.86, n1) * 0.30 + vec3(0.04, 0.14, 0.30) * smoothstep(0.48, 0.92, n2) * 0.28;
  float band = exp(-pow(r.y * 3.2, 2.0));
  vec3 col = vec3(0.006, 0.008, 0.02) + sky + neb * (0.6 + 0.6 * band) + vec3(0.05, 0.05, 0.09) * band * 0.25;
  gl_FragColor = vec4(col, 1.0);
}`,
BG: `
uniform sampler2D uBuf; uniform float uTime, uDim, uStars; uniform vec2 uOff, uView;
vec3 stars(vec2 fc, float cell, float dens, float smin, float smax, float seed, float halo) {
  vec2 g = fc / cell; vec2 id = floor(g); vec2 f = fract(g);
  float h = hash(id + seed);
  if (h > dens) return vec3(0.0);
  vec2 pos = vec2(hash(id + seed + 1.3), hash(id + seed + 7.1)) * 0.56 + 0.22;
  vec2 dv = (f - pos) * cell; float d2 = dot(dv, dv);
  float s = mix(smin, smax, pow(hash(id + seed + 3.7), 3.0));
  float tw = 0.62 + 0.38 * sin(uTime * mix(0.5, 2.4, hash(id + seed + 5.0)) + h * 60.0);
  float core = exp(-d2 / (s * s * 1.3));
  float glow = halo * exp(-d2 / (s * s * 14.0)) * 0.16;
  vec3 tint = mix(vec3(0.72, 0.82, 1.0), vec3(1.0, 0.88, 0.72), hash(id + seed + 9.0));
  return tint * (core + glow) * tw * mix(0.45, 1.0, hash(id + seed + 11.0));
}
void main() {
  vec2 fc = vPx;
  vec2 bu = fc / uView; bu.y = 1.0 - bu.y;
  vec3 col = texture2D(uBuf, clamp(bu, 0.001, 0.999)).rgb;
  col += stars(fc + uOff * 0.2, 9.0, 0.10 * uStars, 0.35, 0.8, 1.0, 0.0) * 0.55;
  col += stars(fc + uOff * 0.5, 19.0, 0.12 * uStars, 0.5, 1.15, 17.0, 0.0) * 0.85;
  col += stars(fc + uOff, 47.0, 0.16 * uStars, 0.7, 1.9, 41.0, 1.0) * 1.25;
  vec2 v = (fc / uView - 0.5) * vec2(1.0, 0.9);
  col *= mix(0.42, 1.0, smoothstep(0.95, 0.2, length(v)));
  col += (hash(fc + fract(uTime)) - 0.5) * 0.012;
  gl_FragColor = vec4(col * uDim, 1.0);
}`,
};
