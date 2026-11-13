// Chef d'orchestre : ecrans, HUD, cartes retournees, enchainement des animations.
import { BOARD } from './board-data.js?v=202611122242';
import { h, $, $$, sleep, clear, uid, rint } from './util.js?v=202611122242';
import { PLAYERS, other, TYPE_BADGE, RULES, MINIJUEGOS } from './content.js?v=202611122242';
import * as R from './rules.js?v=202611122242';
import * as net from './net.js?v=202611122242';
import * as sfx from './sfx.js?v=202611122242';
import {
  mountBoard, placePawns, movePawn, pawnBurst, tileRect, showHole, settleTile, highlightTile,
  heartBeatBig, followPawn, setZoom, isSmall, toggleZoom, isZoomed,
} from './board.js?v=202611122242';
import { mountDice, rollTo, setDice } from './dice.js?v=202611122242';
import { renderMG, roulette, mgSummary } from './minigames.js?v=202611122242';

const S = {
  roomKey: '', me: '', room: null, game: null, presence: {},
  rendered: null, card: null, pending: null, running: false, lobbyForced: false,
  seenMg: {}, typingAt: 0, endShownFor: '',
};
const pad = (n) => String(n).padStart(2, '0');
const NAME = (k) => PLAYERS[k].name;
let dice;

// ------------------------------------------------------------------ stockage
const store = (k, v) => { try { localStorage.setItem('cdc.' + k, v); } catch (e) { /* prive */ } };
const load = (k) => { try { return localStorage.getItem('cdc.' + k) || ''; } catch (e) { return ''; } };

function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  return { s: p.get('s') || '', p: p.get('p') || '' };
}
function writeHash() {
  const q = new URLSearchParams();
  if (S.roomKey) q.set('s', S.roomKey);
  if (S.me) q.set('p', S.me);
  history.replaceState(null, '', '#' + q.toString());
}
export function shareLink(k) {
  return `${location.origin}${location.pathname}#s=${S.roomKey}&p=${k}`;
}

// ------------------------------------------------------------------ demarrage
function boot() {
  const { s, p } = readHash();
  if (/^[A-Za-z0-9_-]{8,64}$/.test(s)) store('room', s);
  if (/^[AJ]$/.test(p)) store('me', p);
  S.roomKey = load('room');
  S.me = load('me');
  if (S.roomKey) writeHash();
  mountUI();
  document.addEventListener('pointerdown', () => sfx.unlock(), { once: false, passive: true });
  // lien colle alors que le jeu est deja ouvert : on recharge sur la bonne salle
  addEventListener('hashchange', () => {
    const n = readHash();
    if ((n.s && n.s !== S.roomKey) || (n.p && n.p !== S.me)) location.reload();
  });
  if (!S.roomKey) { showRoomScreen(); return; }
  start();
}

function start() {
  net.useRoom(S.roomKey);
  net.watchConnection((on) => document.body.classList.toggle('offline', !on));
  net.watchRoom(onRoom);
  if (S.me) net.presence(S.me);
  setInterval(tickTyping, 1000);
  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 1500));
  idle(() => BOARD.tiles.forEach((t) => { if (t.n < R.LAST) { const i = new Image(); i.src = `assets/tiles/face_${pad(t.n)}.webp`; } }));
}

function onRoom(data) {
  S.room = data;
  S.presence = data.presence || {};
  const g = R.norm(data.game);
  S.game = g;
  if (!S.me) { showWho(); renderHUD(); return; }
  // l'autre a lance une nouvelle partie pendant que j'etais dans le lobby
  if (S.lobbyForced && g && g.id !== S.lobbyFor) { S.lobbyForced = false; }
  const lobbyOn = document.getElementById('scr-lobby')?.classList.contains('on');
  if (!g || S.lobbyForced) { if (!lobbyOn) showLobby(); } else hide('lobby');
  if (g) push(g); else renderHUD();
}

function openLobby() {
  S.lobbyForced = true;
  S.lobbyFor = S.game ? S.game.id : '';
  hide('end');
  showLobby();
}

// ------------------------------------------------------------------ squelette
function mountUI() {
  const app = $('#app');
  const stage = h('main', { class: 'stage', id: 'stage' });
  const boardHost = h('div', { class: 'board-host', id: 'boardHost' });
  stage.append(boardHost);
  const chip = (k) => h('div', { class: `pchip pchip-${k}`, id: `chip-${k}` },
    h('div', { class: `tok tok-${k}`, text: k }),
    h('div', { class: 'pchip-txt' }, h('b', { text: NAME(k) }), h('small', { class: 'where', text: '' })),
    h('div', { class: 'score', text: '0' }),
    h('i', { class: 'dot', title: 'en línea' }));
  const panel = h('aside', { class: 'panel', id: 'panel' },
    h('div', { class: 'brand' }, h('span', { class: 'brand-heart', text: '♥' }), h('span', { text: 'Camino del Corazón' })),
    h('div', { class: 'players' }, chip('A'), chip('J')),
    h('div', { class: 'turn', id: 'turn', text: '' }),
    h('div', { class: 'tray', id: 'tray' }),
    h('button', { class: 'btn roll', id: 'roll', disabled: true, onclick: doRoll }, h('span', { text: '🎲' }), h('span', { text: 'Lanzar los dados' })),
    h('div', { class: 'last', id: 'last' }),
    h('div', { class: 'tools' },
      h('button', { class: 'tool', id: 'tZoom', title: 'Zoom', onclick: () => toggleZoom(S.me || 'A'), text: '🔍' }),
      h('button', { class: 'tool', title: 'Nuestras respuestas', onclick: showHistory, text: '📜' }),
      h('button', { class: 'tool', title: 'Reglas', onclick: showRules, text: '📖' }),
      h('button', { class: 'tool', id: 'tSound', title: 'Sonido', onclick: toggleSound, text: sfx.isMuted() ? '🔇' : '🔊' }),
      h('button', { class: 'tool', title: 'Menú', onclick: showMenu, text: '☰' })));
  app.append(stage, panel);
  mountBoard(boardHost);
  dice = mountDice($('#tray'));
  // couche des cartes
  document.body.append(
    h('div', { class: 'card-layer', id: 'cardLayer' },
      // toucher a cote de la carte ouvre le menu d'options
      h('div', { class: 'backdrop', id: 'backdrop', onclick: () => showMenu() }),
      h('button', { class: 'back-to-card', id: 'backToCard', onclick: () => setPeek(false) }, h('span', { text: '🃏' }), h('span', { text: 'Volver a la carta' }))),
    h('div', { class: 'fx-top', id: 'fxTop' }),
    h('div', { class: 'toast', id: 'toast' }),
    h('div', { class: 'net-off', text: 'Sin conexión… reconectando' }));
  addEventListener('resize', () => { if (S.card) placeCardFinal(); });
  if (window.visualViewport) visualViewport.addEventListener('resize', () => { if (S.card) placeCardFinal(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) document.title = 'Camino del Corazón'; });
}

