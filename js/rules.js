// Regles du jeu : fonctions pures (etat -> nouvel etat) utilisees dans les
// transactions Firebase. Chaque action renvoie le nouvel etat, ou null si
// l'action n'est pas permise (la transaction est alors abandonnee).
import { BOARD } from './board-data.js?v=202611122242';
import { VERDADES, RETOS, PALABRAS, other, fill } from './content.js?v=202611122242';
import { uid, rint, pick, plain } from './util.js?v=202611122242';

export const LAST = BOARD.tiles.length - 1; // case META
const arr = (v) => (Array.isArray(v) ? v.filter((x) => x != null) : v && typeof v === 'object' ? Object.values(v) : []);
const clone = (o) => JSON.parse(JSON.stringify(o));

/** Remet les champs manquants (Firebase efface tableaux vides et null). */
export function norm(g0) {
  if (!g0) return null;
  const g = clone(g0);
  g.pos = { A: 0, J: 0, ...(g.pos || {}) };
  g.score = { A: 0, J: 0, ...(g.score || {}) };
  g.done = { A: false, J: false, ...(g.done || {}) };
  g.log = arr(g.log);
  g.usedVR = g.usedVR || {};
  g.usedDeck = g.usedDeck || {};
  g.deck = { A: arr(g.deck && g.deck.A), J: arr(g.deck && g.deck.J) };
  g.newq = { A: arr(g.newq && g.newq.A), J: arr(g.newq && g.newq.J) };
  g.endMode = g.endMode || 'both';
  if (g.mg) {
    g.mg.st = g.mg.st || {};
    if (g.mg.type === 'ppt') {
      g.mg.st.hist = arr(g.mg.st.hist);
      g.mg.st.p = { L: '', O: '', ...(g.mg.st.p || {}) };
      g.mg.st.w = { L: 0, O: 0, ...(g.mg.st.w || {}) };
    }
    if (g.mg.type === 'numero') g.mg.st.tries = arr(g.mg.st.tries);
    if (g.mg.type === 'reflejos') {
      g.mg.st.rd = { L: false, O: false, ...(g.mg.st.rd || {}) };
      g.mg.st.t = { L: 0, O: 0, ...(g.mg.st.t || {}) };
    }
    if (g.mg.type === 'ahorcado') { g.mg.st.g = g.mg.st.g || ''; g.mg.st.f = g.mg.st.f || 0; g.mg.st.word = g.mg.st.word || ''; }
  }
  return g;
}

export function newGame(prev, { endMode = 'both', first = 'A' } = {}) {
  const p = norm(prev) || {};
  const deck = { A: [], J: [] };
  for (const k of ['A', 'J']) {
    const keep = arr(p.deck && p.deck[k]).filter((it) => it && it.t && !(p.usedDeck || {})[it.id]);
    const fresh = arr(p.newq && p.newq[k]).filter((t) => t && String(t).trim()).map((t) => ({ id: 'q' + uid(8), t: String(t).trim().slice(0, 200) }));
    deck[k] = [...keep, ...fresh];
  }
  return {
    id: 'g' + uid(8), status: 'playing', endMode, turn: first, startedAt: Date.now(),
    pos: { A: 0, J: 0 }, score: { A: 0, J: 0 }, done: { A: false, J: false },
    log: [], usedVR: {}, usedDeck: {}, deck, newq: {}, n: 0,
  };
}

function cardFor(g, n, me) {
  const t = BOARD.tiles[n];
  const c = { id: 'c' + uid(8), n, by: me, type: t.type, at: Date.now() };
  switch (t.type) {
    case 'adivina': return { ...c, phase: 'answer', q: fill(t.q, me) };
    case 'sincero':
    case 'foto': return { ...c, phase: 'answer', q: t.label };
    case 'vr': return { ...c, phase: 'vr' };
    case 'libre': return { ...c, phase: 'ask' };
    case 'back2': return { ...c, phase: 'back2' };
    case 'meta': return { ...c, phase: 'meta' };
    default: return null;
  }
}

const bump = (g) => { g.n = (g.n || 0) + 1; return g; };

