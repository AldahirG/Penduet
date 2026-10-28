import type { CSSProperties } from 'react'
import { Gift, HeartHandshake, MousePointer2, Puzzle, ShieldCheck, Split, type LucideIcon } from 'lucide-react'
import { BrushUnderline } from '../components/Brand'
import { useRealtimeHealth } from '../data/realtimeHealth'
import { ButtonLink, cn } from '../ui'
import { usePageTitle } from '../usePageTitle'

const statusText = {
  checking: 'Checking the rooms…',
  online: 'Rooms are open.',
  offline: 'Rooms are not reachable right now. Drawing on your own still works.',
} as const

const swatches = ['--color-paint-red', '--color-paint-yellow', '--color-paint-green', '--color-accent', '--color-paint-pink']

const steps = [
  { title: 'Open a room', text: 'Press "Create room". You get a six-character code, and a link if you prefer.', tone: '--color-paint-yellow' },
  { title: 'Send the code', text: 'Your friend types it in, or opens the link. No account, no sign-up form.', tone: '--color-paint-pink' },
  { title: 'Draw', text: 'Free canvas, or pick a lesson and trace it together. You both see every line as it is drawn.', tone: '--color-paint-green' },
]

const features: { title: string; text: string; icon: LucideIcon; tone: string }[] = [
  {
    icon: HeartHandshake,
    tone: '--color-paint-red',
    title: 'Real people only',
    text: 'A room holds the people you gave the code to. No bots, no replays of someone else’s drawing, no matching with strangers.',
  },
  {
    icon: Gift,
    tone: '--color-paint-yellow',
    title: 'Nothing is locked',
    text: 'Every lesson, every tool and every room works today. There are no ads, no energy meter and no trial screen.',
  },
  {
    icon: Puzzle,
    tone: '--color-accent',
    title: 'Lessons you can do together',
    text: 'Trace a guide, get a score for how close and how steady you were, then try again. Do it side by side on one canvas.',
  },
  {
    icon: Split,
    tone: '--color-paint-green',
    title: 'Games for two',
    text: 'Not just lessons: draw half of a picture each and meet in the middle, get a topic to draw together, or pass the pen one stroke at a time.',
  },
  {
    icon: MousePointer2,
    tone: '--color-paint-pink',
    title: 'Works with what you have',
    text: 'A mouse, a finger or a pen. A pen is nice, but you never need one.',
  },
  {
    icon: ShieldCheck,
    tone: '--color-player-2',
    title: 'Your name, your data',
    text: 'Pick a name, or keep the one you get. Delete everything from Settings whenever you like.',
  },
]

const faq = [
  {
    q: 'Is it really free?',
    a: 'Yes. Everything in Penduet today is free, for personal use: lessons, rooms, tools and saving a picture, with no ads. Later versions may add ads or an optional paid plan to cover running costs. We would announce that first, and a paid plan would always be optional and cancel in one click.',
  },
  {
    q: 'Do I need an account?',
    a: 'No. You are signed in as a guest the first time you open a room. Pick a name in Settings if you like.',
  },
  {
    q: 'How many people can draw in a room?',
    a: 'Two. Rooms are invite-only.',
  },
  {
    q: 'What happens to my drawing?',
    a: 'Free draw is kept on your device. In a room, use "Save as image" before you leave: the room itself is cleared after a day.',
  },
  {
    q: 'Is it safe for children?',
    a: 'There is no chat and no matching with strangers: someone has to give a person the code. We have not built parental controls, age checks or a report button yet, so a child should draw with an adult nearby.',
  },
  {
    q: 'Does it work on a tablet or a phone?',
    a: 'Yes, in the browser. Mouse, touch and pen input are all supported, though it has not been tried on many devices yet. It is a web app for now, not yet in the app stores.',
  },
]

const delay = (i: number) => ({ ['--i' as string]: i }) as CSSProperties
const wash = (tone: string, pct = 26) => ({ background: `color-mix(in srgb, var(${tone}) ${pct}%, var(--color-surface-raised))` })

// A row of paint dabs, used as a quiet divider before the big sections.
function Swatches() {
  return (
    <div aria-hidden="true" className="flex items-center gap-2">
      {swatches.map((c, i) => (
        <span key={c} className="pop-in h-3 w-3 rounded-pill" style={{ background: `var(${c})`, ...delay(i) }} />
      ))}
    </div>
  )
}