// ------------------------------------------------------------------ HUD
function renderHUD() {
  const g = S.rendered || S.game;
  for (const k of ['A', 'J']) {
    const c = $(`#chip-${k}`);
    c.querySelector('.score').textContent = g ? g.score[k] : 0;
    c.querySelector('.where').textContent = !g ? '' : g.done[k] ? '💘 en el corazón' : g.pos[k] === 0 ? 'en el inicio' : `casilla ${g.pos[k]}/${R.LAST}`;
    c.classList.toggle('is-turn', !!g && g.status === 'playing' && g.turn === k && !g.done[k]);
    c.classList.toggle('me', S.me === k);
    c.classList.toggle('online', !!(S.presence[k] && S.presence[k].on));
  }
  const t = $('#turn');
  const btn = $('#roll');
  let txt = '';
  const can = canRoll();
  if (!g) txt = 'Preparen una nueva partida';
  else if (g.status === 'ended') txt = '¡Partida terminada!';
  else if (g.card) txt = phaseLine(g);
  else if (g.turn === S.me) txt = '¡Tu turno! Lanza los dados';
  else txt = `Turno de ${NAME(g.turn)}`;
  t.textContent = txt;
  t.classList.toggle('mine', can);
  btn.disabled = !can;
  btn.classList.toggle('pulse', can);
  $('#tZoom').hidden = !isSmall();
  const last = g && g.log.length ? g.log[g.log.length - 1] : null;
  const lastEl = $('#last');
  clear(lastEl);
  if (last) {
    lastEl.append(h('small', { text: `Última: ${NAME(last.by)} · ${BOARD.tiles[last.n].label}` }),
      h('div', { class: 'last-a', text: last.photo ? '📸 una foto' : last.a ? `«${last.a}»` : last.vr === 'reto' ? 'reto cumplido' : '' }),
      h('small', { class: last.ok ? 'ok' : 'ko', text: last.ok ? '✓ acertó' : last.mg ? mgLine(last) : '✗ sin punto' }));
  }
}

function mgLine(l) {
  const info = MINIJUEGOS[l.mg];
  const w = l.mgres === 'L' ? NAME(l.by) : l.mgres === 'O' ? NAME(other(l.by)) : '';
  return `${info ? info.icon : '🎮'} minijuego: ${w ? `ganó ${w}` : 'empate'}`;
}

function phaseLine(g) {
  const c = g.card;
  const L = NAME(c.by), O = NAME(other(c.by));
  switch (c.phase) {
    case 'answer': return `${L} responde…`;
    case 'ask': return `${O} escribe una pregunta…`;
    case 'vr': return `${L} elige verdad o reto…`;
    case 'judge': return `${O} decide si vale…`;
    case 'rescue': return `${O} decide si propone un minijuego…`;
    case 'mg': return '¡Minijuego!';
    case 'back2': return `${L} retrocede 2 casillas`;
    case 'meta': return `¡${L} llegó al corazón!`;
    default: return 'Resultado';
  }
}

function canRoll() {
  const g = S.game;
  return !!g && !!S.me && g.status === 'playing' && g.turn === S.me && !g.card && !g.done[S.me] && !S.running && !S.pending;
}

async function doRoll() {
  sfx.unlock();
  if (!canRoll()) return;
  $('#roll').disabled = true;
  const ok = await net.act((g) => R.roll(g, S.me, rint(1, 6), rint(1, 6)));
  if (!ok) renderHUD();
}

function toggleSound() {
  sfx.setMuted(!sfx.isMuted());
  $('#tSound').textContent = sfx.isMuted() ? '🔇' : '🔊';
  sfx.unlock();
  sfx.play('pop');
}

// ------------------------------------------------------------------ chef d'orchestre
function push(g) {
  S.pending = g;
  if (!S.running) run();
}

async function run() {
  S.running = true;
  while (S.pending) {
    const g = S.pending;
    S.pending = null;
    try { await transition(S.rendered, g); } catch (e) { console.error(e); }
    S.rendered = g;
    renderHUD();
  }
  S.running = false;
  renderHUD();
}

async function transition(prev, g) {
  // premier affichage, nouvelle partie ou sauvegarde restauree : pas d'animation
  if (!prev || prev.id !== g.id || (prev.rk || '') !== (g.rk || '')) {
    if (S.card) await closeCard(true);
    placePawns(g.pos, g.turn);
    if (g.dice) { setDice(dice, g.dice.d1, g.dice.d2); $('#tray').dataset.sum = `= ${g.dice.d1 + g.dice.d2}`; } else delete $('#tray').dataset.sum;
    S.rendered = g;
    renderHUD();
    if (g.card) { await openCard(g, true); renderCard(g); }
    afterState(prev, g);
    return;
  }
  // 1. la carte precedente se referme
  if (S.card && (!g.card || g.card.id !== S.card.id)) await closeCard(false);
  // 2. des
  if (g.dice && (!prev.dice || prev.dice.id !== g.dice.id)) {
    S.rendered = { ...prev, dice: g.dice };
    renderHUD();
    delete $('#tray').dataset.sum;
    await rollTo(dice, g.dice.d1, g.dice.d2);
    $('#tray').dataset.sum = `= ${g.dice.d1 + g.dice.d2}`;
    toast(`${g.dice.by === S.me ? 'Sacaste' : `${NAME(g.dice.by)} sacó`} ${g.dice.d1} + ${g.dice.d2} = ${g.dice.d1 + g.dice.d2}`, 1600);
    await sleep(250);
  }
  // 3. deplacement du pion
  if (g.move && (!prev.move || prev.move.id !== g.move.id)) {
    const k = g.move.by;
    const small = isSmall();
    if (small) { followPawn(k, true); await sleep(380); }
    await movePawn(k, g.move.from, g.move.to, g.pos);
    if (g.move.to === R.LAST) heartBeatBig();
    if (small) { followPawn(k, false); setZoom(1); await sleep(420); }
  }
  placePawns(g.pos, g.turn);
  // 4. points gagnes
  for (const k of ['A', 'J']) {
    const d = g.score[k] - prev.score[k];
    if (d > 0) { pawnBurst(k, `+${d}`); bumpChip(k); }
  }
  S.rendered = g;
  renderHUD();
  // 5. nouvelle carte
  if (g.card && (!S.card || S.card.id !== g.card.id)) {
    highlightTile(g.card.n, true);
    await sleep(380);
    highlightTile(null, false);
    await openCard(g, false);
  }
  if (g.card) renderCard(g);
  afterState(prev, g);
}

