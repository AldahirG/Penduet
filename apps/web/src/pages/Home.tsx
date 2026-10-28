import { useRealtimeHealth } from '../data/realtimeHealth'
import { ButtonLink, cn } from '../ui'
import { usePageTitle } from '../usePageTitle'

const statusText = {
  checking: 'Checking the rooms…',
  online: 'Rooms are open.',
  offline: 'Rooms are not reachable right now. Drawing on your own still works.',
} as const

const steps = [
  { title: 'Open a room', text: 'Press "Create room". You get a six-character code, and a link if you prefer.' },
  { title: 'Send the code', text: 'Your friend types it in, or opens the link. No account, no sign-up form.' },
  { title: 'Draw', text: 'Free canvas, or pick a lesson and trace it together. You both see every line as it is drawn.' },
]

const features = [
  {
    title: 'Real people only',
    text: 'A room holds the people you gave the code to. No bots, no replays of someone else’s drawing, no matching with strangers.',
  },
  {
    title: 'Nothing is locked',
    text: 'Every lesson, every tool and every room works today. There are no ads, no energy meter and no trial screen.',
  },
  {
    title: 'Lessons you can do together',
    text: 'Trace a guide, get a score for how close and how steady you were, then try again. Do it side by side on one canvas.',
  },
  {
    title: 'Works with what you have',
    text: 'A mouse, a finger or a pen. A pen is nice, but you never need one.',
  },
  {
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

// S02 Home, and the page that explains the product to someone who has not seen it.
export function Home() {
  usePageTitle()
  const status = useRealtimeHealth()
  return (
    <div className="flex flex-col gap-16">
      <section aria-labelledby="hero-title" className="grid items-center gap-8 lg:grid-cols-[1fr_1.1fr]">
        <div className="flex flex-col gap-6">
          <h1 id="hero-title" className="font-display text-display font-extrabold">
            Draw with someone you know.
          </h1>
          <p className="max-w-prose text-lg text-muted">
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
        </div>
        <picture>
          <source media="(max-width: 639px)" srcSet="/landing/room-phone.png" width="780" height="1690" />
          <img
            src="/landing/room-desktop.png"
            width="2560"
            height="1600"
            alt="A room with two people in it. One drew an orange sun, the other added blue rays. The tools are on the left of the canvas."
            className="w-full rounded-lg border border-line shadow-card"
          />
        </picture>
      </section>

      <section aria-labelledby="problem-title" className="flex max-w-3xl flex-col gap-4">
        <h2 id="problem-title" className="font-display text-xl font-bold">
          Drawing together should not need a payment plan
        </h2>
        <p className="text-muted">
          Many drawing apps are free to download and then lock almost everything behind a subscription, or make you wait for an energy bar to
          refill. Many say you can draw with other people, and then pair you with a bot.
        </p>
        <p className="text-muted">Penduet does the one thing: you and a friend, one canvas, now.</p>
      </section>

      <section aria-labelledby="how-title" className="flex flex-col gap-6">
        <h2 id="how-title" className="font-display text-xl font-bold">
          How it works
        </h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-5">
              <span aria-hidden="true" className="font-display text-display font-extrabold text-accent-text">
                {i + 1}
              </span>
              <h3 className="font-display text-lg font-semibold">{s.title}</h3>
              <p className="text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="features-title" className="flex flex-col gap-6">
        <h2 id="features-title" className="font-display text-xl font-bold">
          What you get
        </h2>
        <ul className="grid gap-4 md:grid-cols-2">
          {features.map((f) => (
            <li key={f.title} className="flex flex-col gap-1 rounded-lg border border-line bg-surface p-5">
              <h3 className="font-display text-lg font-semibold">{f.title}</h3>
              <p className="text-muted">{f.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="price-title" className="flex max-w-3xl flex-col gap-3 rounded-lg border border-line bg-raised p-6 shadow-card">
        <h2 id="price-title" className="font-display text-xl font-bold">
          Price: nothing
        </h2>
        <p className="text-muted">
          Penduet is free. This first version has no ads, no energy and no trial that turns into a charge. If that changes later, for
          example ads or an optional paid extra to help pay for the servers, we will announce it here first and update the privacy policy
          before it starts. Anything paid will show its price before you commit, and you will cancel it in one click.
        </p>
      </section>

      <section aria-labelledby="faq-title" className="flex max-w-3xl flex-col gap-4">
        <h2 id="faq-title" className="font-display text-xl font-bold">
          Questions
        </h2>
        <dl className="flex flex-col gap-4">
          {faq.map((item) => (
            <div key={item.q} className="flex flex-col gap-1">
              <dt className="font-semibold">{item.q}</dt>
              <dd className="text-muted">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="cta-title" className="flex flex-col items-start gap-4 pb-8">
        <h2 id="cta-title" className="font-display text-xl font-bold">
          Open a room and send the code.
        </h2>
        <ButtonLink to="/together" size="lg">
          Start a room
        </ButtonLink>
      </section>
    </div>
  )
}
