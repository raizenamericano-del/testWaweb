import { io } from 'socket.io-client'
import { getToken } from './api.js'

let socket = null

export function getSocket() {
  if (socket) return socket
  const url = import.meta.env.VITE_API_URL || undefined
  socket = io(url, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 900,
    reconnectionDelayMax: 6000,
    reconnectionAttempts: Infinity,
    timeout: 15000,
    auth: { token: getToken() },
  })
  // Debug handle: window.__kyywa.emit('chat:open', jid, console.log)
  // Always on in dev. In a production build it is opt-in, so the socket is not
  // reachable from the console on a deployed instance unless you ask for it:
  //   localStorage.setItem('kyywa:debug', '1')
  if (typeof window !== 'undefined') {
    let wanted = import.meta.env.DEV
    if (!wanted) {
      try {
        wanted = localStorage.getItem('kyywa:debug') === '1'
      } catch {
        wanted = false
      }
    }
    if (wanted) window.__kyywa = socket
  }
  return socket
}

export default getSocket
