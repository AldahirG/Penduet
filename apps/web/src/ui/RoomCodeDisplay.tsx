import { useEffect, useRef, useState } from 'react'
import { Check, Copy, Link2 } from 'lucide-react'
import { Button } from './Button'

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
        Room code
      </p>
      <div role="group" aria-labelledby="room-code-label" className="flex gap-2">
        <span className="sr-only">{spoken}</span>
        {code.split('').map((ch, i) => (
          <span
            key={`${i}-${ch}`}
            aria-hidden="true"
            className="grid h-14 w-touch place-items-center rounded-md border border-line bg-surface font-mono text-code font-bold"
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
          {copied === 'code' ? 'Copied' : 'Copy code'}
        </Button>
        {link ? (
          <Button
            variant="ghost"
            icon={copied === 'link' ? <Check aria-hidden="true" className="h-4 w-4" /> : <Link2 aria-hidden="true" className="h-4 w-4" />}
            onClick={() => copy('link', link)}
          >
            {copied === 'link' ? 'Link copied' : 'Copy link'}
          </Button>
        ) : null}
      </div>
      <p role="status" className="sr-only">
        {failed ? 'Could not copy. Select the code and copy it by hand.' : copied === 'code' ? 'Code copied' : copied === 'link' ? 'Link copied' : ''}
      </p>
      {failed ? <p className="text-sm text-danger">Could not copy. Select the code and copy it by hand.</p> : null}
    </div>
  )
}
