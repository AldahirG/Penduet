import { useEffect, useRef, useState } from 'react'
import { Check, Copy, Link2 } from 'lucide-react'
import { useT } from '../i18n'
import { Button } from './Button'

const dabs = ['--color-paint-yellow', '--color-paint-pink', '--color-paint-green', '--color-accent', '--color-paint-red', '--color-paint-yellow']
const tilt = ['-rotate-2', 'rotate-1', '-rotate-1', 'rotate-2', '-rotate-2', 'rotate-1']

export interface RoomCodeDisplayProps {
  code: string
  /** Full invite link. When omitted the "Copy link" button is hidden. */
  link?: string
}

type Copied = 'code' | 'link' | null

async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function RoomCodeDisplay({ code, link }: RoomCodeDisplayProps) {
  const { t } = useT()
  const [copied, setCopied] = useState<Copied>(null)
  const [failed, setFailed] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const copy = async (what: Exclude<Copied, null>, text: string) => {
    const ok = await writeClipboard(text)
    setFailed(!ok)
    setCopied(ok ? what : null)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      setCopied(null)
      setFailed(false)
    }, 2000)
  }

  const spoken = code.split('').join(' ')

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold" id="room-code-label">
        {t('code.label')}
      </p>
      <div role="group" aria-labelledby="room-code-label" className="flex gap-2">
        <span className="sr-only">{spoken}</span>
        {code.split('').map((ch, i) => (
          <span
            key={`${i}-${ch}`}
            aria-hidden="true"
            className={`pop-in grid h-14 w-touch place-items-center rounded-md border border-line font-mono text-code font-bold shadow-card ${tilt[i % tilt.length]}`}
            style={{
              ['--i' as string]: i,
              background: `color-mix(in srgb, var(${dabs[i % dabs.length]}) 20%, var(--color-surface-raised))`,
            }}
          >
            {ch}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          icon={copied === 'code' ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
          onClick={() => copy('code', code)}
        >
          {copied === 'code' ? t('code.copied') : t('code.copy')}
        </Button>
        {link ? (
          <Button
            variant="ghost"
            icon={copied === 'link' ? <Check aria-hidden="true" className="h-4 w-4" /> : <Link2 aria-hidden="true" className="h-4 w-4" />}
            onClick={() => copy('link', link)}
          >
            {copied === 'link' ? t('code.linkCopied') : t('code.copyLink')}
          </Button>
        ) : null}
      </div>
      <p role="status" className="sr-only">
        {failed ? t('code.failed') : copied === 'code' ? t('code.srCodeCopied') : copied === 'link' ? t('code.linkCopied') : ''}
      </p>
      {failed ? <p className="text-sm text-danger">{t('code.failed')}</p> : null}
    </div>
  )
}
