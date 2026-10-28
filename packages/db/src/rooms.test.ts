import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asService, asUser, createDb, newGuest, one, type Db } from './harness'

let db: Db
beforeAll(async () => {
  db = await createDb()
}, 60_000)
afterAll(async () => {
  await db.close()
})

type Room = { id: string; code: string; status: string; host_id: string; capacity: number; lesson_slug: string | null; game: string }
const create = async (uid: string, slug: string | null = null) =>
  (await asUser<Room>(db, uid, 'select * from create_room($1)', [slug]))[0]!
const join = async (uid: string, code: string) =>
  (await asUser<Room>(db, uid, 'select * from join_room($1)', [code]))[0]!
const members = (roomId: string) =>
  asService<{ user_id: string; role: string; left_at: string | null }>(
    db,
    'select user_id, role, left_at from room_members where room_id = $1 order by joined_at, role',
    [roomId],
  )

describe('create_room', () => {
  it('makes a live room with a valid code and puts the host in it', async () => {
    const host = await newGuest(db)
    const room = await create(host)
    expect(room.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/)
    expect(room.status).toBe('open')
    expect(room.host_id).toBe(host)
    expect(await members(room.id)).toMatchObject([{ user_id: host, role: 'host' }])
  })

  it('keeps the lesson slug and rejects a malformed one', async () => {
    const host = await newGuest(db)
    expect((await create(host, 'straight-lines')).lesson_slug).toBe('straight-lines')
    await expect(create(host, 'Not A Slug!')).rejects.toThrow(/bad_lesson/)
  })

  it('makes free rooms by default and keeps the game it was made for', async () => {
    const host = await newGuest(db)
    expect((await create(host)).game).toBe('free')
    const game = async (g: string, slug: string | null = null) =>
      (await asUser<Room>(db, host, 'select * from create_room($1, $2)', [slug, g]))[0]!
    await db.exec('delete from rooms')
    expect((await game('topic')).game).toBe('topic')
    expect((await game('turns')).game).toBe('turns')
    await db.exec('delete from rooms')
    expect((await game('halves')).game).toBe('halves')
    await db.exec('delete from rooms')
    expect((await game('guess')).game).toBe('guess')
  })

  it('refuses an unknown game, and a game together with a lesson', async () => {
    const host = await newGuest(db)
    const game = (g: string | null, slug: string | null = null) =>
      asUser<Room>(db, host, 'select * from create_room($1, $2)', [slug, g])
    await expect(game('battle-royale')).rejects.toThrow(/bad_game/)
    await expect(game(null)).rejects.toThrow(/bad_game/)
    await expect(game('turns', 'straight-lines')).rejects.toThrow(/bad_game/)
    expect((await game('free', 'straight-lines'))[0]!.game).toBe('free')
  })

  it('allows 3 live rooms per host and refuses the 4th', async () => {
    const host = await newGuest(db)
    await create(host)
    await create(host)
    await create(host)
    await expect(create(host)).rejects.toThrow(/too_many_rooms/)
  })

  it('needs a signed-in user', async () => {
    await db.exec('set role authenticated')
    try {
      await expect(db.query('select * from create_room()')).rejects.toThrow(/not_authenticated/)
    } finally {
      await db.exec('reset role')
    }
  })

  it('gives every live room a different code', async () => {
    const codes = new Set<string>()
    for (let i = 0; i < 12; i++) codes.add((await create(await newGuest(db))).code)
    expect(codes.size).toBe(12)
  })
})

describe('join_room', () => {
  it('seats a second player, activates the room, and is idempotent for the same player', async () => {
    const [a, b] = [await newGuest(db), await newGuest(db)]
    const room = await create(a)
    const joined = await join(b, room.code)
    expect(joined.status).toBe('active')
    expect((await join(b, room.code)).id).toBe(room.id)
    expect(await members(room.id)).toHaveLength(2)
  })

  it('accepts a lowercase code', async () => {
    const [a, b] = [await newGuest(db), await newGuest(db)]
    const room = await create(a)
    expect((await join(b, room.code.toLowerCase())).id).toBe(room.id)
  })

  it('refuses a third player with room_full', async () => {
    const [a, b, c] = [await newGuest(db), await newGuest(db), await newGuest(db)]
    const room = await create(a)
    await join(b, room.code)
    await expect(join(c, room.code)).rejects.toThrow(/room_full/)
    expect(await members(room.id)).toHaveLength(2)
  })

  it('says room_not_found for an unknown, ended or expired code', async () => {
    const [a, b] = [await newGuest(db), await newGuest(db)]
    await expect(join(b, 'AAAAAA')).rejects.toThrow(/room_not_found/)
    const ended = await create(a)
    await asUser(db, a, 'select end_room($1)', [ended.code])
    await expect(join(b, ended.code)).rejects.toThrow(/room_not_found/)
    const old = await create(a)
    await asService(db, `update rooms set expires_at = now() - interval '1 minute' where id = $1`, [old.id])
    await expect(join(b, old.code)).rejects.toThrow(/room_not_found/)
  })

  it('lets someone who left come back while there is a free seat', async () => {
    const [a, b] = [await newGuest(db), await newGuest(db)]
    const room = await create(a)
    await join(b, room.code)
    await asUser(db, b, 'select leave_room($1)', [room.code])
    await join(b, room.code)
    expect((await members(room.id)).filter((m) => m.left_at === null)).toHaveLength(2)
  })
})

