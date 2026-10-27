import { useEffect, useMemo, useRef, useState } from 'react'
import { Board } from '../drawing/board'
import { REALTIME_URL, toWsUrl } from './config'
import { rooms } from './rooms'
import { RoomSocket, type RoomState } from './socket'

export interface RoomSession {
  board: Board
  state: RoomState
  /** Whether the caller is the host (can end the room). Known after the first ticket. */
  isHost: boolean
  socket: RoomSocket
}

/** One room, one socket, one board. Cleans up when the code changes or the page closes. */
export function useRoomSession(code: string): RoomSession {
  const board = useMemo(() => new Board(), [code])
  const [state, setState] = useState<RoomState>({
    status: 'connecting',
    you: null,
    peer: null,
    peerLeft: false,
    peerDrawing: false,
    lesson: null,
  })
  const [isHost, setIsHost] = useState(false)
  const hostRef = useRef(setIsHost)
  hostRef.current = setIsHost

  const socket = useMemo(
    () =>
      new RoomSocket({
        code,
        wsBase: toWsUrl(REALTIME_URL),
        board,
        onState: (s) => setState(s),
        getTicket: async () => {
          // A visitor with an invite link is not in the room yet: the ticket says so, and then they join.
          let t
          try {
            t = await rooms.ticket(code)
          } catch (err) {
            if ((err as { code?: string }).code !== 'room_not_found') throw err
            await rooms.join(code)
            t = await rooms.ticket(code)
          }
          hostRef.current(t.isHost)
          return t.ticket
        },
      }),
    [code, board],
  )

  // When the other person leaves, the host may have changed: you may be the host now. Ask again.
  useEffect(() => {
    if (!state.peerLeft) return
    let live = true
    rooms
      .ticket(code)
      .then((t) => live && setIsHost(t.isHost))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [state.peerLeft, code])

  useEffect(() => {
    socket.connect()
    const online = () => {
      if (socket.current.status === 'reconnecting') socket.connect()
    }
    window.addEventListener('online', online)
    return () => {
      window.removeEventListener('online', online)
      socket.close()
    }
  }, [socket])

  return { board, state, isHost, socket }
}
