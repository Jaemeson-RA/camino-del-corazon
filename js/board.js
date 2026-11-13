// Plateau : fond, stickers animes, effets d'ambiance, pions, camera (zoom),
// creux des dalles soulevees.
import { BOARD } from './board-data.js?v=202611122220';
import { h, $, sleep, clamp, rint, reducedMotion } from './util.js?v=202611122220';
import { play } from './sfx.js?v=202611122220';

const T = BOARD.tiles;
let root, viewport, board, pawnsEl, holesEl, fxEl, hlEl;
const pawns = {};
const cam = { s: 1, x: 0, y: 0, follow: false };
let fullRes = false;

// stickers : ordre d'empilement (le coeur sous le chien)
const STICKER_ORDER = ['heart', 'garland', 'stamp', 'beer', 'manneken', 'arrow_start', 'arrow_small',
  'flag_be', 'flag_ar', 'chocolate', 'mate', 'candles', 'empanadas', 'pikachu', 'vine', 'ivy_left', 'ivy_right', 'dog'];
// stickers poses sur une dalle : ils s'effacent quand elle se souleve
const ATTACHED = { 36: ['garland', 'stamp'], 26: ['pikachu'], 35: ['beer'], 27: ['vine'], 11: ['ivy_right'], 18: ['ivy_left'], 29: ['candles'] };

const pct = (v) => v + '%';

export function mountBoard(container) {
  root = container;
  viewport = h('div', { class: 'viewport' });
  board = h('div', { class: 'board' });
  const base = h('img', {
    class: 'base', alt: 'Camino del Corazón', draggable: 'false', decoding: 'async',
    src: 'assets/board-sm.webp',
  });
  board.append(base);
  // effets sous les stickers (pouls, lueurs)
  fxEl = h('div', { class: 'fx' });
  board.append(fxEl);
  for (const name of STICKER_ORDER) {
    const s = BOARD.stickers[name];
    if (!s) continue;
    const el = h('img', {
      class: `stk stk-${name}`, src: `assets/stickers/${name}.webp`, alt: '', draggable: 'false', decoding: 'async',
      style: { left: pct(s[0]), top: pct(s[1]), width: pct(s[2]), height: pct(s[3]) },
    });
    el.dataset.name = name;
    board.append(el);
  }
  holesEl = h('div', { class: 'holes' });
  hlEl = h('div', { class: 'hl-layer' });
  pawnsEl = h('div', { class: 'pawns' });
  board.append(holesEl, hlEl, pawnsEl);
  for (const k of ['A', 'J']) {
    const p = h('div', { class: `pawn pawn-${k}` }, h('div', { class: 'pawn-shadow' }), h('div', { class: 'pawn-body' }, h('span', { text: k })));
    pawns[k] = p;
    pawnsEl.append(p);
  }
  viewport.append(board);
  root.append(viewport);
  buildAmbience();
  bindCamera();
  if (window.devicePixelRatio * Math.max(innerWidth, innerHeight) > 2200) upgradeRes();
  new ResizeObserver(() => layout()).observe(root);
  layout();
  return board;
}

function upgradeRes() {
  if (fullRes) return;
  fullRes = true;
  const img = new Image();
  img.decoding = 'async';
  img.src = 'assets/board.webp';
  img.onload = () => { $('.base', board).src = img.src; };
}

/** Taille du plateau : contenu dans la zone, ratio 3:2. */
export function layout() {
  if (!root) return;
  const r = root.getBoundingClientRect();
  let w = r.width, hgt = r.width / 1.5;
  if (hgt > r.height) { hgt = r.height; w = hgt * 1.5; }
  viewport.style.width = w + 'px';
  viewport.style.height = hgt + 'px';
  board.style.setProperty('--bw', w + 'px');
  applyCam(false);
}