describe('leave_room and end_room', () => {
  it('promotes the guest to host when the host leaves', async () => {
    const [a, b] = [await newGuest(db), await newGuest(db)]
    const room = await create(a)
    await join(b, room.code)
    const { leave_room } = one(await asUser<{ leave_room: string }>(db, a, 'select leave_room($1)', [room.code]))
    expect(leave_room).toBe(room.id)
    const [after] = await asService<Room>(db, 'select * from rooms where id = $1', [room.id])
    expect(after).toMatchObject({ host_id: b, status: 'active' })
  })

  it('ends the room when the last person leaves', async () => {
    const a = await newGuest(db)
    const room = await create(a)
    await asUser(db, a, 'select leave_room($1)', [room.code])
    const [after] = await asService<Room>(db, 'select * from rooms where id = $1', [room.id])
    expect(after!.status).toBe('ended')
  })

  it('does nothing, and says so, when a stranger calls leave_room', async () => {
    const [a, stranger] = [await newGuest(db), await newGuest(db)]
    const room = await create(a)
    const { leave_room } = one(await asUser<{ leave_room: string | null }>(db, stranger, 'select leave_room($1)', [room.code]))
    expect(leave_room).toBeNull()
    expect((await members(room.id)).every((m) => m.left_at === null)).toBe(true)
  })

  it('lets only the host end a room', async () => {
    const [a, b] = [await newGuest(db), await newGuest(db)]
    const room = await create(a)
    await join(b, room.code)
    const [byGuest] = await asUser<{ end_room: string | null }>(db, b, 'select end_room($1)', [room.code])
    expect(byGuest!.end_room).toBeNull()
    const [byHost] = await asUser<{ end_room: string | null }>(db, a, 'select end_room($1)', [room.code])
    expect(byHost!.end_room).toBe(room.id)
  })

  it('frees the code for reuse once the room has ended', async () => {
    const a = await newGuest(db)
    const room = await create(a)
    await asUser(db, a, 'select end_room($1)', [room.code])
    // The unique index only covers live rooms, so the same code can be inserted again.
    await asService(db, `insert into rooms (code, host_id) values ($1, $2)`, [room.code, a])
    expect(await asService(db, 'select 1 from rooms where code = $1', [room.code])).toHaveLength(2)
  })
})

describe('jobs', () => {
  it('expire_rooms expires old live rooms and leaves fresh ones', async () => {
    const [a, b] = [await newGuest(db), await newGuest(db)]
    const stale = await create(a)
    const fresh = await create(b)
    await asService(db, `update rooms set expires_at = now() - interval '1 hour' where id = $1`, [stale.id])
    const { expire_rooms } = one((await db.query<{ expire_rooms: number }>('select expire_rooms()')).rows)
    expect(expire_rooms).toBeGreaterThanOrEqual(1)
    const rows = await asService<Room>(db, 'select id, status from rooms where id in ($1, $2)', [stale.id, fresh.id])
    expect(Object.fromEntries(rows.map((r) => [r.id, r.status]))).toEqual({ [stale.id]: 'expired', [fresh.id]: 'open' })
  })

  it('prune_guests deletes idle guests and everything they own, and keeps active ones', async () => {
    const [idle, active] = [await newGuest(db), await newGuest(db)]
    const room = await create(idle)
    await asService(db, `update auth.users set last_sign_in_at = now() - interval '40 days' where id = $1`, [idle])
    await db.query('select prune_guests()')
    expect(await asService(db, 'select 1 from profiles where id = $1', [idle])).toHaveLength(0)
    expect(await asService(db, 'select 1 from rooms where id = $1', [room.id])).toHaveLength(0)
    expect(await asService(db, 'select 1 from profiles where id = $1', [active])).toHaveLength(1)
  })

  it('clients cannot run the jobs', async () => {
    const a = await newGuest(db)
    await expect(asUser(db, a, 'select expire_rooms()')).rejects.toThrow(/permission denied/)
    await expect(asUser(db, a, 'select prune_guests()')).rejects.toThrow(/permission denied/)
  })
})

describe('delete_my_account', () => {
  it('removes the user, their profile, hosted rooms and memberships', async () => {
    const [a, b] = [await newGuest(db), await newGuest(db)]
    const hosted = await create(a)
    const other = await create(b)
    await join(a, other.code)
    await asUser(db, a, 'select delete_my_account()')
    expect(await asService(db, 'select 1 from auth.users where id = $1', [a])).toHaveLength(0)
    expect(await asService(db, 'select 1 from profiles where id = $1', [a])).toHaveLength(0)
    expect(await asService(db, 'select 1 from rooms where id = $1', [hosted.id])).toHaveLength(0)
    expect(await asService(db, 'select 1 from room_members where user_id = $1', [a])).toHaveLength(0)
    // The other person and their room are untouched.
    expect(await asService(db, 'select 1 from rooms where id = $1', [other.id])).toHaveLength(1)
  })
})
