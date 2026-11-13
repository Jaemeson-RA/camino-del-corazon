// Banque de questions des dalles : a chaque nouvelle partie, chaque dalle
// « gustos » (adivina), « sincero » ou « foto » tire une question de la meme
// famille, sans reprendre celles des parties precedentes tant qu'il en reste.
// {o} = prenom de l'autre, {x} = terminaison de celui qui repond, {ox} = de l'autre.
// L'etiquette (2e texte) s'ecrit sur la dalle : pas de {..} dedans.
import { BOARD } from './board-data.js?v=202611131305';
import { pick } from './util.js?v=202611131305';

export const MOODS = {
  tierno: { icon: '💗', name: 'Tierno' },
  picante: { icon: '🔥', name: 'Picante' },
  risas: { icon: '😂', name: 'Risas' },
  profundo: { icon: '🌙', name: 'Profundo' },
};

/** Modes proposes dans le lobby. */
export const QMODES = [
  { id: 'nuevas', icon: '🎲', name: 'Nuevas', hint: 'Preguntas nuevas, mismo estilo que el tablero' },
  { id: 'tablero', icon: '📜', name: 'Del tablero', hint: 'Las preguntas originales del tablero' },
  { id: 'tierno', icon: '💗', name: 'Más tiernas', hint: 'Más preguntas tiernas y románticas' },
  { id: 'picante', icon: '🔥', name: 'Más picantes', hint: 'Más preguntas atrevidas 😏' },
  { id: 'risas', icon: '😂', name: 'Más risas', hint: 'Más preguntas para reírse' },
  { id: 'profundo', icon: '🌙', name: 'Más profundas', hint: 'Más preguntas para conocerse a fondo' },
];

// ambiance des dalles d'origine (le mode « Nuevas » garde la meme ambiance case par case)
const ORIG_MOOD = {
  1: 'tierno', 2: 'tierno', 3: 'tierno', 4: 'profundo', 5: 'tierno', 6: 'picante',
  7: 'tierno', 8: 'picante', 9: 'risas', 10: 'tierno', 12: 'tierno', 13: 'picante', 14: 'risas',
  15: 'picante', 16: 'picante', 17: 'tierno', 19: 'risas', 20: 'tierno', 21: 'risas', 22: 'tierno',
  24: 'risas', 25: 'picante', 26: 'tierno', 27: 'tierno', 28: 'profundo', 30: 'tierno', 31: 'picante',
  32: 'picante', 34: 'profundo', 35: 'profundo',
};

const A = 'adivina', S = 'sincero', F = 'foto';
const t = 'tierno', p = 'picante', r = 'risas', d = 'profundo';