function afterState(prev, g) {
  autoSave(prev, g);
  // c'est mon tour
  if (g.status === 'playing' && !g.card && g.turn === S.me && (!prev || prev.turn !== S.me || prev.card)) {
    sfx.play('notify');
    sfx.buzz(30);
    if (document.hidden) document.title = '💘 ¡Tu turno! — Camino del Corazón';
  }
  if (g.status === 'ended') showEnd(g); else hide('end');
}

function bumpChip(k) {
  const c = $(`#chip-${k}`);
  c.classList.remove('bump');
  void c.offsetWidth;
  c.classList.add('bump');
}

// ------------------------------------------------------------------ cartes
function cardSize() {
  const vv = window.visualViewport;
  const vw = vv ? vv.width : innerWidth;
  const vh = vv ? vv.height : innerHeight;
  let w = Math.min(420, vw * 0.9);
  let hh = Math.min(w * 1.58, vh * 0.9);
  if (hh < w * 1.25) w = Math.max(Math.min(w, hh / 1.25), Math.min(300, vw * 0.9));
  return { w, h: hh, x: (vv ? vv.offsetLeft : 0) + (vw - w) / 2, y: (vv ? vv.offsetTop : 0) + (vh - hh) / 2 };
}

function placeCardFinal() {
  const c = S.card;
  if (!c) return;
  const z = cardSize();
  Object.assign(c.flyer.style, { left: z.x + 'px', top: z.y + 'px', width: z.w + 'px', height: z.h + 'px' });
}

function sourceRect(n) {
  if (n === R.LAST) {
    const s = BOARD.stickers.heart;
    const r = $('.board').getBoundingClientRect();
    return { left: r.left + (s[0] / 100) * r.width, top: r.top + (s[1] / 100) * r.height, width: (s[2] / 100) * r.width, height: (s[3] / 100) * r.height };
  }
  return tileRect(n);
}

function flyTransforms(n, z) {
  const r = sourceRect(n);
  const sx = r.width / z.w, sy = r.height / z.h;
  const start = `translate(${r.left - z.x}px, ${r.top - z.y}px) scale(${sx}, ${sy})`;
  const lift = `translate(${r.left - z.x - r.width * 0.05}px, ${r.top - z.y - r.height * 0.16}px) scale(${sx * 1.1}, ${sy * 1.1})`;
  return { start, lift };
}

const EASE = 'cubic-bezier(.5,.05,.2,1)';

async function openCard(g, instant) {
  const c = g.card;
  const z = cardSize();
  const isMeta = c.n === R.LAST;
  const back = h('div', { class: 'face back' }, h('div', { class: 'card', id: 'cardBody' }));
  const front = h('div', { class: 'face front' }, h('img', { alt: '', src: isMeta ? 'assets/stickers/heart.webp' : `assets/tiles/face_${pad(c.n)}.webp` }));
  const flip = h('div', { class: 'flip' }, front, back);
  const flyer = h('div', { class: 'flyer' + (isMeta ? ' meta' : '') }, flip);
  Object.assign(flyer.style, { left: z.x + 'px', top: z.y + 'px', width: z.w + 'px', height: z.h + 'px' });
  $('#cardLayer').append(flyer);
  S.card = { id: c.id, n: c.n, flyer, flip, body: back.firstChild, sig: '', phase: '' };
  S.peek = false;
  $('#cardLayer').classList.remove('peek');
  showHole(c.n, true);
  if (isMeta) $('.stk-heart').classList.add('lifted-away');
  $('#backdrop').classList.add('on');
  document.body.classList.add('card-open');
  if (instant) { flip.style.transform = 'rotateY(180deg)'; return; }
  const { start, lift } = flyTransforms(c.n, z);
  sfx.play('flip');
  sfx.buzz(15);
  const a1 = flyer.animate([
    { transform: start }, { transform: lift, offset: 0.2 }, { transform: 'none' },
  ], { duration: 1100, easing: EASE });
  const a2 = flip.animate([
    { transform: 'rotateY(0deg)' }, { transform: 'rotateY(0deg)', offset: 0.2 }, { transform: 'rotateY(180deg)' },
  ], { duration: 1100, easing: EASE });
  flip.style.transform = 'rotateY(180deg)';
  await Promise.all([a1.finished, a2.finished]).catch(() => {});
  if (isMeta) { burst(innerWidth / 2, innerHeight * 0.35, 40); sfx.play('win'); }
}

async function closeCard(instant) {
  const c = S.card;
  if (!c) return;
  S.card = null;
  S.peek = false;
  $('#cardLayer').classList.remove('peek');
  hide('menu');
  document.activeElement && document.activeElement.blur && document.activeElement.blur();
  $('#backdrop').classList.remove('on');
  document.body.classList.remove('card-open');
  if (!instant) {
    const z = { x: parseFloat(c.flyer.style.left), y: parseFloat(c.flyer.style.top), w: parseFloat(c.flyer.style.width), h: parseFloat(c.flyer.style.height) };
    const { start, lift } = flyTransforms(c.n, z);
    sfx.play('close');
    const a1 = c.flyer.animate([
      { transform: 'none' }, { transform: lift, offset: 0.78 }, { transform: start },
    ], { duration: 950, easing: EASE, fill: 'forwards' });
    const a2 = c.flip.animate([
      { transform: 'rotateY(180deg)' }, { transform: 'rotateY(0deg)', offset: 0.78 }, { transform: 'rotateY(0deg)' },
    ], { duration: 950, easing: EASE, fill: 'forwards' });
    await Promise.all([a1.finished, a2.finished]).catch(() => {});
  }
  c.flyer.remove();
  showHole(c.n, false);
  if (c.n === R.LAST) $('.stk-heart').classList.remove('lifted-away');
  else if (!instant) settleTile(c.n);
}

// signature de ce qui change l'affichage (hors indicateur de frappe)
function sigOf(g) {
  const c = { ...g.card };
  delete c.typing;
  return JSON.stringify([c, g.mg || null]);
}

