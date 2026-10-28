import type { HalfSubject } from './halves'
import { halfSubjects } from './halves'
import { lessons, type Lesson } from './content'
import { topics } from './topics'

// Spanish for the lessons, topics and two-halves pictures. English lives next to the drawings (content.ts, topics.ts,
// halves.ts); this is the same content in Spanish, matched by slug (or by position for topics, which have none).
// A test makes sure nothing is missing, and that every lesson has one prompt per step.

export type Lang = 'en' | 'es'

export interface LessonText {
  title: string
  summary: string
  /** One prompt per step, in order. */
  steps: string[]
}

const lessonsEs: Record<string, LessonText> = {
  'straight-lines': {
    title: 'Líneas rectas',
    summary: 'Calienta la mano: líneas planas, verticales e inclinadas, dibujadas en un solo movimiento tranquilo.',
    steps: [
      'Dibuja una línea recta de izquierda a derecha siguiendo la guía punteada.',
      'Ahora una línea de arriba hacia abajo.',
      'Dibuja la línea inclinada desde abajo a la izquierda hasta arriba a la derecha.',
      'Tres rayas. Levanta el lápiz entre una línea y otra.',
    ],
  },
  'first-shapes': {
    title: 'Primeras formas',
    summary: 'Círculo, cuadrado y triángulo, y luego únelos para formar una casita.',
    steps: [
      'Traza el círculo de una sola vez. Ciérralo donde empezaste.',
      'Dibuja el cuadrado. Gira en cada esquina sin levantar el lápiz.',
      'Dibuja el triángulo.',
      'Construye la casa: paredes, techo y puerta, como tres líneas separadas.',
    ],
  },
  'happy-sun': {
    title: 'Sol feliz',
    summary: 'Un sol redondo con rayos y una cara. Los detalles pequeños piden una mano firme y lenta.',
    steps: [
      'Dibuja el sol: un círculo redondo.',
      'Añade ocho rayos cortos a su alrededor. Empieza cada rayo cerca del círculo.',
      'Dale dos ojitos redondos.',
      'Termina con una sonrisa: una curva desde la mejilla izquierda hasta la derecha.',
    ],
  },
  'happy-cat': {
    title: 'Gato feliz',
    summary: 'Una cara de gato redonda con orejas puntiagudas, ojos grandes, una naricita y bigotes.',
    steps: [
      'Dibuja la cabeza del gato: un círculo grande y redondo.',
      'Añade dos orejas puntiagudas arriba. Dibuja cada una como una sola línea que sube y vuelve a bajar.',
      'Dos ojos redondos y un triángulo pequeño para la nariz.',
      'La boca son dos sonrisitas una al lado de otra, como una «w» acostada.',
      'Termina con los bigotes: tres a cada lado, abiertos hacia afuera.',
    ],
  },
  'little-fish': {
    title: 'Pececito',
    summary: 'Un pez con cola, un ojo, una aleta, escamas y unas burbujas.',
    steps: [
      'Dibuja el cuerpo: un óvalo ancho, cerrado donde empezaste.',
      'Añade la cola a la derecha: un triángulo que empieza en el cuerpo.',
      'Un ojo redondo cerca del frente y una aleta puntiaguda arriba.',
      'Tres escamas curvas, como paréntesis, una tras otra.',
      'Tres burbujas que suben desde su boca. Haz cada una como un círculo pequeño.',
    ],
  },
  'simple-flower': {
    title: 'Flor sencilla',
    summary: 'Una flor de cinco pétalos sobre un tallo curvo, con dos hojas.',
    steps: [
      'Empieza en el centro de la flor con un círculo pequeño.',
      'Dibuja cinco pétalos redondos alrededor del centro. Cada uno es su propio lazo.',
      'Dibuja el tallo: una curva tranquila desde la flor hacia abajo.',
      'Dos hojas, una a cada lado del tallo. Dibuja cada una como un óvalo puntiagudo.',
    ],
  },
  'big-tree': {
    title: 'Árbol grande',
    summary: 'Un árbol redondo con tronco, ramas, el suelo y dos pájaros.',
    steps: [
      'Dibuja la copa frondosa: un círculo grande y redondo.',
      'Añade el tronco abajo: un rectángulo alto.',
      'Dos ramas desde lo alto del tronco hacia las hojas, y una línea para el suelo.',
      'Dos pájaros en el cielo: cada uno es una «v» ancha y plana.',
    ],
  },
  sailboat: {
    title: 'Velero',
    summary: 'Un barco con dos velas y una bandera, meciéndose sobre las olas.',
    steps: [
      'Dibuja el casco: ancho arriba y más angosto abajo.',
      'Un mástil alto desde el medio del barco, con una banderita arriba.',
      'Dos velas: un triángulo grande a la derecha y uno más pequeño a la izquierda.',
      'Termina con dos líneas onduladas de agua bajo el barco.',
    ],
  },
  'friendly-face': {
    title: 'Cara amable',
    summary: 'Una cara completa: cabeza, ojos, cejas, nariz, sonrisa y orejas.',
    steps: [
      'Dibuja la cabeza: un óvalo alto, un poco más largo que ancho.',
      'Dos ojos almendrados, con una ceja arqueada sobre cada uno.',
      'La nariz es una línea hacia abajo con un pequeño gancho, y debajo una sonrisa ancha.',
      'Por último las orejas: medio círculo a cada lado de la cabeza.',
    ],
  },
  'wavy-patterns': {
    title: 'Patrones ondulados',
    summary: 'Olas, festones, lazos y una espiral. Las curvas son el siguiente paso después de las líneas rectas.',
    steps: [
      'Tres olas largas, una debajo de otra. Mueve la mano de forma pareja.',
      'Dos filas de festones: pequeñas curvas unidas, como una fila de colinas.',
      'Una fila de lazos, como «e» cursivas. Mantenlos redondos y del mismo tamaño.',
      'Una espiral: empieza en el centro y gira hacia afuera.',
    ],
  },
  'night-sky': {
    title: 'Cielo nocturno',
    summary: 'Una luna creciente, un planeta con anillo, estrellas fugaces y las colinas abajo.',
    steps: [
      'Dibuja una luna creciente: una curva larga alrededor y luego una más corta de regreso al inicio.',
      'Un planeta: un círculo grande y luego un óvalo largo y plano para su anillo.',
      'Tres estrellas fugaces: líneas largas e inclinadas, de arriba a la derecha hacia abajo a la izquierda.',
      'Dibuja las colinas abajo: una línea larga y ondulante.',
    ],
  },
}

