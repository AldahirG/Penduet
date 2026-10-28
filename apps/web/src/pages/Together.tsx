import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { lessons } from '@penduet/lessons'
import type { GameKind } from '@penduet/protocol'
import { useCaptcha } from '../components/Turnstile'
import { createErrorText, rooms, RoomError } from '../data/rooms'
import { Button, RoomCodeInput, useToast } from '../ui'
import { usePageTitle } from '../usePageTitle'

const themes = [...new Set(lessons.map((l) => l.theme))]

const games: { value: GameKind; label: string; hint: string }[] = [
  { value: 'topic', label: 'Draw a topic together', hint: 'You both get a prompt to draw on one canvas. No score.' },
  { value: 'turns', label: 'Pass the pen', hint: 'You take turns: one stroke each, back and forth.' },
  { value: 'halves', label: 'Two halves of one picture', hint: 'You each draw one half of a picture, and meet in the middle.' },
]

const joinErrors: Record<string, string> = {
  room_not_found: 'No open room has that code. Check it with your partner.',
  room_full: 'That room already has two people in it.',
  rate_limited: 'Too many tries. Wait a minute and try again.',
  captcha: 'The human check is not available in this version yet.',
  not_authenticated: 'Could not sign you in as a guest. Reload the page and try again.',
  too_many_rooms: 'Could not join. Try again in a moment.',
  network: 'Could not reach the service. Try again in a moment.',
}

// S09 Multiplayer hub: make a room or join one with a code.
export function Together() {
  usePageTitle('Rooms')
  const navigate = useNavigate()
  const toast = useToast()
  const [creating, setCreating] = useState(false)
  // What the room is for: '' (a free canvas), 'game:topic', 'game:turns', or a lesson slug.
  const [choice, setChoice] = useState('')
  const game = games.find((g) => choice === `game:${g.value}`)
  const captcha = useCaptcha()
  const [code, setCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | undefined>()

  const create = async () => {
    setCreating(true)
    try {
      const room = await rooms.create({
        ...(game ? { game: game.value } : choice ? { lessonSlug: choice } : {}),
        ...(captcha.token ? { turnstileToken: captcha.token } : {}),
      })
      navigate(`/room/${room.code}`)
    } catch (err) {
      toast.show(createErrorText(err), 'error')
      captcha.renew() // a token works once
      setCreating(false)
    }
  }

  const join = async (value: string) => {
    setJoining(true)
    setJoinError(undefined)
    try {
      const room = await rooms.join(value)
      navigate(`/room/${room.code}`)
    } catch (err) {
      setJoinError(joinErrors[err instanceof RoomError ? err.code : 'network'])
      setJoining(false)
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="font-display text-xl font-bold">Draw together</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <section aria-labelledby="create-title" className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-6">
          <h2 id="create-title" className="font-display text-lg font-semibold">
            Start a room
          </h2>
          <p className="text-muted">You get a six-character code. Send it to a friend and you can both draw.</p>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            What will you draw?
            <select
              value={choice}
              onChange={(e) => setChoice(e.target.value)}
              aria-describedby={game ? 'choice-hint' : undefined}
              className="min-h-touch rounded-md border border-input bg-surface px-3 font-normal text-fg"
            >
              <option value="">A free canvas</option>
              <optgroup label="Games">
                {games.map((g) => (
                  <option key={g.value} value={`game:${g.value}`}>
                    Game: {g.label}
                  </option>
                ))}
              </optgroup>
              {themes.map((theme) => (
                <optgroup key={theme} label={theme}>
                  {lessons
                    .filter((l) => l.theme === theme)
                    .map((l) => (
                      <option key={l.slug} value={l.slug}>
                        Lesson: {l.title}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
          {game ? (
            <p id="choice-hint" className="text-sm text-muted">
              {game.hint}
            </p>
          ) : null}
          {captcha.widget}
          <Button loading={creating} disabled={captcha.required && !captcha.token} onClick={create} className="self-start">
            Create room
          </Button>
        </section>

        <section aria-labelledby="join-title" className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-6">
          <h2 id="join-title" className="font-display text-lg font-semibold">
            Join with a code
          </h2>
          <RoomCodeInput
            value={code}
            onChange={(v) => {
              setCode(v)
              setJoinError(undefined)
            }}
            onComplete={join}
            error={joinError}
            disabled={joining}
          />
          <Button variant="secondary" loading={joining} disabled={code.length !== 6} onClick={() => join(code)} className="self-start">
            Join room
          </Button>
        </section>
      </div>
    </div>
  )
}
