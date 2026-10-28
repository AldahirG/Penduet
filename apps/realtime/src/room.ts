import { DurableObject } from 'cloudflare:workers'
import {
  MAX_MESSAGE_BYTES,
  PING_FRAME,
  PONG_FRAME,
  WS_SUBPROTOCOL,
  clientMessageSchema,
  type GameState,
  type Player,
  type ServerMessage,
  type Stroke,
} from '@penduet/protocol'
import type { Env } from './env'
import { answer, nextWake, seatLeft, seatsFilled, tick, timingFor, visibleTo, type GuessGame, type Step, type Timing } from './guessGame'
import {
  allowMessage,
  applyClientMessage,
  newGame,
  newLesson,
  newRoomData,
  stamp,
  type RateWindow,
  type RoomData,
  type StorageOps,
  type TurnContext,
} from './roomLog'
import { ticketFromProtocolHeader, verifyTicket } from './ticket'

interface Meta {
  rid: string
  code: string
  cap: number
}

/** What a socket carries across hibernation. Keep it small: attachments are limited to 2 KB. */
interface Attachment {
  sid: string // this socket, so a close handler can tell itself from a newer socket of the same person
  uid: string
  name: string
  slot: 1 | 2
  rate: RateWindow
  strikes: number
  replaced: boolean
}

const IDLE_MS = 24 * 60 * 60 * 1000
const ENDED_KEEP_MS = 60 * 60 * 1000
const MAX_STRIKES = 20
/** After a wake-up the counter jumps ahead, so sequence numbers never repeat even though
 *  stroke_pts events do not each write the counter to storage. */
const SEQ_GAP_AFTER_WAKE = 100_000

/**
 * One instance per room, named by rooms.id (not the code: a code can be reused once a room ends).
 * It is the single authority for the room: it orders events, keeps the stroke log and the seats.
 * Uses the WebSocket Hibernation API, so an idle room costs nothing.
 */
