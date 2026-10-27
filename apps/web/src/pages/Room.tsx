import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Download, LogOut, UserPlus } from 'lucide-react'
import { roomCodeSchema } from '@penduet/protocol'
import { Stub } from '../components/Stub'
import { usePageTitle } from '../usePageTitle'
import { ROOMS_ARE_LIVE, RoomError, rooms } from '../data/rooms'
import { useRoomSession } from '../data/useRoomSession'
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
  const { code = '' } = useParams()

  if (!roomCodeSchema.safeParse(code).success) {
    return (
      <Stub screen="S10" title="That does not look like a room code" milestone="M2">
        <ConnectionBanner kind="room-expired" />
        <ButtonLink to="/together" variant="secondary" className="self-start">
          Back to rooms
        </ButtonLink>
      </Stub>
    )
  }
  return ROOMS_ARE_LIVE ? <LiveRoom code={code} /> : <DemoRoom code={code} />
}

const strokeWords = (n: number, who: string) => `${who} drew ${n} ${n === 1 ? 'stroke' : 'strokes'}`

/** No Supabase project configured: the lobby can be shown, but nothing is shared. */
function DemoRoom({ code }: { code: string }) {
  return (
    <Stub screen="S10 · S11" title="Your room (demo mode)" milestone="M2">
      <RoomCodeDisplay code={code} link={`${window.location.origin}/room/${code}`} />
      <div className="flex flex-wrap gap-2">
        <PlayerChip name="You" slot={1} status="online" isMe />
        <PlayerChip name="Partner" slot={2} status="waiting" />
      </div>
      <p className="text-muted">
        The live canvas needs the backend. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see apps/web/.env.example) and restart.
      </p>
      <ButtonLink to="/together" variant="secondary" className="self-start">
        Leave room
      </ButtonLink>
    </Stub>
  )
}

