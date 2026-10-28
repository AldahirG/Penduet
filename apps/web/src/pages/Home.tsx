import type { CSSProperties } from 'react'
import { Gift, HeartHandshake, MousePointer2, Puzzle, ShieldCheck, Split, type LucideIcon } from 'lucide-react'
import { BrushUnderline } from '../components/Brand'
import { useT, type StringKey } from '../i18n'
import { useRealtimeHealth } from '../data/realtimeHealth'
import { ButtonLink, cn } from '../ui'
import { usePageTitle } from '../usePageTitle'

const statusKey = { checking: 'home.status.checking', online: 'home.status.online', offline: 'home.status.offline' } as const satisfies Record<string, StringKey>

const swatches = ['--color-paint-red', '--color-paint-yellow', '--color-paint-green', '--color-accent', '--color-paint-pink']

const steps: { title: StringKey; text: StringKey; tone: string }[] = [
  { title: 'home.how.1.title', text: 'home.how.1.text', tone: '--color-paint-yellow' },
  { title: 'home.how.2.title', text: 'home.how.2.text', tone: '--color-paint-pink' },
  { title: 'home.how.3.title', text: 'home.how.3.text', tone: '--color-paint-green' },
]

const features: { title: StringKey; text: StringKey; icon: LucideIcon; tone: string }[] = [
  { icon: HeartHandshake, tone: '--color-paint-red', title: 'home.f.real.title', text: 'home.f.real.text' },
  { icon: Gift, tone: '--color-paint-yellow', title: 'home.f.free.title', text: 'home.f.free.text' },
  { icon: Puzzle, tone: '--color-accent', title: 'home.f.lessons.title', text: 'home.f.lessons.text' },
  { icon: Split, tone: '--color-paint-green', title: 'home.f.games.title', text: 'home.f.games.text' },
  { icon: MousePointer2, tone: '--color-paint-pink', title: 'home.f.input.title', text: 'home.f.input.text' },
  { icon: ShieldCheck, tone: '--color-player-2', title: 'home.f.data.title', text: 'home.f.data.text' },
]

const faq: { q: StringKey; a: StringKey }[] = [
  { q: 'home.faq.free.q', a: 'home.faq.free.a' },
  { q: 'home.faq.account.q', a: 'home.faq.account.a' },
  { q: 'home.faq.people.q', a: 'home.faq.people.a' },
  { q: 'home.faq.drawing.q', a: 'home.faq.drawing.a' },
  { q: 'home.faq.kids.q', a: 'home.faq.kids.a' },
  { q: 'home.faq.devices.q', a: 'home.faq.devices.a' },
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
  const { t } = useT()
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
            {t('home.hero.before')}{' '}
            <span className="brush-underline">
              {t('home.hero.brush')}
              <BrushUnderline />
            </span>
            .
          </h1>
          <p className="rise max-w-prose text-lg text-muted" style={delay(2)}>
            {t('home.hero.lead')}
          </p>
          <div className="rise flex flex-wrap gap-3" style={delay(3)}>
            <ButtonLink to="/together" size="lg">
              {t('home.hero.start')}
            </ButtonLink>
            <ButtonLink to="/lessons" size="lg" variant="secondary">
              {t('home.hero.lesson')}
            </ButtonLink>
            <ButtonLink to="/draw" size="lg" variant="ghost">
              {t('home.hero.solo')}
            </ButtonLink>
          </div>
          <p role="status" className={cn('flex items-center gap-2 text-sm font-semibold', status === 'offline' ? 'text-warning-text' : 'text-muted')}>
            <span
              aria-hidden="true"
              className={cn('h-2.5 w-2.5 rounded-pill', status === 'online' ? 'breathe bg-success' : status === 'offline' ? 'bg-warning-text' : 'bg-input')}
            />
            {t(statusKey[status])}
          </p>
        </div>
        <picture className="rise relative" style={delay(2)}>
          <source media="(max-width: 639px)" srcSet="/landing/room-phone.png" width="780" height="1690" />
          <img
            src="/landing/room-desktop.png"
            width="2560"
            height="1600"
            alt={t('home.hero.alt')}
            className="max-h-[28rem] w-full rotate-1 rounded-lg border-[6px] border-raised object-cover object-top shadow-canvas transition-transform duration-base ease-out hover:rotate-0 sm:max-h-none"
          />
        </picture>
      </section>

      <section aria-labelledby="problem-title" className="relative flex max-w-3xl flex-col gap-4 md:pl-6">
        <span aria-hidden="true" className="absolute left-0 top-1 hidden h-16 w-1.5 rounded-pill bg-paint-red md:block" />
        <h2 id="problem-title" className="text-xl font-bold md:text-[2rem] md:leading-tight">
          {t('home.problem.title')}
        </h2>
        <p className="text-muted">{t('home.problem.p1')}</p>
        <p className="text-muted">{t('home.problem.p2')}</p>
      </section>

      <section aria-labelledby="how-title" className="flex flex-col gap-6">
        <h2 id="how-title" className="text-xl font-bold md:text-[2rem]">
          {t('home.how.title')}
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
              <h3 className="text-lg font-semibold">{t(s.title)}</h3>
              <p className="text-muted">{t(s.text)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="features-title" className="flex flex-col gap-6">
        <h2 id="features-title" className="text-xl font-bold md:text-[2rem]">
          {t('home.features.title')}
        </h2>
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <li key={f.title} className="paper lift rise flex flex-col gap-2 p-5" style={delay(i)}>
              <span aria-hidden="true" className="mb-1 flex h-11 w-11 items-center justify-center rounded-md" style={wash(f.tone)}>
                <f.icon className="h-6 w-6 text-fg" strokeWidth={2} />
              </span>
              <h3 className="text-lg font-semibold">{t(f.title)}</h3>
              <p className="text-muted">{t(f.text)}</p>
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
          {t('home.price.title')}
        </h2>
        <p className="text-fg">{t('home.price.text')}</p>
      </section>

      <section aria-labelledby="faq-title" className="flex max-w-3xl flex-col gap-4">
        <h2 id="faq-title" className="text-xl font-bold md:text-[2rem]">
          {t('home.faq.title')}
        </h2>
        <div className="flex flex-col gap-2">
          {faq.map((item) => (
            <details key={item.q} className="group paper px-5 py-1 open:pb-4">
              <summary className="flex min-h-touch cursor-pointer list-none items-center justify-between gap-4 font-bold [&::-webkit-details-marker]:hidden">
                {t(item.q)}
                <span aria-hidden="true" className="text-2xl leading-none text-muted transition-transform duration-base ease-out group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="text-muted">{t(item.a)}</p>
            </details>
          ))}
        </div>
      </section>

      <section aria-labelledby="cta-title" className="flex flex-col items-start gap-4 pb-8">
        <Swatches />
        <h2 id="cta-title" className="text-xl font-bold md:text-[2rem]">
          {t('home.cta.title')}
        </h2>
        <ButtonLink to="/together" size="lg">
          {t('home.hero.start')}
        </ButtonLink>
      </section>
    </div>
  )
}