async function renderCard(g) {
  const oc = S.card;
  if (!oc || !g.card || oc.id !== g.card.id) return;
  const sig = sigOf(g);
  if (sig === oc.sig) { tickTyping(); return; }
  const prevPhase = oc.phase;
  oc.sig = sig;
  oc.phase = g.card.phase;
  // roulette du minijeu, une seule fois par minijeu
  if (g.card.phase === 'mg' && g.mg && !S.seenMg[g.mg.id]) {
    S.seenMg[g.mg.id] = true;
    oc.spinning = true;
    clear(oc.body);
    oc.body.append(cardHead(g), h('div', { class: 'card-main', id: 'mgHost' }));
    await roulette($('#mgHost'), g.mg.type);
    oc.spinning = false;
    oc.sig = '';
    const latest = S.rendered && S.rendered.card && S.rendered.card.id === g.card.id ? S.rendered : g;
    return renderCard(latest);
  }
  if (oc.spinning) return;
  if (g.mg) S.seenMg[g.mg.id] = true;
  // garder le minijeu en place (reflejos) : seul son contenu change
  if (g.card.phase === 'mg' && prevPhase === 'mg' && $('#mgHost', oc.body)) {
    renderMG($('#mgHost', oc.body), g, mgCtx());
    return;
  }
  clear(oc.body);
  oc.body.append(...cardView(g));
  oc.body.scrollTop = 0;
  if (g.card.phase === 'result' && prevPhase !== 'result') celebrate(g);
  if (g.card.phase === 'rescue' && prevPhase !== 'rescue') { sfx.play('bad'); sfx.buzz([20, 60, 20]); }
  const ta = oc.body.querySelector('textarea, input.inp');
  if (ta && !matchMedia('(pointer: coarse)').matches) setTimeout(() => ta.focus(), 50);
}

function celebrate(g) {
  const p = g.card.pts || {};
  const r = S.card.flyer.getBoundingClientRect();
  if (Object.values(p).some((v) => v > 0)) {
    burst(r.left + r.width / 2, r.top + r.height * 0.4, 26);
    sfx.play('good');
    sfx.buzz([20, 40, 20]);
  } else sfx.play('bad');
}

function mgCtx() {
  return {
    me: S.me,
    now: net.now,
    act: (action, val) => net.act((g) => R.mgAct(g, S.me, action, val)),
  };
}

function cardHead(g) {
  const c = g.card;
  const t = BOARD.tiles[c.n];
  const badge = c.type === 'vr' && c.vr ? { text: c.vr === 'verdad' ? 'Verdad' : 'Reto', cls: 'b-vr' } : TYPE_BADGE[c.type] || { text: '', cls: '' };
  // l'intitule de la case n'est repete en titre que s'il differe de la question
  const sameAsQ = ['sincero', 'foto', 'back2'].includes(c.type) && c.phase !== 'mg';
  return h('div', { class: 'card-head' },
    h('span', { class: `badge ${badge.cls}`, text: badge.text }),
    sameAsQ ? null : h('div', { class: 'card-tile', text: c.type === 'meta' ? 'META' : t.label }),
    h('span', { class: `who tok tok-${c.by}`, text: c.by, title: NAME(c.by) }));
}

/** Bouton qui execute une regle dans une transaction. */
function actBtn(label, fn, cls = '') {
  const b = h('button', { class: `btn ${cls}`, text: label });
  b.addEventListener('click', async () => {
    sfx.unlock();
    b.disabled = true;
    const ok = await net.act(fn);
    if (!ok) b.disabled = false;
  });
  return b;
}

function textBox(placeholder, onType) {
  const ta = h('textarea', { class: 'ta', rows: '3', maxlength: '600', placeholder });
  ta.addEventListener('input', () => {
    const t = Date.now();
    if (t - S.typingAt > 2500) { S.typingAt = t; onType && onType(); }
  });
  return ta;
}

const typingPing = () => net.act((g) => R.setTyping(g, S.me, net.now()));

function waitLine(text) {
  return h('div', { class: 'wait' }, h('span', { class: 'dots' }, h('i'), h('i'), h('i')), h('span', { text }));
}

function answerBubble(g) {
  const c = g.card;
  if (c.photo) {
    const img = h('img', { class: 'photo', alt: 'foto' });
    net.loadPhoto(c.photo).then((u) => { if (u) img.src = u; });
    return h('div', { class: 'answer photo-wrap' }, img, c.answer ? h('p', { text: c.answer }) : null);
  }
  if (c.vr === 'reto') return h('div', { class: 'answer' }, h('p', { text: c.answer ? `«${c.answer}»` : `${NAME(c.by)} dice que cumplió el reto 💪` }));
  return h('div', { class: 'answer' }, h('small', { text: `Respuesta de ${NAME(c.by)}:` }), h('p', { text: `«${c.answer || '…'}»` }));
}

function questionBlock(g) {
  const c = g.card;
  const isL = S.me === c.by;
  const L = NAME(c.by), O = NAME(other(c.by));
  if (c.type === 'adivina') {
    return h('div', { class: 'card-q' },
      h('small', { text: isL ? `Adivina la respuesta de ${O}` : `${L} tiene que adivinar tu respuesta` }),
      h('p', { class: 'q', text: c.q }));
  }
  if (c.type === 'vr') {
    return h('div', { class: 'card-q' },
      h('small', { text: c.author ? `✍️ Pregunta escrita por ${NAME(c.author)} en la partida anterior` : c.vr === 'reto' ? (isL ? 'Tu reto:' : `El reto de ${L}:`) : (isL ? 'Responde con la verdad:' : `${L} tiene que responder con la verdad:`) }),
      h('p', { class: 'q', text: c.q }));
  }
  if (c.type === 'libre') {
    return h('div', { class: 'card-q' },
      h('small', { text: isL ? `${O} te pregunta:` : `Le preguntaste a ${L}:` }),
      h('p', { class: 'q', text: c.q }));
  }
  return h('div', { class: 'card-q' },
    h('small', { text: isL ? `${O} te pregunta:` : `Le preguntas a ${L}:` }),
    h('p', { class: 'q', text: c.q }));
}