// S02 Home, and the page that explains the product to someone who has not seen it.
export function Home() {
  usePageTitle()
  const status = useRealtimeHealth()
  return (
    <div className="flex flex-col gap-20 overflow-x-clip md:gap-24">
      <section aria-labelledby="hero-title" className="relative grid items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
        {/* Blobs of paint behind the picture. Purely decorative. */}
        <div aria-hidden="true" className="pointer-events-none absolute -right-6 -top-8 -z-10 h-64 w-64 lg:h-96 lg:w-96">
          <span
            className="drift absolute left-6 top-8 h-40 w-40 rounded-[58%_42%_55%_45%] opacity-30 lg:opacity-70"
            style={{ background: 'var(--color-paint-yellow)', ...delay(0) }}
          />
          <span
            className="drift absolute right-4 top-24 h-32 w-32 rounded-[45%_55%_40%_60%] opacity-25 lg:opacity-60"
            style={{ background: 'var(--color-paint-pink)', ...delay(1) }}
          />
        </div>
        <div className="flex flex-col gap-6">
          <Swatches />
          <h1 id="hero-title" className="rise text-[2.125rem] font-bold leading-[1.1] min-[400px]:text-[2.5rem] sm:text-[3.5rem] lg:text-[4rem]">
            Draw with{' '}
            <span className="brush-underline">
              someone you know
              <BrushUnderline />
            </span>
            .
          </h1>
          <p className="rise max-w-prose text-lg text-muted" style={delay(2)}>
            Open a room, send the code, and draw on one canvas. The other person is always a real person: no bots, no ads, no energy meter.
          </p>
          <div className="rise flex flex-wrap gap-3" style={delay(3)}>
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
          <p role="status" className={cn('flex items-center gap-2 text-sm font-semibold', status === 'offline' ? 'text-warning-text' : 'text-muted')}>
            <span
              aria-hidden="true"
              className={cn('h-2.5 w-2.5 rounded-pill', status === 'online' ? 'breathe bg-success' : status === 'offline' ? 'bg-warning-text' : 'bg-input')}
            />
            {statusText[status]}
          </p>
        </div>
        <picture className="rise relative" style={delay(2)}>
          <source media="(max-width: 639px)" srcSet="/landing/room-phone.png" width="780" height="1690" />
          <img
            src="/landing/room-desktop.png"
            width="2560"
            height="1600"
            alt="A room with two people in it. One drew an orange sun, the other added blue rays. The tools are on the left of the canvas."
            className="max-h-[28rem] w-full rotate-1 rounded-lg border-[6px] border-raised object-cover object-top shadow-canvas transition-transform duration-base ease-out hover:rotate-0 sm:max-h-none"
          />
        </picture>
      </section>

      <section aria-labelledby="problem-title" className="relative flex max-w-3xl flex-col gap-4 md:pl-6">
        <span aria-hidden="true" className="absolute left-0 top-1 hidden h-16 w-1.5 rounded-pill bg-paint-red md:block" />
        <h2 id="problem-title" className="text-xl font-bold md:text-[2rem] md:leading-tight">
          Drawing together should not need a payment plan
        </h2>
        <p className="text-muted">
          Many drawing apps are free to download and then lock almost everything behind a subscription, or make you wait for an energy bar to
          refill. Many say you can draw with other people, and then pair you with a bot.
        </p>
        <p className="text-muted">Penduet does the one thing: you and a friend, one canvas, now.</p>
      </section>

      <section aria-labelledby="how-title" className="flex flex-col gap-6">
        <h2 id="how-title" className="text-xl font-bold md:text-[2rem]">
          How it works
        </h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="paper lift rise flex flex-col gap-3 p-6" style={delay(i)}>
              <span
                aria-hidden="true"
                className="flex h-12 w-12 items-center justify-center rounded-pill font-display text-xl font-bold text-fg"
                style={wash(s.tone, 55)}
              >
                {i + 1}
              </span>
              <h3 className="text-lg font-semibold">{s.title}</h3>
              <p className="text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="features-title" className="flex flex-col gap-6">
        <h2 id="features-title" className="text-xl font-bold md:text-[2rem]">
          What you get
        </h2>
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <li key={f.title} className="paper lift rise flex flex-col gap-2 p-5" style={delay(i)}>
              <span aria-hidden="true" className="mb-1 flex h-11 w-11 items-center justify-center rounded-md" style={wash(f.tone)}>
                <f.icon className="h-6 w-6 text-fg" strokeWidth={2} />
              </span>
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="text-muted">{f.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="price-title"
        className="flex max-w-3xl flex-col gap-3 rounded-xl border border-line p-6 shadow-card md:p-8"
        style={wash('--color-paint-yellow', 22)}
      >
        <h2 id="price-title" className="text-xl font-bold md:text-[2rem]">
          Price: nothing
        </h2>
        <p className="text-fg">
          Penduet is free. This first version has no ads, no energy and no trial that turns into a charge. If that changes later, for
          example ads or an optional paid extra to help pay for the servers, we will announce it here first and update the privacy policy
          before it starts. Anything paid will show its price before you commit, and you will cancel it in one click.
        </p>
      </section>

      <section aria-labelledby="faq-title" className="flex max-w-3xl flex-col gap-4">
        <h2 id="faq-title" className="text-xl font-bold md:text-[2rem]">
          Questions
        </h2>
        <div className="flex flex-col gap-2">
          {faq.map((item) => (
            <details key={item.q} className="group paper px-5 py-1 open:pb-4">
              <summary className="flex min-h-touch cursor-pointer list-none items-center justify-between gap-4 font-bold [&::-webkit-details-marker]:hidden">
                {item.q}
                <span aria-hidden="true" className="text-2xl leading-none text-muted transition-transform duration-base ease-out group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section aria-labelledby="cta-title" className="flex flex-col items-start gap-4 pb-8">
        <Swatches />
        <h2 id="cta-title" className="text-xl font-bold md:text-[2rem]">
          Open a room and send the code.
        </h2>
        <ButtonLink to="/together" size="lg">
          Start a room
        </ButtonLink>
      </section>
    </div>
  )
}
