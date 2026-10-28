import { useState } from 'react'
import { halfGuide, halfSubjects, topics, words, type GuidePoint } from '@penduet/lessons'
import { GUESS } from '@penduet/protocol'
import type { RoomSocket, RoomState } from '../data/socket'
import type { Board } from '../drawing/board'
import { useCanUndo } from '../drawing/hooks'
import { Button, Modal } from '../ui'
import { GuessPanel, type GuessControls } from './GuessPanel'

/** The canvas shuts this long before the room's clock says so (see `drawUntil`). */
const DRAW_MARGIN_MS = 300

/** What a room that was made for a game needs from the page. Null in a free room or a lesson. */
export type GameControls = TopicControls | TurnsControls | HalvesControls | GuessControls

export interface TopicControls {
  kind: 'topic'
  topic: string
  /** Ask for another topic. Clears the canvas for both people. */
  next: () => void
}

export interface HalvesControls {
  kind: 'halves'
  title: string
  prompt: string
  /** The half you draw: seat 1 has the left one, seat 2 the right one. */
  side: 'left' | 'right'
  /** Where you may draw, as logical x. */
  region: { minX: number; maxX: number }
  /** The whole picture, both halves, for the dashed guide. */
  guide: GuidePoint[][]
  peerName: string
  /** Ask for another picture. Clears the canvas for both people. */
  next: () => void
}

export interface TurnsControls {
  kind: 'turns'
  /** You may start a stroke: it is your turn, or the person who has the pen is not here. */
  myTurn: boolean
  /** The other person's name, for "Mara's turn". */
  peerName: string
  /** There is someone to pass the pen to. */
  hasPartner: boolean
  /** The latest stroke on the canvas is yours, so you may take it back and have the pen again. */
  canUndo: boolean
  pass: () => void
}

/** Topic and pass-the-pen rooms. The room is the authority; this only reads its state and sends requests. */
export function useGame(state: RoomState, board: Board, socket: RoomSocket): GameControls | null {
  const me = state.you?.id ?? null
  useCanUndo(board, me) // re-render whenever finished strokes change
  const game = state.game
  if (!game || !state.you) return null

  if (game.kind === 'topic') {
    return {
      kind: 'topic',
      topic: topics[game.topic] ?? 'Draw anything you like, together.',
      next: () => {
        // Any topic but the one on screen. With only one on the list there is nothing to change to.
        if (topics.length < 2) return
        let pick = Math.floor(Math.random() * (topics.length - 1))
        if (pick >= game.topic) pick += 1
        socket.sendTopicSet(pick, game.topic)
      },
    }
  }

  if (game.kind === 'halves') {
    const subject = halfSubjects[game.subject] ?? halfSubjects[0]!
    const left = state.you.slot === 1
    return {
      kind: 'halves',
      title: subject.title,
      prompt: subject.prompt,
      side: left ? 'left' : 'right',
      region: left ? { minX: 0, maxX: 500 } : { minX: 500, maxX: 1000 },
      guide: halfGuide(subject),
      peerName: state.peer?.name ?? 'your partner',
      next: () => {
        if (halfSubjects.length < 2) return
        let pick = Math.floor(Math.random() * (halfSubjects.length - 1))
        if (pick >= game.subject) pick += 1
        socket.sendSubjectSet(pick, game.subject)
      },
    }
  }

  const hasPartner = state.peer !== null && !state.peerLeft

  if (game.kind === 'guess') {
    const seat = state.you.slot
    const amDrawer = game.drawer === seat
    return {
      kind: 'guess',
      phase: game.phase,
      round: game.round,
      interval: game.interval,
      intervals: GUESS.intervals,
      amDrawer,
      seat,
      drawerSeat: game.drawer,
      myName: state.you.name,
      peerName: state.peer?.name ?? 'Your partner',
      hasPartner,
      word: game.wordId === null ? null : (words[game.wordId] ?? null),
      // The room sends deadlines on its own clock. This device's clock may be a little different.
      deadline: game.deadline === null ? null : game.deadline - state.skew,
      canDraw: game.phase === 'draw' && amDrawer,
      drawUntil: game.deadline === null ? null : game.deadline - state.skew - DRAW_MARGIN_MS,
      last: game.last,
      result: game.result,
      score: game.score,
      played: game.played,
      won: game.won,
      submit: (text) => socket.sendGuess(text),
    }
  }

  const last = board.strokesSince(0).at(-1)
  return {
    kind: 'turns',
    myTurn: game.turn === state.you.slot || !hasPartner,
    peerName: state.peer?.name ?? 'your partner',
    hasPartner,
    canUndo: last !== undefined && last.authorId === me,
    pass: () => socket.sendPass(),
  }
}

