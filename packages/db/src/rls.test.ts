import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asAnon, asService, asUser, createDb, newGuest, one, type Db } from './harness'

// The rule from the security checklist: authorisation is tested with a second user, who must get
// nothing back. Every block below sets up data as one user and then probes it as another.

let db: Db
beforeAll(async () => {
  db = await createDb({ seed: true })
}, 60_000)
afterAll(async () => {
  await db.close()
})

const room = async (host: string) =>
  (await asUser<{ id: string; code: string }>(db, host, 'select * from create_room()'))[0]!

describe('profiles', () => {
  it('shows you yourself and people in your room, and nobody else', async () => {
    const [a, b, outsider] = [await newGuest(db), await newGuest(db), await newGuest(db)]
    const r = await room(a)
    await asUser(db, b, 'select join_room($1)', [r.code])
    const seenByA = (await asUser<{ id: string }>(db, a, 'select id from profiles')).map((p) => p.id)
    expect(seenByA.sort()).toEqual([a, b].sort())
    const seenByOutsider = (await asUser<{ id: string }>(db, outsider, 'select id from profiles')).map((p) => p.id)
    expect(seenByOutsider).toEqual([outsider])
  })

  it('lets you rename yourself but not set is_guest, and never touches another profile', async () => {
    const [a, b] = [await newGuest(db), await newGuest(db)]
    await asUser(db, a, `update profiles set display_name = 'Renamed' where id = $1`, [a])
    expect((await asUser<{ display_name: string }>(db, a, 'select display_name from profiles where id = $1', [a]))[0]!.display_name).toBe('Renamed')
    await expect(asUser(db, a, `update profiles set is_guest = false where id = $1`, [a])).rejects.toThrow(/permission denied/)
    const hit = await asUser(db, a, `update profiles set display_name = 'Hacked' where id = $1 returning id`, [b])
    expect(hit).toHaveLength(0)
  })

  it('rejects usernames and names that break the format rules', async () => {
    const a = await newGuest(db)
    await expect(asUser(db, a, `update profiles set username = 'Has Space' where id = $1`, [a])).rejects.toThrow(/check/)
    await expect(asUser(db, a, `update profiles set display_name = '' where id = $1`, [a])).rejects.toThrow(/check/)
  })

  it('does not let a client insert or delete profiles', async () => {
    const a = await newGuest(db)
    await expect(asUser(db, a, `insert into profiles (id, username, display_name) values (gen_random_uuid(), 'sneaky', 'X')`)).rejects.toThrow(/permission denied/)
    await expect(asUser(db, a, 'delete from profiles')).rejects.toThrow(/permission denied/)
  })
})

describe('rooms and room_members', () => {
  it('hides a room and its members from anyone who is not in it', async () => {
    const [a, outsider] = [await newGuest(db), await newGuest(db)]
    const r = await room(a)
    expect(await asUser(db, outsider, 'select * from rooms')).toHaveLength(0)
    expect(await asUser(db, outsider, `select * from rooms where code = $1`, [r.code])).toHaveLength(0)
    expect(await asUser(db, outsider, 'select * from room_members')).toHaveLength(0)
    expect(await asUser(db, a, 'select * from rooms')).toHaveLength(1)
  })

  it('stops reading once you have left', async () => {
    const [a, b] = [await newGuest(db), await newGuest(db)]
    const r = await room(a)
    await asUser(db, b, 'select join_room($1)', [r.code])
    expect(await asUser(db, b, 'select * from rooms')).toHaveLength(1)
    await asUser(db, b, 'select leave_room($1)', [r.code])
    expect(await asUser(db, b, 'select * from rooms')).toHaveLength(0)
  })

  it('refuses every direct write, so seats and status can only change through the functions', async () => {
    const [a, b] = [await newGuest(db), await newGuest(db)]
    const r = await room(a)
    await expect(asUser(db, b, `insert into rooms (code, host_id) values ('ZZZZZZ', $1)`, [b])).rejects.toThrow(/permission denied/)
    await expect(asUser(db, a, `update rooms set capacity = 10 where id = $1`, [r.id])).rejects.toThrow(/permission denied/)
    await expect(asUser(db, a, 'delete from rooms')).rejects.toThrow(/permission denied/)
    await expect(asUser(db, b, `insert into room_members (room_id, user_id) values ($1, $2)`, [r.id, b])).rejects.toThrow(/permission denied/)
  })

  it('does not let signed-out visitors call the room functions or read anything', async () => {
    await expect(asAnon(db, 'select * from create_room()')).rejects.toThrow(/permission denied/)
    await expect(asAnon(db, `select * from join_room('ABCD23')`)).rejects.toThrow(/permission denied/)
    expect(await asAnon(db, 'select * from rooms')).toHaveLength(0)       // RLS: no policy for anon
    expect(await asAnon(db, 'select * from room_members')).toHaveLength(0)
    expect(await asAnon(db, 'select * from profiles')).toHaveLength(0)
  })
})

