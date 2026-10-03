// Themed page backgrounds, all drawn with original code:
//  - liquid: a domain-warped noise shader on a WebGL canvas (CSS gradient fallback)
//  - aero:   layered gradients, glow and rising bubbles (pure CSS/DOM)
//  - stars:  a slow drifting starfield on a 2D canvas
//  - flat:   a solid colour
const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;
const FRAG = `
precision highp float;
uniform vec2 uRes; uniform float uTime;
uniform vec3 c0; uniform vec3 c1; uniform vec3 c2; uniform vec3 c3;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p){ float v = 0.0, a = 0.55; mat2 m = mat2(1.5, 1.1, -1.1, 1.5); for (int i = 0; i < 4; i++){ v += a * noise(p); p = m * p; a *= 0.48; } return v; }
void main(){
  vec2 uv = gl_FragCoord.xy / uRes.xy; uv.x *= uRes.x / uRes.y;
  float t = uTime * 0.04;
  vec2 q = vec2(fbm(uv * 0.75 + vec2(0.0, t)), fbm(uv * 0.75 + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(uv * 0.95 + 2.5 * q + vec2(1.7, 9.2) + 0.8 * t), fbm(uv * 0.95 + 2.5 * q + vec2(8.3, 2.8) - 0.6 * t));
  float f = fbm(uv * 0.9 + 2.7 * r);
  f = smoothstep(0.2, 0.8, f);
  float streak = 1.0 - abs(2.0 * fbm(uv * 1.15 + 2.2 * r + t) - 1.0);
  streak = pow(streak, 3.0);
  vec3 col = mix(c0, c1, smoothstep(0.0, 0.7, f));
  col = mix(col, c2, clamp(f * 0.75 + streak * 0.55 - 0.18, 0.0, 1.0) * 0.9);
  col += c3 * pow(streak, 3.0) * f * 0.35;
  float vig = smoothstep(1.5, 0.3, length((gl_FragCoord.xy / uRes.xy - 0.5) * vec2(1.1, 1.0)));
  col *= mix(0.62, 1.0, vig);
  gl_FragColor = vec4(col, 1.0);
}`;

const hex = h => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };

function liquidScene(host, colors, { still }) {
  const canvas = document.createElement('canvas'); canvas.className = 'bg-canvas'; host.appendChild(canvas);
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) { canvas.remove(); host.style.background = `radial-gradient(80% 60% at 25% 20%, ${colors[2]}55, transparent 70%), radial-gradient(70% 60% at 80% 70%, ${colors[1]}, transparent 70%), ${colors[0]}`; return () => { host.style.background = ''; }; }
  const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram(); gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(prog); gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const u = n => gl.getUniformLocation(prog, n); const uRes = u('uRes'), uTime = u('uTime');
  colors.forEach((c, i) => gl.uniform3fv(u('c' + i), hex(c)));
  const scale = () => Math.min(0.5, 960 / Math.max(window.innerWidth, 1));
  const size = () => { const w = Math.max(2, Math.round(window.innerWidth * scale())), h = Math.max(2, Math.round(window.innerHeight * scale())); canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); gl.uniform2f(uRes, w, h); };
  size(); window.addEventListener('resize', size);
  let raf = 0, t0 = performance.now() - 20000, last = 0;
  const draw = now => { gl.uniform1f(uTime, (now - t0) / 1000); gl.drawArrays(gl.TRIANGLES, 0, 3); };
  const loop = now => { raf = requestAnimationFrame(loop); if (now - last < 33) return; last = now; draw(now); };
  if (still) draw(performance.now()); else raf = requestAnimationFrame(loop);
  const vis = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else if (!still && !raf) raf = requestAnimationFrame(loop); };
  document.addEventListener('visibilitychange', vis);
  return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', size); document.removeEventListener('visibilitychange', vis); gl.getExtension('WEBGL_lose_context')?.loseContext(); canvas.remove(); };
}

function aeroScene(host, { still }) {
  host.classList.add('is-aero');
  host.innerHTML = `<div class="aero-sky"></div><div class="aero-ribbon r1"></div><div class="aero-ribbon r2"></div><div class="aero-sun"></div><div class="aero-horizon"></div><div class="aero-bubbles"></div><div class="aero-vignette"></div>`;
  const bubbles = host.querySelector('.aero-bubbles');
  if (!still) for (let i = 0; i < 16; i++) {
    const b = document.createElement('i'); const s = 18 + Math.random() * 70;
    b.style.cssText = `left:${Math.random() * 100}%;width:${s}px;height:${s}px;animation-duration:${22 + Math.random() * 26}s;animation-delay:${-Math.random() * 40}s;--drift:${(Math.random() - 0.5) * 120}px`;
    bubbles.appendChild(b);
  }
  return () => { host.classList.remove('is-aero'); host.innerHTML = ''; };
}

function starsScene(host, { still }) {
  const canvas = document.createElement('canvas'); canvas.className = 'bg-canvas'; host.appendChild(canvas);
  const ctx = canvas.getContext('2d'); let W = 0, H = 0, stars = [], raf = 0;
  const init = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; stars = Array.from({ length: Math.round(W * H / 11000) }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() ** 3 * 2.4 + 0.4, a: 0.25 + Math.random() * 0.7, vy: 0.02 + Math.random() * 0.06, tw: Math.random() * 6.28, glow: Math.random() < 0.08 })); };
  const draw = t => {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    for (const s of stars) {
      s.y -= still ? 0 : s.vy; if (s.y < -6) { s.y = H + 6; s.x = Math.random() * W; }
      const a = s.a * (0.75 + 0.25 * Math.sin(t / 900 + s.tw));
      if (s.glow) { const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 9); g.addColorStop(0, `rgba(255,255,255,${a * 0.5})`); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 9, 0, 6.28); ctx.fill(); }
      ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.28); ctx.fill();
    }
  };
  init(); window.addEventListener('resize', init);
  const loop = t => { raf = requestAnimationFrame(loop); draw(t); };
  if (still) draw(0); else raf = requestAnimationFrame(loop);
  return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', init); canvas.remove(); };
}

export function createBackground(host) {
  let teardown = null; let spec = null; let still = false;
  const clear = () => { teardown?.(); teardown = null; host.className = 'theme-bg'; host.style.background = ''; host.innerHTML = ''; };
  const build = () => {
    clear(); if (!spec) return;
    host.dataset.kind = spec.kind;
    if (spec.kind === 'liquid') teardown = liquidScene(host, spec.colors, { still });
    else if (spec.kind === 'aero') teardown = aeroScene(host, { still });
    else if (spec.kind === 'stars') teardown = starsScene(host, { still });
    else { host.style.background = spec.color || '#050505'; }
  };
  return { set(next) { spec = next; build(); }, setStill(v) { if (still !== v) { still = v; build(); } } };
}