export function roll(g0, me, d1, d2) {
  const g = norm(g0);
  if (!g || g.status !== 'playing' || g.turn !== me || g.card || g.done[me]) return null;
  const from = g.pos[me];
  const to = Math.min(LAST, from + d1 + d2);
  g.dice = { d1, d2, by: me, id: 'd' + uid(8) };
  g.move = { by: me, from, to, id: 'm' + uid(8), back: false };
  g.pos[me] = to;
  if (to === LAST) g.done[me] = true;
  const c = cardFor(g, to, me);
  if (c) g.card = c; else delete g.card;
  return bump(g);
}

export function chooseVR(g0, me, kind) {
  const g = norm(g0);
  const c = g && g.card;
  if (!c || c.phase !== 'vr' || c.by !== me || !['verdad', 'reto'].includes(kind)) return null;
  let text = '';
  if (kind === 'verdad') {
    // d'abord les questions ecrites par l'autre a la fin de la partie precedente
    const mine = g.deck[other(me)].find((it) => !g.usedDeck[it.id]);
    if (mine) {
      g.usedDeck[mine.id] = true;
      text = mine.t;
      c.author = other(me);
    }
  }
  if (!text) {
    const pool = kind === 'verdad' ? VERDADES : RETOS;
    let free = pool.filter(([id]) => !g.usedVR[id]);
    if (!free.length) { for (const [id] of pool) delete g.usedVR[id]; free = pool; }
    const [id, t] = pick(free);
    g.usedVR[id] = true;
    text = fill(t, me);
  }
  c.vr = kind;
  c.q = text;
  c.phase = 'answer';
  return bump(g);
}

export function ask(g0, me, text) {
  const g = norm(g0);
  const c = g && g.card;
  const t = String(text || '').trim().slice(0, 240);
  if (!c || c.phase !== 'ask' || c.by === me || !t) return null;
  c.q = t;
  c.phase = 'answer';
  return bump(g);
}

export function answer(g0, me, { text = '', photo = '' } = {}) {
  const g = norm(g0);
  const c = g && g.card;
  if (!c || c.phase !== 'answer' || c.by !== me) return null;
  c.answer = String(text).trim().slice(0, 600);
  if (photo) c.photo = photo;
  c.phase = 'judge';
  delete c.typing;
  return bump(g);
}

export function judge(g0, me, ok) {
  const g = norm(g0);
  const c = g && g.card;
  if (!c || c.phase !== 'judge' || c.by === me) return null;
  c.ok = !!ok;
  if (ok) {
    g.score[c.by] += 1;
    c.pts = { [c.by]: 1 };
    c.phase = 'result';
  } else {
    c.phase = 'rescue';
  }
  return bump(g);
}

export function rescue(g0, me, yes, type) {
  const g = norm(g0);
  const c = g && g.card;
  if (!c || c.phase !== 'rescue' || c.by === me) return null;
  if (!yes) {
    c.phase = 'result';
    c.pts = {};
    return bump(g);
  }
  g.mg = initMG(type, c.by, me);
  c.phase = 'mg';
  return bump(g);
}

export function back2(g0, me) {
  const g = norm(g0);
  const c = g && g.card;
  if (!c || c.phase !== 'back2' || c.by !== me) return null;
  const from = g.pos[me];
  const to = Math.max(0, from - 2);
  g.pos[me] = to;
  g.move = { by: me, from, to, id: 'm' + uid(8), back: true };
  const nc = cardFor(g, to, me);
  if (nc) g.card = nc; else delete g.card;
  return bump(g);
}

export function cont(g0, me) {
  const g = norm(g0);
  const c = g && g.card;
  if (!c || !['result', 'meta'].includes(c.phase)) return null;
  return endTurn(g);
}