describe('lessons (public content)', () => {
  it('shows signed-out visitors only published lessons and their steps', async () => {
    const lessons = await asAnon<{ slug: string }>(db, 'select slug from lessons')
    expect(lessons.map((l) => l.slug)).toEqual(['straight-lines'])
    expect(await asAnon(db, 'select 1 from lesson_steps')).toHaveLength(2)
    await asService(db, `insert into lesson_steps (lesson_id, position, stage, prompt, guide)
      values ('30000000-0000-4000-8000-000000000002', 0, 'lines', 'hidden', '{"paths": []}')`)
    expect(await asAnon(db, 'select 1 from lesson_steps')).toHaveLength(2)
  })

  it('refuses client writes to content', async () => {
    const a = await newGuest(db)
    await expect(asUser(db, a, `update lessons set published = true`)).rejects.toThrow(/permission denied/)
    await expect(asAnon(db, `delete from courses`)).rejects.toThrow(/permission denied/)
  })
})

describe('attempts', () => {
  const step = '40000000-0000-4000-8000-000000000001'
  const lesson = '30000000-0000-4000-8000-000000000001'
  const insert = (uid: string, clientId: string, roomId: string | null = null, accuracy = 80) =>
    asUser(
      db,
      uid,
      `insert into attempts (user_id, lesson_id, step_id, room_id, client_id, accuracy, smoothness, duration_ms, passed)
       values ($1, $2, $3, $4, $5, $6, 70, 4000, true) on conflict (user_id, client_id) do nothing returning id`,
      [uid, lesson, step, roomId, clientId, accuracy],
    )

  it('keeps a second user out of your attempts and rejects a forged owner', async () => {
    const [a, b] = [await newGuest(db), await newGuest(db)]
    await insert(a, randomUUID())
    expect(await asUser(db, a, 'select 1 from attempts')).toHaveLength(1)
    expect(await asUser(db, b, 'select 1 from attempts')).toHaveLength(0)
    await expect(
      asUser(db, b, `insert into attempts (user_id, lesson_id, step_id, client_id, accuracy, smoothness, duration_ms, passed)
        values ($1, $2, $3, gen_random_uuid(), 50, 50, 1000, false)`, [a, lesson, step]),
    ).rejects.toThrow(/row-level security/)
  })

  it('treats a resend with the same client_id as a no-op', async () => {
    const a = await newGuest(db)
    const id = randomUUID()
    expect(await insert(a, id)).toHaveLength(1)
    expect(await insert(a, id)).toHaveLength(0)
    expect(await asUser(db, a, 'select 1 from attempts')).toHaveLength(1)
  })

  it('only accepts a room you are in, and rejects out-of-range scores', async () => {
    const [a, b] = [await newGuest(db), await newGuest(db)]
    const r = await room(a)
    await expect(insert(b, randomUUID(), r.id)).rejects.toThrow(/row-level security/)
    expect(await insert(a, randomUUID(), r.id)).toHaveLength(1)
    await expect(insert(a, randomUUID(), null, 101)).rejects.toThrow(/check/)
  })

  it('cannot be edited or deleted by the owner', async () => {
    const a = await newGuest(db)
    await insert(a, randomUUID())
    await expect(asUser(db, a, 'update attempts set accuracy = 100')).rejects.toThrow(/permission denied/)
    await expect(asUser(db, a, 'delete from attempts')).rejects.toThrow(/permission denied/)
  })
})

