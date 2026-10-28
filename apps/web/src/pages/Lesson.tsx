import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Download, Users } from 'lucide-react'
import { findLesson, lessonText, scoreStep, type Lesson as LessonData, type StepScore } from '@penduet/lessons'
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
import { useT } from '../i18n'
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
  const { t } = useT()
  const { slug = '' } = useParams()
  const lesson = findLesson(slug)
  if (!lesson) {
    return (
      <section className="flex max-w-xl flex-col gap-4">
        <h1 className="font-display text-xl font-bold">{t('lesson.notFound.title')}</h1>
        <p className="text-muted">{t('lesson.notFound.text')}</p>
        <ButtonLink to="/lessons" variant="secondary" className="self-start">
          {t('lesson.seeAll')}
        </ButtonLink>
      </section>
    )
  }
  return <LessonRun key={lesson.slug} lesson={lesson} />
}

function LessonRun({ lesson }: { lesson: LessonData }) {
  const { t, lang } = useT()
  const text = lessonText(lesson, lang)
  usePageTitle(text.title)
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
  const stepNo = Math.min(stepIndex, total - 1)
  const step = lesson.steps[stepNo]!
  const prompt = text.steps[stepNo] ?? step.prompt
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
        <p className="text-sm font-semibold text-muted">{t('lesson.kicker')}</p>
        <h1 id="lesson-title" className="font-display text-display font-extrabold">
          {text.title}
        </h1>
        <p className="text-lg text-muted">{text.summary}</p>
        <dl className="grid grid-cols-3 gap-3 paper p-4 text-sm">
          <div>
            <dt className="text-muted">{t('lesson.steps')}</dt>
            <dd className="font-semibold">{total}</dd>
          </div>
          <div>
            <dt className="text-muted">{t('lesson.time')}</dt>
            <dd className="font-semibold">{t('lesson.timeAbout', { n: lesson.estMinutes })}</dd>
          </div>
          <div>
            <dt className="text-muted">{t('lesson.difficulty')}</dt>
            <dd className="font-semibold">{t('lesson.difficultyOf', { n: lesson.difficulty })}</dd>
          </div>
        </dl>
        {previous ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            {t('lesson.best')} <Stars n={previous.stars} /> <span>{t('lesson.accuracy', { n: previous.accuracy })}</span>
          </p>
        ) : null}
        {captcha.widget}
        <div className="flex flex-wrap gap-3">
          <Button size="lg" onClick={begin}>
            {previous ? t('lesson.drawAgain') : t('lesson.start')}
          </Button>
          <Button size="lg" variant="secondary" loading={creating} disabled={captcha.required && !captcha.token} icon={<Users aria-hidden="true" className="h-4 w-4" />} onClick={together}>
            {t('lesson.withFriend')}
          </Button>
          <ButtonLink to="/lessons" size="lg" variant="ghost">
            {t('lesson.all')}
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
          <p className="text-sm font-semibold text-muted">{text.title}</p>
          <h1 id="lesson-title" className="font-display text-xl font-bold">
            {phase.kind === 'done' ? t('lesson.finished') : t('lesson.stepTitle', { stage: stageLabel(step.stage), n: stepIndex + 1 })}
          </h1>
        </div>
        <Button variant="secondary" icon={<Download aria-hidden="true" className="h-4 w-4" />} onClick={() => save(lesson.slug)}>
          {t('common.saveImage')}
        </Button>
      </div>
      {/* One column on a phone. From lg up the canvas has its own column and the lesson text sits beside it,
          so the whole canvas fits on a laptop screen. */}
      <div className="grid gap-4 lg:grid-cols-[auto_20rem] lg:items-start">
        <div className="flex flex-col gap-3 lg:col-start-2 lg:row-start-1">
          <StepProgress current={phase.kind === 'done' ? total + 1 : stepIndex + 1} total={total} />

          {drawing ? (
            <p className="max-w-prose text-lg" id="step-prompt">
              {prompt}
            </p>
          ) : null}

          {phase.kind === 'result' ? (
            <ScoreCard
              title={t('step.of', { a: stepIndex + 1, b: total })}
              accuracy={phase.score.accuracy}
              smoothness={phase.score.smoothness}
              stars={phase.score.stars}
              passed={phase.score.passed}
              hint={hintText(phase.score.hint)}
              onRetry={retry}
              onNext={next}
            />
          ) : null}
          {phase.kind === 'result' && !phase.score.passed ? (
            <div>
              <Button variant="ghost" onClick={skip}>
                {t('lesson.moveOn')}
              </Button>
            </div>
          ) : null}

          {phase.kind === 'done' ? (
            <LessonSummary
              lesson={lesson}
              outcomes={results}
              actions={
                <>
                  <Button onClick={begin}>{t('lesson.drawAgain')}</Button>
                  <ButtonLink to="/lessons" variant="secondary">
                    {t('lesson.more')}
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
                label: t('lesson.restartLabel'),
                title: t('lesson.restartTitle'),
                description: t('lesson.restartText'),
                confirm: t('lesson.restartConfirm'),
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
              label={drawing ? t('lesson.canvasLabel', { n: stepIndex + 1, total, prompt }) : t('canvas.yours')}
            />
            {phase.kind !== 'done' ? (
              <GuideOverlay guide={step.guide} tolerance={step.tolerance} result={phase.kind === 'result' ? phase.score.guideCoverage : undefined} />
            ) : null}
          </div>
        </div>

        {drawing ? (
          <div className="flex flex-wrap gap-2 lg:col-start-2 lg:row-start-2">
            <Button onClick={check} disabled={board.strokeCount <= mark.current}>
              {t('lesson.check')}
            </Button>
            <Button variant="ghost" onClick={skip}>
              {t('lesson.skip')}
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  )
}
