import { z } from 'zod'

// Room codes: 6 characters from a 32-character alphabet with no 0, O, 1 or I.
// Must match gen_room_code() and the rooms.code check in replica/schema.sql.
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const ROOM_CODE_LENGTH = 6
export const roomCodeSchema = z.string().regex(/^[A-HJ-NP-Z2-9]{6}$/)

/** Uppercases, drops anything that cannot be in a code (spaces, dashes, 0 O 1 I), caps at 6. */
export function normalizeRoomCode(input: string): string {
  let out = ''
  for (const ch of input.toUpperCase()) {
    if (ROOM_CODE_ALPHABET.includes(ch)) out += ch
    if (out.length === ROOM_CODE_LENGTH) break
  }
  return out
}

// Fixed logical canvas. Points are sent in these units so every screen size lines up.
export const CANVAS_SIZE = 1000
export const MAX_POINTS_PER_MESSAGE = 64

const coord = z.number().min(0).max(CANVAS_SIZE)
/** [x, y, pressure 0..1] */
export const pointSchema = z.tuple([coord, coord, z.number().min(0).max(1)])
export type Point = z.infer<typeof pointSchema>

export const toolSchema = z.enum(['pen', 'eraser'])
export const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/)
const strokeId = z.string().min(8).max(64)
const sizeSchema = z.number().min(1).max(64)

// ---- lessons in a room ----------------------------------------------------------
// Both people draw the same lesson on one canvas. Phases follow the messages: `lesson_set` starts a
// step (or restarts it), `step_result` is what a Check found and puts both people on the result card,
// and `lesson_set` for the next step moves on. The room keeps the state, so a reconnect picks it up.

/** What a finished check of one step amounts to. Scores are on this project's own 0-100 scale. */
export const stepSummarySchema = z.object({
  accuracy: z.number().int().min(0).max(100),
  smoothness: z.number().int().min(0).max(100),
  stars: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
})
export type StepSummary = z.infer<typeof stepSummarySchema>

export const stepResultSchema = stepSummarySchema.extend({
  passed: z.boolean(),
  /** Which hint to show. A key, not text: the client owns the wording. */
  hint: z.string().min(1).max(16),
  /** Per guide line, how much of it was traced (0-1). Lets both screens mark hit and missed lines. */
  guideCoverage: z.array(z.number().min(0).max(1)).max(32),
})
export type StepResult = z.infer<typeof stepResultSchema>

export const lessonStateSchema = z.object({
  slug: z.string().min(1).max(64),
  step: z.number().int().min(0).max(99),
  /** Finished strokes in the room when this step began. The step is scored on the strokes after them. */
  from: z.number().int().nonnegative(),
  /** What the latest check of this step found, or null before any (and after a restart). */
  result: stepResultSchema.nullable(),
  /** Latest check of each step so far, by step number. Null where a step was skipped or restarted. */
  results: z.array(stepSummarySchema.nullable()).max(100),
})
export type LessonState = z.infer<typeof lessonStateSchema>

// ---- game modes ---------------------------------------------------------------
// A room is a free canvas (or a lesson, see above) unless it was made for a game. The game is fixed when
// the room is made. `topic`: both people get a prompt to draw together, and either can ask for a new one.
// `turns` (pass the pen): people alternate, one stroke each, and the room enforces whose turn it is.
// `halves`: one symmetric picture, split down the middle. Seat 1 draws the left half and seat 2 the right
// half, and the room keeps each person's lines on their own side.

export const gameKindSchema = z.enum(['free', 'topic', 'turns', 'halves'])
export type GameKind = z.infer<typeof gameKindSchema>

const slotSchema = z.union([z.literal(1), z.literal(2)])
export type Slot = z.infer<typeof slotSchema>

export const gameStateSchema = z.discriminatedUnion('kind', [
  /** `topic` is an index into the shared list of topics. */
  z.object({ kind: z.literal('topic'), topic: z.number().int().min(0).max(999) }),
  /** `turn` is the seat (1 or 2) whose turn it is to draw. */
  z.object({ kind: z.literal('turns'), turn: slotSchema }),
  /** `subject` is an index into the list of two-halves pictures. */
  z.object({ kind: z.literal('halves'), subject: z.number().int().min(0).max(999) }),
])
export type GameState = z.infer<typeof gameStateSchema>

// ---- client -> server -------------------------------------------------------

export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('hello'), name: z.string().min(1).max(30) }),
  z.object({
    type: z.literal('stroke_start'),
    id: strokeId,
    tool: toolSchema,
    color: colorSchema,
    size: sizeSchema,
  }),
  z.object({
    type: z.literal('stroke_pts'),
    id: strokeId,
    pts: z.array(pointSchema).min(1).max(MAX_POINTS_PER_MESSAGE),
  }),
  z.object({ type: z.literal('stroke_end'), id: strokeId }),
  z.object({ type: z.literal('undo') }),
  z.object({ type: z.literal('clear') }),
  z.object({
    type: z.literal('lesson_set'),
    slug: z.string().min(1).max(64),
    step: z.number().int().min(0).max(99),
    /** Start the current step over. Without it, asking for the step the room is already on does nothing,
     *  so two people pressing "next" together move one step, not two. */
    restart: z.boolean().optional(),
  }),
  z.object({ type: z.literal('step_result'), step: z.number().int().min(0).max(99), result: stepResultSchema }),
  /** Topic room: ask for another topic. `after` is the topic you were looking at, so two people pressing
   *  "new topic" together change it once. The canvas is cleared. */
  z.object({ type: z.literal('topic_set'), topic: z.number().int().min(0).max(999), after: z.number().int().min(0).max(999) }),
  /** Pass-the-pen room: give the pen to the other person without drawing. */
  z.object({ type: z.literal('pass') }),
  /** Two-halves room: ask for another picture. Works like `topic_set`: `after` is the picture you were looking at, and the canvas is cleared. */
  z.object({ type: z.literal('subject_set'), subject: z.number().int().min(0).max(999), after: z.number().int().min(0).max(999) }),
])
export type ClientMessage = z.infer<typeof clientMessageSchema>

