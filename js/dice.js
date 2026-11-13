// Deux des 3D en CSS, avec de vrais points.
import { h, rint, reducedMotion } from './util.js?v=202611122242';
import { play, buzz } from './sfx.js?v=202611122242';

const PIPS = {
  1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9],
};
// face -> rotation du cube pour la montrer
const FACE_ROT = {
  1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180],
};
const FACE_CLASS = { 1: 'f1', 2: 'f2', 3: 'f3', 4: 'f4', 5: 'f5', 6: 'f6' };

function makeDie() {
  const cube = h('div', { class: 'die' });
  for (let f = 1; f <= 6; f++) {
    const face = h('div', { class: `die-face ${FACE_CLASS[f]}` });
    for (let i = 1; i <= 9; i++) face.append(h('i', { class: PIPS[f].includes(i) ? 'pip' : 'nopip' }));
    cube.append(face);
  }
  return h('div', { class: 'die-wrap' }, cube);
}

export function mountDice(el) {
  const a = makeDie();
  const b = makeDie();
  el.append(a, b);
  show(a, 1, false);
  show(b, 6, false);
  return { a, b };
}

function show(wrap, v, animate, spins = 2) {
  const cube = wrap.firstChild;
  const [rx, ry] = FACE_ROT[v];
  const fx = rx + 360 * spins * (Math.random() < 0.5 ? 1 : -1);
  const fy = ry + 360 * spins;
  if (!animate || reducedMotion()) {
    cube.style.transition = 'none';
    cube.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
    return Promise.resolve();
  }
  cube.style.transition = 'none';
  cube.style.transform = `rotateX(${rint(-200, 200)}deg) rotateY(${rint(-200, 200)}deg) rotateZ(${rint(-90, 90)}deg)`;
  void cube.offsetWidth;
  return new Promise((res) => {
    cube.style.transition = 'transform 1.05s cubic-bezier(.2,.75,.25,1)';
    cube.style.transform = `rotateX(${fx}deg) rotateY(${fy}deg) rotateZ(0deg)`;
    setTimeout(res, 1080);
  });
}

/** Lance l'animation jusqu'aux valeurs donnees. */
export async function rollTo(dice, d1, d2) {
  const tray = dice.a.parentElement;
  tray.classList.remove('rolled');
  tray.classList.add('rolling');
  play('dice');
  buzz([12, 40, 12, 40, 18]);
  await Promise.all([show(dice.a, d1, true, 2), show(dice.b, d2, true, 3)]);
  tray.classList.remove('rolling');
  tray.classList.add('rolled');
}

export function setDice(dice, d1, d2) {
  show(dice.a, d1 || 1, false);
  show(dice.b, d2 || 6, false);
}
