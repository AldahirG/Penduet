// Words for draw and guess, in English and Spanish. The drawer sees the word (in their own language) and a small
// picture to look at (`icon` names a Lucide icon, which the web app maps to the real one). The other person may
// answer in either language: an answer is checked against both. A room keeps the index of the word, so only ever
// add to the end of this list.

export type WordCategory = 'Animals' | 'Food' | 'Objects' | 'Places' | 'Nature' | 'Vehicles' | 'Characters' | 'Activities' | 'Ideas'

export interface Word {
  /** What the drawer is told to draw (English), and what an answer is checked against. */
  word: string
  /** The same word in Spanish. */
  es: string
  category: WordCategory
  /** Name of a Lucide icon: the reference picture for the drawer. */
  icon: string
  /** Other English answers that count as right. */
  aliases?: readonly string[]
  /** Other Spanish answers that count as right. */
  aliasesEs?: readonly string[]
}

type Row = [en: string, es: string, category: WordCategory, icon: string, aliases?: string[], aliasesEs?: string[]]

const rows: Row[] = [
  // Animals
  ['cat', 'gato', 'Animals', 'Cat', ['kitten', 'kitty'], ['gatito', 'minino']],
  ['dog', 'perro', 'Animals', 'Dog', ['puppy'], ['perrito', 'cachorro']],
  ['fish', 'pez', 'Animals', 'Fish', [], ['pescado', 'pescadito']],
  ['bird', 'pájaro', 'Animals', 'Bird', [], ['ave', 'pajarito']],
  ['rabbit', 'conejo', 'Animals', 'Rabbit', ['bunny'], ['liebre', 'conejito']],
  ['squirrel', 'ardilla', 'Animals', 'Squirrel'],
  ['turtle', 'tortuga', 'Animals', 'Turtle', ['tortoise']],
  ['snail', 'caracol', 'Animals', 'Snail'],
  ['bug', 'bicho', 'Animals', 'Bug', ['insect', 'beetle'], ['insecto', 'escarabajo']],
  ['mouse', 'ratón', 'Animals', 'Rat', ['rat'], ['rata']],
  ['worm', 'gusano', 'Animals', 'Worm', [], ['lombriz']],
  ['bone', 'hueso', 'Animals', 'Bone'],
  // Food
  ['apple', 'manzana', 'Food', 'Apple'],
  ['banana', 'plátano', 'Food', 'Banana', [], ['banana', 'platano']],
  ['cherry', 'cereza', 'Food', 'Cherry', ['cherries'], ['cerezas']],
  ['grapes', 'uvas', 'Food', 'Grape', ['grape'], ['uva']],
  ['orange', 'naranja', 'Food', 'Citrus', ['lemon', 'lime'], ['limón', 'lima', 'mandarina']],
  ['pizza', 'pizza', 'Food', 'Pizza'],
  ['cake', 'pastel', 'Food', 'Cake', [], ['tarta', 'torta']],
  ['ice cream', 'helado', 'Food', 'IceCreamCone', ['icecream'], ['nieve', 'paleta']],
  ['coffee', 'café', 'Food', 'Coffee', ['tea'], ['té']],
  ['egg', 'huevo', 'Food', 'Egg'],
  ['carrot', 'zanahoria', 'Food', 'Carrot'],
  ['sandwich', 'sándwich', 'Food', 'Sandwich', [], ['emparedado', 'bocadillo']],
  ['cookie', 'galleta', 'Food', 'Cookie', ['biscuit'], ['galletita']],
  ['croissant', 'cruasán', 'Food', 'Croissant', [], ['croissant', 'cuernito']],
  ['hamburger', 'hamburguesa', 'Food', 'Hamburger', ['burger']],
  ['candy', 'dulce', 'Food', 'Candy', ['sweet', 'sweets'], ['caramelo', 'golosina', 'dulces']],
  ['soup', 'sopa', 'Food', 'Soup'],
  ['popcorn', 'palomitas', 'Food', 'Popcorn', [], ['palomitas de maíz', 'pochoclo', 'cabritas', 'canguil']],
  ['donut', 'dona', 'Food', 'Donut', ['doughnut'], ['rosquilla', 'donut']],
  // Places
  ['house', 'casa', 'Places', 'House', ['home'], ['hogar']],
  ['castle', 'castillo', 'Places', 'Castle'],
  ['church', 'iglesia', 'Places', 'Church'],
  ['hospital', 'hospital', 'Places', 'Hospital'],
  ['school', 'escuela', 'Places', 'School', [], ['colegio']],
  ['shop', 'tienda', 'Places', 'Store', ['store'], ['comercio']],
  ['tent', 'carpa', 'Places', 'Tent', ['camping'], ['tienda de campaña', 'casa de campaña', 'acampar']],
  ['mountain', 'montaña', 'Places', 'Mountain', ['mountains'], ['monte', 'montañas']],
  ['island', 'isla', 'Places', 'Palmtree', ['beach'], ['playa']],
  ['fence', 'cerca', 'Places', 'Fence', ['gate'], ['valla', 'reja', 'portón']],
  // Nature
  ['tree', 'árbol', 'Nature', 'TreeDeciduous'],
  ['pine tree', 'pino', 'Nature', 'TreePine', ['pine', 'christmas tree'], ['árbol de navidad']],
  ['flower', 'flor', 'Nature', 'Flower'],
  ['leaf', 'hoja', 'Nature', 'Leaf'],
  ['sun', 'sol', 'Nature', 'Sun'],
  ['moon', 'luna', 'Nature', 'Moon'],
  ['cloud', 'nube', 'Nature', 'Cloud'],
  ['rain', 'lluvia', 'Nature', 'CloudRain', ['rainy'], ['llover']],
  ['snowflake', 'copo de nieve', 'Nature', 'Snowflake', ['snow'], ['copo']],
  ['rainbow', 'arcoíris', 'Nature', 'Rainbow', [], ['arco iris']],
  ['waves', 'olas', 'Nature', 'Waves', ['wave', 'sea', 'ocean'], ['ola', 'mar', 'océano']],
  ['fire', 'fuego', 'Nature', 'Flame', ['flame'], ['llama', 'fogata']],
  ['star', 'estrella', 'Nature', 'Star'],
  ['plant', 'planta', 'Nature', 'Sprout', ['seedling', 'sprout'], ['brote', 'semilla']],
  ['tornado', 'tornado', 'Nature', 'Tornado', [], ['ciclón']],
  // Vehicles
  ['car', 'coche', 'Vehicles', 'Car', [], ['carro', 'auto', 'automóvil']],
  ['bike', 'bicicleta', 'Vehicles', 'Bike', ['bicycle'], ['bici']],
  ['plane', 'avión', 'Vehicles', 'Plane', ['airplane', 'aeroplane']],
  ['ship', 'barco', 'Vehicles', 'Ship', ['boat'], ['buque', 'navío']],
  ['train', 'tren', 'Vehicles', 'Train'],
  ['bus', 'autobús', 'Vehicles', 'Bus', [], ['bus', 'micro', 'colectivo']],
  ['rocket', 'cohete', 'Vehicles', 'Rocket', ['spaceship'], ['nave espacial']],
  ['sailboat', 'velero', 'Vehicles', 'Sailboat', [], ['barco de vela']],
  ['truck', 'camión', 'Vehicles', 'Truck', ['lorry'], ['camioneta']],
  ['tractor', 'tractor', 'Vehicles', 'Tractor'],
  ['ambulance', 'ambulancia', 'Vehicles', 'Ambulance'],
  ['anchor', 'ancla', 'Vehicles', 'Anchor'],
  // Objects
  ['key', 'llave', 'Objects', 'Key'],
  ['lamp', 'lámpara', 'Objects', 'Lamp', ['lantern'], ['farol', 'linterna']],
  ['clock', 'reloj', 'Objects', 'Clock', ['watch']],
  ['book', 'libro', 'Objects', 'Book'],
  ['glasses', 'gafas', 'Objects', 'Glasses', ['spectacles'], ['lentes', 'anteojos']],
  ['guitar', 'guitarra', 'Objects', 'Guitar'],
  ['camera', 'cámara', 'Objects', 'Camera'],
  ['phone', 'teléfono', 'Objects', 'Phone', ['telephone'], ['celular', 'móvil']],
  ['scissors', 'tijeras', 'Objects', 'Scissors'],
  ['hammer', 'martillo', 'Objects', 'Hammer'],
  ['umbrella', 'paraguas', 'Objects', 'Umbrella', [], ['sombrilla']],
  ['gift', 'regalo', 'Objects', 'Gift', ['present'], ['presente']],
  ['bell', 'campana', 'Objects', 'Bell', [], ['campanita', 'timbre']],
  ['bed', 'cama', 'Objects', 'Bed'],
  ['sofa', 'sofá', 'Objects', 'Sofa', ['couch'], ['sillón']],
  ['shirt', 'camisa', 'Objects', 'Shirt', ['t-shirt', 'tshirt'], ['camiseta', 'playera', 'remera']],
  ['backpack', 'mochila', 'Objects', 'Backpack', ['rucksack']],
  ['telescope', 'telescopio', 'Objects', 'Telescope'],
  ['paintbrush', 'pincel', 'Objects', 'Paintbrush', ['brush'], ['brocha']],
  ['compass', 'brújula', 'Objects', 'Compass'],
  ['trophy', 'trofeo', 'Objects', 'Trophy', ['cup'], ['copa']],
  ['lightbulb', 'bombilla', 'Objects', 'Lightbulb', ['light bulb', 'bulb'], ['foco', 'bombillo']],
  ['headphones', 'auriculares', 'Objects', 'Headphones', [], ['audífonos', 'cascos']],
  ['laptop', 'computadora', 'Objects', 'Laptop', ['computer'], ['ordenador', 'portátil', 'laptop']],
  // Characters
  ['ghost', 'fantasma', 'Characters', 'Ghost'],
  ['king', 'rey', 'Characters', 'Crown', ['queen', 'crown', 'prince', 'princess'], ['reina', 'corona', 'príncipe', 'princesa']],
  ['wizard', 'mago', 'Characters', 'Wand', ['witch', 'magician', 'magic'], ['bruja', 'hechicero', 'brujo', 'magia']],
  ['pirate', 'pirata', 'Characters', 'Skull', ['skull'], ['calavera']],
  ['knight', 'caballero', 'Characters', 'Swords', ['warrior', 'sword'], ['guerrero', 'espada']],
  ['baby', 'bebé', 'Characters', 'Baby'],
  ['robot', 'robot', 'Characters', 'Bot'],
  // Activities
  ['dancing', 'bailar', 'Activities', 'PartyPopper', ['dance', 'party'], ['baile', 'bailando', 'fiesta']],
  ['fishing', 'pescar', 'Activities', 'Fish', ['fisherman'], ['pesca', 'pescador']],
  ['sleeping', 'dormir', 'Activities', 'Moon', ['sleep', 'nap'], ['durmiendo', 'siesta']],
  ['painting', 'pintar', 'Activities', 'Palette', ['paint'], ['pintando', 'pintura']],
  ['running', 'correr', 'Activities', 'Footprints', ['run', 'walking', 'walk'], ['corriendo', 'caminar', 'caminando']],
  ['lifting weights', 'pesas', 'Activities', 'Dumbbell', ['weights', 'gym', 'dumbbell'], ['levantar pesas', 'gimnasio', 'mancuerna']],
  ['singing', 'cantar', 'Activities', 'Mic', ['sing', 'karaoke'], ['cantando']],
  ['reading', 'leer', 'Activities', 'Book', ['read'], ['leyendo', 'lectura']],
  // Ideas
  ['love', 'amor', 'Ideas', 'Heart', ['heart'], ['corazón']],
  ['idea', 'idea', 'Ideas', 'Lightbulb', ['inspiration'], ['inspiración']],
  ['music', 'música', 'Ideas', 'Music', ['song'], ['canción']],
  ['luck', 'suerte', 'Ideas', 'Dices', ['dice', 'gamble'], ['dado', 'dados']],
  ['speed', 'velocidad', 'Ideas', 'Zap', ['fast', 'lightning'], ['rápido', 'rapidez', 'rayo']],
  ['puzzle', 'rompecabezas', 'Ideas', 'Puzzle', [], ['puzle', 'acertijo']],
  ['time', 'tiempo', 'Ideas', 'Clock', [], ['hora']],
  ['winner', 'ganador', 'Ideas', 'Medal', ['medal', 'victory'], ['medalla', 'victoria', 'campeón']],
]