export function GamePanel({ g }: { g: GameControls }) {
  return g.kind === 'topic' ? <TopicPanel g={g} /> : g.kind === 'halves' ? <HalvesPanel g={g} /> : g.kind === 'guess' ? <GuessPanel g={g} /> : <TurnsPanel g={g} />
}

function TopicPanel({ g }: { g: TopicControls }) {
  const [asking, setAsking] = useState(false)
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold text-muted">Draw a topic together</p>
        <h2 className="font-display text-lg font-bold">Your topic</h2>
      </div>
      <p data-testid="topic" className="max-w-prose text-lg">
        {g.topic}
      </p>
      <p className="text-sm text-muted">Draw at the same time, or take turns. There is no score: just make something.</p>
      <div>
        <Button variant="secondary" onClick={() => setAsking(true)}>
          New topic
        </Button>
      </div>
      <Modal
        open={asking}
        onOpenChange={setAsking}
        title="Pick a new topic?"
        description="The canvas is cleared for both of you. Use “Save as image” first if you want to keep this drawing."
        confirm={{
          label: 'New topic',
          onClick: () => {
            setAsking(false)
            g.next()
          },
        }}
      />
    </div>
  )
}

function HalvesPanel({ g }: { g: HalvesControls }) {
  const [asking, setAsking] = useState(false)
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold text-muted">Two halves of one picture</p>
        <h2 className="font-display text-lg font-bold" data-testid="subject">
          {g.title}
        </h2>
      </div>
      <p className="max-w-prose text-lg">
        You draw the <strong>{g.side}</strong> half. {g.peerName} draws the {g.side === 'left' ? 'right' : 'left'} one.
      </p>
      <p className="text-sm text-muted">{g.prompt} Your lines stop at the middle, so line them up where the halves meet.</p>
      <div>
        <Button variant="secondary" onClick={() => setAsking(true)}>
          New picture
        </Button>
      </div>
      <Modal
        open={asking}
        onOpenChange={setAsking}
        title="Pick a new picture?"
        description="The canvas is cleared for both of you. Use “Save as image” first if you want to keep this one."
        confirm={{
          label: 'New picture',
          onClick: () => {
            setAsking(false)
            g.next()
          },
        }}
      />
    </div>
  )
}

function TurnsPanel({ g }: { g: TurnsControls }) {
  const text = !g.hasPartner
    ? 'Waiting for your friend. Until they join, you can draw.'
    : g.myTurn
      ? `Draw one stroke, and the pen goes to ${g.peerName}.`
      : `${g.peerName} has the pen. Their stroke comes next.`
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold text-muted">Pass the pen</p>
        <h2 className="font-display text-lg font-bold">{g.myTurn ? 'Your turn' : `${g.peerName}’s turn`}</h2>
      </div>
      <p role="status" className="max-w-prose text-lg">
        {text}
      </p>
      <p className="text-sm text-muted">One stroke each, back and forth, until the drawing is done.</p>
      {g.hasPartner && g.myTurn ? (
        <div>
          <Button variant="secondary" onClick={g.pass}>
            Pass the pen
          </Button>
        </div>
      ) : null}
    </div>
  )
}
