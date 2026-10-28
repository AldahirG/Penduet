import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { findLesson, lessons } from '@penduet/lessons'
import { ToastProvider } from '../ui'
import { Lesson } from './Lesson'
import { Lessons } from './Lessons'

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <Routes>
          <Route path="/lessons" element={<Lessons />} />
          <Route path="/lesson/:slug" element={<Lesson />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )

/** Draws a line with pointer events. jsdom has no layout, so client coordinates are logical units. */
function drawLine(canvas: HTMLElement, from: [number, number], to: [number, number], steps = 40) {
  const at = (i: number) => ({ clientX: from[0] + ((to[0] - from[0]) * i) / steps, clientY: from[1] + ((to[1] - from[1]) * i) / steps, pointerId: 1, pointerType: 'mouse', button: 0 })
  fireEvent.pointerDown(canvas, at(0))
  for (let i = 1; i <= steps; i++) fireEvent.pointerMove(canvas, at(i))
  fireEvent.pointerUp(canvas, at(steps))
}

beforeEach(() => window.localStorage.clear())
afterEach(() => window.localStorage.clear())

describe('lessons list', () => {
  it('lists every lesson with a start link', () => {
    renderAt('/lessons')
    expect(screen.getAllByRole('link', { name: /start/i })).toHaveLength(lessons.length)
    expect(screen.getByRole('heading', { name: 'Straight lines' })).toBeInTheDocument()
  })

  it('shows the best result stored on this device', () => {
    window.localStorage.setItem('penduet.progress.v1', JSON.stringify({ 'straight-lines': { stars: 2, accuracy: 88, at: '2026-10-27T10:00:00Z' } }))
    renderAt('/lessons')
    expect(screen.getByLabelText('Your best: 2 of 3 stars, accuracy 88')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Draw again' })).toBeInTheDocument()
  })

  it('ignores damaged progress data', () => {
    window.localStorage.setItem('penduet.progress.v1', '{not json')
    renderAt('/lessons')
    expect(screen.getAllByRole('link', { name: /start/i })).toHaveLength(lessons.length)
  })
})

describe('a lesson', () => {
  const lesson = findLesson('straight-lines')!

  it('says so for a lesson that does not exist', () => {
    renderAt('/lesson/nope')
    expect(screen.getByRole('heading', { name: 'Lesson not found' })).toBeInTheDocument()
  })

  it('starts on an intro, then shows the first step with its prompt', () => {
    renderAt('/lesson/straight-lines')
    expect(screen.getByRole('heading', { name: 'Straight lines' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Start lesson' }))
    expect(screen.getByText(lesson.steps[0]!.prompt)).toBeInTheDocument()
    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Check my drawing' })).toBeDisabled() // nothing drawn yet
  })

  it('scores a good trace, passes, and moves on to the next step', () => {
    renderAt('/lesson/straight-lines')
    fireEvent.click(screen.getByRole('button', { name: 'Start lesson' }))
    drawLine(screen.getByRole('img', { name: /Lesson canvas, step 1/ }), [150, 500], [850, 500])
    fireEvent.click(screen.getByRole('button', { name: 'Check my drawing' }))
    expect(screen.getByRole('heading', { name: 'Step 1 of 4' })).toBeInTheDocument()
    expect(screen.getByText(/Excellent|Good work/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next step' }))
    expect(screen.getByText(lesson.steps[1]!.prompt)).toBeInTheDocument()
    expect(screen.getByText('Step 2 of 4')).toBeInTheDocument()
  })

  it('does not let a wrong drawing pass, offers a retry, and lets you move on anyway', () => {
    renderAt('/lesson/straight-lines')
    fireEvent.click(screen.getByRole('button', { name: 'Start lesson' }))
    drawLine(screen.getByRole('img', { name: /Lesson canvas/ }), [100, 900], [900, 950])
    fireEvent.click(screen.getByRole('button', { name: 'Check my drawing' }))
    expect(screen.queryByRole('button', { name: 'Next step' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByRole('button', { name: 'Check my drawing' })).toBeDisabled() // the attempt was wiped
    drawLine(screen.getByRole('img', { name: /Lesson canvas/ }), [100, 900], [900, 950])
    fireEvent.click(screen.getByRole('button', { name: 'Check my drawing' }))
    fireEvent.click(screen.getByRole('button', { name: 'Move on anyway' }))
    expect(screen.getByText('Step 2 of 4')).toBeInTheDocument()
  })

  it('can be finished by tracing every step, and then remembers the result', () => {
    renderAt('/lesson/straight-lines')
    fireEvent.click(screen.getByRole('button', { name: 'Start lesson' }))
    for (const [i, step] of lesson.steps.entries()) {
      const canvas = screen.getByRole('img', { name: new RegExp(`Lesson canvas, step ${i + 1}`) })
      for (const g of step.guide) drawLine(canvas, g[0]!, g[g.length - 1]!)
      fireEvent.click(screen.getByRole('button', { name: 'Check my drawing' }))
      fireEvent.click(screen.getByRole('button', { name: 'Next step' }))
    }
    expect(screen.getByRole('heading', { name: 'Lesson finished' })).toBeInTheDocument()
    const stored = JSON.parse(window.localStorage.getItem('penduet.progress.v1')!)
    expect(stored['straight-lines'].stars).toBeGreaterThanOrEqual(2)
    expect(stored['straight-lines'].accuracy).toBeGreaterThan(90)
  })

  it('lets a learner skip every step without drawing, and does not record that as progress', () => {
    renderAt('/lesson/straight-lines')
    fireEvent.click(screen.getByRole('button', { name: 'Start lesson' }))
    for (let i = 0; i < lesson.steps.length; i++) fireEvent.click(screen.getByRole('button', { name: 'Skip step' }))
    expect(screen.getByRole('heading', { name: 'Lesson finished' })).toBeInTheDocument()
    expect(screen.getAllByText('skipped')).toHaveLength(4)
    expect(window.localStorage.getItem('penduet.progress.v1')).toBeNull()
  })
})