export const words: readonly Word[] = rows.map(([word, es, category, icon, aliases, aliasesEs]) => ({
  word,
  es,
  category,
  icon,
  ...(aliases?.length ? { aliases } : {}),
  ...(aliasesEs?.length ? { aliasesEs } : {}),
}))

/** The word as shown to someone who reads this language. */
export const wordIn = (w: Word, lang: 'en' | 'es'): string => (lang === 'es' ? w.es : w.word)

/** Lowercase, no accents, no leading article, and only letters and digits: "The Ice-Cream", "el helado" and "icecream" are the same. */
export function normalizeAnswer(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .trim()
    .replace(/^(a|an|the|el|la|los|las|un|una)\s+/, '')
    .replace(/[^a-z0-9]+/g, '')
}

function distanceAtMostOne(a: string, b: string): boolean {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 1) return false
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  let i = 0
  while (i < short.length && short[i] === long[i]) i++
  if (short.length === long.length) return short.slice(i + 1) === long.slice(i + 1) // one letter different
  return short.slice(i) === long.slice(i + 1) // one letter missing
}

const targetsOf = (w: Word): string[] => [w.word, w.es, ...(w.aliases ?? []), ...(w.aliasesEs ?? [])].map(normalizeAnswer)

/** Every word and alias of the list, in both languages, normalised. */
const known = new Set(words.flatMap(targetsOf))

/**
 * Whether `text` is a right answer for `words[id]`: the word or an alias, in English or Spanish, with a plural "s" or one
 * mistyped letter forgiven (not for short words, where one letter makes a different word, nor when the answer is another
 * word of the list: "mouse" is not a typo of "house").
 */
export function isCorrectAnswer(id: number, text: string): boolean {
  const entry = words[id]
  if (!entry) return false
  const guess = normalizeAnswer(text)
  if (guess.length === 0) return false
  const targets = targetsOf(entry)
  if (targets.some((t) => guess === t || guess === `${t}s` || guess === `${t}es` || `${guess}s` === t)) return true
  if (known.has(guess)) return false
  return targets.some((t) => t.length >= 5 && guess.length >= 4 && distanceAtMostOne(guess, t))
}