export class Room extends DurableObject<Env> {
  private data: RoomData = newRoomData()
  private meta: Meta | null = null
  private slots: Record<string, 1 | 2> = {}
  private ended = false
  /** When an idle room is cleaned up. The one alarm is set to the sooner of this and the game's next deadline. */
  private idleAt = Date.now() + IDLE_MS

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    // Keep-alive answered by the runtime itself, so an idle room can stay hibernated.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING_FRAME, PONG_FRAME))
    void ctx.blockConcurrencyWhile(() => this.load())
  }

  private async load(): Promise<void> {
    const stored = await this.ctx.storage.get<unknown>(['meta', 'slots', 'ended', 'lesson', 'game', 'meta_seq', 'idle_at'])
    const meta = stored.get('meta') as Meta | undefined
    if (!meta) return
    this.meta = meta
    this.slots = (stored.get('slots') as Record<string, 1 | 2> | undefined) ?? {}
    this.ended = stored.get('ended') === true
    this.data.lesson = (stored.get('lesson') as RoomData['lesson'] | undefined) ?? null
    this.data.game = (stored.get('game') as RoomData['game'] | undefined) ?? null
    this.idleAt = (stored.get('idle_at') as number | undefined) ?? Date.now() + IDLE_MS
    this.data.seq = ((stored.get('meta_seq') as number | undefined) ?? 0) + SEQ_GAP_AFTER_WAKE
    const strokes = await this.ctx.storage.list<Stroke>({ prefix: 's:' })
    this.data.strokes = [...strokes.values()]
  }

  // ---- entry from the Worker: the WebSocket upgrade --------------------------

  async fetch(request: Request): Promise<Response> {
    const ticket = ticketFromProtocolHeader(request.headers.get('Sec-WebSocket-Protocol'), WS_SUBPROTOCOL)
    // The Worker checked this already. The room checks again, so it is safe whoever calls it.
    const claims = ticket ? await verifyTicket(this.env.TICKET_SECRET, ticket) : null
    if (!claims) return new Response('unauthorized', { status: 401 })
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 })
    if (this.ended) return new Response('room ended', { status: 410 })
    if (this.meta && this.meta.rid !== claims.rid) return new Response('wrong room', { status: 403 })

    if (!this.meta) {
      this.meta = { rid: claims.rid, code: claims.code, cap: claims.cap }
      if (claims.lesson) this.data.lesson = newLesson(claims.lesson)
      else this.data.game = newGame(claims.game)
      await this.ctx.storage.put({
        meta: this.meta,
        ...(this.data.lesson ? { lesson: this.data.lesson } : {}),
        ...(this.data.game ? { game: this.data.game } : {}),
      })
    }

    // One socket per person: a new connection replaces the old one (reconnect, second tab).
    for (const old of this.ctx.getWebSockets(claims.sub)) {
      const att = old.deserializeAttachment() as Attachment
      old.serializeAttachment({ ...att, replaced: true })
      old.close(4001, 'replaced')
    }

    const pair = new WebSocketPair()
    const [client, server] = [pair[0], pair[1]]
    const protocolHeader = { 'Sec-WebSocket-Protocol': WS_SUBPROTOCOL }

    const others = this.liveSockets().filter((ws) => this.attachment(ws).uid !== claims.sub)
    if (others.length >= this.meta.cap) {
      server.accept()
      this.send(server, { type: 'error', code: 'room_full' })
      server.close(4002, 'room_full')
      return new Response(null, { status: 101, webSocket: client, headers: protocolHeader })
    }

    const slot = await this.slotFor(claims.sub)
    await this.syncGame() // a deadline may have passed while the room slept
    const attachment: Attachment = {
      sid: crypto.randomUUID(),
      uid: claims.sub,
      name: claims.name,
      slot,
      rate: { start: Date.now(), messages: 0, points: 0 },
      strikes: 0,
      replaced: false,
    }
    this.ctx.acceptWebSocket(server, [claims.sub])
    server.serializeAttachment(attachment)

    const you: Player = { id: claims.sub, name: claims.name, slot }
    const peer = others[0] ? this.playerOf(others[0]) : null
    this.send(server, {
      type: 'welcome',
      you,
      peer,
      strokes: this.data.strokes,
      open: [...this.data.open.values()],
      lesson: this.data.lesson,
      game: this.gameFor(slot),
      lastSeq: this.data.seq,
      now: Date.now(),
    })
    for (const ws of others) this.send(ws, { type: 'peer_joined', peer: you })

    // Draw and guess starts by itself once both seats are taken.
    const g = this.guess()
    if (g && this.bothHere()) await this.applyStep(seatsFilled(g, Date.now(), this.timing()))
    await this.touch()
    return new Response(null, { status: 101, webSocket: client, headers: protocolHeader })
  }

  // ---- hibernation handlers --------------------------------------------------

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const att = this.attachment(ws)
    if (typeof message !== 'string' || message.length > MAX_MESSAGE_BYTES) return this.strike(ws, att)

    let parsed: ReturnType<typeof clientMessageSchema.safeParse>
    try {
      parsed = clientMessageSchema.safeParse(JSON.parse(message))
    } catch {
      return this.strike(ws, att)
    }
    if (!parsed.success) return this.strike(ws, att)

    const allowed = allowMessage(att.rate, Date.now(), parsed.data)
    ws.serializeAttachment(att)
    if (!allowed) {
      this.send(ws, { type: 'error', code: 'rate_limited' })
      return
    }

    if (this.guess()) {
      await this.syncGame() // judge this message against the room clock, not the browser clock
      if (parsed.data.type === 'guess') return this.handleGuess(ws, att.slot, parsed.data.text)
    }

    const outcome = applyClientMessage(this.data, att.uid, parsed.data, this.turnContext(att.slot))
    if (outcome.refused) {
      this.send(ws, { type: 'error', code: outcome.refused })
      return
    }
    if (outcome.event) {
      const frame = JSON.stringify({ type: 'event', ...outcome.event } satisfies ServerMessage)
      for (const peer of this.liveSockets()) peer.send(frame)
    }
    if (outcome.turn) this.broadcastTurn(outcome.turn)
    if (outcome.storage) await this.persist(outcome.storage)
    if (parsed.data.type === 'stroke_end') await this.touch()
  }

  async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    await this.left(ws)
    try {
      ws.close(code === 1005 || code === 1006 ? 1000 : code, 'closed')
    } catch {
      // already closed
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.left(ws)
  }

  // ---- calls from the Worker (Durable Object RPC) ----------------------------

  /** The person left through the API: drop their socket. The close handler tells the partner. */
  async kick(userId: string): Promise<void> {
    for (const ws of this.ctx.getWebSockets(userId)) ws.close(4003, 'left')
  }

  /** The host ended the room: tell everyone, close, and drop the log soon. */
  async end(): Promise<void> {
    this.ended = true
    this.idleAt = Date.now() + ENDED_KEEP_MS
    await this.ctx.storage.put({ ended: true, idle_at: this.idleAt })
    const frame = JSON.stringify({ type: 'room_ended' } satisfies ServerMessage)
    for (const ws of this.ctx.getWebSockets()) {
      ws.send(frame)
      ws.close(4004, 'room_ended')
    }
    await this.schedule()
  }

  /**
   * Two jobs share the room's one alarm. A game deadline (the next phase of draw and guess) moves the game on.
   * Past 24 hours without a finished stroke or a new connection (or an hour after the end), everything is deleted.
   */
  async alarm(): Promise<void> {
    await this.syncGame()
    if (Date.now() < this.idleAt) return this.schedule()
    if (!this.ended && this.ctx.getWebSockets().length > 0) {
      this.idleAt = Date.now() + IDLE_MS
      return this.schedule()
    }
    await this.ctx.storage.deleteAll()
    this.data = newRoomData()
    this.meta = null
    this.slots = {}
    this.ended = false
    this.idleAt = Date.now() + IDLE_MS
  }

  // ---- helpers ---------------------------------------------------------------

  private attachment(ws: WebSocket): Attachment {
    return ws.deserializeAttachment() as Attachment
  }

  private playerOf(ws: WebSocket): Player {
    const a = this.attachment(ws)
    return { id: a.uid, name: a.name, slot: a.slot }
  }

  /** Sockets that count as present: open and not already replaced by a newer one. */
  private liveSockets(): WebSocket[] {
    return this.ctx.getWebSockets().filter((ws) => !this.attachment(ws).replaced)
  }

  /** What pass-the-pen needs to know: the sender's seat, and whether a seat has someone in it. */
  private turnContext(slot: 1 | 2): TurnContext {
    return { slot, present: (s) => this.liveSockets().some((ws) => this.attachment(ws).slot === s) }
  }

  // ---- draw and guess ---------------------------------------------------------

  private guess(): GuessGame | null {
    return this.data.game?.kind === 'guess' ? this.data.game : null
  }

  /** What one seat may know of the game: in draw and guess the word goes only to the drawer. */
  private gameFor(slot: 1 | 2): GameState | null {
    const g = this.data.game
    return g?.kind === 'guess' ? visibleTo(g, slot) : g
  }

  private timing(): Timing {
    return timingFor(Number(this.env.GAME_SPEED ?? 1))
  }

  /** Both seats have someone in them. */
  private bothHere(): boolean {
    const seats = new Set(this.liveSockets().map((ws) => this.attachment(ws).slot))
    return seats.size === 2
  }

  /** Moves the game on past any deadline that has passed. Cheap when nothing is due. */
  private async syncGame(): Promise<void> {
    const g = this.guess()
    if (!g || this.ended) return
    await this.applyStep(tick(g, Date.now(), this.timing(), this.bothHere()))
  }

  private async handleGuess(ws: WebSocket, slot: 1 | 2, text: string): Promise<void> {
    const g = this.guess()
    const result = g ? answer(g, slot, text, Date.now(), this.timing()) : ({ refused: 'bad_message' } as const)
    if ('refused' in result) return this.send(ws, { type: 'error', code: result.refused })
    await this.applyStep(result)
  }

  /** Carries out what a game step reported: close the canvas, wipe it, tell both people, store the state, set the alarm. */
  private async applyStep(step: Step): Promise<void> {
    const g = this.guess()
    if (!g || !step.changed) return
    if (step.lock) {
      for (const uid of new Set([...this.data.open.values()].map((s) => s.authorId))) await this.finishOpenStrokes(uid, '')
    }
    if (step.clear) {
      this.data.strokes = []
      this.data.open.clear()
      const frame = JSON.stringify({ type: 'event', ...stamp(this.data, 'server', { type: 'clear' }) } satisfies ServerMessage)
      for (const ws of this.liveSockets()) ws.send(frame)
      await this.persist({ clearStrokes: true, put: { meta_seq: this.data.seq } })
    }
    await this.ctx.storage.put('game', g)
    this.broadcastGame()
    await this.schedule()
  }

  private broadcastGame(): void {
    const now = Date.now()
    for (const ws of this.liveSockets()) {
      const game = this.gameFor(this.attachment(ws).slot)
      if (game) this.send(ws, { type: 'game', game, now })
    }
  }

  /** The alarm goes off at the sooner of the game's next deadline and the idle clean-up. */
  private async schedule(): Promise<void> {
    const g = this.ended ? null : this.guess()
    const wake = g ? nextWake(g) : null
    const at = wake !== null ? Math.min(wake, this.idleAt) : this.idleAt
    await this.ctx.storage.setAlarm(Math.max(at, Date.now()))
  }

  private broadcastTurn(slot: 1 | 2): void {
    const frame = JSON.stringify({ type: 'turn', slot } satisfies ServerMessage)
    for (const ws of this.liveSockets()) ws.send(frame)
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    ws.send(JSON.stringify(msg))
  }

  /** Bad input: tell the sender, and hang up on a socket that keeps doing it. */
  private strike(ws: WebSocket, att: Attachment): void {
    att.strikes += 1
    ws.serializeAttachment(att)
    this.send(ws, { type: 'error', code: 'bad_message' })
    if (att.strikes >= MAX_STRIKES) ws.close(1008, 'too many bad messages')
  }

  private async left(ws: WebSocket): Promise<void> {
    const att = this.attachment(ws)
    if (att.replaced) return // a newer socket of the same person is already in
    const stillHere = this.liveSockets().some((other) => {
      const o = this.attachment(other)
      return o.sid !== att.sid && o.uid === att.uid
    })
    if (stillHere) return
    await this.finishOpenStrokes(att.uid, att.sid)
    const frame = JSON.stringify({ type: 'peer_left', peerId: att.uid } satisfies ServerMessage)
    for (const other of this.liveSockets()) {
      if (this.attachment(other).sid !== att.sid) other.send(frame)
    }
    // A round of draw and guess needs both people. It waits a few seconds for the one who dropped (a reload), then it is called off.
    const g = this.guess()
    if (g && !this.ended) {
      seatLeft(g, Date.now(), this.timing())
      await this.ctx.storage.put('game', g)
      await this.schedule()
    }
  }

  /**
   * A person who drops in the middle of a stroke leaves it half done on everyone's screen. Their stroke
   * is finished for them, as if they had lifted the pen, so it is kept and nobody is left with a stray line.
   */
  private async finishOpenStrokes(uid: string, sid: string): Promise<void> {
    for (const stroke of [...this.data.open.values()].filter((s) => s.authorId === uid)) {
      const slot = this.slots[uid]
      const outcome = applyClientMessage(this.data, uid, { type: 'stroke_end', id: stroke.id }, slot ? this.turnContext(slot) : undefined)
      if (outcome.event) {
        const frame = JSON.stringify({ type: 'event', ...outcome.event } satisfies ServerMessage)
        for (const peer of this.liveSockets()) if (this.attachment(peer).sid !== sid) peer.send(frame)
      }
      if (outcome.turn) {
        const frame = JSON.stringify({ type: 'turn', slot: outcome.turn } satisfies ServerMessage)
        for (const peer of this.liveSockets()) if (this.attachment(peer).sid !== sid) peer.send(frame)
      }
      if (outcome.storage) await this.persist(outcome.storage)
    }
  }

  /** A person keeps their seat (and colour) for the life of the room. */
  private async slotFor(uid: string): Promise<1 | 2> {
    const known = this.slots[uid]
    if (known) return known
    const connected = new Set(this.liveSockets().map((ws) => this.attachment(ws).slot))
    const held = new Set(Object.values(this.slots))
    // Prefer a seat nobody ever had, then one whose owner is not connected.
    const slot = ([1, 2] as const).find((s) => !held.has(s)) ?? ([1, 2] as const).find((s) => !connected.has(s)) ?? 2
    this.slots[uid] = slot
    await this.ctx.storage.put('slots', this.slots)
    return slot
  }

  private async persist(ops: StorageOps): Promise<void> {
    if (ops.clearStrokes) {
      const keys = [...(await this.ctx.storage.list({ prefix: 's:' })).keys()]
      for (let i = 0; i < keys.length; i += 128) await this.ctx.storage.delete(keys.slice(i, i + 128))
    }
    if (ops.del?.length) await this.ctx.storage.delete(ops.del)
    if (ops.put) await this.ctx.storage.put(ops.put)
  }

  private async touch(): Promise<void> {
    this.idleAt = Date.now() + IDLE_MS
    await this.schedule()
  }
}
