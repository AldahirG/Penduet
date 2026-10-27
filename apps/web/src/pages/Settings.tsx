import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROOMS_ARE_LIVE } from '../data/rooms'
import { NAME_MAX, ProfileError, cleanName, deleteMyAccount, getMyProfile, renameMe } from '../data/profile'
import { usePageTitle } from '../usePageTitle'
import { Button, Modal, Spinner, TextInput, useToast } from '../ui'

// S20 Settings: your name in rooms, and deleting your data. Theme lives in the header.
export function Settings() {
  usePageTitle('Settings')
  if (!ROOMS_ARE_LIVE) {
    return (
      <section className="flex max-w-xl flex-col gap-3">
        <h1 className="font-display text-xl font-bold">Settings</h1>
        <p className="text-muted">
          Your name and your data live in the backend, which is not configured in this build. Free drawing and lessons work without it.
        </p>
      </section>
    )
  }
  return <SettingsForm />
}

function SettingsForm() {
  const toast = useToast()
  const navigate = useNavigate()
  const [loaded, setLoaded] = useState<{ name: string; isGuest: boolean } | null>(null)
  const [failed, setFailed] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let live = true
    getMyProfile()
      .then((p) => {
        if (!live) return
        setLoaded({ name: p.displayName, isGuest: p.isGuest })
        setName(p.displayName)
      })
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [])

  const save = async (e: FormEvent) => {
    e.preventDefault()
    const clean = cleanName(name)
    if (!clean) return setError(`Use between 1 and ${NAME_MAX} characters.`)
    setError(undefined)
    setSaving(true)
    try {
      const saved = await renameMe(clean)
      setName(saved)
      setLoaded((l) => (l ? { ...l, name: saved } : l))
      toast.show('Name saved. Your partner sees it the next time you join a room.', 'success')
    } catch (err) {
      setError(err instanceof ProfileError && err.code === 'invalid_name' ? `Use between 1 and ${NAME_MAX} characters.` : 'Could not save. Try again.')
    }
    setSaving(false)
  }

  const remove = async () => {
    setDeleting(true)
    try {
      await deleteMyAccount()
      toast.show('Your data is deleted.', 'success')
      navigate('/')
    } catch {
      toast.show('Could not delete. Try again.', 'error')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  if (failed) {
    return (
      <section className="flex max-w-xl flex-col gap-3">
        <h1 className="font-display text-xl font-bold">Settings</h1>
        <p className="text-danger">Could not reach the service. Try again in a moment.</p>
      </section>
    )
  }
  if (!loaded) {
    return (
      <p className="flex items-center gap-2 text-muted">
        <Spinner /> Loading…
      </p>
    )
  }

  return (
    <section className="flex max-w-xl flex-col gap-8">
      <h1 className="font-display text-xl font-bold">Settings</h1>

      <form onSubmit={save} className="flex flex-col gap-3" aria-labelledby="name-title">
        <h2 id="name-title" className="font-display text-lg font-semibold">
          Your name
        </h2>
        <TextInput
          label="Name shown in rooms"
          value={name}
          maxLength={NAME_MAX}
          autoComplete="off"
          onChange={(e) => {
            setName(e.target.value)
            setError(undefined)
          }}
          error={error}
          hint={loaded.isGuest ? 'You are drawing as a guest. This name is all anyone sees.' : undefined}
        />
        <Button type="submit" loading={saving} disabled={name.trim() === loaded.name} className="self-start">
          Save name
        </Button>
      </form>

      <section aria-labelledby="data-title" className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5">
        <h2 id="data-title" className="font-display text-lg font-semibold">
          Your data
        </h2>
        <p className="text-muted">
          Deleting removes your profile, the rooms you opened and your place in other rooms, for good. Drawings you saved to your device are
          not touched.
        </p>
        <Button variant="danger" onClick={() => setConfirmDelete(true)} className="self-start">
          Delete my data
        </Button>
      </section>

      <Modal
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete your data?"
        description="This cannot be undone. A new guest profile is created the next time you open a room."
        confirm={{ label: 'Delete', destructive: true, loading: deleting, onClick: remove }}
      />
    </section>
  )
}