// ------------------------------------------------------------------ ambiance
function buildAmbience() {
  if (reducedMotion()) board.classList.add('calm');
  // pouls qui parcourt la ligne de l'electrocardiogramme
  fxEl.append(h('div', { class: 'ecg-pulse' }));
  // lueurs des bougies
  const c = BOARD.stickers.candles;
  if (c) {
    [[0.18, 0.12], [0.5, 0.0], [0.78, 0.14]].forEach(([fx, fy], i) => {
      board.append(h('div', { class: 'glow', style: { left: pct(c[0] + c[2] * fx), top: pct(c[1] + c[3] * fy), animationDelay: `${i * 0.37}s` } }));
    });
  }
  // vapeur du mate
  const m = BOARD.stickers.mate;
  if (m) {
    for (let i = 0; i < 3; i++) board.append(h('div', { class: 'steam', style: { left: pct(m[0] + m[2] * (0.45 + i * 0.12)), top: pct(m[1] + m[3] * 0.18), animationDelay: `${i * 1.1}s` } }));
  }
  // bulles de la biere
  const b = BOARD.stickers.beer;
  if (b) {
    for (let i = 0; i < 5; i++) board.append(h('div', { class: 'bubble', style: { left: pct(b[0] + b[2] * (0.2 + 0.13 * i)), top: pct(b[1] + b[3] * 0.85), animationDelay: `${i * 0.55}s` } }));
  }
  // ronds dans l'eau du Manneken Pis
  const mk = BOARD.stickers.manneken;
  if (mk) board.append(h('div', { class: 'ripple', style: { left: pct(mk[0] + mk[2] * 0.38), top: pct(mk[1] + mk[3] * 0.91) } }));
  // etincelles autour du coeur et du titre
  const sparks = [[44.5, 46], [61, 44], [58, 63], [47.5, 64.5], [10, 3.5], [20, 9.5], [3.5, 8], [64, 6.5], [92.5, 13]];
  sparks.forEach(([x, y], i) => board.append(h('div', { class: 'spark', style: { left: pct(x), top: pct(y), animationDelay: `${(i * 0.83) % 4}s` } })));
  // petits coeurs qui montent dans les marges
  if (!reducedMotion()) setInterval(floatHeart, 2600);
}

function floatHeart() {
  if (document.hidden || board.querySelectorAll('.float-heart').length > 5) return;
  const side = Math.random();
  const x = side < 0.45 ? rint(1, 5) : side < 0.9 ? rint(95, 99) : rint(20, 80);
  const y = side < 0.9 ? rint(55, 95) : 97;
  const el = h('div', { class: 'float-heart', style: { left: x + '%', top: y + '%', '--hue': String(rint(-12, 14)), '--drift': `${rint(-30, 30)}px` } });
  board.append(el);
  setTimeout(() => el.remove(), 7000);
}

// ------------------------------------------------------------------ pions
const pawnKey = { A: [-1, 0], J: [1, 0] };

function pawnSpot(n, k, posAll) {
  const t = T[n];
  let [x, y] = t.pawn;
  const shared = posAll && posAll.A === posAll.J;
  if (shared) x += pawnKey[k][0] * Math.min(2.2, t.box[2] * 0.2);
  return [x, y];
}

export function placePawns(pos, turn) {
  for (const k of ['A', 'J']) {
    const [x, y] = pawnSpot(pos[k] || 0, k, pos);
    const p = pawns[k];
    p.style.left = pct(x);
    p.style.top = pct(y);
    p.classList.toggle('active', turn === k);
  }
}

/** Deplacement case par case (sauts). */
export async function movePawn(k, from, to, pos, onStep) {
  const p = pawns[k];
  const dir = to > from ? 1 : -1;
  p.classList.add('moving');
  for (let n = from; n !== to; n += dir) {
    const nxt = n + dir;
    const [x0, y0] = pawnSpot(n, k, null);
    const isLast = nxt === to;
    const [x1, y1] = isLast ? pawnSpot(nxt, k, pos) : pawnSpot(nxt, k, null);
    const dur = reducedMotion() ? 90 : 300;
    const anim = p.animate([
      { left: pct(x0), top: pct(y0), transform: 'translate(-50%, -100%) translateY(0) scale(1)' },
      { left: pct((x0 + x1) / 2), top: pct((y0 + y1) / 2), transform: 'translate(-50%, -100%) translateY(-38%) scale(1.08)', offset: 0.5 },
      { left: pct(x1), top: pct(y1), transform: 'translate(-50%, -100%) translateY(0) scale(1, 0.92)', offset: 0.85 },
      { left: pct(x1), top: pct(y1), transform: 'translate(-50%, -100%) translateY(0) scale(1)' },
    ], { duration: dur, easing: 'ease-in-out' });
    p.style.left = pct(x1);
    p.style.top = pct(y1);
    if (cam.follow) focusOn(x1, y1, true);
    play('step', n);
    onStep && onStep(nxt);
    await anim.finished.catch(() => {});
  }
  p.classList.remove('moving');
  // l'autre pion se decale si les deux partagent la case
  const o = k === 'A' ? 'J' : 'A';
  const [ox, oy] = pawnSpot(pos[o] || 0, o, pos);
  pawns[o].style.left = pct(ox);
  pawns[o].style.top = pct(oy);
}

export function pawnBurst(k, text) {
  const p = pawns[k];
  const el = h('div', { class: 'pawn-burst', text, style: { left: p.style.left, top: p.style.top } });
  pawnsEl.append(el);
  setTimeout(() => el.remove(), 1600);
}

