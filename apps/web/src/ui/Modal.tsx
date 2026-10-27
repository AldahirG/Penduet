import * as Dialog from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'
import { Button } from './Button'

export interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children?: ReactNode
  /** The main action. Pass destructive for things like clearing the canvas. */
  confirm?: { label: string; onClick: () => void; destructive?: boolean; loading?: boolean }
  cancelLabel?: string
}

/** Radix Dialog gives the focus trap, Esc to close, aria-modal and focus return. */
export function Modal({ open, onOpenChange, title, description, children, confirm, cancelLabel = 'Cancel' }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-scrim" />
        <Dialog.Content
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-screen flex-col gap-4 overflow-auto rounded-t-xl bg-raised p-6 shadow-pop md:inset-auto md:left-1/2 md:top-1/2 md:w-full md:max-w-md md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl"
          // No description means no describedby target; saying so keeps Radix quiet.
          {...(description ? {} : { 'aria-describedby': undefined })}
        >
          <Dialog.Title className="font-display text-lg font-semibold">{title}</Dialog.Title>
          {description ? <Dialog.Description className="text-muted">{description}</Dialog.Description> : null}
          {children}
          <div className="flex flex-wrap justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="secondary">{cancelLabel}</Button>
            </Dialog.Close>
            {confirm ? (
              <Button variant={confirm.destructive ? 'danger' : 'primary'} loading={confirm.loading} onClick={confirm.onClick}>
                {confirm.label}
              </Button>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
