import { useEffect } from 'react'
import { findLesson, lessonText, scoreStep, type Lesson } from '@penduet/lessons'
import type { Stroke } from '@penduet/protocol'
import type { RoomSocket, RoomState } from '../data/socket'
import { saveResult } from '../data/progress'
import type { Board } from '../drawing/board'
import { useCanUndo } from '../drawing/hooks'
import { useT } from '../i18n'
import { Button, ButtonLink, ScoreCard, StepProgress } from '../ui'
import { LessonSummary, hintFor, overallStars, stageLabel, type StepOutcome } from './shared'

export type RoomLessonPhase = 'draw' | 'result' | 'done'

export interface RoomLessonControls {
  lesson: Lesson
  stepIndex: number
  phase: RoomLessonPhase
  /** The current step's guide, or null once the lesson is done. */
  step: Lesson['steps'][number] | null
  /** Strokes drawn in this step (by either person). Check needs at least one. */
  stepStrokes: Stroke[]
  canUndo: boolean
  check: () => void
  undo: () => void
  /** Start this step again (also what "clear" means in a lesson room). */
  restartStep: () => void
  next: () => void
  /** Move on without a pass: the step is cleared and counted as skipped. */
  skip: () => void
  /** After the last step: wipe the canvas and begin again. */
  again: () => void
}

/**
 * The lesson side of a room. Both people see the same step, prompt and guide, and either can check,
 * retry or move on: those go through the room, so both screens change together. Returns null for a
 * free-canvas room (or a lesson this version does not have).
 */
export function useRoomLesson(state: RoomState, board: Board, socket: RoomSocket): RoomLessonControls | null {
  const l = state.lesson
  const lesson = l ? findLesson(l.slug) : undefined
  const me = state.you?.id ?? null
  useCanUndo(board, me) // re-render whenever finished strokes change
  const stepStrokes = l ? board.strokesSince(l.from) : []

  const controls: RoomLessonControls | null = (() => {
    if (!l || !lesson) return null
    const total = lesson.steps.length
    const phase: RoomLessonPhase = l.step >= total ? 'done' : l.result ? 'result' : 'draw'
    const step = l.step < total ? lesson.steps[l.step]! : null
    const mine = stepStrokes.some((s) => s.authorId === me)
    return {
      lesson,
      stepIndex: l.step,
      phase,
      step,
      stepStrokes,
      canUndo: mine,
      check: () => {
        if (!step) return
        const score = scoreStep({
          guide: step.guide,
          tolerance: step.tolerance,
          strokes: stepStrokes.filter((s) => s.tool === 'pen'),
          passAccuracy: step.passAccuracy,
        })
        socket.sendStepResult(l.step, {
          accuracy: score.accuracy,
          smoothness: score.smoothness,
          stars: score.stars,
          passed: score.passed,
          hint: score.hint,
          guideCoverage: score.guideCoverage,
        })
      },
      undo: () => {
        if (me && mine && board.undoLast(me)) socket.sendUndo()
      },
      restartStep: () => socket.sendLessonSet(lesson.slug, l.step, true),
      next: () => socket.sendLessonSet(lesson.slug, l.step + 1),
      skip: () => {
        socket.sendLessonSet(lesson.slug, l.step, true) // wipes what was drawn in this step
        socket.sendLessonSet(lesson.slug, l.step + 1)
      },
      again: () => {
        board.clear()
        socket.sendClear()
        socket.sendLessonSet(lesson.slug, 0)
      },
    }
  })()

  // Both people save the result on their own device once, when the lesson is done.
  const outcomes: StepOutcome[] = lesson && l ? lesson.steps.map((_, i) => ({ stars: l.results[i]?.stars ?? 0, skipped: !l.results[i] })) : []
  const done = controls?.phase === 'done'
  const slug = lesson?.slug
  useEffect(() => {
    if (!done || !slug || outcomes.every((o) => o.skipped)) return
    const accuracy = Math.round(((l?.results ?? []).reduce((a, r) => a + (r?.accuracy ?? 0), 0)) / outcomes.length)
    saveResult(slug, { stars: overallStars(outcomes), accuracy })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, slug])

  return controls
}

/** Progress, the prompt, the result card or the summary. The canvas itself is drawn by the room page. */
export function RoomLessonPanel({ c, state }: { c: RoomLessonControls; state: RoomState }) {
  const { t, lang } = useT()
  const text = lessonText(c.lesson, lang)
  const total = c.lesson.steps.length
  const result = state.lesson?.result ?? null
  const outcomes: StepOutcome[] = c.lesson.steps.map((_, i) => ({ stars: state.lesson?.results[i]?.stars ?? 0, skipped: !state.lesson?.results[i] }))

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold text-muted">{t('lesson.together', { title: text.title })}</p>
        <h2 className="font-display text-lg font-bold">{c.phase === 'done' ? t('lesson.finished') : t('lesson.stepTitle', { stage: stageLabel(c.step!.stage), n: c.stepIndex + 1 })}</h2>
      </div>
      <StepProgress current={c.phase === 'done' ? total + 1 : c.stepIndex + 1} total={total} />
      {c.phase === 'draw' ? <p className="max-w-prose text-lg">{text.steps[c.stepIndex] ?? c.step!.prompt}</p> : null}

      {c.phase === 'result' && result ? (
        <>
          <ScoreCard
            title={t('step.of', { a: c.stepIndex + 1, b: total })}
            accuracy={result.accuracy}
            smoothness={result.smoothness}
            stars={result.stars}
            passed={result.passed}
            hint={hintFor(result.hint)}
            onRetry={c.restartStep}
            onNext={c.next}
          />
          {!result.passed ? (
            <div>
              <Button variant="ghost" onClick={c.next}>
                {t('lesson.moveOn')}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}

      {c.phase === 'done' ? (
        <LessonSummary
          lesson={c.lesson}
          outcomes={outcomes}
          title={t('lesson.wellDrawnTogether')}
          actions={
            <>
              <Button onClick={c.again}>{t('lesson.drawAgain')}</Button>
              <ButtonLink to="/lessons" variant="secondary">
                {t('lesson.more')}
              </ButtonLink>
            </>
          }
        />
      ) : null}
    </div>
  )
}
