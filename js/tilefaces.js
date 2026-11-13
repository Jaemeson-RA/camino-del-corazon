// Faces des dalles dont la question a change : la dalle vierge
// (assets/tiles/blank_NN.webp) + la nouvelle etiquette ecrite comme sur Canva
// (Quicksand 700, couleur du texte d'origine, centre, taille ajustee).
import { TILE_TEXT } from './tile-text.js?v=202611131305';
import { QTILES, tileQ, isVariant } from './questions.js?v=202611131305';

const pad = (n) => String(n).padStart(2, '0');
const SC = 2; // rendu en 2x : la carte agrandie reste nette
const MAX_FS = 46; // taille du texte Canva (75 sur 4800 px) ramenee aux 3000 px du plateau
const cache = new Map();
let current = {};
let fontP = null;

const EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const font = (px) => `700 ${px}px Quicksand, ${EMOJI}`;

function fontsReady() {
  if (!fontP) fontP = (document.fonts ? document.fonts.load(font(MAX_FS)).catch(() => {}) : Promise.resolve());
  return fontP;
}

function loadImg(src) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.decoding = 'async';
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}

function wrap(ctx, words, maxW) {
  const lines = [];
  let cur = '';
  for (const w of words) {
    const tryL = cur ? cur + ' ' + w : w;
    if (!cur || ctx.measureText(tryL).width <= maxW) cur = tryL;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Ecrit l'etiquette dans la zone : on reduit la taille jusqu'a ce que tout tienne. */
function drawLabel(ctx, label, box, color) {
  const [x, y, w, h] = box;
  const words = String(label).split(/\s+/).filter(Boolean);
  let fs = MAX_FS * SC, lines = [];
  for (; fs >= 12 * SC; fs -= SC) {
    ctx.font = font(fs);
    lines = wrap(ctx, words, w);
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    if (widest <= w && lines.length * fs * 1.3 <= h) break;
  }
  // derniere ligne d'un seul petit mot (souvent l'emoji) : on l'accepte, c'est le style Canva
  const lh = fs * 1.3;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const y0 = y + (h - lines.length * lh) / 2 + lh / 2;
  lines.forEach((l, i) => ctx.fillText(l, x + w / 2, y0 + i * lh));
}

function render(n, label) {
  const key = n + '|' + label;
  if (cache.has(key)) return cache.get(key);
  const job = (async () => {
    const T = TILE_TEXT[n];
    if (!T) return null;
    await fontsReady();
    const img = await loadImg(`assets/tiles/blank_${pad(n)}.webp`);
    const cv = document.createElement('canvas');
    cv.width = T.size[0] * SC;
    cv.height = T.size[1] * SC;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    drawLabel(ctx, label, T.box.map((v) => v * SC), T.color);
    const blob = await new Promise((r) => { try { cv.toBlob(r, 'image/webp', 0.92); } catch (e) { r(null); } });
    return blob ? URL.createObjectURL(blob) : cv.toDataURL('image/png');
  })().catch((e) => { console.warn('dalle', n, e); cache.delete(key); return null; });
  cache.set(key, job);
  return job;
}

/** Prepare les faces de la partie. Renvoie { n: url } pour les dalles changees. */
export async function prepareFaces(g) {
  const next = {};
  await Promise.all(QTILES.filter((n) => isVariant(g, n)).map(async (n) => {
    const url = await render(n, tileQ(g, n).label);
    if (url) next[n] = url;
  }));
  current = next;
  return next;
}

/** Image de la face d'une dalle pour la partie en cours. */
export const faceUrl = (n) => current[n] || `assets/tiles/face_${pad(n)}.webp`;

/** Signature du tirage (pour savoir s'il faut redessiner les dalles). */
export const setSig = (g) => JSON.stringify((g && g.qs) || {});