export function lessonText(lesson: Lesson, lang: Lang): LessonText {
  const es = lang === 'es' ? lessonsEs[lesson.slug] : undefined
  return es ?? { title: lesson.title, summary: lesson.summary, steps: lesson.steps.map((s) => s.prompt) }
}

const topicsEs: readonly string[] = [
  'Un monstruo que le tiene miedo a algo muy pequeño.',
  'Una casa para un animal que no existe.',
  'El sombrero más extraño que puedas imaginar, sobre una persona muy seria.',
  'Un robot aprendiendo a cocinar.',
  'Una isla con exactamente un árbol.',
  'Un gato y un pájaro que son mejores amigos.',
  'Un vehículo para viajar entre las nubes.',
  'El dormitorio de tus sueños.',
  'Un gigante y una personita tomando el té.',
  'Un pez que vive en el cielo.',
  'Un castillo sobre el lomo de una tortuga.',
  'Un dragón con un resfriado terrible.',
  'La vista desde una ventana en la luna.',
  'Una fiesta para las plantas.',
  'Un superhéroe con un poder muy tonto.',
  'Un árbol que da algo inesperado.',
  'Un jardín de noche.',
  'Un globo que carga a todo un pueblo.',
  'Dos extraterrestres visitando un supermercado.',
  'Un muñeco de nieve de vacaciones en la playa.',
  'Una librería atendida por un oso.',
  'Un puente entre dos islas flotantes.',
  'Una fiesta de cumpleaños bajo el agua.',
  'Un coche para un animal muy alto.',
  'Una montaña con cara.',
  'Un faro en medio del desierto.',
  'Un barco pirata hecho de comida.',
  'Una mascota que es un poquito demasiado grande.',
  'La bicicleta más genial jamás hecha.',
  'Un caracol en una carrera.',
]

/** A topic prompt in this language. Falls back to English for one that has no translation yet. */
export function topicText(index: number, lang: Lang): string {
  return (lang === 'es' ? topicsEs[index] : undefined) ?? topics[index] ?? ''
}

const halvesEs: Record<string, { title: string; prompt: string }> = {
  butterfly: { title: 'Una mariposa', prompt: 'Uno dibuja las alas izquierdas y el otro las derechas. Encuéntrense en el cuerpo.' },
  face: { title: 'Una cara', prompt: 'Cada uno dibuja un lado de la cara. La nariz y la boca se encuentran en el medio.' },
  house: { title: 'Una casa', prompt: 'El techo, la pared y la puerta están partidos por la mitad. Hagan que las líneas se encuentren.' },
  rocket: { title: 'Un cohete', prompt: 'Cada uno un lado del cohete, con una ventana y una llama en el medio.' },
  heart: { title: 'Un corazón grande', prompt: 'Cada uno dibuja la mitad del corazón, desde la punta de abajo hasta la hendidura de arriba.' },
  'pine-tree': { title: 'Un pino', prompt: 'Tres capas de ramas, un tronco y dos bolitas, partidos por la mitad.' },
  robot: { title: 'Un robot', prompt: 'Cabeza, cuerpo, brazo y pierna: cada uno construye un lado del robot.' },
  mushroom: { title: 'Un hongo', prompt: 'Un sombrero con manchas sobre un tallo. Cada uno dibuja una mitad y unen la parte de arriba y la de abajo.' },
}

export function halfText(subject: HalfSubject, lang: Lang): { title: string; prompt: string } {
  return (lang === 'es' ? halvesEs[subject.slug] : undefined) ?? { title: subject.title, prompt: subject.prompt }
}

/** Slugs and counts the Spanish text must cover, for the test. */
export const spanishCoverage = {
  lessons: () => lessons.map((l) => ({ slug: l.slug, steps: l.steps.length, has: lessonsEs[l.slug]?.steps.length ?? -1 })),
  topics: () => ({ english: topics.length, spanish: topicsEs.length }),
  halves: () => halfSubjects.map((s) => ({ slug: s.slug, has: halvesEs[s.slug] !== undefined })),
}
