import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { lessons, lessonText } from '@penduet/lessons'
import type { GameKind } from '@penduet/protocol'
import { useCaptcha } from '../components/Turnstile'
import { createErrorText, rooms, RoomError } from '../data/rooms'
import { tDyn, useT, type StringKey } from '../i18n'
import { Button, RoomCodeInput, useToast } from '../ui'
import { usePageTitle } from '../usePageTitle'

const themes = [...new Set(lessons.map((l) => l.theme))]

const games: { value: GameKind; label: StringKey; hint: StringKey }[] = [
  { value: 'topic', label: 'game.topic.label', hint: 'game.topic.hint' },
  { value: 'turns', label: 'game.turns.label', hint: 'game.turns.hint' },
  { value: 'halves', label: 'game.halves.label', hint: 'game.halves.hint' },
  { value: 'guess', label: 'game.guess.label', hint: 'game.guess.hint' },
]

const joinErrors: Record<string, StringKey> = {
  room_not_found: 'err.roomNotFound',
  room_full: 'err.roomFull',
  rate_limited: 'err.rateLimited',
  captcha: 'err.captcha',
  not_authenticated: 'err.notAuthenticated',
  too_many_rooms: 'err.tooManyRoomsJoin',
  network: 'err.network',
}

// S09 Multiplayer hub: make a room or join one with a code.
export function Together() {
  const { t, lang } = useT()
  usePageTitle(t('title.rooms'))
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
      setJoinError(t(joinErrors[err instanceof RoomError ? err.code : 'network'] ?? 'err.network'))
      setJoining(false)
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-xl font-bold sm:text-display">{t('together.title')}</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <section aria-labelledby="create-title" className="flex flex-col gap-4 paper p-6">
          <h2 id="create-title" className="font-display text-lg font-semibold">
            {t('together.start')}
          </h2>
          <p className="text-muted">{t('together.startText')}</p>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            {t('together.whatLabel')}
            <select
              value={choice}
              onChange={(e) => setChoice(e.target.value)}
              aria-describedby={game ? 'choice-hint' : undefined}
              className="min-h-touch rounded-md border border-input bg-surface px-3 font-normal text-fg"
            >
              <option value="">{t('together.free')}</option>
              <optgroup label={t('together.games')}>
                {games.map((g) => (
                  <option key={g.value} value={`game:${g.value}`}>
                    {t('together.gamePrefix', { label: t(g.label) })}
                  </option>
                ))}
              </optgroup>
              {themes.map((theme) => (
                <optgroup key={theme} label={tDyn(`lt.${theme}`, theme)}>
                  {lessons
                    .filter((l) => l.theme === theme)
                    .map((l) => (
                      <option key={l.slug} value={l.slug}>
                        {t('together.lessonPrefix', { title: lessonText(l, lang).title })}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
          {game ? (
            <p id="choice-hint" className="text-sm text-muted">
              {t(game.hint)}
            </p>
          ) : null}
          {captcha.widget}
          <Button loading={creating} disabled={captcha.required && !captcha.token} onClick={create} className="self-start">
            {t('together.create')}
          </Button>
        </section>

        <section aria-labelledby="join-title" className="flex flex-col gap-4 paper p-6">
          <h2 id="join-title" className="font-display text-lg font-semibold">
            {t('together.joinTitle')}
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
            {t('together.join')}
          </Button>
        </section>
      </div>
    </div>
  )
}