// ------------------------------------------------------------------ dalles
export function tileRect(n) {
  const t = T[n];
  const r = board.getBoundingClientRect();
  return {
    left: r.left + (t.box[0] / 100) * r.width,
    top: r.top + (t.box[1] / 100) * r.height,
    width: (t.box[2] / 100) * r.width,
    height: (t.box[3] / 100) * r.height,
  };
}

export function showHole(n, on) {
  const id = `hole-${n}`;
  let el = holesEl.querySelector('#' + id);
  if (on && !el) {
    const t = T[n];
    el = h('img', { id, class: 'hole', src: `assets/tiles/hole_${String(n).padStart(2, '0')}.webp`, alt: '',
      style: { left: pct(t.box[0]), top: pct(t.box[1]), width: pct(t.box[2]), height: pct(t.box[3]) } });
    holesEl.append(el);
  } else if (!on && el) el.remove();
  for (const name of ATTACHED[n] || []) {
    const s = board.querySelector(`.stk-${name}`);
    if (s) s.classList.toggle('lifted-away', !!on);
  }
}

/** Petit choc quand la dalle se repose. */
export function settleTile(n) {
  if (n >= T.length - 1) return;
  const t = T[n];
  const el = h('img', { class: 'settle', src: `assets/tiles/face_${String(n).padStart(2, '0')}.webp`, alt: '',
    style: { left: pct(t.box[0]), top: pct(t.box[1]), width: pct(t.box[2]), height: pct(t.box[3]) } });
  hlEl.append(el);
  setTimeout(() => el.remove(), 700);
}

export function highlightTile(n, on) {
  hlEl.querySelectorAll('.hl').forEach((e) => e.remove());
  if (!on || n == null) return;
  const t = T[n];
  hlEl.append(h('div', { class: 'hl', style: { left: pct(t.box[0]), top: pct(t.box[1]), width: pct(t.box[2]), height: pct(t.box[3]) } }));
}

export function heartBeatBig() {
  const el = board.querySelector('.stk-heart');
  if (!el) return;
  el.classList.remove('big-beat');
  void el.offsetWidth;
  el.classList.add('big-beat');
  play('heart');
}

// ------------------------------------------------------------------ camera
function applyCam(animate) {
  const vw = viewport.clientWidth, vh = viewport.clientHeight;
  cam.x = clamp(cam.x, vw - vw * cam.s, 0);
  cam.y = clamp(cam.y, vh - vh * cam.s, 0);
  board.style.transition = animate ? 'transform .45s cubic-bezier(.3,.7,.2,1)' : 'none';
  board.style.transform = `translate(${cam.x}px, ${cam.y}px) scale(${cam.s})`;
  root.classList.toggle('zoomed', cam.s > 1.01);
}

/** Centre la camera sur un point du plateau (en %). */
export function focusOn(px, py, animate = true) {
  const vw = viewport.clientWidth, vh = viewport.clientHeight;
  cam.x = vw / 2 - (px / 100) * vw * cam.s;
  cam.y = vh / 2 - (py / 100) * vh * cam.s;
  applyCam(animate);
}

export function setZoom(s, px = 50, py = 50, animate = true) {
  cam.s = s;
  if (s > 1) upgradeRes();
  focusOn(px, py, animate);
}

export const isZoomed = () => cam.s > 1.01;
export const isSmall = () => viewport && viewport.clientWidth < 640;

export function followPawn(k, on) {
  cam.follow = on;
  if (on) {
    const p = pawns[k];
    setZoom(2.1, parseFloat(p.style.left), parseFloat(p.style.top));
  }
}

export function toggleZoom(k) {
  if (isZoomed()) setZoom(1);
  else {
    const p = pawns[k];
    setZoom(2.2, parseFloat(p.style.left) || 50, parseFloat(p.style.top) || 50);
  }
}

function bindCamera() {
  let drag = null;
  let lastTap = 0;
  viewport.addEventListener('pointerdown', (e) => {
    if (cam.s <= 1.01) return;
    drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false };
    viewport.setPointerCapture(e.pointerId);
  });
  viewport.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    cam.x = drag.cx + dx;
    cam.y = drag.cy + dy;
    cam.follow = false;
    applyCam(false);
  });
  const end = () => { drag = null; };
  viewport.addEventListener('pointerup', end);
  viewport.addEventListener('pointercancel', end);
  // double tap : zoom a l'endroit touche
  viewport.addEventListener('click', (e) => {
    const t = Date.now();
    if (t - lastTap < 320) {
      const r = board.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * 100;
      const py = ((e.clientY - r.top) / r.height) * 100;
      if (isZoomed()) setZoom(1); else setZoom(2.2, px, py);
      lastTap = 0;
    } else lastTap = t;
  });
}

export { sleep };
