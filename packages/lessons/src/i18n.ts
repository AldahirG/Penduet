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
  'red-apple': {
    title: 'Manzana roja',
    summary: 'Una manzana redonda con tallo, una hoja y un brillo. Las curvas son suaves y son pocas.',
    steps: [
      'Dibuja la manzana: una forma ancha y redonda con una pequeña hendidura arriba.',
      'Añade el tallo: una curva corta que sube desde la hendidura.',
      'Una hoja junto al tallo: un óvalo puntiagudo.',
      'Termina con un brillo a la izquierda: una curva corta y un círculo diminuto.',
    ],
  },
  'ice-cream': {
    title: 'Helado',
    summary: 'Un cono, una bola grande y una cereza encima. Triángulos y círculos, como en las primeras formas.',
    steps: [
      'Dibuja el cono: un triángulo apuntando hacia abajo.',
      'La bola va encima: un círculo grande y redondo.',
      'Líneas cruzadas en el cono, como una galleta de barquillo.',
      'Una cereza arriba, con un tallito rizado.',
    ],
  },
  'party-balloon': {
    title: 'Globo de fiesta',
    summary: 'Un globo con forma de huevo, con nudo, un hilo ondulado y un brillo.',
    steps: [
      'Dibuja el globo: una forma de huevo, más redonda arriba y más angosta abajo.',
      'Un triángulo pequeño para el nudo, justo debajo del globo.',
      'El hilo: una línea ondulante y perezosa hacia abajo.',
      'Un brillo en el globo: una curva corta.',
    ],
  },
  rainbow: {
    title: 'Arcoíris',
    summary: 'Tres franjas de color, dos nubes esponjosas y un sol en la esquina.',
    steps: [
      'Tres arcos, uno dentro de otro. Empieza por el más grande.',
      'Una nube esponjosa en cada extremo del arcoíris. Con bultitos arriba y plana abajo.',
      'Un solecito en la esquina: un círculo con rayos cortos.',
    ],
  },
  'happy-star': {
    title: 'Estrella feliz',
    summary: 'Una estrella de cinco puntas con una sonrisa. Dibújala con líneas rectas y rápidas.',
    steps: [
      'Dibuja la estrella: ve de punta en punta, en un solo contorno.',
      'Dale dos ojos redondos.',
      'Y una sonrisa grande en el medio.',
    ],
  },
  butterfly: {
    title: 'Mariposa',
    summary: 'Dos pares de alas con dibujos por dentro, un cuerpo delgado y antenas rizadas. Los dos lados son iguales.',
    steps: [
      'Empieza por el cuerpo: un óvalo alto y una cabecita redonda arriba.',
      'Las alas grandes de arriba: una a cada lado, como colinas redondeadas que se alejan del cuerpo.',
      'Ahora las alas más pequeñas de abajo, que cuelgan bajo las grandes.',
      'Dibujos dentro de las alas: una curva larga en cada ala de arriba y un círculo en cada una de abajo.',
      'Termina con las dos antenas, cada una con una bolita al final.',
    ],
  },
  'wise-owl': {
    title: 'Búho sabio',
    summary: 'Un búho redondo con plumitas en las orejas, ojos enormes, pico y plumas, posado en una rama.',
    steps: [
      'Dibuja el cuerpo: un huevo grande, ancho arriba y redondeado abajo.',
      'Dos plumitas puntiagudas en lo alto de la cabeza.',
      'Los ojos grandes: dos círculos enormes, cada uno con otro pequeño dentro.',
      'Un piquito pequeño entre los ojos: un triángulo apuntando hacia abajo.',
      'Plumas en la panza: filas de curvitas, como sonrisas.',
      'Un ala a cada lado, y la rama donde está posado.',
    ],
  },
  rocket: {
    title: 'Cohete',
    summary: 'Un cohete con ventana, aletas, una llama y estrellas a su alrededor.',
    steps: [
      'Dibuja el cuerpo: puntiagudo arriba, recto a los lados y plano abajo.',
      'Una ventana redonda, con un círculo más pequeño dentro.',
      'Dos aletas abajo, una a cada lado.',
      'La tobera debajo del cohete, y la llama que sale de ella.',
      'Una franja en el cuerpo y tres estrellitas en el cielo.',
    ],
  },
  cupcake: {
    title: 'Cupcake',
    summary: 'Un molde de papel con pliegues, tres capas de crema, chispitas y una cereza.',
    steps: [
      'Dibuja el molde de papel: más ancho arriba que abajo.',
      'Cinco pliegues en el molde, abiertos en abanico desde abajo.',
      'La crema en tres capas: una ancha, una más pequeña y un remolino arriba.',
      'Una cereza en lo más alto, con un tallito corto.',
      'Chispitas: rayitas inclinadas repartidas sobre la crema.',
    ],
  },
  'sea-turtle': {
    title: 'Tortuga marina',
    summary: 'Una tortuga de lado: caparazón abombado con placas, cabeza sonriente, patas cortas y cola.',
    steps: [
      'Dibuja el caparazón: una cúpula alta, plana por debajo.',
      'Placas en el caparazón: un hexágono en el medio, con líneas que salen de sus esquinas.',
      'La cabeza, asomándose a la derecha: un óvalo suave.',
      'Un ojo redondo y una sonrisa pequeña.',
      'Dos patas cortas bajo el caparazón y una colita puntiaguda atrás.',
    ],
  },
  lighthouse: {
    title: 'Faro',
    summary: 'Un faro a rayas sobre las rocas, con su lámpara, una puerta, rayos de luz y el mar.',
    steps: [
      'La torre: angosta arriba, ancha abajo.',
      'La sala de la lámpara arriba: una cajita, un techo puntiagudo y una bolita.',
      'Dos rayas atravesando la torre.',
      'Una ventana redonda y una puerta en arco.',
      'Rayos de luz a ambos lados, y el mar a lo largo de abajo.',
    ],
  },
  'tall-ship': {
    title: 'Barco de vela',
    summary: 'Un velero con dos mástiles, cuatro velas, un foque, banderas y cuerdas, balanceándose sobre las olas. Hazlo por partes.',
    steps: [
      'El casco: una curva larga por debajo y una línea recta arriba, de popa a proa.',
      'Una línea de tablas a lo largo del casco y cinco ojos de buey debajo.',
      'Dos mástiles altos, y una banderita arriba de cada uno.',
      'Las vergas: seis travesaños que sostienen las velas.',
      'Las dos velas del mástil de atrás. El borde de abajo se curva un poco con el viento.',
      'Las dos velas del mástil de adelante.',
      'Una vela triangular al frente, y las cuerdas que la sujetan.',
      'Olas bajo el barco y unas gotas de espuma junto a la proa.',
    ],
  },
  'stone-castle': {
    title: 'Castillo de piedra',
    summary: 'Un castillo con torre del homenaje, dos torres, almenas, banderas, ventanas y una puerta con rastrillo.',
    steps: [
      'El suelo, y la torre alta del medio apoyada en él.',
      'Las dos torres, una a cada lado de la torre central.',
      'Un techo puntiagudo en la torre central, con asta y bandera.',
      'Almenas: bloques elevados en lo alto de cada torre y en los dos trozos de muralla de en medio.',
      'Una banderita en lo alto de cada torre.',
      'La puerta: un arco en medio de la torre, con una reja de barras dentro.',
      'Ventanas: una con arco en la torre central y una rendija en cada torre.',
    ],
  },
  'lion-king': {
    title: 'León',
    summary: 'Una cara de león con una gran melena de bultitos, orejas, ojos, hocico y sonrisa. Muchas curvas pequeñas.',
    steps: [
      'La melena: un borde grande y redondo hecho de catorce bultitos suaves. Da la vuelta completa.',
      'La cara dentro de ella: una forma ancha que se angosta hacia la barbilla.',
      'Dos orejas redondas arriba, cada una con una curva pequeña dentro.',
      'Dos ojos redondos, con una ceja arqueada sobre cada uno.',
      'El hocico: una forma suave bajo los ojos, con una nariz triangular en el medio.',
      'Una línea desde la nariz hacia abajo, y la boca: dos sonrisitas una al lado de otra.',
      'Mechones de pelo, uno en cada bulto de la melena. Dibuja cada uno como una línea corta desde la cara hacia afuera.',
    ],
  },
  sunflower: {
    title: 'Girasol',
    summary: 'Un girasol con dieciséis pétalos, una espiral de semillas, un tallo, dos hojas grandes y una abeja.',
    steps: [
      'El centro de la flor: un círculo grande con uno más pequeño dentro.',
      'Dieciséis pétalos puntiagudos alrededor. Dibuja cada uno como un óvalo largo y puntiagudo.',
      'Las semillas: una espiral que gira hacia afuera desde el centro.',
      'El tallo: dos líneas largas y curvas, una junto a la otra, hacia abajo.',
      'Una hoja grande a cada lado del tallo, cada una con una línea por el medio.',
      'Una abeja en la esquina: un cuerpo ovalado con dos rayas y dos alas.',
    ],
  },
  mandala: {
    title: 'Mandala',
    summary: 'Un patrón circular, construido anillo por anillo desde el centro hacia afuera. Tranquilo, cuidadoso y muy satisfactorio.',
    steps: [
      'El centro: un círculo pequeño con uno más grande alrededor.',
      'Ocho pétalos alrededor del centro. Dibuja cada uno como un óvalo puntiagudo que apunta hacia afuera.',
      'Dos anillos alrededor de los pétalos, muy juntos.',
      'Dieciséis pétalos pequeños entre los pétalos del anillo.',
      'Un borde festoneado, con dieciséis bultitos redondos. Da la vuelta completa.',
      'Un anillo de 24 puntitos fuera del borde. Cada uno es un circulito.',
      'El último anillo: dieciséis rayos cortos que apuntan hacia afuera.',
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