function endTurn(g) {
  const c = g.card;
  if (c && !['back2', 'meta'].includes(c.type)) {
    g.log.push({
      n: c.n, by: c.by, type: c.type, vr: c.vr || '', q: c.q || '', a: c.answer || '',
      photo: c.photo || '', ok: !!c.ok, mg: g.mg ? g.mg.type : '', mgres: g.mg ? g.mg.res || '' : '',
      pts: c.pts || {}, author: c.author || '', skip: !!c.skipped,
    });
  }
  delete g.card;
  delete g.mg;
  const ended = g.endMode === 'first' ? (g.done.A || g.done.J) : (g.done.A && g.done.J);
  if (ended) {
    g.status = 'ended';
    g.endedAt = Date.now();
  } else {
    const o = other(g.turn);
    if (!g.done[o]) g.turn = o;
  }
  return bump(g);
}

// ------------------------------------------------------------------ options de Jaemeson
/** Ferme la carte en cours sans donner de points (carte bloquee, erreur...). */
export function skipCard(g0) {
  const g = norm(g0);
  if (!g || !g.card) return null;
  const c = g.card;
  if (c.type !== 'meta') { c.pts = {}; c.ok = false; c.skipped = true; }
  if (g.mg) g.mg.res = g.mg.res || '';
  return endTurn(g);
}

/** Corrige un score a la main (jamais sous zero). */
export function adjustScore(g0, k, delta) {
  const g = norm(g0);
  if (!g || !['A', 'J'].includes(k)) return null;
  g.score[k] = Math.max(0, g.score[k] + delta);
  return bump(g);
}

/** Donne la main a un joueur (quand aucune carte n'est ouverte). */
export function setTurn(g0, k) {
  const g = norm(g0);
  if (!g || g.status !== 'playing' || g.card || g.done[k] || g.turn === k) return null;
  g.turn = k;
  return bump(g);
}

/** Restaure une sauvegarde : nouvel identifiant de rendu pour tout redessiner sans animation. */
export function restored(save) {
  const g = norm(save);
  g.rk = 'r' + uid(8);
  g.n = (g.n || 0) + 1;
  return g;
}

export function setNewQ(g0, me, list) {
  const g = norm(g0);
  if (!g || g.status !== 'ended') return null;
  g.newq[me] = arr(list).map((t) => String(t || '').trim().slice(0, 200)).filter(Boolean).slice(0, 5);
  return bump(g);
}

export function setTyping(g0, me, ts) {
  const g = norm(g0);
  const c = g && g.card;
  if (!c || !['answer', 'ask'].includes(c.phase)) return null;
  c.typing = { by: me, at: ts };
  return g;
}

// ------------------------------------------------------------------ minijeux
export const MG_TYPES = ['ppt', 'ttt', 'ahorcado', 'numero', 'reflejos'];

export function initMG(type, lander, judgeKey) {
  const base = { id: 'x' + uid(8), type, L: lander, O: judgeKey, res: '' };
  switch (type) {
    case 'ppt': return { ...base, st: { w: { L: 0, O: 0 }, p: { L: '', O: '' }, hist: [] } };
    case 'ttt': return { ...base, st: { b: '.........', t: 'L', s: 'L', draws: 0, line: '' } };
    case 'ahorcado': return { ...base, st: { word: '', g: '', f: 0 } };
    case 'numero': return { ...base, st: { secret: 0, tries: [] } };
    case 'reflejos': return { ...base, st: { rd: { L: false, O: false }, go: 0, t: { L: 0, O: 0 }, round: 1 } };
    default: return initMG('ppt', lander, judgeKey);
  }
}

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const BEATS = { piedra: 'tijera', papel: 'piedra', tijera: 'papel' };
export const HANG_MAX = 6;
export const NUM_MAX = 6;

export function hangLetters(word) {
  return [...new Set(plain(word).replace(/[^A-ZÑ]/g, ''))];
}

