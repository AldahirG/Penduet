import { useState } from 'react'
import { halfGuide, halfSubjects, halfText, topicText, topics, words, type GuidePoint } from '@penduet/lessons'
import { GUESS } from '@penduet/protocol'
import { getLang, t, useT } from '../i18n'
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
      topic: topics[game.topic] === undefined ? t('topic.fallback') : topicText(game.topic, getLang()),
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
    const text = halfText(subject, getLang())
    return {
      kind: 'halves',
      title: text.title,
      prompt: text.prompt,
      side: left ? 'left' : 'right',
      region: left ? { minX: 0, maxX: 500 } : { minX: 500, maxX: 1000 },
      guide: halfGuide(subject),
      peerName: state.peer?.name ?? t('game.peerFallback'),
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
    peerName: state.peer?.name ?? t('game.peerFallback'),
    hasPartner,
    canUndo: last !== undefined && last.authorId === me,
    pass: () => socket.sendPass(),
  }
}

export function GamePanel({ g }: { g: GameControls }) {
  return g.kind === 'topic' ? <TopicPanel g={g} /> : g.kind === 'halves' ? <HalvesPanel g={g} /> : g.kind === 'guess' ? <GuessPanel g={g} /> : <TurnsPanel g={g} />
}

function TopicPanel({ g }: { g: TopicControls }) {
  const { t } = useT()
  const [asking, setAsking] = useState(false)
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold text-muted">{t('game.topic.label')}</p>
        <h2 className="font-display text-lg font-bold">{t('topic.heading')}</h2>
      </div>
      <p data-testid="topic" className="max-w-prose text-lg">
        {g.topic}
      </p>
      <p className="text-sm text-muted">{t('topic.text')}</p>
      <div>
        <Button variant="secondary" onClick={() => setAsking(true)}>
          {t('topic.new')}
        </Button>
      </div>
      <Modal
        open={asking}
        onOpenChange={setAsking}
        title={t('topic.newTitle')}
        description={t('topic.newText')}
        confirm={{
          label: t('topic.new'),
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
  const { t } = useT()
  const [asking, setAsking] = useState(false)
  // The sentence is written once per language with the side word in the middle: split around it to bold the word.
  const you = t('halves.youDraw', { side: '\u0000', name: g.peerName, other: t(g.side === 'left' ? 'side.right' : 'side.left') }).split('\u0000')
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold text-muted">{t('game.halves.label')}</p>
        <h2 className="font-display text-lg font-bold" data-testid="subject">
          {g.title}
        </h2>
      </div>
      <p className="max-w-prose text-lg">
        {you[0]}
        <strong>{t(g.side === 'left' ? 'side.left' : 'side.right')}</strong>
        {you[1]}
      </p>
      <p className="text-sm text-muted">{t('halves.hint', { prompt: g.prompt })}</p>
      <div>
        <Button variant="secondary" onClick={() => setAsking(true)}>
          {t('halves.new')}
        </Button>
      </div>
      <Modal
        open={asking}
        onOpenChange={setAsking}
        title={t('halves.newTitle')}
        description={t('halves.newText')}
        confirm={{
          label: t('halves.new'),
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
  const { t } = useT()
  const text = !g.hasPartner ? t('turns.noPartner') : g.myTurn ? t('turns.mine', { name: g.peerName }) : t('turns.theirs', { name: g.peerName })
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold text-muted">{t('game.turns.label')}</p>
        <h2 className="font-display text-lg font-bold">{g.myTurn ? t('turns.yourTurn') : t('turns.theirTurn', { name: g.peerName })}</h2>
      </div>
      <p role="status" className="max-w-prose text-lg">
        {text}
      </p>
      <p className="text-sm text-muted">{t('turns.hint')}</p>
      {g.hasPartner && g.myTurn ? (
        <div>
          <Button variant="secondary" onClick={g.pass}>
            {t('turns.pass')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