function cardView(g) {
  const c = g.card;
  const me = S.me;
  const isL = me === c.by;
  const L = NAME(c.by), O = NAME(other(c.by));
  const head = cardHead(g);
  const main = h('div', { class: 'card-main' });
  const foot = h('div', { class: 'card-foot' });
  const typing = h('div', { class: 'typing', id: 'typing' });

  switch (c.phase) {
    case 'vr':
      main.append(h('div', { class: 'big-emoji', text: '🤫🔥' }));
      if (isL) {
        main.append(h('p', { class: 'lead', text: '¿Qué eliges?' }));
        foot.append(actBtn('🤫 Verdad', (x) => R.chooseVR(x, me, 'verdad'), 'v'), actBtn('🔥 Reto', (x) => R.chooseVR(x, me, 'reto'), 'r'));
      } else main.append(waitLine(`${L} está eligiendo: ¿verdad o reto?`));
      break;

    case 'ask':
      main.append(h('div', { class: 'big-emoji', text: '❓' }));
      if (!isL) {
        const ta = textBox(`Tu pregunta para ${L}…`, typingPing);
        main.append(h('p', { class: 'lead', text: `Pregúntale lo que quieras a ${L}:` }), ta);
        foot.append(actBtn('Preguntar 💬', (x) => R.ask(x, me, ta.value)));
      } else main.append(waitLine(`${O} está escribiendo una pregunta para ti…`), typing);
      break;

    case 'answer': {
      main.append(questionBlock(g));
      if (c.type === 'foto') {
        if (isL) {
          const preview = h('img', { class: 'photo', alt: '', hidden: true });
          let data = '';
          const file = h('input', { type: 'file', accept: 'image/*', capture: 'user', hidden: true });
          const send = h('button', { class: 'btn', text: 'Enviar la foto 📤', disabled: true });
          const take = h('button', { class: 'btn ghost', text: '📸 Hacer la foto', onclick: () => file.click() });
          file.addEventListener('change', async () => {
            const f = file.files && file.files[0];
            if (!f) return;
            take.textContent = '⏳ Preparando…';
            data = await shrinkPhoto(f);
            preview.src = data;
            preview.hidden = false;
            take.textContent = '📸 Otra foto';
            send.disabled = false;
          });
          send.addEventListener('click', async () => {
            if (!data) return;
            send.disabled = true;
            send.textContent = '⏳ Enviando…';
            const id = c.id;
            await net.savePhoto(id, data);
            const ok = await net.act((x) => R.answer(x, me, { photo: id }));
            if (!ok) { send.disabled = false; send.textContent = 'Enviar la foto 📤'; }
          });
          main.append(preview, file);
          foot.append(take, send);
        } else main.append(waitLine(`${L} se está sacando una foto… 🤪`));
      } else if (c.vr === 'reto') {
        if (isL) {
          const ta = textBox('Un comentario (opcional)…');
          ta.rows = 2;
          main.append(h('p', { class: 'lead', text: 'Cumple el reto y luego confírmalo:' }), ta);
          foot.append(actBtn('💪 ¡Hecho!', (x) => R.answer(x, me, { text: ta.value })));
        } else main.append(waitLine(`Mira bien a ${L}… 👀`));
      } else if (isL) {
        const ta = textBox(c.type === 'adivina' ? 'Tu respuesta…' : 'Responde con sinceridad…', typingPing);
        main.append(ta);
        foot.append(actBtn('Enviar ✨', (x) => (ta.value.trim() ? R.answer(x, me, { text: ta.value }) : null)));
      } else {
        main.append(waitLine(c.type === 'adivina' ? `${L} está pensando… ¡ten tu respuesta en mente!` : `${L} está respondiendo…`), typing);
      }
      break;
    }

    case 'judge':
      main.append(questionBlock(g), answerBubble(g));
      if (!isL) {
        const qtxt = c.type === 'adivina' ? '¿Acertó?' : c.vr === 'reto' ? '¿Cumplió el reto?' : c.type === 'foto' ? '¿Vale la cara divertida?' : '¿Te convence su respuesta?';
        main.append(h('p', { class: 'lead', text: qtxt }));
        foot.append(actBtn('✗ No', (x) => R.judge(x, me, false), 'no'), actBtn('✓ ¡Sí!', (x) => R.judge(x, me, true), 'yes'));
      } else main.append(waitLine(`Esperando el veredicto de ${O}…`));
      break;

    case 'rescue':
      main.append(questionBlock(g), answerBubble(g), h('div', { class: 'verdict ko', text: c.type === 'adivina' ? '✗ No acertó' : '✗ No vale' }));
      if (!isL) {
        main.append(h('p', { class: 'lead', text: `¿Le das a ${L} una oportunidad de recuperar el punto?` }),
          h('p', { class: 'note', text: `Minijuego al azar: si ${L} gana, recupera el punto. Si pierde, tú ganas 3 puntos.` }));
        foot.append(actBtn('No, seguimos', (x) => R.rescue(x, me, false), 'ghost'),
          actBtn('🎲 ¡Minijuego!', (x) => R.rescue(x, me, true, R.MG_TYPES[Math.floor(Math.random() * R.MG_TYPES.length)])));
      } else main.append(waitLine(`${O} decide si te propone un minijuego…`));
      break;

    case 'mg': {
      const host = h('div', { id: 'mgHost' });
      main.append(host);
      renderMG(host, g, mgCtx());
      break;
    }

    case 'back2':
      main.append(h('div', { class: 'big-emoji wobble', text: '😜' }), h('p', { class: 'lead', text: '¡Retrocede 2 casillas!' }),
        h('p', { class: 'note', text: isL ? 'Y responde la casilla donde caigas.' : `${L} retrocede y responde la casilla donde caiga.` }));
      if (isL) foot.append(actBtn('⬅️ Retroceder', (x) => R.back2(x, me)));
      else main.append(waitLine(`Esperando a ${L}…`));
      break;

    case 'meta': {
      const ends = g.endMode === 'first' || g.done[other(c.by)];
      main.append(h('div', { class: 'big-emoji beat', text: '💘' }),
        h('p', { class: 'lead', text: `¡${L} llegó al corazón!` }),
        h('p', { class: 'note', text: ends ? 'Es el final del camino… ¡veamos los puntos!' : `${O} sigue jugando hasta llegar también.` }));
      foot.append(actBtn('Continuar ➜', (x) => R.cont(x, me)));
      break;
    }

    case 'result': {
      const p = c.pts || {};
      const win = Object.entries(p).find(([, v]) => v > 0);
      if (c.answer || c.photo || c.vr) main.append(questionBlock(g), answerBubble(g));
      if (g.mg) main.append(h('div', { class: 'verdict mg', text: mgSummary(g.mg) }));
      else main.append(h('div', { class: `verdict ${c.ok ? 'ok' : 'ko'}`, text: c.ok ? (c.type === 'adivina' ? '✓ ¡Acertó!' : '✓ ¡Vale!') : '✗ Sin punto' }));
      main.append(h('div', { class: 'points ' + (win ? 'pos' : 'zero') },
        win ? h('span', { text: `+${win[1]} punto${win[1] > 1 ? 's' : ''} para ${NAME(win[0])}` }) : h('span', { text: 'Sin puntos esta vez' }),
        win ? h('span', { class: `tok tok-${win[0]}`, text: win[0] }) : null));
      foot.append(actBtn('Continuar ➜', (x) => R.cont(x, me)));
      break;
    }
    default:
      main.append(h('p', { text: '…' }));
  }
  return [head, main, foot];
}

