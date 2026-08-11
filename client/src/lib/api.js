/** Thin fetch wrapper around the KyyWA REST API. */

const TOKEN_KEY = 'kyywa:token'

export const getToken = () => localStorage.getItem(TOKEN_KEY) || ''
export const setToken = (value) => {
  if (value) localStorage.setItem(TOKEN_KEY, value)
  else localStorage.removeItem(TOKEN_KEY)
}

const base = import.meta.env.VITE_API_URL || ''

async function request(path, { method = 'GET', body, headers = {}, signal } = {}) {
  const token = getToken()
  const isForm = body instanceof FormData
  const res = await fetch(`${base}/api${path}`, {
    method,
    signal,
    headers: {
      ...(isForm ? {} : body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { 'x-access-token': token } : {}),
      ...headers,
    },
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  })

  let data = null
  const text = await res.text()
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { ok: false, error: text || 'Invalid server response' }
  }

  if (!res.ok || data?.ok === false) {
    const error = new Error(data?.error || `Request failed (${res.status})`)
    error.status = res.status
    throw error
  }
  return data
}

/**
 * Upload with real progress events (fetch cannot report upload progress).
 * @returns {{ promise: Promise<any>, abort: () => void }}
 */
export function uploadWithProgress(path, formData, onProgress) {
  const xhr = new XMLHttpRequest()
  const promise = new Promise((resolve, reject) => {
    xhr.open('POST', `${base}/api${path}`)
    const token = getToken()
    if (token) xhr.setRequestHeader('x-access-token', token)

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100))
    }
    xhr.onload = () => {
      let data = null
      try {
        data = JSON.parse(xhr.responseText)
      } catch {
        data = null
      }
      if (xhr.status >= 200 && xhr.status < 300 && data?.ok !== false) {
        onProgress?.(100)
        resolve(data)
      } else {
        reject(new Error(data?.error || `Upload failed (${xhr.status})`))
      }
    }
    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.onabort = () => reject(Object.assign(new Error('Upload cancelled'), { aborted: true }))
    xhr.send(formData)
  })
  return { promise, abort: () => xhr.abort() }
}

export const api = {
  health: () => request('/health'),
  session: () => request('/session'),
  connect: (payload) => request('/session/connect', { method: 'POST', body: payload }),
  disconnect: () => request('/session/disconnect', { method: 'POST' }),
  logout: () => request('/session/logout', { method: 'POST' }),
  restart: () => request('/session/restart', { method: 'POST' }),

  chats: (search = '') => request(`/chats?search=${encodeURIComponent(search)}`),
  messages: (jid, limit = 80) =>
    request(`/chats/${encodeURIComponent(jid)}/messages?limit=${limit}`),
  markRead: (jid) => request(`/chats/${encodeURIComponent(jid)}/read`, { method: 'POST' }),
  avatar: (jid) => request(`/chats/${encodeURIComponent(jid)}/avatar`),
  typing: (jid, typing) =>
    request(`/chats/${encodeURIComponent(jid)}/typing`, { method: 'POST', body: { typing } }),

  sendText: (jid, text, quotedId) =>
    request('/messages/text', { method: 'POST', body: { jid, text, quotedId } }),
  react: (jid, messageId, emoji) =>
    request('/messages/react', { method: 'POST', body: { jid, messageId, emoji } }),
  deleteMessage: (jid, id) =>
    request(`/messages/${encodeURIComponent(jid)}/${id}`, { method: 'DELETE' }),

  statuses: () => request('/status'),
  /** Text-only status. Media statuses go through uploadWithProgress('/status', form). */
  sendStatus: (payload) => request('/status', { method: 'POST', body: payload }),
  contacts: () => request('/contacts'),
  checkNumber: (number) => request('/contacts/check', { method: 'POST', body: { number } }),
}

export const mediaUrl = (jid, id, download = false) => {
  const token = getToken()
  const query = [download ? 'download=1' : '', token ? `token=${encodeURIComponent(token)}` : '']
    .filter(Boolean)
    .join('&')
  return `${base}/api/media/${encodeURIComponent(jid)}/${id}${query ? `?${query}` : ''}`
}

export default api