// [id, type, ambiance, etiquette de la dalle, question complete (gustos : obligatoire)]
const RAW = [
  // ---------------------------------------------------------------- gustos : tierno
  ['a01', A, t, 'Postre favorito 🍰', '¿Cuál es el postre favorito de {o}?'],
  ['a02', A, t, 'Canción del momento 🎧', '¿Qué canción escucha {o} en repetición últimamente?'],
  ['a03', A, t, 'Serie favorita 📺', '¿Cuál es la serie favorita de {o}?'],
  ['a04', A, t, 'Fruta favorita 🍓', '¿Cuál es la fruta favorita de {o}?'],
  ['a05', A, t, 'Animal favorito 🐾', '¿Cuál es el animal favorito de {o}?'],
  ['a06', A, t, 'Estación del año preferida 🍂', '¿Qué estación del año prefiere {o}?'],
  ['a07', A, t, 'Desayuno ideal ☕', '¿Cómo es el desayuno ideal de {o}?'],
  ['a08', A, t, 'Flor favorita 🌷', '¿Cuál es la flor favorita de {o}?'],
  ['a09', A, t, 'Domingo perfecto 🛋️', '¿Cómo sería el domingo perfecto de {o}?'],
  ['a10', A, t, 'Cantante favorito 🎤', '¿Cuál es el cantante o grupo favorito de {o}?'],
  ['a11', A, t, 'Sabor de helado 🍦', '¿Qué sabor de helado elige siempre {o}?'],
  ['a12', A, t, 'Libro favorito 📚', '¿Cuál es el libro o la historia favorita de {o}?'],
  ['a13', A, t, 'Número de la suerte 🍀', '¿Cuál es el número de la suerte de {o}?'],
  ['a14', A, t, '¿Playa o montaña? 🏖️', '¿{o} prefiere la playa o la montaña?'],
  ['a15', A, t, '¿De mañana o de noche? 🌅', '¿{o} es más de mañana o de noche?'],
  ['a16', A, t, 'Comida chatarra preferida 🍔', '¿Cuál es la comida chatarra preferida de {o}?'],
  ['a17', A, t, 'Olor favorito 🌸', '¿Qué olor le encanta a {o}?'],
  ['a18', A, t, 'Regalo soñado 🎁', '¿Qué regalo haría muy feliz a {o}?'],
  ['a19', A, t, 'Mejor amigo o amiga 🤝', '¿Quién es la persona en quien más confía {o}, aparte de ti?'],
  ['a20', A, t, 'Plato de su infancia 🍲', '¿Qué plato le recuerda a {o} su infancia?'],
  ['a21', A, t, 'Rincón favorito de casa 🏠', '¿Cuál es el rincón favorito de {o} en casa?'],
  ['a22', A, t, 'Película que le hizo llorar 🥲', '¿Con qué película lloró {o}?'],
  ['a23', A, t, 'Apodo cariñoso preferido 💕', '¿Qué apodo cariñoso le gusta más a {o} que le digas?'],
  ['a24', A, t, 'Emoji más usado 📱', '¿Cuál es el emoji que más usa {o}?'],
  ['a25', A, t, 'Pizza ideal 🍕', '¿Qué le pone {o} a su pizza ideal?'],
  ['a26', A, t, '¿Café, té o mate? 🧉', '¿Qué prefiere {o}: café, té, mate o chocolate caliente?'],
  ['a27', A, t, 'Comida argentina favorita 🥟', '¿Cuál es la comida argentina favorita de {o}?'],
  ['a28', A, t, 'Comida venezolana favorita 🫓', '¿Qué comida venezolana prefiere {o}?'],
  ['a29', A, t, 'Lugar favorito de Buenos Aires 🏙️', '¿Cuál es el lugar favorito de {o} en Buenos Aires?'],
  ['a30', A, t, 'Juego favorito 🎲', '¿Cuál es el juego de mesa o de cartas favorito de {o}?'],
  ['a31', A, t, 'Talento escondido ✨', '¿Cuál es el talento escondido de {o}?'],
  ['a32', A, t, 'Película para ver mil veces 🍿', '¿Qué película podría ver {o} mil veces sin cansarse?'],
  ['a33', A, t, 'Lo primero al despertar ⏰', '¿Qué es lo primero que hace {o} al despertarse?'],
  ['a34', A, t, 'Comida para un mal día 🍫', '¿Qué come {o} cuando tiene un mal día?'],
  ['a35', A, t, 'Deporte favorito ⚽', '¿Qué deporte le gusta ver o practicar a {o}?'],
  ['a36', A, t, 'Momento favorito del día 🌇', '¿Cuál es el momento favorito del día de {o}?'],
  ['a37', A, t, 'Viaje inolvidable 🗺️', '¿Cuál es el viaje más inolvidable de {o}?'],
  ['a38', A, t, 'Golosina favorita 🍬', '¿Cuál es la golosina favorita de {o}?'],
  // ---------------------------------------------------------------- gustos : picante
  ['ap01', A, p, 'Parte de ti que más le gusta 😍', '¿Qué parte de tu cuerpo le gusta más a {o}?'],
  ['ap02', A, p, 'Dónde le encantan los besos 💋', '¿En qué parte del cuerpo le encanta a {o} que le des besos?'],
  ['ap03', A, p, 'Momento ideal para el amor 🌙', '¿En qué momento del día prefiere {o} hacer el amor?'],
  ['ap04', A, p, 'Lo que más le excita 🔥', '¿Qué es lo que más le excita a {o}?'],
  ['ap05', A, p, 'Su fantasía secreta 😈', '¿Cuál crees que es la fantasía secreta de {o}?'],
  ['ap06', A, p, 'Tu prenda más sexy 👙', '¿Qué prenda tuya le parece más sexy a {o}?'],
  ['ap07', A, p, 'Su beso preferido 😘', '¿Qué beso prefiere {o}: suave, apasionado o juguetón?'],
  ['ap08', A, p, 'Caricias favoritas ✋', '¿Dónde le gustan más las caricias a {o}?'],
  ['ap09', A, p, 'Noche de pasión soñada 🏨', '¿Dónde soñaría {o} pasar una noche de pasión contigo?'],
  ['ap10', A, p, 'Lo que primero le atrajo de ti 👀', '¿Qué fue lo primero que le atrajo de ti a {o}?'],
  ['ap11', A, p, 'Canción para una noche romántica 🎶', '¿Qué canción pondría {o} para una noche romántica?'],
  ['ap12', A, p, 'Lo que le gusta que le susurres 🤫', '¿Qué le gusta a {o} que le susurres al oído?'],
  ['ap13', A, p, '¿Ducha o bañera juntos? 🛁', '¿{o} prefiere una ducha juntos o un baño de espuma?'],
  ['ap14', A, p, 'Tu perfume que le encanta 🌹', '¿Qué perfume o aroma tuyo vuelve loc{ox} a {o}?'],
  ['ap15', A, p, 'Masaje favorito 💆', '¿Dónde prefiere {o} que le hagas masajes?'],
  ['ap16', A, p, '¿Luz encendida o apagada? 💡', '¿{o} prefiere la luz encendida o apagada?'],
  ['ap17', A, p, 'Su piropo preferido 😏', '¿Qué piropo tuyo le encanta escuchar a {o}?'],
  ['ap18', A, p, 'Tu look favorito 👗', '¿Con qué ropa le gustas más a {o}?'],
  // ---------------------------------------------------------------- gustos : risas
  ['ar01', A, r, 'Si fuera un animal 🦥', 'Si {o} fuera un animal, ¿cuál sería?'],
  ['ar02', A, r, 'Su manía más rara 🙃', '¿Cuál es la manía más rara de {o}?'],
  ['ar03', A, r, 'Con un millón de dólares 💸', '¿Qué haría {o} primero si ganara un millón de dólares?'],
  ['ar04', A, r, 'Su frase típica 🗣️', '¿Cuál es la frase que más repite {o}?'],
  ['ar05', A, r, 'Personaje de película 🦸', 'Si {o} fuera un personaje de película, ¿quién sería?'],
  ['ar06', A, r, 'Su miedo más absurdo 🕷️', '¿A qué le tiene miedo {o} aunque no tenga sentido?'],
  ['ar07', A, r, 'Comida que odia 🤢', '¿Qué comida no soporta {o}?'],
  ['ar08', A, r, 'Canción de karaoke 🎤', '¿Qué canción cantaría {o} en un karaoke?'],
  ['ar09', A, r, 'Un día invisible 👻', '¿Qué haría {o} si fuera invisible por un día?'],
  ['ar10', A, r, 'Su paso de baile estrella 💃', '¿Cuál es el paso de baile estrella de {o}?'],
  ['ar11', A, r, 'Isla desierta 🏝️', '¿Qué objeto se llevaría {o} a una isla desierta?'],
  ['ar12', A, r, 'Placer culposo 🍟', '¿Cuál es el placer culposo de {o}?'],
  ['ar13', A, r, 'Cena con un famoso 🌟', '¿Con qué famoso le gustaría cenar a {o}?'],
  ['ar14', A, r, 'Viaje en el tiempo ⏳', 'Si {o} pudiera viajar en el tiempo, ¿a qué época iría?'],
  ['ar15', A, r, 'Lo que le hace enojar 😤', '¿Qué cosa pequeña hace enojar a {o} enseguida?'],
  ['ar16', A, r, 'Su sueño de infancia 🚀', '¿Qué soñaba ser {o} de pequeñ{ox}?'],
  // ---------------------------------------------------------------- gustos : profundo
  ['ad01', A, d, 'Su mayor miedo 🌧️', '¿Cuál es el mayor miedo de {o}?'],
  ['ad02', A, d, 'Lo que más extraña de su país 🌎', '¿Qué es lo que más extraña {o} de su país?'],
  ['ad03', A, d, 'Su mayor orgullo 🏆', '¿De qué está más orgullos{ox} {o} en su vida?'],
  ['ad04', A, d, 'La persona que marcó su vida 👪', '¿Quién es la persona que más marcó la vida de {o}?'],
  ['ad05', A, d, 'Su recuerdo de infancia favorito 💭', '¿Cuál es el recuerdo de infancia favorito de {o}?'],
  ['ad06', A, d, 'Lo que le da paz 🕊️', '¿Qué le da paz a {o} cuando está estresad{ox}?'],
  ['ad07', A, d, 'Lo que cambiaría del mundo 🌍', 'Si {o} pudiera cambiar una cosa del mundo, ¿qué sería?'],
  ['ad08', A, d, 'Su idea de felicidad ☀️', '¿Qué es la felicidad para {o}?'],
  ['ad09', A, d, 'Dentro de diez años 🔭', '¿Dónde se imagina {o} dentro de diez años?'],
  ['ad10', A, d, 'Lo que más valora en alguien 💎', '¿Qué es lo que más valora {o} en una persona?'],
  ['ad11', A, d, 'Su lenguaje del amor 💌', '¿Cómo se siente más querid{ox} {o}: con palabras, regalos, tiempo juntos, abrazos o ayuda?'],
  ['ad12', A, d, 'Su meta para este año 🎯', '¿Cuál es la meta más importante de {o} para este año?'],
  ['ad13', A, d, 'Lo que le quita el sueño 🌙', '¿Qué le quita el sueño a {o} últimamente?'],
  // ---------------------------------------------------------------- sincero : tierno
  ['s01', S, t, 'Lo primero que pensaste de mí 💭'],
  ['s02', S, t, 'Nuestro mejor viaje juntos 🧳'],
  ['s03', S, t, 'Cuándo supiste que me querías 💘'],
  ['s04', S, t, 'Algo de mí que te hace sonreír 😊'],
  ['s05', S, t, 'Una canción que sería nuestra 🎶'],
  ['s06', S, t, 'Tres cosas que amas de mí 💗'],
  ['s07', S, t, 'Nuestro mejor recuerdo juntos 📸'],
  ['s08', S, t, 'Un plan para el próximo fin de semana 🗓️'],
  ['s09', S, t, 'Cómo me describirías a tu familia 👪'],
  ['s10', S, t, 'Algo que te enseñé 🧠'],
  ['s11', S, t, 'Un detalle mío que nadie más nota 🔍'],
  ['s12', S, t, 'Algo que quieres agradecerme 🙏'],
  ['s13', S, t, 'Nuestro lugar especial 📍'],
  ['s14', S, t, 'Un sueño que quieres cumplir conmigo 🌠'],
  ['s15', S, t, 'La cita que más disfrutaste conmigo 🥂'],
  ['s16', S, t, 'Cómo sería nuestra casa ideal 🏡'],
  ['s17', S, t, 'Un apodo nuevo para mí 🐣'],
  ['s18', S, t, 'Algo de mí que te da ternura 🥹'],
  ['s19', S, t, 'Una promesa para este año 🤞'],
  ['s20', S, t, 'Lo que más te gusta de nuestras mañanas ☀️'],
  ['s21', S, t, 'Un mensaje mío que nunca olvidaste 📩'],
  ['s22', S, t, 'Algo que te gustaría aprender juntos 🎨'],
  ['s23', S, t, 'Una receta para cocinar juntos 🍳'],
  ['s24', S, t, 'Cómo festejarías nuestro aniversario 🎉'],
  ['s25', S, t, 'Algo de mi país que te encanta 🌎'],
  ['s26', S, t, 'Un momento en que me admiraste ✨'],
  ['s27', S, t, 'Lo que más extrañas cuando no estoy 🫶'],
  ['s28', S, t, 'Una palabra de mi idioma que te encanta 🗣️'],
  ['s29', S, t, 'Escríbeme un mini poema 📝'],
  ['s30', S, t, 'Tu foto favorita de nosotros 🖼️'],
  ['s31', S, t, 'Cómo te imaginas nuestra vejez 👵👴'],
  ['s32', S, t, 'El mejor regalo que te di 🎁'],
  ['s33', S, t, 'Algo que hago que te hace sentir en casa 🏠'],
  ['s34', S, t, 'Lo que te hizo elegirme 💍'],
  // ---------------------------------------------------------------- sincero : picante
  ['sp01', S, p, 'Nuestro beso más inolvidable 💋'],
  ['sp02', S, p, 'Lo que más te gusta que te haga 😏'],
  ['sp03', S, p, 'Una prenda mía que te encanta ver 👀'],
  ['sp04', S, p, 'Un lugar atrevido para besarnos 🔥'],
  ['sp05', S, p, 'Tu parte favorita de nuestras noches 🌙'],
  ['sp06', S, p, 'Algo que te gustaría que te susurrara 🤫'],
  ['sp07', S, p, 'Describe una noche perfecta conmigo 🍷'],
  ['sp08', S, p, 'Un recuerdo picante nuestro 🌶️'],
  ['sp09', S, p, 'Lo que pensaste en nuestra primera noche 🌹'],
  ['sp10', S, p, 'Un juego que te gustaría probar en la cama 🎲'],
  ['sp11', S, p, 'Dónde quieres que te dé un masaje 💆'],
  ['sp12', S, p, 'Algo mío que te parece irresistible 😍'],
  ['sp13', S, p, 'Tu momento favorito para hacer el amor ⏰'],
  ['sp14', S, p, 'Escríbeme un mensaje picante 📲'],
  ['sp15', S, p, 'Qué harías si estuviéramos solos ahora 😈'],
  ['sp16', S, p, 'Un rol que te gustaría jugar conmigo 🎭'],
  ['sp17', S, p, 'Cuándo me encuentras más sexy 🔥'],
  ['sp18', S, p, 'Algo que nunca te animaste a pedirme 🙊'],
  ['sp19', S, p, 'Tu canción más romántica 🎷'],
  ['sp20', S, p, 'Lo más atrevido que harías conmigo 🫣'],
  ['sp21', S, p, 'Tres palabras para nuestra química ⚡'],
  ['sp22', S, p, 'Un hotel soñado para una escapada 🏨'],
  ['sp23', S, p, 'Lo que te provoca mi voz 🎙️'],
  ['sp24', S, p, 'Algo que te gustaría hacer esta noche 🌙'],
  ['sp25', S, p, 'Qué ropa interior me regalarías 🎀'],
  ['sp26', S, p, 'El lugar más loco donde nos besamos 💥'],
  ['sp27', S, p, 'Describe mi mejor beso 👄'],
  ['sp28', S, p, 'Tu recuerdo favorito de nuestra intimidad 💞'],
  // ---------------------------------------------------------------- sincero : risas
  ['sr01', S, r, 'Tu momento más vergonzoso conmigo 🙈'],
  ['sr02', S, r, 'Imita cómo hablo 🗣️'],
  ['sr03', S, r, 'Una manía mía que te hace reír 😂'],
  ['sr04', S, r, 'La peor comida que te preparé 🍳'],
  ['sr05', S, r, 'Tu peor corte de pelo 💇'],
  ['sr06', S, r, 'Una creencia absurda de tu infancia 🧸'],
  ['sr07', S, r, 'Lo más raro que comiste 🦗'],
  ['sr08', S, r, 'Tu mayor torpeza en público 🤦'],
  ['sr09', S, r, 'Si fuéramos una película, ¿cuál? 🎬'],
  ['sr10', S, r, 'Un apodo ridículo para mí 🐸'],
  ['sr11', S, r, 'Tu baile más ridículo, ¡ahora! 💃'],
  ['sr12', S, r, 'La mentira más tonta que dijiste 🤥'],
  ['sr13', S, r, 'Cuéntame un chiste malo 🤡'],
  ['sr14', S, r, 'Qué harías si fueras yo por un día 🔄'],
  ['sr15', S, r, 'La canción que cantas a escondidas 🎤'],
  ['sr16', S, r, 'El regalo más feo que recibiste 🎁'],
  ['sr17', S, r, 'Tu peor malentendido con un idioma 🌐'],
  ['sr18', S, r, 'Qué emoji me representa 🫠'],
  // ---------------------------------------------------------------- sincero : profundo
  ['sd01', S, d, 'Algo que te da miedo perder 🫂'],
  ['sd02', S, d, 'Un momento difícil que superamos juntos 💪'],
  ['sd03', S, d, 'Algo que aprendiste gracias a mí 🌱'],
  ['sd04', S, d, 'Cómo imaginas nuestra vida en 5 años 🔮'],
  ['sd05', S, d, 'Algo que te cuesta pedir 🤲'],
  ['sd06', S, d, 'Un momento en que sentiste mi amor 💞'],
  ['sd07', S, d, 'Algo que quieres que entienda de ti 🧩'],
  ['sd08', S, d, 'Algo que todavía te duele 🩹'],
  ['sd09', S, d, 'Lo que más admiras de tu familia 🌳'],
  ['sd10', S, d, 'Algo que te gustaría perdonarte 🕊️'],
  ['sd11', S, d, 'Qué significa «hogar» para ti 🏠'],
  ['sd12', S, d, 'Un consejo que me darías 💡'],
  ['sd13', S, d, 'Algo que extrañas de tu vida de antes ⏳'],
  ['sd14', S, d, 'Lo que más te ilusiona de nuestro futuro ✨'],
  ['sd15', S, d, 'Una decisión que cambió tu vida 🛤️'],
  ['sd16', S, d, 'Cómo te gusta que te consuele 🤗'],
  ['sd17', S, d, 'Un lugar de tu país que quieres mostrarme 🗺️'],
  ['sd18', S, d, 'Una tradición que quieres crear juntos 🕯️'],
  ['sd19', S, d, 'Lo que te hace sentir orgullo de nosotros 🏅'],
  ['sd20', S, d, 'Un mensaje para tu yo del pasado ✉️'],
  // ---------------------------------------------------------------- foto
  ['f01', F, t, 'Una selfie mandándome un beso 😘'],
  ['f02', F, r, 'Una foto de lo que ves ahora mismo 👀'],
  ['f03', F, r, 'Tu mejor cara de enojo 😠'],
  ['f04', F, t, 'Una selfie con tu sonrisa más linda 😁'],
  ['f05', F, r, 'Una foto de tu objeto favorito 🧸'],
  ['f06', F, r, 'Tu mejor pose de modelo 📸'],
  ['f07', F, r, 'Una foto imitando a un animal 🐒'],
  ['f08', F, r, 'Una selfie con cara de sorpresa 😱'],
  ['f09', F, t, 'Tu cara de «te extraño» 🥺'],
  ['f10', F, r, 'Una foto de algo rojo cerca de ti ❤️'],
  ['f11', F, p, 'Una selfie guiñando un ojo 😉'],
  ['f12', F, p, 'Tu mirada más seductora 😏'],
  ['f13', F, t, 'Un corazón con tus manos 🫶'],
  ['f14', F, d, 'Una foto de algo que te hace feliz 🌻'],
];

