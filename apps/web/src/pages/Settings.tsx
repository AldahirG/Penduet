import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROOMS_ARE_LIVE } from '../data/rooms'
import { NAME_MAX, ProfileError, cleanName, deleteMyAccount, getMyProfile, renameMe } from '../data/profile'
import { LANGS, useLang, useT, type Lang } from '../i18n'
import { usePageTitle } from '../usePageTitle'
import { Button, Modal, SegmentedControl, Spinner, TextInput, useToast } from '../ui'

// S20 Settings: your name in rooms, and deleting your data. Theme lives in the header.
export function Settings() {
  const { t } = useT()
  usePageTitle(t('title.settings'))
  if (!ROOMS_ARE_LIVE) {
    return (
      <section className="flex max-w-xl flex-col gap-3">
        <h1 className="font-display text-xl font-bold">{t('settings.title')}</h1>
        <LanguageSection />
        <p className="text-muted">{t('settings.noBackend')}</p>
      </section>
    )
  }
  return <SettingsForm />
}

function LanguageSection() {
  const { t, lang } = useT()
  const [, setLang] = useLang()
  return (
    <section aria-labelledby="lang-title" className="flex flex-col gap-2">
      <h2 id="lang-title" className="font-display text-lg font-semibold">
        {t('settings.langTitle')}
      </h2>
      <p className="text-muted">{t('settings.langText')}</p>
      <SegmentedControl<Lang>
        className="self-start"
        label={t('lang.label')}
        value={lang}
        onChange={setLang}
        options={LANGS.map((l) => ({ value: l, label: l === 'es' ? 'Español' : 'English' }))}
      />
    </section>
  )
}

function SettingsForm() {
  const { t } = useT()
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
    if (!clean) return setError(t('settings.invalidName', { max: NAME_MAX }))
    setError(undefined)
    setSaving(true)
    try {
      const saved = await renameMe(clean)
      setName(saved)
      setLoaded((l) => (l ? { ...l, name: saved } : l))
      toast.show(t('settings.saved'), 'success')
    } catch (err) {
      setError(err instanceof ProfileError && err.code === 'invalid_name' ? t('settings.invalidName', { max: NAME_MAX }) : t('settings.saveFail'))
    }
    setSaving(false)
  }

  const remove = async () => {
    setDeleting(true)
    try {
      await deleteMyAccount()
      toast.show(t('settings.deleted'), 'success')
      navigate('/')
    } catch {
      toast.show(t('settings.deleteFail'), 'error')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  if (failed) {
    return (
      <section className="flex max-w-xl flex-col gap-3">
        <h1 className="font-display text-xl font-bold">{t('settings.title')}</h1>
        <p className="text-danger">{t('settings.unreachable')}</p>
      </section>
    )
  }
  if (!loaded) {
    return (
      <p className="flex items-center gap-2 text-muted">
        <Spinner /> {t('common.loading')}
      </p>
    )
  }

  return (
    <section className="flex max-w-xl flex-col gap-8">
      <h1 className="font-display text-xl font-bold">{t('settings.title')}</h1>

      <LanguageSection />

      <form onSubmit={save} className="flex flex-col gap-3" aria-labelledby="name-title">
        <h2 id="name-title" className="font-display text-lg font-semibold">
          {t('settings.nameTitle')}
        </h2>
        <TextInput
          label={t('settings.nameLabel')}
          value={name}
          maxLength={NAME_MAX}
          autoComplete="off"
          onChange={(e) => {
            setName(e.target.value)
            setError(undefined)
          }}
          error={error}
          hint={loaded.isGuest ? t('settings.nameHint') : undefined}
        />
        <Button type="submit" loading={saving} disabled={name.trim() === loaded.name} className="self-start">
          {t('settings.save')}
        </Button>
      </form>

      <section aria-labelledby="data-title" className="flex flex-col gap-3 paper p-5">
        <h2 id="data-title" className="font-display text-lg font-semibold">
          {t('settings.dataTitle')}
        </h2>
        <p className="text-muted">{t('settings.dataText')}</p>
        <Button variant="danger" onClick={() => setConfirmDelete(true)} className="self-start">
          {t('settings.delete')}
        </Button>
      </section>

      <Modal
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('settings.deleteTitle')}
        description={t('settings.deleteText')}
        confirm={{ label: t('settings.deleteConfirm'), destructive: true, loading: deleting, onClick: remove }}
      />
    </section>
  )
}
