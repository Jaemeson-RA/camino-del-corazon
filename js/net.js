// Synchro temps reel : Firebase Realtime Database (projet viaje-del-amor).
// Une partie = corazon/<cle de salle>.
// La cle n'est jamais dans le code : elle vient du lien partage (#s=...).
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getDatabase, ref, onValue, runTransaction, set, get, onDisconnect, serverTimestamp,
  query, orderByKey, limitToLast, limitToFirst, remove,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDby2S1qUHAChX_RwqPRLkU8qgpmsSvQWg',
  authDomain: 'viaje-del-amor.firebaseapp.com',
  databaseURL: 'https://viaje-del-amor-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'viaje-del-amor',
  storageBucket: 'viaje-del-amor.firebasestorage.app',
  messagingSenderId: '1022626936571',
  appId: '1:1022626936571:web:40912f37c6f05cf7b8625e',
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
let room = '';
let offset = 0;
let online = false;

onValue(ref(db, '.info/serverTimeOffset'), (s) => { offset = s.val() || 0; });

/** Heure du serveur (ms), pour synchroniser les minijeux de reflexes. */
export const now = () => Date.now() + offset;
export const isOnline = () => online;

const P = (sub = '') => `corazon/${room}${sub}`;
const clean = (o) => JSON.parse(JSON.stringify(o));

export function useRoom(key) { room = key; }

export function watchRoom(cb) {
  return onValue(ref(db, P()), (snap) => cb(snap.val() || {}));
}

export function watchConnection(cb) {
  return onValue(ref(db, '.info/connected'), (s) => { online = !!s.val(); cb(online); });
}

/** Presence : en ligne tant que l'onglet est ouvert. */
export function presence(me) {
  const r = ref(db, P(`/presence/${me}`));
  onValue(ref(db, '.info/connected'), (s) => {
    if (!s.val()) return;
    onDisconnect(r).set({ on: false, at: serverTimestamp() }).then(() => set(r, { on: true, at: serverTimestamp() }));
  });
  document.addEventListener('visibilitychange', () => {
    set(r, { on: document.visibilityState === 'visible', at: serverTimestamp() }).catch(() => {});
  });
}

/**
 * Applique une regle (fonction pure) dans une transaction sur la partie.
 * fn(etatCourant) -> nouvel etat ou null (abandon). Renvoie true si ecrit.
 */
export async function act(fn) {
  let tries = 0;
  while (tries < 2) {
    tries += 1;
    const res = await runTransaction(ref(db, P('/game')), (cur) => {
      if (cur == null) return undefined;
      const next = fn(cur);
      return next == null ? undefined : clean(next);
    }, { applyLocally: true });
    if (res.committed) return true;
    if (res.snapshot && res.snapshot.exists()) return false;
    // cache vide au premier essai : on relit puis on retente
    await get(ref(db, P('/game')));
  }
  return false;
}

export function writeGame(g) { return set(ref(db, P('/game')), clean(g)); }

export function savePhoto(id, dataUrl) { return set(ref(db, P(`-fotos/${id}`)), dataUrl); }
export async function loadPhoto(id) {
  const s = await get(ref(db, P(`-fotos/${id}`)));
  return s.val() || '';
}

// ------------------------------------------------------------------ sauvegardes
// corazon/<cle>-saves/<cle chronologique> : copie complete de la partie.
// La cle est deterministe (debut de partie + compteur d'actions) : si les deux
// telephones sauvegardent le meme instant, ils ecrivent la meme entree.
const MAX_SAVES = 60;
const pad = (n, w) => String(n).padStart(w, '0');

export function saveKey(g, tag = '') {
  return `t${pad(g.startedAt || 0, 13)}_${pad(g.n || 0, 5)}${tag ? '_' + tag : ''}`;
}

export async function saveSnapshot(g, label, tag = '') {
  if (!g || !g.id) return;
  const key = saveKey(g, tag);
  await set(ref(db, P(`-saves/${key}`)), clean({
    at: Date.now(), label: label || '', gid: g.id, n: g.n || 0,
    score: g.score || {}, pos: g.pos || {}, turn: g.turn || '', status: g.status || '', game: g,
  }));
  // menage : on garde les MAX_SAVES plus recentes
  if (Math.random() < 0.15) {
    const all = await get(query(ref(db, P('-saves')), orderByKey(), limitToFirst(40)));
    const keys = Object.keys(all.val() || {});
    const cnt = await get(query(ref(db, P('-saves')), orderByKey(), limitToLast(MAX_SAVES + 1)));
    const recent = Object.keys(cnt.val() || {});
    if (recent.length > MAX_SAVES) {
      const oldestKept = recent[recent.length - MAX_SAVES];
      for (const k of keys) if (k < oldestKept) remove(ref(db, P(`-saves/${k}`))).catch(() => {});
    }
  }
}

/** Les sauvegardes les plus recentes d'abord. */
export async function listSaves(n = 30) {
  const s = await get(query(ref(db, P('-saves')), orderByKey(), limitToLast(n)));
  const v = s.val() || {};
  return Object.keys(v).sort().reverse().map((k) => ({ key: k, ...v[k] }));
}

export function archive(g) {
  if (!g || !g.id) return Promise.resolve();
  return set(ref(db, P(`-archivo/${g.id}`)), clean({
    startedAt: g.startedAt || 0, endedAt: g.endedAt || Date.now(), score: g.score || {}, log: g.log || [],
  }));
}
