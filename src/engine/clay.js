// The clay renderer. Everything on screen is a lump of procedural "plasticine":
//  - lumpy superellipse outlines that re-roll every stop-motion frame (12 fps "boil")
//  - warm key light from the top-left, cool tinted shadows (never pure black)
//  - a tiling fingerprint / speckle texture, offset per shape and per frame
//  - rim light + inner shadow so shapes read as soft volumes, plus a wet glint
// It only needs a Canvas2D context, so it runs in the browser or any canvas shim.

import { hash, TAU, clamp } from './rng.js';

export const STOP_FPS = 12;
export const frameAt = (t) => Math.floor(t * STOP_FPS);
export const FONT = "'Poppins','Trebuchet MS','Nunito','Segoe UI',Verdana,sans-serif";
// Art-deco display face for names and signs (Grim Fandango nuance); falls back to the body face.
export const FONT_DECO = "'Limelight','Poiret One','Poppins','Trebuchet MS',sans-serif";

// ---------------------------------------------------------------- canvas factory
let factory = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
export function setCanvasFactory(f) {
  factory = f;
}
export function makeCanvas(w, h) {
  return factory(w, h);
}

// ---------------------------------------------------------------- colour helpers
export function parse(c) {
  if (c[0] === '#') {
    let h = c.slice(1);
    if (h.length === 3) h = h.split('').map((x) => x + x).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  return [128, 128, 128];
}
export function toHex(r, g, b) {
  return '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
}
export function mix(a, b, t) {
  const A = parse(a);
  const B = parse(b);
  return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
export const SHADOW_TINT = '#1b1038';
export const LIGHT_TINT = '#fff0cf';
export function shade(c, amt) {
  return amt >= 0 ? mix(c, LIGHT_TINT, amt) : mix(c, SHADOW_TINT, -amt);
}
export function rgba(c, a) {
  const [r, g, b] = parse(c);
  return `rgba(${r},${g},${b},${a})`;
}

// ---------------------------------------------------------------- scene light
// The colour of the light that bounces up off the table into every shadowed underside. A scene sets it once
// (rosy dusk on the pier, lamp amber in the archive, drowned teal in the chapel, kiln orange) and every lump
// picks it up, which is most of what makes the figures feel like they stand *in* a room rather than on top of it.
const AMB = { bounce: 'rgba(255,164,104,0.17)' };
export function setAmbient(o = {}) {
  AMB.bounce = o.bounce || 'rgba(255,164,104,0.17)';
}

// ---------------------------------------------------------------- textures
const TEX = 192; // logical tile size
const TEXRES = 2; // baked at 2x so fingerprints stay crisp on hi-dpi layers
let texCanvas = null;
let grainCanvas = null;
const patterns = new WeakMap();

function buildTexture() {
  const c = makeCanvas(TEX * TEXRES, TEX * TEXRES);
  const g = c.getContext('2d');
  g.scale(TEXRES, TEXRES);
  const wrap = (fn) => {
    for (const dx of [-TEX, 0, TEX]) {
      for (const dy of [-TEX, 0, TEX]) {
        g.save();
        g.translate(dx, dy);
        fn();
        g.restore();
      }
    }
  };
  const r = (i) => hash(i, 91, 3);
  // soft blotches (uneven kneading)
  for (let i = 0; i < 26; i++) {
    const x = r(i * 4) * TEX;
    const y = r(i * 4 + 1) * TEX;
    const rad = 14 + r(i * 4 + 2) * 26;
    const dark = r(i * 4 + 3) < 0.5;
    wrap(() => {
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, dark ? 'rgba(25,10,45,0.10)' : 'rgba(255,246,222,0.11)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    });
  }
  // thumb dents: shallow pits, shadow on the upper-left lip and light on the lower-right
  for (let i = 0; i < 9; i++) {
    const x = r(3000 + i * 3) * TEX;
    const y = r(3001 + i * 3) * TEX;
    const rad = 7 + r(3002 + i * 3) * 11;
    wrap(() => {
      const gr = g.createLinearGradient(x - rad, y - rad, x + rad, y + rad);
      gr.addColorStop(0, 'rgba(22,8,42,0.2)');
      gr.addColorStop(0.5, 'rgba(22,8,42,0.03)');
      gr.addColorStop(1, 'rgba(255,244,214,0.22)');
      g.fillStyle = gr;
      g.beginPath();
      g.ellipse(x, y, rad, rad * 0.8, 0.5, 0, TAU);
      g.fill();
    });
  }
  // speckle: dust and tiny crumbs, each with a pinprick of embossed highlight
  for (let i = 0; i < 900; i++) {
    const x = r(2000 + i * 3) * TEX;
    const y = r(2001 + i * 3) * TEX;
    const s = 0.4 + r(2002 + i * 3) * 1.3;
    wrap(() => {
      g.fillStyle = 'rgba(20,8,40,0.17)';
      g.beginPath();
      g.arc(x, y, s, 0, TAU);
      g.fill();
      g.fillStyle = 'rgba(255,248,225,0.26)';
      g.beginPath();
      g.arc(x - s * 0.7, y - s * 0.8, s * 0.7, 0, TAU);
      g.fill();
    });
  }
  // fingerprint whorls pressed into the surface
  for (let k = 0; k < 6; k++) {
    const cx = r(500 + k * 5) * TEX;
    const cy = r(501 + k * 5) * TEX;
    const rot = r(502 + k * 5) * TAU;
    const sw = 0.7 + r(503 + k * 5) * 0.6;
    for (let i = 1; i < 10; i++) {
      g.lineWidth = 1.1;
      g.strokeStyle = i % 2 ? 'rgba(20,8,40,0.12)' : 'rgba(255,248,225,0.15)';
      wrap(() => {
        g.beginPath();
        g.ellipse(cx, cy, i * 3.1 * sw, i * 2.5 * sw, rot, 0.4 + i * 0.15, 0.4 + i * 0.15 + Math.PI * 1.5);
        g.stroke();
      });
    }
  }
  // modelling-tool scratches: long shallow grooves with a lit lip
  for (let k = 0; k < 10; k++) {
    const x = r(4000 + k * 4) * TEX;
    const y = r(4001 + k * 4) * TEX;
    const a = r(4002 + k * 4) * TAU;
    const len = 18 + r(4003 + k * 4) * 34;
    const bend = (r(4004 + k * 4) - 0.5) * 16;
    const ex = x + Math.cos(a) * len;
    const ey = y + Math.sin(a) * len;
    const mx = (x + ex) / 2 - Math.sin(a) * bend;
    const my = (y + ey) / 2 + Math.cos(a) * bend;
    wrap(() => {
      g.lineCap = 'round';
      g.lineWidth = 1.2;
      g.strokeStyle = 'rgba(20,8,40,0.13)';
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(mx, my, ex, ey);
      g.stroke();
      g.lineWidth = 0.9;
      g.strokeStyle = 'rgba(255,248,225,0.15)';
      g.beginPath();
      g.moveTo(x - 0.9, y - 1);
      g.quadraticCurveTo(mx - 0.9, my - 1, ex - 0.9, ey - 1);
      g.stroke();
    });
  }
  return c;
}

function buildGrain() {
  const c = makeCanvas(256, 256);
  const g = c.getContext('2d');
  for (let i = 0; i < 2600; i++) {
    const x = hash(i, 5) * 256;
    const y = hash(i, 6) * 256;
    g.fillStyle = i % 2 ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.45)';
    g.fillRect(x, y, 1.4, 1.4);
  }
  return c;
}

function patternFor(ctx, which) {
  let m = patterns.get(ctx);
  if (!m) {
    m = {};
    patterns.set(ctx, m);
  }
  if (!m[which]) {
    if (which === 'clay') {
      if (!texCanvas) texCanvas = buildTexture();
      m.clay = ctx.createPattern(texCanvas, 'repeat');
      if (typeof DOMMatrix !== 'undefined' && m.clay && m.clay.setTransform) m.clay.setTransform(new DOMMatrix().scale(1 / TEXRES));
    } else {
      if (!grainCanvas) grainCanvas = buildGrain();
      m.grain = ctx.createPattern(grainCanvas, 'repeat');
    }
  }
  return m[which];
}

// ---------------------------------------------------------------- geometry
function smoothPath(ctx, pts) {
  const n = pts.length;
  ctx.moveTo((pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2);
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % n];
    ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
  }
  ctx.closePath();
}

// Lumpy superellipse. square=2 is an ellipse, ~5 is a soft slab.
export function blobPoints(cx, cy, rx, ry, o = {}) {
  const square = o.square || 2;
  const n = o.n || (square > 2.6 ? 44 : 26);
  const seed = o.seed || 1;
  const frame = o.frame || 0;
  const wob = o.wobble ?? 0.045;
  const ba = o.boil ?? clamp(Math.min(rx, ry) * 0.035, 0.45, 1.7);
  const p1 = hash(seed, 11) * TAU;
  const p2 = hash(seed, 12) * TAU;
  const p3 = hash(seed, 13) * TAU;
  const e = 2 / square;
  const rot = o.rot || 0;
  const cr = Math.cos(rot);
  const sr = Math.sin(rot);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const px = Math.sign(ca) * Math.pow(Math.abs(ca), e);
    const py = Math.sign(sa) * Math.pow(Math.abs(sa), e);
    const coh = Math.sin(a * 2 + p1) * 0.5 + Math.sin(a * 3 + p2) * 0.3 + Math.sin(a * 5 + p3) * 0.2;
    const lump = 1 + wob * coh;
    let x = px * rx * lump + (hash(seed, i, frame + 1, 7) - 0.5) * 2 * ba;
    let y = py * ry * lump + (hash(seed, i, frame + 1, 9) - 0.5) * 2 * ba;
    if (rot) {
      const tx = x * cr - y * sr;
      y = x * sr + y * cr;
      x = tx;
    }
    pts.push([cx + x, cy + y]);
  }
  return pts;
}

// A tapered sausage between two joints.
export function limbPoints(x1, y1, x2, y2, r1, r2, o = {}) {
  const seed = o.seed || 1;
  const frame = o.frame || 0;
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const ba = o.boil ?? clamp(Math.min(r1, r2) * 0.12, 0.35, 1.2);
  const m = 7;
  const raw = [];
  for (let i = 0; i <= m; i++) {
    const a = ang - Math.PI / 2 + (i / m) * Math.PI;
    raw.push([x2 + Math.cos(a) * r2, y2 + Math.sin(a) * r2]);
  }
  for (let i = 0; i <= m; i++) {
    const a = ang + Math.PI / 2 + (i / m) * Math.PI;
    raw.push([x1 + Math.cos(a) * r1, y1 + Math.sin(a) * r1]);
  }
  return raw.map((p, i) => [p[0] + (hash(seed, i, frame + 1, 3) - 0.5) * 2 * ba, p[1] + (hash(seed, i, frame + 1, 5) - 0.5) * 2 * ba]);
}

// ---------------------------------------------------------------- hand marks
function toolMarks(ctx, x0, y0, w, h, small, big, seed, frame) {
  const jit = (frame % 3) * 0.25;
  // one shallow thumb dent
  const dx = x0 + w * (0.25 + 0.5 * hash(seed, 31));
  const dy = y0 + h * (0.25 + 0.5 * hash(seed, 32));
  const dr = Math.max(4, small * (0.1 + 0.07 * hash(seed, 33)));
  const dg = ctx.createLinearGradient(dx - dr, dy - dr, dx + dr, dy + dr);
  dg.addColorStop(0, 'rgba(22,8,42,0.2)');
  dg.addColorStop(0.55, 'rgba(22,8,42,0.02)');
  dg.addColorStop(1, 'rgba(255,244,214,0.2)');
  ctx.fillStyle = dg;
  ctx.beginPath();
  ctx.ellipse(dx, dy, dr, dr * 0.8, hash(seed, 34) * 3, 0, TAU);
  ctx.fill();
  // tool drags
  const n = big >= 130 ? 3 : big >= 80 ? 2 : 1;
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const ax = x0 + w * (0.15 + 0.7 * hash(seed, 41 + i));
    const ay = y0 + h * (0.15 + 0.7 * hash(seed, 51 + i));
    const ang = hash(seed, 61 + i) * Math.PI;
    const len = small * (0.25 + 0.25 * hash(seed, 71 + i)) + 6;
    const bend = (hash(seed, 81 + i) - 0.5) * len * 0.5;
    const ex = ax + Math.cos(ang) * len + jit;
    const ey = ay + Math.sin(ang) * len;
    const mx = (ax + ex) / 2 - Math.sin(ang) * bend;
    const my = (ay + ey) / 2 + Math.cos(ang) * bend;
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(22,8,42,0.15)';
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo(mx, my, ex, ey);
    ctx.stroke();
    ctx.lineWidth = 0.9;
    ctx.strokeStyle = 'rgba(255,246,222,0.16)';
    ctx.beginPath();
    ctx.moveTo(ax - 1, ay - 1);
    ctx.quadraticCurveTo(mx - 1, my - 1, ex - 1, ey - 1);
    ctx.stroke();
  }
}