// ---- server -> client -------------------------------------------------------

export const playerSchema = z.object({
  id: z.string(),
  name: z.string(),
  slot: slotSchema,
})
export type Player = z.infer<typeof playerSchema>

export const strokeSchema = z.object({
  id: strokeId,
  authorId: z.string(),
  tool: toolSchema,
  color: colorSchema,
  size: sizeSchema,
  points: z.array(pointSchema),
  seq: z.number().int().nonnegative(),
})
export type Stroke = z.infer<typeof strokeSchema>

export const serverErrorCodes = ['room_full', 'room_not_found', 'bad_message', 'rate_limited', 'unauthorized', 'not_your_turn'] as const

/** Largest WebSocket text frame the room accepts. 64 points is about 2 KB, so this is generous. */
export const MAX_MESSAGE_BYTES = 16 * 1024

export const serverMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('welcome'),
    you: playerSchema,
    peer: playerSchema.nullable(),
    strokes: z.array(strokeSchema),
    /** Strokes someone is drawing right now, with the points so far. Later points and the end come as events. */
    open: z.array(strokeSchema).optional(),
    lesson: lessonStateSchema.nullable(),
    /** The game this room was made for, with its state. Absent or null for a free canvas or a lesson. */
    game: gameStateSchema.nullable().optional(),
    lastSeq: z.number().int().nonnegative(),
  }),
  z.object({ type: z.literal('peer_joined'), peer: playerSchema }),
  z.object({ type: z.literal('peer_left'), peerId: z.string() }),
  // A client message relayed by the room, stamped with the order it was accepted in.
  z.object({
    type: z.literal('event'),
    seq: z.number().int().nonnegative(),
    from: z.string(),
    body: clientMessageSchema,
  }),
  // Pass-the-pen: whose turn it is now. Sent after every stroke, pass or undo that changes it.
  z.object({ type: z.literal('turn'), slot: slotSchema }),
  // The host ended the room. The server closes the socket right after sending this.
  z.object({ type: z.literal('room_ended') }),
  z.object({ type: z.literal('error'), code: z.enum(serverErrorCodes) }),
])
export type ServerMessage = z.infer<typeof serverMessageSchema>

// ---- HTTP API of the realtime Worker -----------------------------------------

/** First WebSocket subprotocol. The second one is the ticket: new WebSocket(url, [WS_SUBPROTOCOL, ticket]). */
export const WS_SUBPROTOCOL = 'penduet.v1'
export const TICKET_TTL_SECONDS = 60

export const lessonSlugSchema = z.string().regex(/^[a-z0-9-]{1,64}$/)

export const createRoomRequestSchema = z.object({
  lessonSlug: lessonSlugSchema.optional(),
  /** A game instead of a free canvas. Not together with a lesson. */
  game: gameKindSchema.optional(),
  /** Cloudflare Turnstile token. Required for guests once the Worker has a Turnstile secret. */
  turnstileToken: z.string().min(1).max(2048).optional(),
})
export type CreateRoomRequest = z.infer<typeof createRoomRequestSchema>

/** Accepts what a person types ('k7q-2m9') and hands back a valid code or a validation error. */
export const joinRoomRequestSchema = z.object({
  code: z.string().max(32).transform(normalizeRoomCode).pipe(roomCodeSchema),
})
export type JoinRoomRequest = z.input<typeof joinRoomRequestSchema>

export const roomApiErrorCodes = [
  'not_authenticated',
  'bad_request',
  'room_not_found',
  'room_full',
  'too_many_rooms',
  'captcha_required',
  'captcha_failed',
  'rate_limited',
  'server_error',
] as const
export type RoomApiErrorCode = (typeof roomApiErrorCodes)[number]
export const roomApiErrorSchema = z.object({ error: z.enum(roomApiErrorCodes) })

/** What POST /rooms and POST /rooms/join return: connect with WS_SUBPROTOCOL and the ticket. */
export const roomJoinedSchema = z.object({
  code: roomCodeSchema,
  lessonSlug: lessonSlugSchema.nullable(),
  game: gameKindSchema.default('free'),
  ticket: z.string(),
  /** Whether the caller is the host right now. Only the host can end the room. */
  isHost: z.boolean(),
})
export type RoomJoined = z.infer<typeof roomJoinedSchema>
export const ticketResponseSchema = z.object({ ticket: z.string(), isHost: z.boolean() })
export type TicketResponse = z.infer<typeof ticketResponseSchema>

/** Keep-alive: send PING_FRAME every so often. The room answers PONG_FRAME without waking up. Not JSON. */
export const PING_FRAME = 'ping'
export const PONG_FRAME = 'pong'