describe('artworks and storage', () => {
  const insert = (uid: string, path: string, roomId: string | null = null) =>
    asUser(db, uid, `insert into artworks (owner_id, source, image_path, room_id) values ($1, 'free', $2, $3) returning id`, [uid, path, roomId])

  it('is private to the owner', async () => {
    const [a, b] = [await newGuest(db), await newGuest(db)]
    await insert(a, `${a}/one.png`)
    expect(await asUser(db, a, 'select 1 from artworks')).toHaveLength(1)
    expect(await asUser(db, b, 'select 1 from artworks')).toHaveLength(0)
    expect(await asUser(db, b, 'delete from artworks returning id')).toHaveLength(0)
    await expect(asUser(db, b, `insert into artworks (owner_id, source, image_path) values ($1, 'free', $2)`, [a, `${a}/x.png`])).rejects.toThrow(/row-level security/)
  })

  it('refuses an image path that points into someone else folder, or a room you are not in', async () => {
    const [a, b] = [await newGuest(db), await newGuest(db)]
    await expect(insert(a, `${b}/steal.png`)).rejects.toThrow(/check/)
    const r = await room(b)
    await expect(insert(a, `${a}/x.png`, r.id)).rejects.toThrow(/row-level security/)
  })

  it('lets you write and read objects only under your own folder of the private bucket', async () => {
    const [a, b] = [await newGuest(db), await newGuest(db)]
    const put = (uid: string, name: string) =>
      asUser(db, uid, `insert into storage.objects (bucket_id, name) values ('artworks', $1)`, [name])
    await put(a, `${a}/p.png`)
    await expect(put(b, `${a}/overwrite.png`)).rejects.toThrow(/row-level security/)
    expect(await asUser(db, a, `select 1 from storage.objects where bucket_id = 'artworks'`)).toHaveLength(1)
    expect(await asUser(db, b, `select 1 from storage.objects where bucket_id = 'artworks'`)).toHaveLength(0)
  })

  it('configures the bucket as private, png only and size limited', async () => {
    const [bucket] = await asService<{ public: boolean; file_size_limit: string; allowed_mime_types: string[] }>(
      db,
      `select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'artworks'`,
    )
    expect(bucket).toMatchObject({ public: false, allowed_mime_types: ['image/png'] })
    expect(Number(bucket!.file_size_limit)).toBe(5 * 1024 * 1024)
  })
})

describe('daily_progress', () => {
  it('is per user', async () => {
    const [a, b] = [await newGuest(db), await newGuest(db)]
    await asUser(db, a, `insert into daily_progress (user_id, day, lessons_completed) values ($1, current_date, 2)`, [a])
    expect(await asUser(db, b, 'select 1 from daily_progress')).toHaveLength(0)
    await expect(asUser(db, b, `insert into daily_progress (user_id, day) values ($1, current_date)`, [a])).rejects.toThrow(/row-level security/)
  })
})

describe('friendships and notifications', () => {
  const ask = (from: string, to: string) =>
    asUser<{ id: string }>(db, from, `insert into friendships (requester_id, addressee_id) values ($1, $2) returning id`, [from, to])

  it('is visible to the two people in it and nobody else', async () => {
    const [a, b, c] = [await newGuest(db), await newGuest(db), await newGuest(db)]
    await ask(a, b)
    expect(await asUser(db, a, 'select 1 from friendships')).toHaveLength(1)
    expect(await asUser(db, b, 'select 1 from friendships')).toHaveLength(1)
    expect(await asUser(db, c, 'select 1 from friendships')).toHaveLength(0)
  })

  it('allows one row per pair whichever side asks, and no self requests or forged accepts', async () => {
    const [a, b] = [await newGuest(db), await newGuest(db)]
    await ask(a, b)
    await expect(ask(b, a)).rejects.toThrow(/unique|duplicate/)
    await expect(ask(a, a)).rejects.toThrow(/check|friendship_not_self/)
    const c = await newGuest(db)
    await expect(
      asUser(db, c, `insert into friendships (requester_id, addressee_id, status) values ($1, $2, 'accepted')`, [c, a]),
    ).rejects.toThrow(/row-level security/)
  })

  it('lets only the addressee respond, and only by changing the status', async () => {
    const [a, b] = [await newGuest(db), await newGuest(db)]
    const { id } = one(await ask(a, b))
    expect(await asUser(db, a, `update friendships set status = 'accepted' where id = $1 returning id`, [id])).toHaveLength(0)
    await expect(asUser(db, b, `update friendships set requester_id = $1 where id = $2`, [b, id])).rejects.toThrow(/permission denied/)
    expect(await asUser(db, b, `update friendships set status = 'accepted' where id = $1 returning id`, [id])).toHaveLength(1)
  })

  it('does not let a blocked person delete the block and ask again', async () => {
    const [a, b] = [await newGuest(db), await newGuest(db)]
    const { id } = one(await ask(a, b))
    await asUser(db, b, `update friendships set status = 'blocked' where id = $1`, [id])
    expect(await asUser(db, a, 'delete from friendships returning id')).toHaveLength(0)
    expect(await asUser(db, b, 'delete from friendships returning id')).toHaveLength(1)
  })

  it('notifies the addressee through the trigger, and lets them change only read_at', async () => {
    const [a, b] = [await newGuest(db), await newGuest(db)]
    await ask(a, b)
    expect(await asUser(db, a, 'select 1 from notifications')).toHaveLength(0)
    const mine = await asUser<{ id: string; type: string }>(db, b, 'select id, type from notifications')
    expect(mine).toMatchObject([{ type: 'friend_request' }])
    await expect(asUser(db, b, `insert into notifications (user_id, type) values ($1, 'lobby_invite')`, [b])).rejects.toThrow(/permission denied/)
    await expect(asUser(db, b, `update notifications set payload = '{}'`)).rejects.toThrow(/permission denied/)
    expect(await asUser(db, b, `update notifications set read_at = now() returning id`)).toHaveLength(1)
  })
})

