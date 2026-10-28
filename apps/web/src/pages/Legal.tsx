import { Link } from 'react-router-dom'
import { useT } from '../i18n'
import { usePageTitle } from '../usePageTitle'
import { Contact, LegalPage, Section, list } from './LegalParts'
import { PrivacyEs, TermsEs } from './LegalEs'

export { LEGAL_UPDATED } from './LegalParts'

export function Privacy() {
  const { lang } = useT()
  return lang === 'es' ? <PrivacyEs /> : <PrivacyEn />
}

function PrivacyEn() {
  usePageTitle('Privacy policy')
  return (
    <LegalPage
      title="Privacy policy"
      intro="Penduet collects as little as it can to let two people draw together. This page says what that is, where it goes and how to remove it."
    >
      <Section title="What we keep">
        <ul className={list}>
          <li>
            <strong className="text-fg">A random guest identity.</strong> The first time you open a room you are signed in as a guest: an
            internal id, with no email and no password. Your browser keeps the sign-in so you stay the same person on that device.
          </li>
          <li>
            <strong className="text-fg">Your display name.</strong> You get a name, and you can change it in Settings (up to 30 characters).
            The other person in your room sees it.
          </li>
          <li>
            <strong className="text-fg">Room records.</strong> The room code, who hosted and joined, when, and which lesson it was for. These
            stay with your guest profile until you delete your data, or until the profile is removed after 30 days without use.
          </li>
          <li>
            <strong className="text-fg">Your lines, while the room exists.</strong> What you draw in a room is held by the realtime service
            so the other person can see it and so you can rejoin after a dropped connection. It is deleted about an hour after the room is
            ended, or after a day with no activity.
          </li>
          <li>
            <strong className="text-fg">Your internet address, briefly.</strong> The services that run Penduet see it when you connect. We
            use it to limit abuse (for example, too many room attempts) and, when the human check is on, it is passed to that check. It is
            not written to our database, and the short counters used for limits expire on their own.
          </li>
        </ul>
      </Section>

      <Section title="What stays on your device">
        <p className="text-muted">
          Free drawings, your lesson progress, your theme and language choice and your guest sign-in are stored in your browser (local storage). They do
          not leave your device, except the sign-in, which is how the service recognises you. Clearing your browser data removes them.
        </p>
      </Section>

      <Section title="What we do not do">
        <ul className={list}>
          <li>We do not ask for your email, phone number, location or real name.</li>
          <li>We do not sell your data or share it for marketing.</li>
          <li>This first version shows no ads and has no analytics or tracking scripts, and sets no tracking cookies.</li>
          <li>There is no chat. The only things two people exchange in a room are their lines and their display names.</li>
          <li>The sounds in Draw and guess are made on your device; nothing is downloaded or sent.</li>
        </ul>
      </Section>

      <Section title="Who else handles it">
        <ul className={list}>
          <li>
            <strong className="text-fg">Supabase</strong> stores the guest identity, display name and room records.
          </li>
          <li>
            <strong className="text-fg">Cloudflare</strong> delivers the site, runs the realtime service that carries your lines, and, when
            switched on, provides a human check when a room is created.
          </li>
        </ul>
        <p className="text-muted">These companies process data on our behalf and have their own privacy policies and security measures.</p>
      </Section>

      <Section title="If ads or analytics come later">
        <p className="text-muted">
          Penduet may add ads or analytics in a later version to pay for running it. If that happens we will say so on the site before it
          starts, update this page with the companies involved and what each one receives, and ask for your consent where the law requires
          it. The date at the top changes whenever this page does.
        </p>
      </Section>

      <Section title="Your choices">
        <ul className={list}>
          <li>
            <strong className="text-fg">Delete everything:</strong> Settings, then “Delete my data”. This removes your profile, the rooms you
            opened and your place in other rooms, for good.
          </li>
          <li>
            <strong className="text-fg">Change your name</strong> at any time in Settings.
          </li>
          <li>
            <strong className="text-fg">Ask us:</strong> to see, correct or remove what we hold about you, use the contact below. A guest
            has no email, so tell us roughly when you used it and we will do what we can; Settings is the reliable route.
          </li>
        </ul>
      </Section>

      <Section title="Children">
        <p className="text-muted">
          There is no chat and no matching with strangers: someone has to give a person the room code. We do not knowingly ask children
          for personal information, but there are no age checks or parental controls yet, so a child should draw with an adult nearby.
        </p>
      </Section>

      <Section title="Changes and contact">
        <p className="text-muted">
          When this page changes in a way that matters, we will say so on the home page. The rules for using Penduet are in the{' '}
          <Link className="text-accent-text underline" to="/terms">
            terms of use
          </Link>
          .
        </p>
        <Contact />
      </Section>
    </LegalPage>
  )
}