function tickTyping() {
  const el = document.getElementById('typing');
  const g = S.rendered || S.game;
  if (!el || !g || !g.card) return;
  const t = g.card.typing;
  const on = t && t.by !== S.me && net.now() - t.at < 5000;
  el.textContent = on ? '✍️ escribiendo…' : '';
}

async function shrinkPhoto(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
  const max = 720;
  const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const cv = document.createElement('canvas');
  cv.width = Math.round(img.naturalWidth * k);
  cv.height = Math.round(img.naturalHeight * k);
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
  URL.revokeObjectURL(url);
  return cv.toDataURL('image/jpeg', 0.74);
}

// ------------------------------------------------------------------ effets
export function burst(x, y, n = 20) {
  const fx = $('#fxTop');
  const glyphs = ['❤', '♥', '❣', '✦'];
  for (let i = 0; i < n; i++) {
    const el = h('span', { class: 'confetti', text: glyphs[i % glyphs.length] });
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.color = ['#f2588c', '#e2574e', '#f5b64a', '#ff8fb1', '#d76357'][i % 5];
    el.style.fontSize = 12 + Math.random() * 18 + 'px';
    fx.append(el);
    const a = Math.random() * Math.PI * 2;
    const d = 80 + Math.random() * 170;
    el.animate([
      { transform: 'translate(-50%,-50%) scale(.3) rotate(0)', opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d - 40}px)) scale(1) rotate(${rint(-90, 90)}deg)`, opacity: 1, offset: 0.6 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * d * 1.2}px), calc(-50% + ${Math.sin(a) * d + 120}px)) scale(.8) rotate(${rint(-180, 180)}deg)`, opacity: 0 },
    ], { duration: 1300 + Math.random() * 600, easing: 'cubic-bezier(.2,.7,.3,1)' }).finished.then(() => el.remove());
  }
}

let toastT = 0;
function toast(text, ms = 2200) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('on'), ms);
}

// ------------------------------------------------------------------ ecrans
function screen(id, ...content) {
  let el = document.getElementById('scr-' + id);
  if (!el) {
    el = h('div', { class: 'screen', id: 'scr-' + id });
    document.body.append(el);
  }
  clear(el);
  el.append(h('div', { class: 'sheet' }, ...content));
  // pas de requestAnimationFrame : il ne se declenche pas si l'onglet est en arriere-plan
  void el.offsetWidth;
  el.classList.add('on');
  return el;
}
function hide(id) {
  const el = document.getElementById('scr-' + id);
  if (el) el.classList.remove('on');
}
const closeBtn = (id) => h('button', { class: 'x', 'aria-label': 'Cerrar', text: '✕', onclick: () => hide(id) });

function showRoomScreen() {
  const key = uid(22);
  const go = () => {
    S.roomKey = key;
    store('room', key);
    writeHash();
    hide('room');
    start();
    showWho();
  };
  screen('room',
    h('div', { class: 'logo', text: '♥' }),
    h('h1', { text: 'Camino del Corazón' }),
    h('p', { text: 'Para jugar juntos, cada uno abre su propio enlace. Si ya te pasaron un enlace, ábrelo directamente.' }),
    h('button', { class: 'btn big', text: 'Crear nuestra sala 💘', onclick: go }));
}

function showWho() {
  const pickMe = (k) => {
    S.me = k;
    store('me', k);
    writeHash();
    net.presence(k);
    hide('who');
    sfx.unlock();
    if (S.room) onRoom(S.room);
  };
  screen('who',
    h('h1', { text: '¿Quién eres?' }),
    h('div', { class: 'who-pick' },
      ...['A', 'J'].map((k) => h('button', { class: 'who-btn', onclick: () => pickMe(k) },
        h('span', { class: `tok big tok-${k}`, text: k }), h('b', { text: NAME(k) })))),
    h('p', { class: 'note', text: 'Tu teléfono lo recordará. Puedes cambiarlo en el menú ☰.' }));
}

function showLobby() {
  const g = S.game;
  let first = 'rand';
  let endMode = (g && g.endMode) || 'both';
  const seg = (opts, get, set) => {
    const wrap = h('div', { class: 'seg' });
    const draw = () => {
      clear(wrap);
      for (const [v, label] of opts) wrap.append(h('button', { class: get() === v ? 'on' : '', text: label, onclick: () => { set(v); draw(); } }));
    };
    draw();
    return wrap;
  };
  const deckA = g ? (g.deck.A.length + g.newq.A.length) : 0;
  const deckJ = g ? (g.deck.J.length + g.newq.J.length) : 0;
  const playing = g && g.status === 'playing';
  screen('lobby',
    S.game ? h('button', { class: 'x', 'aria-label': 'Cerrar', text: '✕', onclick: () => { S.lobbyForced = false; hide('lobby'); if (S.game) push(S.game); } }) : null,
    h('div', { class: 'logo', text: '♥' }),
    h('h1', { text: 'Nueva partida' }),
    playing ? h('p', { class: 'warn', text: '⚠️ Hay una partida en curso: se guardará en el archivo y empezará una nueva.' }) : null,
    h('label', { text: '¿Quién empieza?' }),
    seg([['A', NAME('A')], ['rand', 'Al azar 🎲'], ['J', NAME('J')]], () => first, (v) => { first = v; }),
    h('label', { text: '¿Cuándo termina?' }),
    seg([['both', 'Cuando los dos llegan'], ['first', 'Cuando llega el primero']], () => endMode, (v) => { endMode = v; }),
    (deckA || deckJ) ? h('p', { class: 'note', text: `Preguntas nuevas para «Verdad»: ${deckA} de ${NAME('A')} · ${deckJ} de ${NAME('J')}` }) : null,
    h('button', {
      class: 'btn big', text: '¡Empezar! 💘', onclick: async (e) => {
        e.currentTarget.disabled = true;
        sfx.unlock();
        const f = first === 'rand' ? (Math.random() < 0.5 ? 'A' : 'J') : first;
        if (S.game && S.game.log.length) await net.archive(S.game);
        await net.writeGame(R.newGame(S.game, { endMode, first: f }));
        S.lobbyForced = false;
        hide('lobby');
        hide('end');
        toast(`¡Empieza ${NAME(f)}!`, 2400);
      },
    }));
}