// dalles d'origine : leur question fait partie de la banque (id « o07 »...)
const ORIG = {};
const ALL = [];
for (const tile of BOARD.tiles) {
  if (!ORIG_MOOD[tile.n]) continue;
  const id = 'o' + String(tile.n).padStart(2, '0');
  ORIG[tile.n] = id;
  ALL.push({ id, type: tile.type, mood: ORIG_MOOD[tile.n], label: tile.label, q: tile.q || '', tile: tile.n });
}
for (const [id, type, mood, label, q] of RAW) ALL.push({ id, type, mood, label, q: q || '' });

export const QUESTIONS = ALL;
export const QBY = Object.fromEntries(ALL.map((x) => [x.id, x]));
export const QTILES = Object.keys(ORIG_MOOD).map(Number);
export const origId = (n) => ORIG[n];

/** Question d'une dalle pour cette partie (celle du plateau si rien n'a ete tire). */
export function tileQ(g, n) {
  const id = (g && g.qs && g.qs['t' + n]) || ORIG[n];
  return id ? QBY[id] : null;
}

/** La dalle affiche-t-elle une autre question que celle imprimee sur le plateau ? */
export const isVariant = (g, n) => { const q = tileQ(g, n); return !!q && q.id !== ORIG[n]; };

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/**
 * Tire les questions d'une partie. Renvoie { qs: { t1: 'a05', ... }, seen: [...] }.
 * seen = questions deja jouees aux parties precedentes (on les evite tant qu'il en reste).
 */