export function Terms() {
  const { lang } = useT()
  return lang === 'es' ? <TermsEs /> : <TermsEn />
}

function TermsEn() {
  usePageTitle('Terms of use')
  return (
    <LegalPage
      title="Terms of use"
      intro="Penduet is free to use for drawing with people you know. The software behind it is not free to copy. Here is what that means."
    >
      <Section title="Free, for fun">
        <p className="text-muted">
          You may use Penduet for free for personal, recreational use: drawing with friends and family, practising with the lessons, or
          helping a child learn. This first version is free. Using it for commercial purposes, such as selling access, running it inside a
          paid service or collecting its content in bulk, is not covered. Ask first.
        </p>
      </Section>

      <Section title="The software is not open source">
        <p className="text-muted">
          The code that runs Penduet, its lessons and scoring rules, its design, its name and its logo belong to the people who made
          them, and all rights are reserved. Using the service does not give you a licence to copy, modify, publish, resell or build a
          competing service from any of it, or to take the service apart to do so, except where the law gives you that right regardless.
          If you want to do something with it, ask.
        </p>
      </Section>

      <Section title="Your drawings">
        <p className="text-muted">
          Your drawings are yours. By drawing in a room you let the service show your lines to the other person and keep them while the
          room exists, and nothing more. We do not use your drawings for anything else. Rooms are temporary: use “Save as image” before you
          leave if you want to keep one.
        </p>
      </Section>

      <Section title="How to behave">
        <ul className={list}>
          <li>Only give a room code to people you want in the room, and keep to what you would be happy for them to see.</li>
          <li>Do not draw anything unlawful, or meant to harass, threaten or shock another person.</li>
          <li>Do not use bots or scripts, get around the limits, or try to break, overload or probe the service.</li>
          <li>
            We may end a room, block a guest or limit access if someone breaks these rules or puts the service at risk. There is no report
            button yet; use the contact below.
          </li>
        </ul>
      </Section>

      <Section title="Children">
        <p className="text-muted">
          Children may use Penduet with an adult’s permission and nearby. If you let a child use it, you are responsible for how.
        </p>
      </Section>

      <Section title="Early version, no guarantees">
        <p className="text-muted">
          Penduet is early. It is provided as it is, without promises that it will always be available, error-free or keep your drawings.
          Features can change or stop. To the extent the law allows, we are not liable for loss or damage from using it; nothing here limits
          rights that cannot be limited by law.
        </p>
      </Section>

      <Section title="Ads and paid extras later">
        <p className="text-muted">
          We may add ads or an optional paid plan in a later version. If we do, we will announce it on the site first and update the{' '}
          <Link className="text-accent-text underline" to="/privacy">
            privacy policy
          </Link>{' '}
          and these terms before it starts. Anything paid will show its price before you commit, and can be cancelled in one click.
        </p>
      </Section>

      <Section title="Changes and contact">
        <p className="text-muted">
          If we change these terms in a way that matters, we will say so on the home page. Continuing to use Penduet after a change means
          you accept the new terms; if you do not, stop using it and delete your data in Settings.
        </p>
        <Contact />
      </Section>
    </LegalPage>
  )
}