function LiveRoom({ code }: { code: string }) {
  usePageTitle(`Room ${code}`)
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
  const { status } = state
  const canDraw = status === 'live' && me !== null && (!rl || rl.phase === 'draw')
  const canUndo = rl ? rl.canUndo : canUndoAny

  // In a lesson, your strokes start in your seat's colour so you can tell who drew what.
  const slot = state.you?.slot
  useEffect(() => {
    if (!rl || !slot) return
    const c = getComputedStyle(document.documentElement).getPropertyValue(`--color-player-${slot}`).trim()
    if (/^#[0-9a-fA-F]{6}$/.test(c)) setColor(c)
    // only when the seat becomes known
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot, rl === null])
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
      toast.show(err instanceof RoomError && err.code === 'room_not_found' ? 'Only the host can end the room.' : 'Could not end the room. Try again.', 'error')
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 id="room-title" className="font-display text-xl font-bold">
          Room {code}
        </h1>
        <div className="flex flex-wrap gap-2">
          {status !== 'ended' && status !== 'gone' && status !== 'full' ? (
            <Button
              variant={waiting && status === 'live' ? 'primary' : 'secondary'}
              icon={<UserPlus aria-hidden="true" className="h-4 w-4" />}
              onClick={() => setInviting(true)}
            >
              Invite
            </Button>
          ) : null}
          {showCanvas ? (
            <Button variant="secondary" icon={<Download aria-hidden="true" className="h-4 w-4" />} onClick={() => save(`room-${code}`)}>
              Save as image
            </Button>
          ) : null}
          {status !== 'ended' && status !== 'gone' ? (
            <>
              {isHost ? (
                <Button variant="secondary" onClick={() => setConfirmEnd(true)}>
                  End room
                </Button>
              ) : null}
              <Button variant="ghost" loading={leaving} icon={<LogOut aria-hidden="true" className="h-4 w-4" />} onClick={leave}>
                Leave
              </Button>
            </>
          ) : null}
        </div>
      </div>
      <div className="flex min-h-[4.5rem] flex-wrap content-start items-center gap-2 sm:min-h-0">
        {state.you ? <PlayerChip name={state.you.name} slot={state.you.slot} status={myStatus} isMe /> : null}
        <PlayerChip name={state.peer?.name ?? 'Partner'} slot={state.peer?.slot ?? (state.you?.slot === 1 ? 2 : 1)} status={peerStatus} />
      </div>

      <p role="status" className="sr-only">
        {state.peer ? `${state.peer.name} ${state.peerLeft ? 'left the room' : 'is in the room'}` : ''}
      </p>

      {status === 'full' ? <ConnectionBanner kind="room-full" /> : null}
      {status === 'gone' ? <ConnectionBanner kind="room-expired" /> : null}

      {status === 'ended' ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-line bg-surface p-4">
          <h2 className="font-display text-lg font-semibold">The room has closed</h2>
          <p className="text-muted">The host ended it. Your drawing is still below, so save it before you leave.</p>
          {me ? (
            <p className="text-sm text-muted">
              {strokeWords(board.strokesSince(0).filter((s) => s.authorId === me).length, 'You')}
              {state.peer ? `, ${strokeWords(board.strokesSince(0).filter((s) => s.authorId === state.peer!.id).length, state.peer.name)}` : ''}.
            </p>
          ) : null}
        </div>
      ) : null}

      {status === 'connecting' ? (
        <p className="flex items-center gap-2 text-muted">
          <Spinner /> Getting you in…
        </p>
      ) : null}

      {showCanvas ? (
        // One column on a phone (lesson text, canvas, then notices); from lg up the canvas has its own column,
        // so notices and results appearing never move it. A moving canvas bends the stroke being drawn.
        <div className="grid gap-4 lg:grid-cols-[auto_20rem] lg:items-start">
          {rl && status !== 'connecting' ? (
            <div className="lg:col-start-2 lg:row-start-1">
              <RoomLessonPanel c={rl} state={state} />
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 md:flex-row md:items-start lg:col-start-1 lg:row-span-3 lg:row-start-1">
            <DrawingToolbar
              orientation={wide ? 'vertical' : 'horizontal'}
              tool={tool}
              onToolChange={setTool}
              color={color}
              onColorChange={setColor}
              size={size}
              onSizeChange={setSize}
              canUndo={canUndo && canDraw}
              onUndo={undo}
              onClear={rl ? rl.restartStep : clear}
              clearCopy={
                rl
                  ? {
                      label: 'Start this step again',
                      title: 'Start this step again?',
                      description: 'What either of you drew in this step is removed for both. Earlier steps stay.',
                      confirm: 'Start again',
                    }
                  : undefined
              }
            />
            <div className={`relative ${CANVAS_BOX_ROOM}`}>
              <DrawingCanvas
                board={board}
                authorId={me ?? 'pending'}
                tool={tool}
                color={color}
                size={size}
                disabled={!canDraw}
                onEngine={onEngine}
                onStrokeStart={(meta) => socket.sendStart(meta)}
                onStrokePoints={(id, pts) => socket.sendPoints(id, pts)}
                onStrokeEnd={(id) => socket.sendEnd(id)}
                label={rl && rl.step ? `Shared lesson canvas, step ${rl.stepIndex + 1} of ${rl.lesson.steps.length}. ${rl.step.prompt}` : undefined}
              />
              {rl && rl.step ? (
                <GuideOverlay guide={rl.step.guide} tolerance={rl.step.tolerance} result={rl.phase === 'result' ? state.lesson?.result?.guideCoverage : undefined} />
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:col-start-2 lg:row-start-2">
            {rl && rl.phase === 'draw' && status === 'live' ? (
              <div className="flex flex-wrap gap-2">
                <Button onClick={rl.check} disabled={rl.stepStrokes.length === 0}>
                  Check our drawing
                </Button>
                <Button variant="ghost" onClick={rl.skip}>
                  Skip step
                </Button>
              </div>
            ) : null}
            {status === 'reconnecting' ? <ConnectionBanner kind="reconnecting" /> : null}
            {status === 'replaced' ? <ConnectionBanner kind="replaced" action={{ label: 'Use this tab', onClick: () => socket.connect() }} /> : null}
            {status === 'live' && state.peerLeft ? <ConnectionBanner kind="peer-left" /> : null}
          </div>
        </div>
      ) : (
        <ButtonLink to="/together" variant="secondary" className="self-start">
          Back to rooms
        </ButtonLink>
      )}

      {status === 'ended' ? (
        <ButtonLink to="/together" variant="secondary" className="self-start">
          Back to rooms
        </ButtonLink>
      ) : null}

      <Modal
        open={inviting}
        onOpenChange={setInviting}
        title="Invite a friend"
        description="Send them this code or link. Up to two people can draw in a room."
        cancelLabel="Close"
      >
        <RoomCodeDisplay code={code} link={`${window.location.origin}/room/${code}`} />
      </Modal>

      <Modal
        open={confirmEnd}
        onOpenChange={setConfirmEnd}
        title="End the room for everyone?"
        description="Both of you are disconnected. You can still save the drawing from this page."
        confirm={{ label: 'End room', destructive: true, onClick: end }}
      />
    </section>
  )
}