/** Action dans un minijeu. role : 'L' (celui qui doit recuperer) ou 'O'. */
export function mgAct(g0, me, action, val) {
  const g = norm(g0);
  const m = g && g.mg;
  const c = g && g.card;
  if (!m || !c || c.phase !== 'mg' || m.res) return null;
  const role = me === m.L ? 'L' : me === m.O ? 'O' : null;
  if (!role) return null;
  const st = m.st;
  switch (m.type) {
    case 'ppt': {
      if (action !== 'pick' || !BEATS[val] || st.p[role]) return null;
      st.p[role] = val;
      if (st.p.L && st.p.O) {
        const w = st.p.L === st.p.O ? '' : BEATS[st.p.L] === st.p.O ? 'L' : 'O';
        st.hist.push({ L: st.p.L, O: st.p.O, w });
        if (w) st.w[w] += 1;
        st.p = { L: '', O: '' };
        if (w && st.w[w] >= 2) m.res = w;
      }
      break;
    }
    case 'ttt': {
      const i = Number(val);
      if (action !== 'play' || st.t !== role || !(i >= 0 && i < 9) || st.b[i] !== '.') return null;
      st.b = st.b.slice(0, i) + role + st.b.slice(i + 1);
      const win = LINES.find((l) => l.every((k) => st.b[k] === role));
      if (win) { m.res = role; st.line = win.join(''); }
      else if (!st.b.includes('.')) {
        st.draws += 1;
        if (st.draws >= 2) m.res = 'D';
        else { st.lastB = st.b; st.b = '.........'; st.s = st.s === 'L' ? 'O' : 'L'; st.t = st.s; }
      } else st.t = role === 'L' ? 'O' : 'L';
      break;
    }
    case 'ahorcado': {
      if (action === 'word') {
        const w = String(val || '').toUpperCase().replace(/[^A-ZÁÉÍÓÚÜÑ ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 18);
        if (role !== 'O' || st.word || hangLetters(w).length < 2) return null;
        st.word = w;
      } else if (action === 'guess') {
        const L = plain(String(val || '')).slice(0, 1);
        if (role !== 'L' || !st.word || !/[A-ZÑ]/.test(L) || st.g.includes(L)) return null;
        st.g += L;
        if (!plain(st.word).includes(L)) st.f += 1;
        if (hangLetters(st.word).every((x) => st.g.includes(x))) m.res = 'L';
        else if (st.f >= HANG_MAX) m.res = 'O';
      } else return null;
      break;
    }
    case 'numero': {
      const n = Math.round(Number(val));
      if (!(n >= 1 && n <= 100)) return null;
      if (action === 'secret') {
        if (role !== 'O' || st.secret) return null;
        st.secret = n;
      } else if (action === 'guess') {
        if (role !== 'L' || !st.secret) return null;
        const hint = n === st.secret ? 'ok' : n < st.secret ? 'up' : 'down';
        st.tries.push({ n, hint });
        if (hint === 'ok') m.res = 'L';
        else if (st.tries.length >= NUM_MAX) m.res = 'O';
      } else return null;
      break;
    }
    case 'reflejos': {
      if (action === 'ready') {
        if (st.rd[role]) return null;
        st.rd[role] = true;
        if (st.rd.L && st.rd.O) st.go = Number(val) + rint(2200, 4800);
      } else if (action === 'time') {
        const t = Math.round(Number(val));
        if (!st.go || st.t[role]) return null;
        st.t[role] = t > 0 ? t : -1;
        if (st.t.L && st.t.O) {
          const { L, O } = st.t;
          let w = '';
          if (L === -1 && O === -1) w = '';
          else if (L === -1) w = 'O';
          else if (O === -1) w = 'L';
          else if (L < O) w = 'L';
          else if (O < L) w = 'O';
          if (w) { m.res = w; st.last = { L, O }; }
          else { st.last = { L, O }; st.rd = { L: false, O: false }; st.go = 0; st.t = { L: 0, O: 0 }; st.round += 1; }
        }
      } else return null;
      break;
    }
    default: return null;
  }
  if (m.res) finishMG(g);
  return bump(g);
}

function finishMG(g) {
  const m = g.mg;
  const c = g.card;
  c.phase = 'result';
  if (m.res === 'L') { g.score[m.L] += 1; c.pts = { [m.L]: 1 }; }
  else if (m.res === 'O') { g.score[m.O] += 3; c.pts = { [m.O]: 3 }; }
  else c.pts = {};
}

export function randomWord() { return pick(PALABRAS); }
