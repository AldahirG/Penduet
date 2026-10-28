// Words for draw and guess. The drawer sees the word and a small picture to look at (`icon` names a
// Lucide icon, which the web app maps to the real one); the other person only sees what gets drawn.
// A room keeps the index of the word, so only ever add to the end of this list.

export type WordCategory = 'Animals' | 'Food' | 'Objects' | 'Places' | 'Nature' | 'Vehicles' | 'Characters' | 'Activities' | 'Ideas'

export interface Word {
  /** What the drawer is told to draw, and what the answer is checked against. */
  word: string
  category: WordCategory
  /** Name of a Lucide icon: the reference picture for the drawer. */
  icon: string
  /** Other answers that count as right. */
  aliases?: readonly string[]
}

type Row = [word: string, category: WordCategory, icon: string, aliases?: string[]]

const rows: Row[] = [
  // Animals
  ['cat', 'Animals', 'Cat', ['kitten', 'kitty']],
  ['dog', 'Animals', 'Dog', ['puppy']],
  ['fish', 'Animals', 'Fish'],
  ['bird', 'Animals', 'Bird'],
  ['rabbit', 'Animals', 'Rabbit', ['bunny']],
  ['squirrel', 'Animals', 'Squirrel'],
  ['turtle', 'Animals', 'Turtle', ['tortoise']],
  ['snail', 'Animals', 'Snail'],
  ['bug', 'Animals', 'Bug', ['insect', 'beetle']],
  ['mouse', 'Animals', 'Rat', ['rat']],
  ['worm', 'Animals', 'Worm'],
  ['bone', 'Animals', 'Bone'],
  // Food
  ['apple', 'Food', 'Apple'],
  ['banana', 'Food', 'Banana'],
  ['cherry', 'Food', 'Cherry', ['cherries']],
  ['grapes', 'Food', 'Grape', ['grape']],
  ['orange', 'Food', 'Citrus', ['lemon', 'lime']],
  ['pizza', 'Food', 'Pizza'],
  ['cake', 'Food', 'Cake'],
  ['ice cream', 'Food', 'IceCreamCone', ['icecream']],
  ['coffee', 'Food', 'Coffee', ['tea']],
  ['egg', 'Food', 'Egg'],
  ['carrot', 'Food', 'Carrot'],
  ['sandwich', 'Food', 'Sandwich'],
  ['cookie', 'Food', 'Cookie', ['biscuit']],
  ['croissant', 'Food', 'Croissant'],
  ['hamburger', 'Food', 'Hamburger', ['burger']],
  ['candy', 'Food', 'Candy', ['sweet', 'sweets']],
  ['soup', 'Food', 'Soup'],
  ['popcorn', 'Food', 'Popcorn'],
  ['donut', 'Food', 'Donut', ['doughnut']],
  // Places
  ['house', 'Places', 'House', ['home']],
  ['castle', 'Places', 'Castle'],
  ['church', 'Places', 'Church'],
  ['hospital', 'Places', 'Hospital'],
  ['school', 'Places', 'School'],
  ['shop', 'Places', 'Store', ['store']],
  ['tent', 'Places', 'Tent', ['camping']],
  ['mountain', 'Places', 'Mountain', ['mountains']],
  ['island', 'Places', 'Palmtree', ['beach']],
  ['fence', 'Places', 'Fence', ['gate']],
  // Nature
  ['tree', 'Nature', 'TreeDeciduous'],
  ['pine tree', 'Nature', 'TreePine', ['pine', 'christmas tree']],
  ['flower', 'Nature', 'Flower'],
  ['leaf', 'Nature', 'Leaf'],
  ['sun', 'Nature', 'Sun'],
  ['moon', 'Nature', 'Moon'],
  ['cloud', 'Nature', 'Cloud'],
  ['rain', 'Nature', 'CloudRain', ['rainy']],
  ['snowflake', 'Nature', 'Snowflake', ['snow']],
  ['rainbow', 'Nature', 'Rainbow'],
  ['waves', 'Nature', 'Waves', ['wave', 'sea', 'ocean']],
  ['fire', 'Nature', 'Flame', ['flame']],
  ['star', 'Nature', 'Star'],
  ['plant', 'Nature', 'Sprout', ['seedling', 'sprout']],
  ['tornado', 'Nature', 'Tornado'],
  // Vehicles
  ['car', 'Vehicles', 'Car'],
  ['bike', 'Vehicles', 'Bike', ['bicycle']],
  ['plane', 'Vehicles', 'Plane', ['airplane', 'aeroplane']],
  ['ship', 'Vehicles', 'Ship', ['boat']],
  ['train', 'Vehicles', 'Train'],
  ['bus', 'Vehicles', 'Bus'],
  ['rocket', 'Vehicles', 'Rocket', ['spaceship']],
  ['sailboat', 'Vehicles', 'Sailboat'],
  ['truck', 'Vehicles', 'Truck', ['lorry']],
  ['tractor', 'Vehicles', 'Tractor'],
  ['ambulance', 'Vehicles', 'Ambulance'],
  ['anchor', 'Vehicles', 'Anchor'],
  // Objects
  ['key', 'Objects', 'Key'],
  ['lamp', 'Objects', 'Lamp', ['lantern']],
  ['clock', 'Objects', 'Clock', ['watch']],
  ['book', 'Objects', 'Book'],
  ['glasses', 'Objects', 'Glasses', ['spectacles']],
  ['guitar', 'Objects', 'Guitar'],
  ['camera', 'Objects', 'Camera'],
  ['phone', 'Objects', 'Phone', ['telephone']],
  ['scissors', 'Objects', 'Scissors'],
  ['hammer', 'Objects', 'Hammer'],
  ['umbrella', 'Objects', 'Umbrella'],
  ['gift', 'Objects', 'Gift', ['present']],
  ['bell', 'Objects', 'Bell'],
  ['bed', 'Objects', 'Bed'],
  ['sofa', 'Objects', 'Sofa', ['couch']],
  ['shirt', 'Objects', 'Shirt', ['t-shirt', 'tshirt']],
  ['backpack', 'Objects', 'Backpack', ['rucksack']],
  ['telescope', 'Objects', 'Telescope'],
  ['paintbrush', 'Objects', 'Paintbrush', ['brush']],
  ['compass', 'Objects', 'Compass'],
  ['trophy', 'Objects', 'Trophy', ['cup']],
  ['lightbulb', 'Objects', 'Lightbulb', ['light bulb', 'bulb']],
  ['headphones', 'Objects', 'Headphones'],
  ['laptop', 'Objects', 'Laptop', ['computer']],
  // Characters
  ['ghost', 'Characters', 'Ghost'],
  ['king', 'Characters', 'Crown', ['queen', 'crown', 'prince', 'princess']],
  ['wizard', 'Characters', 'Wand', ['witch', 'magician', 'magic']],
  ['pirate', 'Characters', 'Skull', ['skull']],
  ['knight', 'Characters', 'Swords', ['warrior', 'sword']],
  ['baby', 'Characters', 'Baby'],
  ['robot', 'Characters', 'Bot'],
  // Activities
  ['dancing', 'Activities', 'PartyPopper', ['dance', 'party']],
  ['fishing', 'Activities', 'Fish', ['fisherman']],
  ['sleeping', 'Activities', 'Moon', ['sleep', 'nap']],
  ['painting', 'Activities', 'Palette', ['paint']],
  ['running', 'Activities', 'Footprints', ['run', 'walking', 'walk']],
  ['lifting weights', 'Activities', 'Dumbbell', ['weights', 'gym', 'dumbbell']],
  ['singing', 'Activities', 'Mic', ['sing', 'karaoke']],
  ['reading', 'Activities', 'Book', ['read']],
  // Ideas
  ['love', 'Ideas', 'Heart', ['heart']],
  ['idea', 'Ideas', 'Lightbulb', ['inspiration']],
  ['music', 'Ideas', 'Music', ['song']],
  ['luck', 'Ideas', 'Dices', ['dice', 'gamble']],
  ['speed', 'Ideas', 'Zap', ['fast', 'lightning']],
  ['puzzle', 'Ideas', 'Puzzle'],
  ['time', 'Ideas', 'Clock'],
  ['winner', 'Ideas', 'Medal', ['medal', 'victory']],
]

