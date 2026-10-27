import { useRealtimeHealth } from '../data/realtimeHealth'
import { ButtonLink, cn } from '../ui'
import { usePageTitle } from '../usePageTitle'

const statusText = {
  checking: 'Checking the rooms…',
  online: 'Rooms are open.',
  offline: 'Rooms are not reachable right now. Drawing on your own still works.',
} as const

// S02 Home: the front door to rooms, lessons and free drawing.
export function Home() {
  usePageTitle()
  const status = useRealtimeHealth()
  return (
    <section className="flex max-w-xl flex-col gap-6">
      <h1 className="font-display text-display font-extrabold">Draw with someone you know.</h1>
      <p className="text-lg text-muted">
        Open a room, send the code, and draw on one canvas. The other person is always a real person: no bots, no ads, no energy meter.
      </p>
      <div className="flex flex-wrap gap-3">
        <ButtonLink to="/together" size="lg">
          Start a room
        </ButtonLink>
        <ButtonLink to="/lessons" size="lg" variant="secondary">
          Try a lesson
        </ButtonLink>
        <ButtonLink to="/draw" size="lg" variant="ghost">
          Draw on your own
        </ButtonLink>
      </div>
      <p role="status" className={cn('flex items-center gap-2 text-sm', status === 'offline' ? 'text-warning-text' : 'text-muted')}>
        <span
          aria-hidden="true"
          className={cn('h-2.5 w-2.5 rounded-pill', status === 'online' ? 'bg-success' : status === 'offline' ? 'bg-warning-text' : 'bg-input')}
        />
        {statusText[status]}
      </p>
    </section>
  )
}
