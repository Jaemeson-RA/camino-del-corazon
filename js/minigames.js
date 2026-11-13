// Interface des minijeux (affiches dans la carte retournee).
// La logique est dans rules.js (mgAct) ; ici on dessine et on envoie les actions.
import { h, clear, sleep, pick, plain } from './util.js?v=202611122242';
import { PLAYERS, MINIJUEGOS } from './content.js?v=202611122242';
import { HANG_MAX, NUM_MAX, hangLetters, randomWord, MG_TYPES } from './rules.js?v=202611122242';
import { play } from './sfx.js?v=202611122242';

const HAND = { piedra: '✊', papel: '✋', tijera: '✌️' };
const HAND_NAME = { piedra: 'Piedra', papel: 'Papel', tijera: 'Tijera' };
const local = {}; // etat local par minijeu (reflejos)

const nameOf = (m, role) => PLAYERS[role === 'L' ? m.L : m.O].short;
const keyOf = (m, role) => (role === 'L' ? m.L : m.O);

/** Roulette qui tourne sur les noms des jeux puis s'arrete sur le bon. */
export async function roulette(el, type) {
  clear(el);
  const wheel = h('div', { class: 'roulette' });
  const label = h('div', { class: 'roulette-label' });
  wheel.append(h('div', { class: 'roulette-title', text: 'Minijuego al azar…' }), label);
  el.append(wheel);
  const seq = [];
  for (let i = 0; i < 14; i++) seq.push(MG_TYPES[i % MG_TYPES.length]);
  seq.push(type);
  for (let i = 0; i < seq.length; i++) {
    const g = MINIJUEGOS[seq[i]];
    label.textContent = `${g.icon} ${g.name}`;
    label.classList.remove('tick');
    void label.offsetWidth;
    label.classList.add('tick');
    play('tick');
    await sleep(60 + i * i * 1.6);
  }
  label.classList.add('chosen');
  play('pop');
  await sleep(750);
}

/** Dessine le minijeu. ctx = { me, act(action, val), now() } */
export function renderMG(el, g, ctx) {
  const m = g.mg;
  if (!m) return;
  const role = ctx.me === m.L ? 'L' : ctx.me === m.O ? 'O' : '';
  const info = MINIJUEGOS[m.type];
  // le jeu de reflexes garde son DOM pendant l'attente du coeur
  if (m.type === 'reflejos' && el.dataset.key === rkey(m, role)) return;
  clear(el);
  el.append(h('div', { class: 'mg-head' },
    h('div', { class: 'mg-title', text: `${info.icon} ${info.name}` }),
    h('div', { class: 'mg-rule', text: `Si ${nameOf(m, 'L')} gana, recupera el punto. Si pierde, ${nameOf(m, 'O')} gana 3 puntos.` })));
  const body = h('div', { class: `mg-body mg-${m.type}` });
  el.append(body);
  ({ ppt, ttt, ahorcado, numero, reflejos })[m.type](body, m, role, ctx, el);
}

// --------------------------------------------------------- piedra papel tijera
function ppt(body, m, role, ctx) {
  const st = m.st;
  body.append(h('div', { class: 'mg-score' },
    h('span', { class: `chip chip-${m.L}`, text: `${nameOf(m, 'L')} ${st.w.L}` }),
    h('span', { class: 'vs', text: 'al mejor de 3' }),
    h('span', { class: `chip chip-${m.O}`, text: `${st.w.O} ${nameOf(m, 'O')}` })));
  const last = st.hist[st.hist.length - 1];
  if (last) {
    const txt = last.w ? `Ronda para ${nameOf(m, last.w)}` : 'Empate, otra vez';
    body.append(h('div', { class: 'ppt-reveal' },
      h('div', { class: 'ppt-hand left' }, h('span', { text: HAND[last.L] }), h('small', { text: nameOf(m, 'L') })),
      h('div', { class: 'ppt-res', text: txt }),
      h('div', { class: 'ppt-hand right' }, h('span', { text: HAND[last.O] }), h('small', { text: nameOf(m, 'O') }))));
  }
  if (m.res) return;
  if (!role) return;
  const mine = st.p[role];
  const theirs = st.p[role === 'L' ? 'O' : 'L'];
  if (mine) {
    body.append(h('p', { class: 'mg-wait', text: `Elegiste ${HAND[mine]} ${HAND_NAME[mine]}. Esperando a ${nameOf(m, role === 'L' ? 'O' : 'L')}…` }));
  } else {
    body.append(h('p', { class: 'mg-ask', text: theirs ? `${nameOf(m, role === 'L' ? 'O' : 'L')} ya eligió 🤫 ¡Tu turno!` : 'Elige en secreto:' }));
    body.append(h('div', { class: 'ppt-choices' },
      ...Object.keys(HAND).map((k) => h('button', { class: 'ppt-btn', onclick: () => ctx.act('pick', k) },
        h('span', { text: HAND[k] }), h('small', { text: HAND_NAME[k] })))));
  }
}