function showEnd(g) {
  const key = g.id + ':' + g.newq[S.me].length + ':' + g.newq[other(S.me)].length;
  if (S.endShownFor === key && document.getElementById('scr-end')?.classList.contains('on')) return;
  const first = S.endShownFor.split(':')[0] !== g.id;
  S.endShownFor = key;
  const a = g.score.A, j = g.score.J;
  const winner = a === j ? '' : a > j ? 'A' : 'J';
  const mine = g.newq[S.me];
  // on garde ce qui est en cours de saisie si l'ecran se redessine
  const typed = $$('#scr-end input.inp').map((i) => i.value);
  const inputs = [0, 1, 2, 3, 4].map((i) => h('input', { class: 'inp', type: 'text', maxlength: '200', placeholder: `Pregunta ${i + 1}`, value: (typed[i] != null && !first ? typed[i] : mine[i]) || '' }));
  const theirs = g.newq[other(S.me)];
  screen('end',
    h('div', { class: 'logo beat', text: '💘' }),
    h('h1', { text: winner ? `¡Gana ${NAME(winner)}!` : '¡Empate de amor!' }),
    h('div', { class: 'final-scores' },
      ...['A', 'J'].map((k) => h('div', { class: 'fs' + (winner === k ? ' win' : '') }, h('span', { class: `tok big tok-${k}`, text: k }), h('b', { text: g.score[k] }), h('small', { text: NAME(k) })))),
    h('button', { class: 'btn ghost', text: '📜 Ver todas nuestras respuestas', onclick: showHistory }),
    h('h2', { text: 'Al final, cada uno crea 5 preguntas nuevas' }),
    h('p', { class: 'note', text: `Aparecerán en la próxima partida cuando ${NAME(other(S.me))} elija «Verdad».` }),
    ...inputs,
    h('button', {
      class: 'btn', text: mine.length ? '✓ Guardadas — actualizar' : 'Guardar mis preguntas', onclick: async (e) => {
        const b = e.currentTarget;
        b.disabled = true;
        const ok = await net.act((x) => R.setNewQ(x, S.me, inputs.map((i) => i.value)));
        b.disabled = false;
        if (ok) toast('¡Preguntas guardadas! 💌');
      },
    }),
    h('p', { class: 'note', text: theirs.length ? `${NAME(other(S.me))} ya escribió sus ${theirs.length} preguntas ✓` : `${NAME(other(S.me))} todavía está escribiendo sus preguntas…` }),
    h('button', { class: 'btn big', text: 'Nueva partida 🎲', onclick: openLobby }));
  if (first) {
    sfx.play('win');
    setTimeout(() => burst(innerWidth / 2, innerHeight * 0.3, 50), 200);
  }
}

function showHistory() {
  const g = S.rendered || S.game;
  const list = h('div', { class: 'hist' });
  const log = g ? [...g.log].reverse() : [];
  if (!log.length) list.append(h('p', { class: 'note', text: 'Todavía no hay respuestas.' }));
  for (const l of log) {
    const t = BOARD.tiles[l.n];
    const pts = Object.entries(l.pts || {}).filter(([, v]) => v > 0).map(([k, v]) => `+${v} ${PLAYERS[k].short}`).join(' ');
    const item = h('div', { class: 'hist-item' },
      h('div', { class: 'hist-top' }, h('span', { class: `tok tok-${l.by}`, text: l.by }), h('b', { text: t.label }), h('span', { class: 'pts', text: pts || '—' })),
      l.q && l.q !== t.label ? h('div', { class: 'hist-q', text: l.q }) : null,
      l.a ? h('div', { class: 'hist-a', text: `«${l.a}»` }) : null,
      h('small', { class: l.ok ? 'ok' : 'ko', text: l.ok ? '✓ vale' : l.skip ? '⏭️ carta cerrada' : l.mg ? mgLine(l) : '✗ no vale' }));
    if (l.photo) {
      const img = h('img', { class: 'photo small', alt: 'foto' });
      net.loadPhoto(l.photo).then((u) => { if (u) img.src = u; });
      item.insertBefore(img, item.lastChild);
    }
    list.append(item);
  }
  screen('hist', closeBtn('hist'), h('h1', { text: 'Nuestras respuestas' }), list);
}

function showRules() {
  screen('rules', closeBtn('rules'), h('h1', { text: 'Reglas' }),
    h('div', { class: 'rules' }, ...RULES.map(([i, t]) => h('div', { class: 'rule' }, h('span', { text: i }), h('p', { text: t })))));
}

// ------------------------------------------------------------------ menu d'options
function setPeek(on) {
  S.peek = !!on && !!S.card;
  $('#cardLayer').classList.toggle('peek', S.peek);
  document.body.classList.toggle('card-open', !!S.card && !S.peek);
}

const opt = (icon, label, sub, fn, cls = '') => h('button', { class: `opt ${cls}`, onclick: fn },
  h('span', { class: 'i', text: icon }), h('span', { class: 'opt-t' }, h('b', { text: label }), sub ? h('small', { text: sub }) : null));

function confirmBox(title, text, okLabel, fn, danger = false) {
  screen('confirm',
    h('div', { class: 'logo', text: danger ? '⚠️' : '💭' }),
    h('h1', { text: title }),
    text ? h('p', { class: 'note', text }) : null,
    h('div', { class: 'row' },
      h('button', { class: 'btn ghost', text: 'Cancelar', onclick: () => hide('confirm') }),
      h('button', {
        class: `btn ${danger ? 'no' : ''}`, text: okLabel, onclick: async (e) => {
          e.currentTarget.disabled = true;
          try { await fn(); } finally { hide('confirm'); }
        },
      })));
}

