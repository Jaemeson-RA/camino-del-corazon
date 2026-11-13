// Textes du jeu : joueurs, cartes Verdad / Reto, mots du pendu, mini-jeux.
// {o} = prenom de l'autre joueur, {x} = terminaison du joueur qui repond (a/o),
// {ox} = terminaison de l'autre joueur.

export const PLAYERS = {
  A: { key: 'A', name: 'Alejandra', short: 'Ale', g: 'a' },
  J: { key: 'J', name: 'Jaemeson', short: 'Jaeme', g: 'o' },
};
export const other = (k) => (k === 'A' ? 'J' : 'A');

export function fill(text, lander) {
  const o = PLAYERS[other(lander)];
  const me = PLAYERS[lander];
  return String(text || '')
    .replaceAll('{o}', o.name)
    .replaceAll('{x}', me.g)
    .replaceAll('{ox}', o.g);
}

export const VERDADES = [
  ['v01', '¿Qué fue lo primero que pensaste de {o} cuando se conocieron?'],
  ['v02', '¿En qué momento supiste que {o} te gustaba de verdad?'],
  ['v03', '¿Cuál es tu recuerdo favorito juntos?'],
  ['v04', '¿Qué es lo que más te cuesta decirle a {o}?'],
  ['v05', '¿Alguna vez le dijiste una mentirita a {o}? ¿Cuál?'],
  ['v06', '¿Qué es lo más loco que harías por {o}?'],
  ['v07', '¿Qué te da celos?'],
  ['v08', '¿Qué cambiarías de su primera cita?'],
  ['v09', '¿Qué costumbre de {o} te parece adorable?'],
  ['v10', '¿Qué costumbre de {o} te saca de quicio?'],
  ['v11', '¿Dónde te ves con {o} en cinco años?'],
  ['v12', '¿Cuál es tu mayor miedo en la pareja?'],
  ['v13', '¿Qué es lo más romántico que alguien hizo por ti?'],
  ['v14', '¿Qué parte de tu cuerpo te gusta más?'],
  ['v15', '¿Cuál es tu fantasía más inconfesable?'],
  ['v16', '¿Cuándo fue la última vez que lloraste y por qué?'],
  ['v17', '¿Qué es lo que más extrañas de tu país?'],
  ['v18', '¿Qué secreto tuyo todavía no conoce {o}?'],
  ['v19', 'Si pudieras revivir un día con {o}, ¿cuál sería?'],
  ['v20', '¿Cuál es tu lugar favorito para estar con {o}?'],
  ['v21', '¿Qué es lo primero que harías si ganaras la lotería?'],
  ['v22', '¿Qué logro tuyo te hace sentir más orgullo?'],
  ['v23', '¿Qué te gustaría aprender junto a {o}?'],
  ['v24', '¿Con qué gesto de {o} te sientes más querid{x}?'],
  ['v25', '¿Qué es lo más vergonzoso que te pasó en una cita?'],
  ['v26', '¿Qué te gustaría que {o} supiera de ti y nunca le dijiste?'],
  ['v27', '¿Cuál fue tu primera impresión de su familia o amigos?'],
  ['v28', '¿Qué canción pondrías en su boda?'],
  ['v29', '¿Cuál es el piropo más lindo que te dijo {o}?'],
  ['v30', '¿Qué harías en un día entero sin reglas con {o}?'],
];

export const RETOS = [
  ['r01', 'Imita a {o} durante 15 segundos.'],
  ['r02', 'Cántale a {o} el estribillo de una canción de amor.'],
  ['r03', 'Dile a {o} tres cosas que te encantan, mirándole a los ojos.'],
  ['r04', 'Pon tu cara más graciosa y mantenla 10 segundos sin reírte.'],
  ['r05', 'Baila 20 segundos sin música.'],
  ['r06', 'Dale a {o} un masaje de un minuto (o prométeselo por escrito).'],
  ['r07', 'Escribe un mini poema de cuatro versos para {o}.'],
  ['r08', 'Dile un piropo a {o}… en cámara lenta.'],
  ['r09', 'Imita cómo es {o} cuando se enoja.'],
  ['r10', 'Habla con acento de otro país hasta tu próximo turno.'],
  ['r11', 'Cuenta un chiste malo. Si {o} se ríe, cumpliste.'],
  ['r12', 'Hazle a {o} una declaración de amor dramática, estilo telenovela.'],
  ['r13', 'Dale un beso a {o} donde te pida (si están lejos, prométeselo).'],
  ['r14', 'Elige la canción que bailarán juntos esta noche.'],
  ['r15', 'Dile a {o} una frase romántica en su idioma (francés o español).'],
  ['r16', 'Imita a un animal hasta que {o} adivine cuál es.'],
  ['r17', 'Haz 10 sentadillas diciendo «te quiero» en cada una.'],
  ['r18', 'Mira a {o} a los ojos 30 segundos sin reírte.'],
  ['r19', 'Hazle a {o} un cumplido que nunca le hayas dicho.'],
  ['r20', 'Prepárale a {o} un mate o un café en la próxima pausa.'],
  ['r21', 'Muéstrale a {o} la última foto de tu galería (sin trampa).'],
  ['r22', 'Describe a {o} usando solo emojis.'],
  ['r23', 'Inventa un apodo nuevo para {o} y úsalo hasta el final de la partida.'],
  ['r24', 'Mándale a {o} un mensaje cariñoso por WhatsApp ahora mismo.'],
  ['r25', 'Haz una pose de modelo y mantenla 10 segundos.'],
  ['r26', 'Canta «Feliz cumpleaños» con voz de dibujo animado.'],
  ['r27', 'Inventa un brindis por la pareja y dilo en voz alta.'],
  ['r28', 'Dale a {o} tres besos en lugares distintos de la cara.'],
  ['r29', 'Recrea la pose de su primera foto juntos.'],
  ['r30', 'Susúrrale a {o} algo que le haga sonrojar.'],
];