// --------------------------------------------------------- ta-te-ti
function ttt(body, m, role, ctx) {
  const st = m.st;
  const myTurn = !m.res && role && st.t === role;
  body.append(h('p', { class: 'mg-ask', text: m.res ? '' : myTurn ? '¡Tu turno!' : `Turno de ${nameOf(m, st.t)}…` }));
  if (st.draws && !m.res) body.append(h('p', { class: 'mg-note', text: `Empate ${st.draws}/2 — nueva partida, empieza ${nameOf(m, st.s)}.` }));
  const grid = h('div', { class: 'ttt-grid' });
  const line = (st.line || '').split('').map(Number);
  [...st.b].forEach((c, i) => {
    const cell = h('button', { class: 'ttt-cell' + (line.includes(i) && st.line ? ' win' : ''), disabled: !myTurn || c !== '.', onclick: () => ctx.act('play', i) });
    if (c !== '.') cell.append(h('span', { class: `tok tok-${keyOf(m, c)}`, text: keyOf(m, c) }));
    grid.append(cell);
  });
  body.append(grid);
  body.append(h('div', { class: 'ttt-legend' },
    h('span', { class: `tok tok-${m.L}`, text: m.L }), h('span', { text: ` ${nameOf(m, 'L')}   ` }),
    h('span', { class: `tok tok-${m.O}`, text: m.O }), h('span', { text: ` ${nameOf(m, 'O')}` })));
}

