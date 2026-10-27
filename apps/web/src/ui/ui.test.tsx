import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { Button, ButtonLink, DrawingToolbar, PlayerChip, RoomCodeInput, StepProgress, TextInput } from './index'

describe('Button', () => {
  it('ignores clicks and announces busy while loading', () => {
    const onClick = vi.fn()
    render(
      <Button loading onClick={onClick}>
        Join
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Join' })
    expect(button).toHaveAttribute('aria-busy', 'true')
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('fires onClick normally', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Go</Button>)
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))
    expect(onClick).toHaveBeenCalledOnce()
  })
})

describe('ButtonLink', () => {
  it('is a link, not a button', () => {
    render(
      <MemoryRouter>
        <ButtonLink to="/together">Start</ButtonLink>
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Start' })).toHaveAttribute('href', '/together')
  })
})

describe('TextInput', () => {
  it('links the error to the field and marks it invalid', () => {
    render(<TextInput label="Name" error="Required" />)
    const input = screen.getByLabelText('Name')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Required')
  })
})

describe('RoomCodeInput', () => {
  it('uppercases, strips junk and never exceeds 6 characters', () => {
    const onChange = vi.fn()
    render(<RoomCodeInput value="" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Room code'), { target: { value: 'k7q-2m9zz' } })
    expect(onChange).toHaveBeenCalledWith('K7Q2M9')
  })

  it('reports a complete code after a short pause', () => {
    vi.useFakeTimers()
    const onComplete = vi.fn()
    render(<RoomCodeInput value="K7Q2M9" onChange={() => undefined} onComplete={onComplete} />)
    expect(onComplete).not.toHaveBeenCalled()
    vi.advanceTimersByTime(300)
    expect(onComplete).toHaveBeenCalledWith('K7Q2M9')
    vi.useRealTimers()
  })
})

describe('PlayerChip', () => {
  it('names the player and their status for screen readers', () => {
    render(<PlayerChip name="Leo" slot={2} status="reconnecting" />)
    expect(screen.getByLabelText('Leo, reconnecting')).toBeInTheDocument()
  })
})

describe('StepProgress', () => {
  it('exposes progress as numbers, not just a bar', () => {
    render(<StepProgress current={3} total={5} />)
    const bar = screen.getByRole('progressbar', { name: 'Lesson progress' })
    expect(bar).toHaveAttribute('aria-valuenow', '2')
    expect(bar).toHaveAttribute('aria-valuemax', '5')
    expect(screen.getByText('Step 3 of 5')).toBeInTheDocument()
  })
})

describe('DrawingToolbar', () => {
  const setup = () =>
    render(
      <DrawingToolbar
        tool="pen"
        onToolChange={() => undefined}
        color="#2563eb"
        onColorChange={() => undefined}
        size={10}
        onSizeChange={() => undefined}
        onUndo={() => undefined}
        canUndo={false}
        onClear={() => undefined}
      />,
    )

  it('has one tab stop and moves with the arrow keys', () => {
    setup()
    const pen = screen.getByRole('button', { name: 'Pen' })
    const eraser = screen.getByRole('button', { name: 'Eraser' })
    expect(pen).toHaveAttribute('tabindex', '0')
    expect(eraser).toHaveAttribute('tabindex', '-1')
    pen.focus()
    fireEvent.keyDown(pen, { key: 'ArrowRight' })
    expect(eraser).toHaveFocus()
  })

  it('disables undo when there is nothing to undo', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Undo your last stroke' })).toBeDisabled()
  })
})
