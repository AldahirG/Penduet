import { useState, type ReactNode } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { DEFAULT_PALETTE } from '../drawing/palette'
import { usePageTitle } from '../usePageTitle'
import {
  Button,
  ColourPicker,
  ConnectionBanner,
  DrawingToolbar,
  IconButton,
  Modal,
  PlayerChip,
  RoomCodeDisplay,
  RoomCodeInput,
  ScoreCard,
  SegmentedControl,
  SizeControl,
  StepProgress,
  TextInput,
  useToast,
  type ConnectionKind,
  type DrawingTool,
} from '../ui'

const connectionKinds: ConnectionKind[] = ['reconnecting', 'offline', 'peer-left', 'room-full', 'room-expired', 'replaced']

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`d-${title}`} className="flex flex-col gap-3">
      <h2 id={`d-${title}`} className="font-display text-lg font-semibold">
        {title}
      </h2>
      {children}
    </section>
  )
}

// Every primitive in every state that matters. This is the design-system check (replica-design, step 4).
export function Design() {
  usePageTitle('Design')
  const toast = useToast()
  const [tool, setTool] = useState<DrawingTool>('pen')
  const [color, setColor] = useState(DEFAULT_PALETTE[7]?.value ?? '#2563eb')
  const [size, setSize] = useState(10)
  const [code, setCode] = useState('K7Q')
  const [modal, setModal] = useState(false)
  const [seg, setSeg] = useState<'solo' | 'together'>('together')
  const [name, setName] = useState('Mia')

  return (
    <div className="flex flex-col gap-8 pb-16">
      <header>
        <h1 className="font-display text-xl font-bold">Design system</h1>
        <p className="text-muted">Primitives built from replica/design. Switch the theme in the header.</p>
      </header>

      <Section title="Buttons">
        <div className="flex flex-wrap gap-3">
          <Button>Create room</Button>
          <Button variant="secondary">Join with code</Button>
          <Button variant="ghost">Skip step</Button>
          <Button variant="danger">Clear canvas</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
          <Button disabled>Disabled</Button>
          <Button loading>Joining</Button>
          <Button icon={<Plus aria-hidden="true" className="h-4 w-4" />}>With icon</Button>
        </div>
        <div className="flex gap-2">
          <IconButton label="Pen" icon={<Pencil />} />
          <IconButton label="Pen, selected" icon={<Pencil />} pressed />
          <IconButton label="Pen, disabled" icon={<Pencil />} disabled />
        </div>
      </Section>

      <Section title="Fields and room code">
        <div className="grid gap-4 md:grid-cols-3">
          <TextInput label="Display name" value={name} onChange={(e) => setName(e.target.value)} hint="Your partner sees this." />
          <TextInput label="Room code" defaultValue="K7Q2" error="Codes have six characters." />
          <TextInput label="Disabled" disabled defaultValue="Not editable" />
        </div>
        <div className="flex flex-wrap items-start gap-8">
          <RoomCodeInput value={code} onChange={setCode} onComplete={(c) => toast.show(`Looking for room ${c}…`)} />
          <RoomCodeInput value="K7Q2M9" onChange={() => undefined} error="That room is full." />
          <RoomCodeDisplay code="K7Q2M9" link="https://example.com/room/K7Q2M9" />
        </div>
      </Section>

      <Section title="Players and status">
        <div className="flex flex-wrap gap-2">
          <PlayerChip name="Mia" slot={1} status="drawing" isMe />
          <PlayerChip name="Leo" slot={2} status="online" />
          <PlayerChip name="Leo" slot={2} status="reconnecting" />
          <PlayerChip name="Leo" slot={2} status="left" />
        </div>
        <div className="flex flex-col gap-2">
          {connectionKinds.map((kind) => (
            <ConnectionBanner key={kind} kind={kind} action={kind === 'room-full' ? undefined : { label: 'Leave room', onClick: () => undefined }} />
          ))}
        </div>
      </Section>

      <Section title="Drawing tools">
        <div className="flex flex-wrap items-start gap-8">
          <DrawingToolbar
            tool={tool}
            onToolChange={setTool}
            color={color}
            onColorChange={setColor}
            size={size}
            onSizeChange={setSize}
            onUndo={() => toast.show('Undid your last stroke', 'success')}
            canUndo
            onClear={() => toast.show('Canvas cleared', 'success')}
          />
          <div className="flex flex-col gap-4">
            <ColourPicker colours={DEFAULT_PALETTE} value={color} onChange={setColor} />
            <div className="w-64">
              <SizeControl value={size} onChange={setSize} color={color} />
            </div>
          </div>
        </div>
      </Section>

      <Section title="Lesson progress and score">
        <StepProgress current={2} total={5} className="max-w-md" />
        <ScoreCard
          title="Nice and steady"
          accuracy={87}
          smoothness={74}
          stars={2}
          passed
          hint="Try a rounder curve on the left ear."
          onRetry={() => undefined}
          onNext={() => undefined}
        />
      </Section>

      <Section title="Segmented control, toasts and dialog">
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl
            label="Mode"
            options={[
              { value: 'solo', label: 'On my own' },
              { value: 'together', label: 'With a friend' },
            ]}
            value={seg}
            onChange={setSeg}
          />
          <Button variant="secondary" onClick={() => toast.show('Room code copied', 'success')}>
            Success toast
          </Button>
          <Button variant="secondary" onClick={() => toast.show('Could not save the drawing.', 'error')}>
            Error toast
          </Button>
          <Button variant="secondary" onClick={() => setModal(true)}>
            Open dialog
          </Button>
        </div>
        <Modal
          open={modal}
          onOpenChange={setModal}
          title="Leave this room?"
          description="Your partner can keep drawing. You can rejoin with the same code while the room is open."
          confirm={{ label: 'Leave room', onClick: () => setModal(false), destructive: true }}
        />
      </Section>
    </div>
  )
}