// --------------------------------------------------------- ahorcado
function ahorcado(body, m, role, ctx) {
  const st = m.st;
  if (!st.word) {
    if (role === 'O') {
      const inp = h('input', { class: 'inp', type: 'text', maxlength: '18', placeholder: 'Palabra secreta', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false' });
      body.append(h('p', { class: 'mg-ask', text: `Elige una palabra para ${nameOf(m, 'L')} (sin que la vea):` }), inp,
        h('div', { class: 'row' },
          h('button', { class: 'btn ghost', onclick: () => ctx.act('word', randomWord()), text: '🎲 Al azar' }),
          h('button', { class: 'btn', onclick: () => ctx.act('word', inp.value), text: 'Elegir' })));
    } else body.append(h('p', { class: 'mg-wait', text: `${nameOf(m, 'O')} está eligiendo una palabra secreta…` }));
    return;
  }
  const hearts = h('div', { class: 'hang-hearts' });
  for (let i = 0; i < HANG_MAX; i++) hearts.append(h('span', { class: i < st.f ? 'broken' : '', text: i < st.f ? '💔' : '❤️' }));
  body.append(hearts);
  const word = h('div', { class: 'hang-word' });
  const reveal = !!m.res || role === 'O';
  for (const ch of st.word) {
    if (ch === ' ') { word.append(h('span', { class: 'gap' })); continue; }
    const shown = st.g.includes(plain(ch)) || reveal;
    word.append(h('span', { class: 'slot' + (shown && !st.g.includes(plain(ch)) ? ' ghost' : ''), text: shown ? ch : '' }));
  }
  body.append(word);
  if (role === 'O' && !m.res) body.append(h('p', { class: 'mg-note', text: 'Tu palabra se ve en gris: solo tú la ves.' }));
  const kb = h('div', { class: 'hang-kb' });
  const letters = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('');
  const inWord = hangLetters(st.word);
  for (const L of letters) {
    const used = st.g.includes(L);
    kb.append(h('button', {
      class: 'key' + (used ? (inWord.includes(L) ? ' hit' : ' miss') : ''),
      disabled: used || role !== 'L' || !!m.res, text: L, onclick: () => ctx.act('guess', L),
    }));
  }
  body.append(kb);
}

// --------------------------------------------------------- numero
function numero(body, m, role, ctx) {
  const st = m.st;
  if (!st.secret) {
    if (role === 'O') {
      const inp = h('input', { class: 'inp', type: 'number', min: '1', max: '100', inputmode: 'numeric', placeholder: '1 – 100' });
      body.append(h('p', { class: 'mg-ask', text: `Piensa un número del 1 al 100 para ${nameOf(m, 'L')}:` }), inp,
        h('div', { class: 'row' },
          h('button', { class: 'btn ghost', onclick: () => ctx.act('secret', 1 + Math.floor(Math.random() * 100)), text: '🎲 Al azar' }),
          h('button', { class: 'btn', onclick: () => ctx.act('secret', inp.value), text: 'Elegir' })));
    } else body.append(h('p', { class: 'mg-wait', text: `${nameOf(m, 'O')} está pensando un número…` }));
    return;
  }
  const left = NUM_MAX - st.tries.length;
  if (role === 'O' || m.res) body.append(h('p', { class: 'mg-note', text: `Número secreto: ${st.secret}` }));
  body.append(h('div', { class: 'num-left', text: m.res ? '' : `${left} intento${left > 1 ? 's' : ''}` }));
  const list = h('div', { class: 'num-tries' });
  st.tries.forEach((t) => list.append(h('div', { class: `num-try ${t.hint}` },
    h('b', { text: t.n }), h('span', { text: t.hint === 'ok' ? '¡Exacto! 🎉' : t.hint === 'up' ? 'Más alto ⬆️' : 'Más bajo ⬇️' }))));
  body.append(list);
  if (role === 'L' && !m.res) {
    const inp = h('input', { class: 'inp', type: 'number', min: '1', max: '100', inputmode: 'numeric', placeholder: 'Tu número' });
    const go = () => { if (inp.value) ctx.act('guess', inp.value); };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    body.append(h('div', { class: 'row' }, inp, h('button', { class: 'btn', onclick: go, text: 'Probar' })));
  }
}

// --------------------------------------------------------- reflejos
// cle de rendu : on ne redessine la zone que si ce qui m'est affiche change
function rkey(m, role) {
  const st = m.st;
  const mine = role ? (st.t[role] ? 1 : 0) : `${st.t.L ? 1 : 0}${st.t.O ? 1 : 0}`;
  return `${m.id}:${st.round}:${st.go ? 'go' : 'wait'}:${st.rd.L ? 1 : 0}${st.rd.O ? 1 : 0}:${mine}:${m.res || ''}`;
}

function reflejos(body, m, role, ctx, el) {
  const st = m.st;
  el.dataset.key = rkey(m, role);
  if (st.last && !m.res) {
    const f = (v) => (v === -1 ? 'salida falsa' : `${v} ms`);
    body.append(h('p', { class: 'mg-note', text: `Ronda anterior: ${nameOf(m, 'L')} ${f(st.last.L)} · ${nameOf(m, 'O')} ${f(st.last.O)} — ¡otra vez!` }));
  }
  if (m.res) {
    const f = (v) => (v === -1 ? 'salida falsa' : `${v} ms`);
    if (st.last) body.append(h('p', { class: 'mg-ask', text: `${nameOf(m, 'L')}: ${f(st.last.L)} · ${nameOf(m, 'O')}: ${f(st.last.O)}` }));
    return;
  }
  if (!st.go) {
    body.append(h('p', { class: 'mg-ask', text: 'Cuando aparezca el corazón, ¡tócalo lo más rápido posible! Si tocas antes, pierdes.' }));
    const r = h('div', { class: 'reflex-ready' });
    for (const k of ['L', 'O']) r.append(h('span', { class: 'chip' + (st.rd[k] ? ' ok' : ''), text: `${nameOf(m, k)} ${st.rd[k] ? '✓ listo' : '…'}` }));
    body.append(r);
    if (role && !st.rd[role]) body.append(h('button', { class: 'btn big', text: `¡Estoy list${PLAYERS[ctx.me].g}!`, onclick: () => ctx.act('ready', ctx.now()) }));
    return;
  }
  if (!role) { body.append(h('p', { class: 'mg-wait', text: 'Atentos…' })); return; }
  if (st.t[role]) {
    body.append(h('p', { class: 'mg-wait', text: st.t[role] === -1 ? '¡Uy! Tocaste antes de tiempo…' : `Tu tiempo: ${st.t[role]} ms. Esperando…` }));
    return;
  }
  const key = `${m.id}:${st.round}`;
  const zone = h('button', { class: 'reflex-zone', 'aria-label': 'Toca cuando aparezca el corazón' }, h('span', { class: 'rz-text', text: 'Atención…' }));
  body.append(zone);
  const L = (local[key] = local[key] || { shown: 0, sent: false });
  const fire = () => {
    if (L.sent) return;
    // l'ecran peut se redessiner : le chrono part de la PREMIERE apparition du coeur
    if (!L.shown) { L.shown = performance.now(); play('pop'); }
    zone.classList.add('go');
    zone.firstChild.textContent = '❤️';
  };
  const wait = st.go - ctx.now();
  if (wait <= 0) fire(); else setTimeout(() => { if (zone.isConnected) fire(); }, wait);
  zone.addEventListener('pointerdown', () => {
    if (L.sent) return;
    L.sent = true;
    const ms = L.shown ? Math.max(1, Math.round(performance.now() - L.shown)) : -1;
    zone.classList.add(ms === -1 ? 'false' : 'hit');
    zone.firstChild.textContent = ms === -1 ? '¡Muy pronto!' : `${ms} ms`;
    ctx.act('time', ms);
  });
}

export function mgSummary(m) {
  if (!m) return '';
  const info = MINIJUEGOS[m.type];
  const who = m.res === 'L' ? PLAYERS[m.L].short : m.res === 'O' ? PLAYERS[m.O].short : '';
  return `${info.icon} ${info.name}: ${who ? `gana ${who}` : 'empate'}`;
}

export { pick };