function showMenu() {
  sfx.unlock();
  const g = S.game;
  const o = S.me ? other(S.me) : 'A';
  const copy = async () => {
    const url = shareLink(o);
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ title: 'Camino del Corazón', url });
      else { await navigator.clipboard.writeText(url); toast('Enlace copiado ✓'); }
    } catch (e) { /* annule */ }
  };
  const go = (fn) => () => { hide('menu'); fn(); };
  const list = h('div', { class: 'opt-list' });
  if (S.card) {
    list.append(
      opt('🃏', 'Volver a la carta', null, go(() => setPeek(false))),
      opt('👀', 'Ver el tablero', 'La carta te espera: un toque abajo para volver', go(() => setPeek(true))));
  }
  list.append(
    opt('📜', 'Nuestras respuestas', null, go(showHistory)),
    opt('📖', 'Reglas', null, go(showRules)),
    opt(sfx.isMuted() ? '🔊' : '🔇', sfx.isMuted() ? 'Activar el sonido' : 'Silenciar', null, go(toggleSound)),
    opt('🔗', `Enviar su enlace a ${NAME(o)}`, null, copy),
    opt('👤', `Soy ${S.me ? NAME(S.me) : '…'}`, 'Cambiar de jugador en este aparato', go(showWho)));

  if (S.me === 'J') {
    list.append(h('div', { class: 'opt-sec' }, h('span', { text: 'Opciones de Jaemeson' })));
    if (g && g.card) {
      list.append(opt('⏭️', 'Cerrar esta carta sin puntos', 'Si una carta se quedó trabada', go(() => confirmBox(
        '¿Cerrar la carta?', 'Nadie gana puntos y pasa el turno.', 'Cerrar la carta', () => net.act((x) => R.skipCard(x))))));
    }
    if (g && g.status === 'playing' && !g.card) {
      const t = other(g.turn);
      if (!g.done[t]) list.append(opt('🔁', `Dar el turno a ${NAME(t)}`, null, go(() => net.act((x) => R.setTurn(x, t)))));
    }
    list.append(
      opt('↩️', 'Deshacer el último turno', 'Vuelve al turno guardado anterior', go(undoLast)),
      opt('💾', 'Partidas guardadas', 'Se guarda sola a cada turno', go(showSaves)));
    if (g) for (const k of ['A', 'J']) list.append(adjustRow(k));
    list.append(opt('🔄', 'Reiniciar la partida', 'Se guarda antes, se puede recuperar', go(() => confirmBox(
      '¿Reiniciar la partida?', 'La partida actual queda guardada en «Partidas guardadas».', 'Reiniciar', resetGame, true)), 'danger'));
  }
  screen('menu', closeBtn('menu'), h('h1', { text: 'Opciones' }), list);
}

function adjustRow(k) {
  const val = h('b', { class: 'adj-v', text: String(S.game ? S.game.score[k] : 0) });
  const step = (d) => async () => {
    const ok = await net.act((x) => R.adjustScore(x, k, d));
    if (ok && S.game) val.textContent = String(S.game.score[k]);
  };
  return h('div', { class: 'adjust' },
    h('span', { class: `tok tok-${k}`, text: k }), h('span', { class: 'adj-n', text: `Puntos de ${NAME(k)}` }),
    h('button', { 'aria-label': 'menos', text: '−', onclick: step(-1) }), val,
    h('button', { 'aria-label': 'más', text: '+', onclick: step(1) }));
}

// ------------------------------------------------------------------ sauvegardes
function autoSave(prev, g) {
  try {
    if (!prev || prev.id !== g.id || (prev.rk || '') !== (g.rk || '')) {
      if ((g.n || 0) === 0) net.saveSnapshot(g, 'Inicio de la partida');
      return;
    }
    if (g.status === 'ended' && prev.status !== 'ended') { net.saveSnapshot(g, 'Fin de la partida'); return; }
    if (prev.card && !g.card && g.log.length) {
      const l = g.log[g.log.length - 1];
      net.saveSnapshot(g, `Turno ${g.log.length} · ${NAME(l.by)} en «${BOARD.tiles[l.n].label}»`);
    }
  } catch (e) { console.warn('sauvegarde', e); }
}

const fmtDate = (t) => new Date(t).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

async function restoreSave(s) {
  if (S.game) await net.saveSnapshot(S.game, 'Antes de restaurar', 'pre');
  await net.writeGame(R.restored(s.game));
  hide('saves');
  toast('Partida restaurada ✓');
}

async function undoLast() {
  const g = S.game;
  if (!g) return;
  const saves = (await net.listSaves(20)).filter((s) => s.gid === g.id && !/_(pre|reset)$/.test(s.key) && s.n < (g.n || 0));
  const target = saves[0];
  if (!target) { toast('No hay un turno anterior guardado'); return; }
  confirmBox('¿Deshacer?', `Volver a: ${target.label || 'copia guardada'} (${fmtDate(target.at)}). Marcador ${PLAYERS.A.short} ${target.score.A || 0} – ${target.score.J || 0} ${PLAYERS.J.short}.`, 'Deshacer', () => restoreSave(target));
}

async function showSaves() {
  const list = h('div', { class: 'saves' }, h('p', { class: 'note', text: 'Cargando…' }));
  screen('saves', closeBtn('saves'), h('h1', { text: 'Partidas guardadas' }),
    h('p', { class: 'note', text: 'Una copia por turno, la más reciente arriba. Restaurar no borra nada: el estado actual también se guarda.' }), list);
  const saves = await net.listSaves(30);
  clear(list);
  if (!saves.length) list.append(h('p', { class: 'note', text: 'Todavía no hay copias guardadas.' }));
  for (const s of saves) {
    const cur = S.game && s.gid === S.game.id && s.n === S.game.n;
    list.append(h('div', { class: 'save-item' + (cur ? ' cur' : '') },
      h('div', { class: 'save-t' },
        h('b', { text: s.label || 'Copia guardada' }),
        h('small', { text: `${fmtDate(s.at)} · ${PLAYERS.A.short} ${s.score.A || 0} – ${s.score.J || 0} ${PLAYERS.J.short} · casillas ${s.pos.A || 0} / ${s.pos.J || 0}${s.status === 'ended' ? ' · terminada' : ''}` })),
      cur ? h('span', { class: 'save-cur', text: 'actual' }) : h('button', {
        class: 'btn ghost small', text: 'Restaurar',
        onclick: () => confirmBox('¿Restaurar?', `${s.label || ''} — ${fmtDate(s.at)}`, 'Restaurar', () => restoreSave(s)),
      })));
  }
}

async function resetGame() {
  if (S.game) {
    await net.saveSnapshot(S.game, 'Antes de reiniciar', 'reset');
    if (S.game.log.length) await net.archive(S.game);
  }
  openLobby();
}

// outils de test, seulement en local
if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
  window.__cdc = {
    S, R, net,
    roll: (d1, d2) => net.act((g) => R.roll(g, S.me, d1, d2)),
    rescue: (t) => net.act((g) => R.rescue(g, S.me, true, t)),
    idle: () => !S.running && !S.pending && !(S.card && S.card.spinning),
  };
}

boot();