export function drawSet(mode, seen0) {
  const seen = new Set(seen0 || []);
  if (mode === 'tablero') return { qs: {}, seen: [...seen] };
  const tiles = shuffle([...QTILES]);
  // modes « Mas ... » : la moitie des dalles passe a l'ambiance choisie
  const want = {};
  const boost = MOODS[mode] ? mode : null;
  const already = tiles.filter((n) => ORIG_MOOD[n] === boost).length;
  let toSwitch = boost ? Math.max(0, Math.round(tiles.length * 0.5) - already) : 0;
  for (const n of tiles) {
    const keep = ORIG_MOOD[n];
    if (boost && keep !== boost && toSwitch > 0) { want[n] = boost; toSwitch--; } else want[n] = keep;
  }
  const used = new Set();
  const qs = {};
  // les dalles a changement d'ambiance d'abord : leur famille est la plus sollicitee
  tiles.sort((a, b) => (want[b] !== ORIG_MOOD[b]) - (want[a] !== ORIG_MOOD[a]));
  for (const n of tiles) {
    const type = BOARD.tiles[n].type;
    const fam = (m) => ALL.filter((x) => x.type === type && (type === 'foto' || x.mood === m) && !used.has(x.id));
    let m = want[n];
    let pool = fam(m);
    if (!pool.length) { m = ORIG_MOOD[n]; pool = fam(m); }
    let fresh = pool.filter((x) => !seen.has(x.id));
    if (!fresh.length) {
      // famille epuisee : on la recommence
      for (const x of ALL) if (x.type === type && (type === 'foto' || x.mood === m)) seen.delete(x.id);
      fresh = pool;
    }
    if (!fresh.length) continue;
    const q = pick(fresh);
    used.add(q.id);
    qs['t' + n] = q.id;
  }
  return { qs, seen: [...seen] };
}

/** « Otra pregunta » : une autre question pour la meme dalle (meme ambiance si possible). */
export function rerollQ(g, n) {
  const cur = tileQ(g, n);
  const type = BOARD.tiles[n].type;
  const onBoard = new Set(QTILES.map((k) => { const q = tileQ(g, k); return q && q.id; }));
  const seen = new Set((g && g.qseen) || []);
  const base = ALL.filter((x) => x.type === type && !onBoard.has(x.id));
  const same = base.filter((x) => !cur || type === 'foto' || x.mood === cur.mood);
  for (const pool of [same.filter((x) => !seen.has(x.id)), base.filter((x) => !seen.has(x.id)), same, base]) {
    if (pool.length) return pick(pool);
  }
  return null;
}

/** Ajoute les questions d'une partie terminee a la liste des questions deja jouees. */
export function markSeen(g) {
  const seen = new Set((g && g.qseen) || []);
  for (const n of QTILES) { const q = tileQ(g, n); if (q) seen.add(q.id); }
  return [...seen].slice(-400);
}
