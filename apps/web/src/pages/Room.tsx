import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Download, LogOut, UserPlus } from 'lucide-react'
import { roomCodeSchema } from '@penduet/protocol'
import { FreeTable } from '../components/FreeTable'
import { Stub } from '../components/Stub'
import { lessonText } from '@penduet/lessons'
import { useT } from '../i18n'
import { usePageTitle } from '../usePageTitle'
import { ROOMS_ARE_LIVE, RoomError, rooms } from '../data/rooms'
import { useRoomSession } from '../data/useRoomSession'
import { GamePanel, useGame } from '../games/GamePanel'
import { HalvesOverlay } from '../games/HalvesOverlay'
import { GuessCanvasOverlay } from '../games/GuessPanel'
import { GuessStage, stageIsOpen } from '../games/GuessStage'
import { RoomLessonPanel, useRoomLesson } from '../lessons/RoomLesson'
import { DrawingCanvas } from '../drawing/DrawingCanvas'
import { CANVAS_BOX_ROOM } from '../drawing/layout'
import { GuideOverlay } from '../drawing/GuideOverlay'
import { useCanUndo, useMediaQuery, useSavePicture } from '../drawing/hooks'
import { BRUSH_SIZES, DEFAULT_PALETTE } from '../drawing/palette'
import {
  Button,
  ButtonLink,
  ConnectionBanner,
  DrawingToolbar,
  Modal,
  PlayerChip,
  RoomCodeDisplay,
  Spinner,
  useToast,
  type DrawingTool,
  type PlayerStatus,
} from '../ui'

// S10 Lobby and S11 shared canvas on one page: you can draw while you wait for your partner.
export function Room() {
  const { t } = useT()
  const { code = '' } = useParams()

  if (!roomCodeSchema.safeParse(code).success) {
    return (
      <Stub screen="S10" title={t('room.badCode')} milestone="M2">
        <ConnectionBanner kind="room-expired" />
        <ButtonLink to="/together" variant="secondary" className="self-start">
          {t('room.backToRooms')}
        </ButtonLink>
      </Stub>
    )
  }
  return ROOMS_ARE_LIVE ? <LiveRoom code={code} /> : <DemoRoom code={code} />
}

/** No Supabase project configured: the lobby can be shown, but nothing is shared. */
function DemoRoom({ code }: { code: string }) {
  const { t } = useT()
  return (
    <Stub screen="S10 · S11" title={t('room.demoTitle')} milestone="M2">
      <RoomCodeDisplay code={code} link={`${window.location.origin}/room/${code}`} />
      <div className="flex flex-wrap gap-2">
        <PlayerChip name={t('room.you')} slot={1} status="online" isMe />
        <PlayerChip name={t('room.partner')} slot={2} status="waiting" />
      </div>
      <p className="text-muted">{t('room.demoText')}</p>
      <ButtonLink to="/together" variant="secondary" className="self-start">
        {t('room.leaveRoom')}
      </ButtonLink>
    </Stub>
  )
}

