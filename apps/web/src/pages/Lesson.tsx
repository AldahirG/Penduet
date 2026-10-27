import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Download, Users } from 'lucide-react'
import { findLesson, scoreStep, type Lesson as LessonData, type StepScore } from '@penduet/lessons'
import { getProgress, saveResult } from '../data/progress'
import { useCaptcha } from '../components/Turnstile'
import { createErrorText, rooms } from '../data/rooms'
import { Board } from '../drawing/board'
import { DrawingCanvas } from '../drawing/DrawingCanvas'
import { CANVAS_BOX } from '../drawing/layout'
import { GuideOverlay } from '../drawing/GuideOverlay'
import { useCanUndo, useMediaQuery, useSavePicture } from '../drawing/hooks'
import { BRUSH_SIZES, DEFAULT_PALETTE } from '../drawing/palette'
import { LessonSummary, Stars, hintText, overallStars, stageLabel } from '../lessons/shared'
import { usePageTitle } from '../usePageTitle'
import { Button, ButtonLink, DrawingToolbar, ScoreCard, StepProgress, useToast, type DrawingTool } from '../ui'

const ME = 'me'

interface StepResult {
  accuracy: number
  smoothness: number
  stars: 0 | 1 | 2 | 3
  skipped: boolean
}

type Phase =
  | { kind: 'intro' }
  | { kind: 'draw'; step: number }
  | { kind: 'result'; step: number; score: StepScore }
  | { kind: 'done' }

// S05 lesson start, S06 lesson canvas, S07 result.
export function Lesson() {
  const { slug = '' } = useParams()
  const lesson = findLesson(slug)
  if (!lesson) {
    return (
      <section className="flex max-w-xl flex-col gap-4">
        <h1 className="font-display text-xl font-bold">Lesson not found</h1>
        <p className="text-muted">There is no lesson with that name.</p>
        <ButtonLink to="/lessons" variant="secondary" className="self-start">
          See all lessons
        </ButtonLink>
      </section>
    )
  }
  return <LessonRun key={lesson.slug} lesson={lesson} />
}