describe('user_reports, subscriptions, webhook_events', () => {
  it('lets you file a report as yourself, never read reports back, and not report yourself', async () => {
    const [a, b] = [await newGuest(db), await newGuest(db)]
    await asUser(db, a, `insert into user_reports (reporter_id, reported_id, reason) values ($1, $2, 'spam')`, [a, b])
    expect(await asUser(db, a, 'select 1 from user_reports')).toHaveLength(0)
    expect(await asUser(db, b, 'select 1 from user_reports')).toHaveLength(0)
    await expect(asUser(db, a, `insert into user_reports (reporter_id, reported_id, reason) values ($1, $2, 'spam')`, [b, a])).rejects.toThrow(/row-level security/)
    await expect(asUser(db, a, `insert into user_reports (reporter_id, reported_id, reason) values ($1, $1, 'spam')`, [a])).rejects.toThrow(/check|report_not_self/)
  })

  it('never lets a client grant itself a subscription', async () => {
    const [a, b] = [await newGuest(db), await newGuest(db)]
    await expect(
      asUser(db, a, `insert into subscriptions (user_id, provider, provider_ref, plan, status, price_cents, currency)
        values ($1, 'stripe', 'sub_x', 'yearly', 'active', 0, 'USD')`, [a]),
    ).rejects.toThrow(/permission denied/)
    await asService(db, `insert into subscriptions (user_id, provider, provider_ref, plan, status, price_cents, currency)
      values ($1, 'stripe', 'sub_real', 'monthly', 'active', 499, 'USD')`, [a])
    expect(await asUser(db, a, 'select 1 from subscriptions')).toHaveLength(1)
    expect(await asUser(db, b, 'select 1 from subscriptions')).toHaveLength(0)
  })

  it('keeps webhook idempotency rows away from clients and makes a repeated event id a conflict', async () => {
    const a = await newGuest(db)
    await expect(asUser(db, a, 'select * from webhook_events')).rejects.toThrow(/permission denied/)
    const first = await asService(db, `insert into webhook_events (provider, event_id) values ('stripe', 'evt_1') on conflict do nothing returning event_id`)
    const again = await asService(db, `insert into webhook_events (provider, event_id) values ('stripe', 'evt_1') on conflict do nothing returning event_id`)
    expect([first.length, again.length]).toEqual([1, 0])
  })
})

describe('seed', () => {
  it('loads and gives the fake users a profile each', async () => {
    const profiles = await asService<{ username: string }>(db, `select username from profiles where username in ('mara_draws','teo_sketch','lonely_pencil')`)
    expect(profiles).toHaveLength(3)
    const { n } = one(await asService<{ n: number }>(db, `select count(*)::int as n from rooms where code in ('ABCD23','WXYZ89')`))
    expect(n).toBe(2)
  })
})