function LiveRoom({ code }: { code: string }) {
  const { t, tn, lang } = useT()
  usePageTitle(t('title.room', { code }))
  const navigate = useNavigate()
  const toast = useToast()
  const { board, state, isHost, socket } = useRoomSession(code)
  const [tool, setTool] = useState<DrawingTool>('pen')
  const [color, setColor] = useState(DEFAULT_PALETTE[0]!.value)
  const [size, setSize] = useState<number>(BRUSH_SIZES.presets.medium)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const wide = useMediaQuery('(min-width: 768px)')
  const { onEngine, save } = useSavePicture()

  const me = state.you?.id ?? null
  const canUndoAny = useCanUndo(board, me)
  const rl = useRoomLesson(state, board, socket)
  const game = useGame(state, board, socket)
  const { status } = state
  // Draw and guess: the canvas shuts a moment before the room shuts it (see `drawUntil`), so wake up then.
  const [, setTick] = useState(0)
  const drawUntil = game?.kind === 'guess' && game.canDraw ? game.drawUntil : null
  useEffect(() => {
    if (drawUntil === null) return
    const id = window.setTimeout(() => setTick((n) => n + 1), Math.max(0, drawUntil - Date.now()))
    return () => window.clearTimeout(id)
  }, [drawUntil])
  const canDraw = status === 'live' && me !== null && (!rl || rl.phase === 'draw') && (game?.kind !== 'turns' || game.myTurn) && (game?.kind !== 'guess' || (game.canDraw && Date.now() < (game.drawUntil ?? 0)))
  const canUndo = rl ? rl.canUndo : game?.kind === 'turns' ? game.canUndo : canUndoAny
  // In pass the pen you can only take a stroke back while it is the latest, which is exactly when the pen is not yours.
  const undoEnabled = game?.kind === 'turns' ? canUndo && status === 'live' : canUndo && canDraw

  // In a lesson or a game, your strokes start in your seat's colour so you can tell who drew what.
  const slot = state.you?.slot
  const seatColours = rl !== null || game !== null
  useEffect(() => {
    if (!seatColours || !slot) return
    const c = getComputedStyle(document.documentElement).getPropertyValue(`--color-player-${slot}`).trim()
    if (/^#[0-9a-fA-F]{6}$/.test(c)) setColor(c)
    // only when the seat becomes known
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot, seatColours])
  const showCanvas = status !== 'gone' && status !== 'full'

  const leave = async () => {
    setLeaving(true)
    try {
      await rooms.leave(code)
    } catch {
      // leaving is best effort: the room cleans itself up either way
    }
    navigate('/together')
  }

  const end = async () => {
    setConfirmEnd(false)
    try {
      await rooms.end(code)
    } catch (err) {
      toast.show(err instanceof RoomError && err.code === 'room_not_found' ? t('room.endOnlyHost') : t('room.endFail'), 'error')
    }
  }

  const undo = () => {
    if (rl) return rl.undo()
    if (me && board.undoLast(me)) socket.sendUndo()
  }
  const clear = () => {
    board.clear()
    socket.sendClear()
  }

  const closed = status === 'ended' || status === 'replaced'
  const myStatus: PlayerStatus = closed ? 'left' : status === 'reconnecting' ? 'reconnecting' : 'online'
  const peerStatus: PlayerStatus = !state.peer ? 'waiting' : state.peerLeft || closed ? 'left' : state.peerDrawing ? 'drawing' : 'online'
  const waiting = !state.peer || state.peerLeft

  return (
    <section aria-labelledby="room-title" className="flex flex-col gap-4">
      {/* Two fixed rows: the title and buttons, then the people. A chip changing width ("not here yet" to
          "here") must not make the row wrap or unwrap, because that moves the canvas under a stroke. */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col">
          <p aria-hidden="true" className="text-xs font-bold uppercase tracking-widest text-muted">
            {t('room.eyebrow')}
          </p>
          <h1 id="room-title" className="font-display text-xl font-bold sm:text-display">
            {t('room.title')}{' '}
            <span
              className="-rotate-2 inline-block rounded-md px-2 font-mono tracking-widest shadow-card"
              style={{ background: 'color-mix(in srgb, var(--color-paint-yellow) 38%, var(--color-surface-raised))' }}
            >
              {code}
            </span>
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {status !== 'ended' && status !== 'gone' && status !== 'full' ? (
            <Button
              variant={waiting && status === 'live' ? 'primary' : 'secondary'}
              icon={<UserPlus aria-hidden="true" className="h-4 w-4" />}
              onClick={() => setInviting(true)}
            >
              {t('room.invite')}
            </Button>
          ) : null}
          {showCanvas ? (
            <Button variant="secondary" icon={<Download aria-hidden="true" className="h-4 w-4" />} onClick={() => save(`room-${code}`)}>
              {t('common.saveImage')}
            </Button>
          ) : null}
          {status !== 'ended' && status !== 'gone' ? (
            <>
              {isHost ? (
                <Button variant="secondary" onClick={() => setConfirmEnd(true)}>
                  {t('room.end')}
                </Button>
              ) : null}
              <Button variant="ghost" loading={leaving} icon={<LogOut aria-hidden="true" className="h-4 w-4" />} onClick={leave}>
                {t('room.leave')}
              </Button>
            </>
          ) : null}
        </div>
      </div>
      <div className="flex min-h-[4.5rem] flex-wrap content-start items-center gap-2 sm:min-h-0">
        {state.you ? <PlayerChip name={state.you.name} slot={state.you.slot} status={myStatus} isMe /> : null}
        <PlayerChip name={state.peer?.name ?? t('room.partner')} slot={state.peer?.slot ?? (state.you?.slot === 1 ? 2 : 1)} status={peerStatus} />
      </div>

      <p role="status" className="sr-only">
        {state.peer ? t(state.peerLeft ? 'room.srPeerLeft' : 'room.srPeerIn', { name: state.peer.name }) : ''}
      </p>

      {status === 'full' ? <ConnectionBanner kind="room-full" /> : null}
      {status === 'gone' ? <ConnectionBanner kind="room-expired" /> : null}

      {status === 'ended' ? (
        <div className="rise flex flex-col items-start gap-3 paper p-4">
          <h2 className="font-display text-lg font-semibold">{t('room.closedTitle')}</h2>
          <p className="text-muted">{t('room.closedText')}</p>
          {me ? (
            <p className="text-sm text-muted">
              {tn('room.drewYou', board.strokesSince(0).filter((s) => s.authorId === me).length)}
              {state.peer ? `, ${tn('room.drew', board.strokesSince(0).filter((s) => s.authorId === state.peer!.id).length, { name: state.peer.name })}` : ''}.
            </p>
          ) : null}
        </div>
      ) : null}

      {status === 'connecting' ? (
        <p className="flex items-center gap-2 text-muted">
          <Spinner /> {t('room.gettingIn')}
        </p>
      ) : null}

      {showCanvas ? (
        // One column on a phone (lesson text, canvas, then notices); from lg up the canvas has its own column,
        // so notices and results appearing never move it. A moving canvas bends the stroke being drawn.
        <div className="grid gap-4 lg:grid-cols-[auto_20rem] lg:items-start">
          {rl && status !== 'connecting' ? (
            <div className="lg:col-start-2 lg:row-start-1 paper p-4">
              <RoomLessonPanel c={rl} state={state} />
            </div>
          ) : null}
          {!rl && !game && status !== 'connecting' ? (
            <div className="hidden lg:col-start-2 lg:row-start-1 lg:block">
              <FreeTable together={!waiting} />
            </div>
          ) : null}
          {game && game.kind !== 'guess' && status !== 'connecting' ? (
            <div className="lg:col-start-2 lg:row-start-1 paper p-4">
              <GamePanel g={game} />
            </div>
          ) : null}

          <div className="easel flex flex-col-reverse gap-3 p-3 sm:p-5 md:flex-row md:items-start lg:col-start-1 lg:row-span-3 lg:row-start-1">
            <DrawingToolbar
              orientation={wide ? 'vertical' : 'horizontal'}
              tool={tool}
              onToolChange={setTool}
              color={color}
              onColorChange={setColor}
              size={size}
              onSizeChange={setSize}
              canUndo={undoEnabled}
              onUndo={undo}
              onClear={rl ? rl.restartStep : clear}
              clearCopy={
                rl
                  ? {
                      label: t('lesson.restartLabel'),
                      title: t('lesson.restartTitle'),
                      description: t('lesson.restartTextRoom'),
                      confirm: t('lesson.restartConfirm'),
                    }
                  : undefined
              }
            />
            <div className={`sheet relative rounded-md ring-4 ring-raised ${CANVAS_BOX_ROOM} ${game?.kind === 'guess' && stageIsOpen(game.phase) ? 'z-[55]' : ''}`}>
              <DrawingCanvas
                board={board}
                authorId={me ?? 'pending'}
                tool={tool}
                color={color}
                size={size}
                disabled={!canDraw}
                dimWhenDisabled={game?.kind !== 'guess'}
                region={game?.kind === 'halves' ? game.region : undefined}
                onEngine={onEngine}
                onStrokeStart={(meta) => socket.sendStart(meta)}
                onStrokePoints={(id, pts) => socket.sendPoints(id, pts)}
                onStrokeEnd={(id) => socket.sendEnd(id)}
                label={
                  rl && rl.step
                    ? t('room.canvasLesson', { n: rl.stepIndex + 1, total: rl.lesson.steps.length, prompt: lessonText(rl.lesson, lang).steps[rl.stepIndex] ?? rl.step.prompt })
                    : game?.kind === 'topic'
                      ? t('room.canvasTopic', { topic: game.topic })
                      : game?.kind === 'turns'
                        ? game.myTurn
                          ? t('room.canvasTurnMine')
                          : t('room.canvasTurnPeer', { name: game.peerName })
                        : game?.kind === 'halves'
                          ? t('room.canvasHalves', { title: game.title, side: t(game.side === 'left' ? 'side.left' : 'side.right') })
                          : game?.kind === 'guess'
                            ? game.amDrawer
                              ? t('room.canvasGuessMe')
                              : t('room.canvasGuessPeer', { name: game.peerName })
                            : undefined
                }
              />
              {game?.kind === 'halves' ? <HalvesOverlay guide={game.guide} side={game.side} /> : null}
              {game?.kind === 'guess' ? <GuessCanvasOverlay g={game} /> : null}
              {rl && rl.step ? (
                <GuideOverlay guide={rl.step.guide} tolerance={rl.step.tolerance} result={rl.phase === 'result' ? state.lesson?.result?.guideCoverage : undefined} />
              ) : null}
            </div>
          </div>

          {/* Draw and guess: when the canvas locks (and when a round ends) a window opens over a blurred page; the canvas sits above the blur, so the drawing stays sharp. */}
          {game?.kind === 'guess' ? <GuessStage g={game} /> : null}

          {/* Draw and guess: on a phone the panel (word, answer box, clock) sits under the canvas, so the canvas stays where it is. */}
          {game?.kind === 'guess' && status !== 'connecting' ? (
            <div className="lg:col-start-2 lg:row-start-1">
              <GamePanel g={game} />
            </div>
          ) : null}

          <div className="flex flex-col gap-3 lg:col-start-2 lg:row-start-2">
            {rl && rl.phase === 'draw' && status === 'live' ? (
              <div className="flex flex-wrap gap-2">
                <Button onClick={rl.check} disabled={rl.stepStrokes.length === 0}>
                  {t('room.check')}
                </Button>
                <Button variant="ghost" onClick={rl.skip}>
                  {t('room.skip')}
                </Button>
              </div>
            ) : null}
            {status === 'reconnecting' ? <ConnectionBanner kind="reconnecting" /> : null}
            {status === 'replaced' ? <ConnectionBanner kind="replaced" action={{ label: t('banner.useTab'), onClick: () => socket.connect() }} /> : null}
            {status === 'live' && state.peerLeft ? <ConnectionBanner kind="peer-left" /> : null}
          </div>
        </div>
      ) : (
        <ButtonLink to="/together" variant="secondary" className="self-start">
          {t('room.backToRooms')}
        </ButtonLink>
      )}

      {status === 'ended' ? (
        <ButtonLink to="/together" variant="secondary" className="self-start">
          {t('room.backToRooms')}
        </ButtonLink>
      ) : null}

      <Modal
        open={inviting}
        onOpenChange={setInviting}
        title={t('room.inviteTitle')}
        description={t('room.inviteText')}
        cancelLabel={t('room.close')}
      >
        <RoomCodeDisplay code={code} link={`${window.location.origin}/room/${code}`} />
      </Modal>

      <Modal
        open={confirmEnd}
        onOpenChange={setConfirmEnd}
        title={t('room.endTitle')}
        description={t('room.endText')}
        confirm={{ label: t('room.end'), destructive: true, onClick: end }}
      />
    </section>
  )
}