function LessonRun({ lesson }: { lesson: LessonData }) {
  usePageTitle(lesson.title)
  const navigate = useNavigate()
  const toast = useToast()
  const [creating, setCreating] = useState(false)
  const captcha = useCaptcha()
  const [board] = useState(() => new Board())
  const [phase, setPhase] = useState<Phase>({ kind: 'intro' })
  const [results, setResults] = useState<StepResult[]>([])
  const [tool, setTool] = useState<DrawingTool>('pen')
  const [color, setColor] = useState(DEFAULT_PALETTE[0]!.value)
  const [size, setSize] = useState<number>(BRUSH_SIZES.presets.medium)
  /** Number of finished strokes when the current step began: the step is scored on what comes after. */
  const mark = useRef(0)
  const wide = useMediaQuery('(min-width: 768px)')
  const { onEngine, save } = useSavePicture()
  const finishedStrokes = useCanUndo(board, ME) // re-renders when strokes change
  const canUndo = finishedStrokes && board.strokeCount > mark.current

  const total = lesson.steps.length
  const stepIndex = phase.kind === 'draw' || phase.kind === 'result' ? phase.step : phase.kind === 'done' ? total : 0
  const step = lesson.steps[Math.min(stepIndex, total - 1)]!
  const previous = getProgress()[lesson.slug]

  /** Opens a room for this lesson and goes there: the same steps, drawn together on one canvas. */
  const together = async () => {
    setCreating(true)
    try {
      const room = await rooms.create({ lessonSlug: lesson.slug, ...(captcha.token ? { turnstileToken: captcha.token } : {}) })
      navigate(`/room/${room.code}`)
    } catch (err) {
      toast.show(createErrorText(err), 'error')
      captcha.renew()
      setCreating(false)
    }
  }

  const begin = () => {
    board.clear()
    mark.current = 0
    setResults([])
    setPhase({ kind: 'draw', step: 0 })
  }

  const check = () => {
    const strokes = board.strokesSince(mark.current).filter((s) => s.tool === 'pen')
    setPhase({ kind: 'result', step: stepIndex, score: scoreStep({ guide: step.guide, tolerance: step.tolerance, strokes, passAccuracy: step.passAccuracy }) })
  }

  const retry = () => {
    board.truncate(mark.current)
    setPhase({ kind: 'draw', step: stepIndex })
  }

  const advance = (result: StepResult) => {
    const next = [...results.slice(0, stepIndex), result]
    setResults(next)
    if (stepIndex + 1 >= total) {
      const accuracy = Math.round(next.reduce((a, r) => a + r.accuracy, 0) / total)
      const stars = overallStars(next)
      if (next.some((r) => !r.skipped)) saveResult(lesson.slug, { stars, accuracy }) // a lesson skipped end to end is not progress
      setPhase({ kind: 'done' })
    } else {
      mark.current = board.strokeCount
      setPhase({ kind: 'draw', step: stepIndex + 1 })
    }
  }

  const next = () => {
    if (phase.kind !== 'result') return
    advance({ accuracy: phase.score.accuracy, smoothness: phase.score.smoothness, stars: phase.score.stars, skipped: false })
  }

  /** Moving on without passing: the step counts as zero, and the attempt is wiped from the canvas. */
  const skip = () => {
    board.truncate(mark.current)
    advance({ accuracy: 0, smoothness: 0, stars: 0, skipped: true })
  }

  if (phase.kind === 'intro') {
    return (
      <section aria-labelledby="lesson-title" className="flex max-w-xl flex-col gap-4">
        <p className="text-sm font-semibold text-muted">Lesson</p>
        <h1 id="lesson-title" className="font-display text-display font-extrabold">
          {lesson.title}
        </h1>
        <p className="text-lg text-muted">{lesson.summary}</p>
        <dl className="grid grid-cols-3 gap-3 rounded-lg border border-line bg-surface p-4 text-sm">
          <div>
            <dt className="text-muted">Steps</dt>
            <dd className="font-semibold">{total}</dd>
          </div>
          <div>
            <dt className="text-muted">Time</dt>
            <dd className="font-semibold">about {lesson.estMinutes} min</dd>
          </div>
          <div>
            <dt className="text-muted">Difficulty</dt>
            <dd className="font-semibold">{lesson.difficulty} of 5</dd>
          </div>
        </dl>
        {previous ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            Your best: <Stars n={previous.stars} /> <span>accuracy {previous.accuracy}</span>
          </p>
        ) : null}
        {captcha.widget}
        <div className="flex flex-wrap gap-3">
          <Button size="lg" onClick={begin}>
            {previous ? 'Draw it again' : 'Start lesson'}
          </Button>
          <Button size="lg" variant="secondary" loading={creating} disabled={captcha.required && !captcha.token} icon={<Users aria-hidden="true" className="h-4 w-4" />} onClick={together}>
            Draw it with a friend
          </Button>
          <ButtonLink to="/lessons" size="lg" variant="ghost">
            All lessons
          </ButtonLink>
        </div>
      </section>
    )
  }

  const drawing = phase.kind === 'draw'

  return (
    <section aria-labelledby="lesson-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-muted">{lesson.title}</p>
          <h1 id="lesson-title" className="font-display text-xl font-bold">
            {phase.kind === 'done' ? 'Lesson finished' : `${stageLabel[step.stage]}: step ${stepIndex + 1}`}
          </h1>
        </div>
        <Button variant="secondary" icon={<Download aria-hidden="true" className="h-4 w-4" />} onClick={() => save(lesson.slug)}>
          Save as image
        </Button>
      </div>
      {/* One column on a phone. From lg up the canvas has its own column and the lesson text sits beside it,
          so the whole canvas fits on a laptop screen. */}
      <div className="grid gap-4 lg:grid-cols-[auto_20rem] lg:items-start">
        <div className="flex flex-col gap-3 lg:col-start-2 lg:row-start-1">
          <StepProgress current={phase.kind === 'done' ? total + 1 : stepIndex + 1} total={total} />

          {drawing ? (
            <p className="max-w-prose text-lg" id="step-prompt">
              {step.prompt}
            </p>
          ) : null}

          {phase.kind === 'result' ? (
            <ScoreCard
              title={`Step ${stepIndex + 1} of ${total}`}
              accuracy={phase.score.accuracy}
              smoothness={phase.score.smoothness}
              stars={phase.score.stars}
              passed={phase.score.passed}
              hint={hintText[phase.score.hint]}
              onRetry={retry}
              onNext={next}
            />
          ) : null}
          {phase.kind === 'result' && !phase.score.passed ? (
            <div>
              <Button variant="ghost" onClick={skip}>
                Move on anyway
              </Button>
            </div>
          ) : null}

          {phase.kind === 'done' ? (
            <LessonSummary
              lesson={lesson}
              outcomes={results}
              actions={
                <>
                  <Button onClick={begin}>Draw it again</Button>
                  <ButtonLink to="/lessons" variant="secondary">
                    More lessons
                  </ButtonLink>
                </>
              }
            />
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-3 md:flex-row md:items-start lg:col-start-1 lg:row-span-2 lg:row-start-1">
          {drawing ? (
            <DrawingToolbar
              orientation={wide ? 'vertical' : 'horizontal'}
              tool={tool}
              onToolChange={setTool}
              color={color}
              onColorChange={setColor}
              size={size}
              onSizeChange={setSize}
              canUndo={canUndo}
              onUndo={() => board.undoLast(ME)}
              onClear={() => board.truncate(mark.current)}
              clearCopy={{
                label: 'Start this step again',
                title: 'Start this step again?',
                description: 'What you drew in this step is removed. Earlier steps stay.',
                confirm: 'Start again',
              }}
            />
          ) : null}
          <div className={`relative ${CANVAS_BOX}`}>
            <DrawingCanvas
              board={board}
              authorId={ME}
              tool={tool}
              color={color}
              size={size}
              disabled={!drawing}
              onEngine={onEngine}
              label={drawing ? `Lesson canvas, step ${stepIndex + 1} of ${total}. ${step.prompt}` : 'Your drawing'}
            />
            {phase.kind !== 'done' ? (
              <GuideOverlay guide={step.guide} tolerance={step.tolerance} result={phase.kind === 'result' ? phase.score.guideCoverage : undefined} />
            ) : null}
          </div>
        </div>

        {drawing ? (
          <div className="flex flex-wrap gap-2 lg:col-start-2 lg:row-start-2">
            <Button onClick={check} disabled={board.strokeCount <= mark.current}>
              Check my drawing
            </Button>
            <Button variant="ghost" onClick={skip}>
              Skip step
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  )
}