// Fill a rectangle with the fingerprint texture (callable under any clip), jittered per frame.
export function texFill(ctx, x, y, w, h, alpha = 0.5, seed = 1, frame = 0) {
  const ox = hash(seed, 21) * TEX + (frame % 3) * 6;
  const oy = hash(seed, 22) * TEX + ((frame * 2) % 3) * 5;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(ox, oy);
  ctx.fillStyle = patternFor(ctx, 'clay');
  ctx.fillRect(x - ox, y - oy, w, h);
  ctx.restore();
}

// ---------------------------------------------------------------- the shader
export function drawClay(ctx, pts, o = {}) {
  const color = o.color || '#c9a27e';
  const seed = o.seed || 1;
  const frame = o.frame || 0;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    if (p[0] < x0) x0 = p[0];
    if (p[0] > x1) x1 = p[0];
    if (p[1] < y0) y0 = p[1];
    if (p[1] > y1) y1 = p[1];
  }
  const w = Math.max(1, x1 - x0);
  const h = Math.max(1, y1 - y0);
  const big = Math.max(w, h);
  const small = Math.min(w, h);

  ctx.save();
  if (o.alpha != null) ctx.globalAlpha *= o.alpha;
  const baseAlpha = ctx.globalAlpha;

  // "lite" lumps (specks, petals, flames, anything tiny and flat) skip the texture and volume passes:
  // they would be invisible at that size and there are hundreds of them per frame
  if (o.lite ?? (o.flat && o.noRim && o.gloss === 0 && small < 16)) {
    const lg = ctx.createLinearGradient(x0 + w * 0.2, y0, x0 + w * 0.85, y1);
    lg.addColorStop(0, shade(color, 0.18));
    lg.addColorStop(1, shade(color, -0.3));
    ctx.beginPath();
    smoothPath(ctx, pts);
    ctx.fillStyle = lg;
    ctx.fill();
    const low = o.outline ?? 1.5;
    if (low > 0) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = low;
      ctx.strokeStyle = rgba(shade(color, -0.55), 0.55);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  // contact shadow: the lump leans on whatever is behind it (also reads as grout between bricks)
  const dropK = o.drop ?? (o.flat ? 0 : 1);
  if (dropK > 0 && small >= 7) {
    const d = clamp(small * 0.05, 1, 3.4) * dropK;
    ctx.save();
    ctx.translate(d * 0.9, d * 1.3);
    ctx.beginPath();
    smoothPath(ctx, pts);
    ctx.fillStyle = 'rgba(14,6,34,0.22)';
    ctx.fill();
    ctx.restore();
  }

  // body colour: lit top-left -> cool shadow bottom-right
  const g = ctx.createLinearGradient(x0 + w * 0.2, y0, x0 + w * 0.85, y1);
  g.addColorStop(0, shade(color, 0.24));
  g.addColorStop(0.45, color);
  g.addColorStop(1, shade(color, -0.4));
  ctx.beginPath();
  smoothPath(ctx, pts);
  ctx.fillStyle = g;
  ctx.fill();

  ctx.save();
  ctx.clip();

  // fingerprint / speckle texture, jittered each frame (the "boil")
  if (!o.flat) {
    const ox = hash(seed, 21) * TEX + (frame % 3) * 6;
    const oy = hash(seed, 22) * TEX + ((frame * 2) % 3) * 5;
    ctx.globalAlpha = baseAlpha * (o.tex ?? 0.7);
    ctx.translate(ox, oy);
    ctx.fillStyle = patternFor(ctx, 'clay');
    ctx.fillRect(x0 - ox - 2, y0 - oy - 2, w + 4, h + 4);
    ctx.translate(-ox, -oy);
    ctx.globalAlpha = baseAlpha;
  }

  // hand marks on bigger lumps: a thumb dent and a couple of modelling-tool drags (stable per seed)
  if (!o.flat && o.tex !== 0 && big >= 44) {
    toolMarks(ctx, x0, y0, w, h, small, big, seed, frame);
  }

  // soft volume: warm bloom top-left, cool occlusion bottom-right
  const bx = x0 + w * 0.34;
  const by = y0 + h * 0.28;
  const bloom = ctx.createRadialGradient(bx, by, 0, bx, by, big * 0.7);
  bloom.addColorStop(0, 'rgba(255,244,214,0.34)');
  bloom.addColorStop(0.55, 'rgba(255,244,214,0.05)');
  bloom.addColorStop(1, 'rgba(255,244,214,0)');
  ctx.fillStyle = bloom;
  ctx.fillRect(x0, y0, w, h);

  const cx = x0 + w / 2;
  const cy = y0 + h / 2;
  const occ = ctx.createRadialGradient(cx - w * 0.12, cy - h * 0.14, small * 0.22, cx, cy, big * 0.62);
  occ.addColorStop(0, 'rgba(27,16,56,0)');
  occ.addColorStop(1, `rgba(27,16,56,${o.occlusion ?? 0.36})`);
  ctx.fillStyle = occ;
  ctx.fillRect(x0, y0, w, h);

  // rim light (top-left) and inner shadow (bottom-right): shifted outline strokes, clipped
  if (!o.noRim) {
    const k = clamp(small * 0.045, 1.1, 5);
    const shifted = (dx, dy, style, lw) => {
      ctx.save();
      ctx.translate(dx, dy);
      ctx.beginPath();
      smoothPath(ctx, pts);
      ctx.lineJoin = 'round';
      ctx.lineWidth = lw;
      ctx.strokeStyle = style;
      ctx.stroke();
      ctx.restore();
    };
    shifted(-k * 0.9, -k * 1.1, 'rgba(27,16,56,0.30)', k * 2.4);
    shifted(k * 0.8, k * 0.9, 'rgba(255,246,222,0.30)', k * 1.5);
    // warm bounce light creeping up from the table into the shadowed underside
    if (small >= 14 && o.bounce !== 0) shifted(-k * 0.25, -k * 2.7, AMB.bounce, k * 1.1);
  }

  // Broad glaze reflection: a soft, hand-shaped highlight that makes each lump read as
  // rounded clay rather than a flat painted cut-out. Kept subtle so fingerprints remain visible.
  if (!o.flat && small >= 18 && o.gloss !== 0) {
    const gl = o.gloss ?? 0.5;
    ctx.save();
    ctx.translate(x0 + w * 0.31, y0 + h * 0.2);
    ctx.rotate(-0.48);
    ctx.scale(1, Math.max(0.22, h / Math.max(1, w)) * 0.72);
    const sheen = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(8, w * 0.24));
    sheen.addColorStop(0, `rgba(255,249,226,${0.11 * gl})`);
    sheen.addColorStop(0.48, `rgba(255,239,205,${0.055 * gl})`);
    sheen.addColorStop(1, 'rgba(255,239,205,0)');
    ctx.fillStyle = sheen;
    ctx.beginPath();
    ctx.ellipse(0, 0, Math.max(8, w * 0.24), Math.max(4, h * 0.16), 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // wet glint
  if (o.gloss !== 0) {
    const gl = o.gloss ?? 0.5;
    const hx = x0 + w * 0.3;
    const hy = y0 + h * 0.22;
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(-0.5);
    ctx.scale(1, 0.55);
    const rr = Math.max(2, small * 0.2);
    const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, rr);
    sg.addColorStop(0, `rgba(255,252,236,${0.6 * gl})`);
    sg.addColorStop(1, 'rgba(255,252,236,0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(0, 0, rr, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore(); // end clip

  // soft outline in a darker tint of the clay itself
  const ow = o.outline ?? 1.5;
  if (ow > 0) {
    ctx.beginPath();
    smoothPath(ctx, pts);
    ctx.lineJoin = 'round';
    ctx.lineWidth = ow;
    ctx.strokeStyle = rgba(shade(color, -0.55), 0.55);
    ctx.stroke();
  }
  ctx.restore();
}

export function blob(ctx, cx, cy, rx, ry, o = {}) {
  drawClay(ctx, blobPoints(cx, cy, rx, ry, o), o);
}
export function slab(ctx, x, y, w, h, o = {}) {
  drawClay(ctx, blobPoints(x + w / 2, y + h / 2, w / 2, h / 2, { square: 5, wobble: 0.02, ...o }), o);
}
export function limb(ctx, x1, y1, x2, y2, r1, r2, o = {}) {
  drawClay(ctx, limbPoints(x1, y1, x2, y2, r1, r2, o), o);
}

// ---------------------------------------------------------------- small things
export function shadow(ctx, x, y, rx, ry = rx * 0.26, a = 0.32) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(15,8,35,${a})`);
  g.addColorStop(0.6, `rgba(15,8,35,${a * 0.55})`);
  g.addColorStop(1, 'rgba(15,8,35,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export function glow(ctx, x, y, r, color = '#ffb65c', a = 0.5) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, a));
  g.addColorStop(0.45, rgba(color, a * 0.35));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

// A pair of cartoon eyes in the Neverhood spirit: white lumps, black pupils.
export function eye(ctx, x, y, r, o = {}) {
  const frame = o.frame || 0;
  const seed = o.seed || 1;
  if (o.blink || o.squint) {
    ctx.save();
    ctx.strokeStyle = '#2a1428';
    ctx.lineWidth = Math.max(1.5, r * 0.22);
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (o.squint) {
      const s = o.side || 1;
      ctx.moveTo(x - r * 0.7 * s, y - r * 0.5);
      ctx.lineTo(x + r * 0.5 * s, y);
      ctx.lineTo(x - r * 0.7 * s, y + r * 0.5);
    } else {
      ctx.moveTo(x - r * 0.8, y);
      ctx.quadraticCurveTo(x, y + r * 0.5, x + r * 0.8, y);
    }
    ctx.stroke();
    ctx.restore();
    return;
  }
  blob(ctx, x, y, r, r * 1.08, { color: o.white || '#fbf5e4', seed, frame, outline: 0.9, tex: 0.25, noRim: true, gloss: 0.2, boil: 0.35, wobble: 0.03 });
  const lx = (o.look?.[0] || 0) * r * 0.38;
  const ly = (o.look?.[1] || 0) * r * 0.3;
  blob(ctx, x + lx, y + ly, r * 0.5, r * 0.56, { color: o.pupil || '#241224', seed: seed + 3, frame, outline: 0, flat: true, noRim: true, gloss: 0, boil: 0.25, wobble: 0.02 });
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(x + lx - r * 0.14, y + ly - r * 0.2, Math.max(0.8, r * 0.14), 0, TAU);
  ctx.fill();
}

// ---------------------------------------------------------------- text
// Clay lettering: dark extrusion, coloured face, tiny highlight. `jitter` boils each letter.
export function clayText(ctx, str, x, y, size, color, o = {}) {
  const frame = o.frame || 0;
  ctx.save();
  ctx.font = `${o.weight || '700'} ${size}px ${o.font || FONT}`;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const chars = [...str];
  const widths = chars.map((ch) => ctx.measureText(ch).width + (o.tracking || 0));
  const total = widths.reduce((a, b) => a + b, 0);
  let cx = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
  chars.forEach((ch, i) => {
    const jx = (hash(frame, i, 1) - 0.5) * (o.jitter ?? 1.6);
    const jy = (hash(frame, i, 2) - 0.5) * (o.jitter ?? 1.6);
    const rot = (hash(frame, i, 3) - 0.5) * (o.tilt ?? 0.05);
    ctx.save();
    ctx.translate(cx + widths[i] / 2 + jx, y + jy);
    ctx.rotate(rot);
    ctx.textAlign = 'center';
    const depth = o.depth ?? Math.max(2, size * 0.09);
    ctx.strokeStyle = shade(color, -0.62);
    ctx.lineWidth = size * 0.16;
    ctx.strokeText(ch, depth * 0.5, depth);
    ctx.strokeStyle = shade(color, -0.42);
    ctx.lineWidth = size * 0.12;
    ctx.strokeText(ch, 0, 0);
    ctx.fillStyle = color;
    ctx.fillText(ch, 0, 0);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = shade(color, 0.6);
    ctx.fillText(ch, -size * 0.015, -size * 0.025);
    ctx.restore();
    cx += widths[i];
  });
  ctx.restore();
  return total;
}

// ---------------------------------------------------------------- film finish
// Noir finish for the whole frame: a teal-ink / bruised-rose split tone, a heavy vignette, the exposure
// flicker of a real animation stand (each 12 fps frame is lit a hair differently), film grain,
// and the odd hair in the gate. All of it re-rolls per stop-motion frame, nothing per rAF.
export function filmFinish(ctx, W, H, frame, o = {}) {
  const noir = o.noir ?? 1;
  if (noir > 0) {
    // `cool` tints the shadows at the top of the frame, `warm` the lit floor at the bottom; each scene grades its own
    const cool = (o.cool || [18, 92, 104]).join(',');
    const warm = (o.warm || [150, 48, 96]).join(',');
    ctx.save();
    const gr = ctx.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, `rgba(${cool},${0.26 * noir})`);
    gr.addColorStop(0.5, `rgba(${cool},0)`);
    gr.addColorStop(0.78, `rgba(${warm},${0.1 * noir})`);
    gr.addColorStop(1, `rgba(${warm},${0.22 * noir})`);
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.56);
  v.addColorStop(0, 'rgba(4,10,24,0)');
  v.addColorStop(1, `rgba(4,10,24,${o.vignette ?? 0.6})`);
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);

  // lamp flicker
  const fl = hash(frame, 71) - 0.5;
  ctx.save();
  if (fl > 0) {
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = `rgba(255,236,200,${fl * 0.16})`;
  } else {
    ctx.fillStyle = `rgba(8,4,28,${-fl * 0.1})`;
  }
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  const ox = hash(frame, 3) * 256;
  const oy = hash(frame, 4) * 256;
  ctx.save();
  ctx.globalAlpha = o.grain ?? 0.09;
  ctx.translate(-ox, -oy);
  ctx.fillStyle = patternFor(ctx, 'grain');
  ctx.fillRect(ox, oy, W, H);
  ctx.restore();

  // a hair or two caught in the gate
  if (hash(frame, 72) < 0.55) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(240,228,205,0.3)';
    ctx.lineWidth = 0.8;
    const n = 1 + Math.floor(hash(frame, 73) * 2);
    for (let i = 0; i < n; i++) {
      const hx = hash(frame, 74 + i) * W;
      const hy = hash(frame, 80 + i) * H;
      const a = hash(frame, 86 + i) * TAU;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.quadraticCurveTo(hx + Math.cos(a) * 9, hy + Math.sin(a) * 9 - 4, hx + Math.cos(a + 0.7) * 16, hy + Math.sin(a + 0.7) * 14);
      ctx.stroke();
    }
    ctx.restore();
  }
}