export const PALABRAS = [
  'CORAZÓN', 'BESO', 'ABRAZO', 'EMPANADA', 'CHOCOLATE', 'MATE', 'BRUSELAS', 'TANGO',
  'ALFAJOR', 'CERVEZA', 'PERRITO', 'ESTRELLA', 'VIAJE', 'AVIÓN', 'PLAYA', 'MONTAÑA',
  'PALERMO', 'CARIÑO', 'SONRISA', 'GUITARRA', 'PELÍCULA', 'DOMINGO', 'DESAYUNO',
  'MEDIALUNA', 'GOFRE', 'GIRASOL', 'MARIPOSA', 'ARCOÍRIS', 'BICICLETA', 'TERRAZA',
  'VERANO', 'LLUVIA', 'ATARDECER', 'PIJAMA', 'CAFECITO', 'CARAMELO', 'PICNIC',
  'BALCÓN', 'VELAS', 'ANILLO', 'POSTRE', 'HELADO', 'MALETA', 'PASAPORTE', 'OBELISCO',
  'ATOMIUM', 'WAFFLE', 'DULCE DE LECHE', 'TE QUIERO', 'BUENOS AIRES',
];

export const MINIJUEGOS = {
  ppt: { name: 'Piedra, papel o tijera', icon: '✊', blurb: 'Al mejor de tres.' },
  ttt: { name: 'Ta-te-ti', icon: '❌', blurb: 'Tres en raya: ¡alinea tres corazones!' },
  ahorcado: { name: 'El ahorcado', icon: '🔤', blurb: 'Adivina la palabra antes de perder los 6 corazones.' },
  numero: { name: 'Adivina el número', icon: '🔢', blurb: 'Un número del 1 al 100, en 6 intentos.' },
  reflejos: { name: 'Reflejos', icon: '⚡', blurb: 'Toca el corazón antes que tu pareja.' },
};

export const TYPE_BADGE = {
  adivina: { text: 'Adivina', cls: 'b-adivina' },
  sincero: { text: 'Con sinceridad', cls: 'b-sincero' },
  vr: { text: 'Verdad o reto', cls: 'b-vr' },
  foto: { text: 'Foto', cls: 'b-foto' },
  libre: { text: 'Pregunta libre', cls: 'b-libre' },
  back2: { text: '¡Oh no!', cls: 'b-back' },
  meta: { text: '¡Meta!', cls: 'b-meta' },
};

export const RULES = [
  ['🎲', 'Por turnos, cada uno lanza los dos dados y avanza su ficha siguiendo las flechas, en el sentido de las agujas del reloj, desde «Inicio» hasta el corazón.'],
  ['💬', 'La casilla donde caes se da vuelta: respondes a su pregunta. En las casillas de gustos, tienes que adivinar la respuesta de tu pareja.'],
  ['✅', 'Tu pareja confirma si acertaste (o si tu respuesta le convence): +1 punto.'],
  ['🎮', 'Si fallas, tu pareja puede proponerte un minijuego al azar: si ganas, recuperas el punto; si pierdes, tu pareja gana 3 puntos.'],
  ['😜', '«Retrocede 2 casillas»: retrocedes y respondes la casilla donde caes. «Verdad o reto»: eliges tú.'],
  ['💘', 'Al final, cada uno crea 5 preguntas nuevas: aparecerán en la próxima partida cuando el otro elija «Verdad».'],
];