export const words: readonly Word[] = rows.map(([word, category, icon, aliases]) => ({ word, category, icon, ...(aliases ? { aliases } : {}) }))

/** Lowercase, no accents, no leading "a" or "the", and only letters and digits: "The Ice-Cream" and "icecream" are one answer. */
export function normalizeAnswer(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .trim()
    .replace(/^(a|an|the)\s+/, '')
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

/**
 * Whether `text` is a right answer for `words[id]`: the word or one of its aliases, with a plural "s" or one
 * mistyped letter forgiven (not for short words, where one letter makes a different word).
 */
export function isCorrectAnswer(id: number, text: string): boolean {
  const entry = words[id]
  if (!entry) return false
  const guess = normalizeAnswer(text)
  if (guess.length === 0) return false
  const targets = [entry.word, ...(entry.aliases ?? [])].map(normalizeAnswer)
  if (targets.some((t) => guess === t || guess === `${t}s` || guess === `${t}es` || `${guess}s` === t)) return true
  // A typo may be forgiven, but not when the answer is a different word of the list ("mouse" is not a typo of "house").
  if (known.has(guess)) return false
  return targets.some((t) => t.length >= 5 && guess.length >= 4 && distanceAtMostOne(guess, t))
}

/** Every word and alias in the list, normalised. */
const known = new Set(words.flatMap((w) => [w.word, ...(w.aliases ?? [])].map(normalizeAnswer)))
