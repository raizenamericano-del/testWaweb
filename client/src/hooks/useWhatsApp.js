import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { api } from '../lib/api.js'
import { getSocket } from '../lib/socket.js'

const MAX_MESSAGES = 400

const sortChats = (list) =>
  [...list].sort((a, b) => (b.conversationTimestamp || 0) - (a.conversationTimestamp || 0))

/**
 * Single source of truth for session state, chats, messages, presences and
 * statuses. Everything is kept in sync through the socket.io bridge.
 */
export function useWhatsApp({ onNotify } = {}) {
  const [session, setSession] = useState({ state: 'idle', connected: false })
  const [chats, setChats] = useState([])
  const [statuses, setStatuses] = useState([])
  const [messages, setMessages] = useState({}) // jid -> message[]
  const [presences, setPresences] = useState({})
  const [socketReady, setSocketReady] = useState(false)
  const [activeJid, setActiveJid] = useState(null)

  const activeRef = useRef(null)
  const notifyRef = useRef(onNotify)
  notifyRef.current = onNotify
  activeRef.current = activeJid

  const socket = useMemo(() => getSocket(), [])

  const mergeMessage = useCallback((chatId, message) => {
    setMessages((prev) => {
      const list = prev[chatId]
      if (!list) return prev // chat not opened yet; loaded on demand
      const index = list.findIndex((item) => item.id === message.id)
      const next = index >= 0 ? list.map((m, i) => (i === index ? { ...m, ...message } : m)) : [...list, message]
      next.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
      return { ...prev, [chatId]: next.slice(-MAX_MESSAGES) }
    })
  }, [])

  const patchMessage = useCallback((chatId, id, patch) => {
    setMessages((prev) => {
      const list = prev[chatId]
      if (!list) return prev
      return {
        ...prev,
        [chatId]: list.map((message) => (message.id === id ? { ...message, ...patch } : message)),
      }
    })
  }, [])

  const upsertChats = useCallback((incoming) => {
    const arr = Array.isArray(incoming) ? incoming : [incoming]
    setChats((prev) => {
      const map = new Map(prev.map((chat) => [chat.id, chat]))
      for (const chat of arr) {
        if (!chat?.id) continue
        map.set(chat.id, { ...map.get(chat.id), ...chat })
      }
      return sortChats([...map.values()])
    })
  }, [])

  /* ------------------------------ socket wiring ----------------------------- */
  useEffect(() => {
    const onConnect = () => setSocketReady(true)
    const onDisconnect = () => setSocketReady(false)

    const onBootstrap = (payload) => {
      setSession(payload.session || { state: 'idle' })
      setChats(sortChats(payload.chats || []))
      setStatuses(payload.statuses || [])
    }

    const onSession = (snapshot) => setSession(snapshot || { state: 'idle' })

    const onMessage = ({ message, chat, notify }) => {
      if (!message) return
      mergeMessage(message.chatId, message)
      if (chat) upsertChats(chat)
      if (notify && message.chatId !== activeRef.current) {
        notifyRef.current?.(message, chat)
      }
      if (message.chatId === activeRef.current && !message.fromMe) {
        api.markRead(message.chatId).catch(() => {})
      }
    }

    const onMessageUpdate = ({ chatId, id, patch }) => patchMessage(chatId, id, patch)
    const onReaction = ({ chatId, id, reactions }) => patchMessage(chatId, id, { reactions })
    const onRevoke = ({ chatId, id }) =>
      patchMessage(chatId, id, { deleted: true, text: '', media: null })
    const onClear = ({ chatId }) => setMessages((prev) => ({ ...prev, [chatId]: [] }))

    const onChatsDelete = (ids) => {
      const list = Array.isArray(ids) ? ids : [ids]
      setChats((prev) => prev.filter((chat) => !list.includes(chat.id)))
    }

    const onPresence = (presence) => {
      if (!presence?.chatId) return
      setPresences((prev) => ({ ...prev, [presence.chatId]: presence }))
    }

    const onStatus = (status) => {
      if (!status?.id) return
      setStatuses((prev) => {
        const index = prev.findIndex((item) => item.id === status.id)
        if (index >= 0) return prev.map((item, i) => (i === index ? { ...item, ...status } : item))
        return [status, ...prev]
      })
    }

    const onCleared = () => {
      setChats([])
      setMessages({})
      setStatuses([])
      setActiveJid(null)
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('bootstrap', onBootstrap)
    socket.on('session', onSession)
    socket.on('chats.upsert', upsertChats)
    socket.on('chats.update', upsertChats)
    socket.on('chats.delete', onChatsDelete)
    socket.on('message', onMessage)
    socket.on('message.update', onMessageUpdate)
    socket.on('message.reaction', onReaction)
    socket.on('message.revoke', onRevoke)
    socket.on('messages.clear', onClear)
    socket.on('presence', onPresence)
    socket.on('status.upsert', onStatus)
    socket.on('cleared', onCleared)

    if (socket.connected) setSocketReady(true)

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('bootstrap', onBootstrap)
      socket.off('session', onSession)
      socket.off('chats.upsert', upsertChats)
      socket.off('chats.update', upsertChats)
      socket.off('chats.delete', onChatsDelete)
      socket.off('message', onMessage)
      socket.off('message.update', onMessageUpdate)
      socket.off('message.reaction', onReaction)
      socket.off('message.revoke', onRevoke)
      socket.off('messages.clear', onClear)
      socket.off('presence', onPresence)
      socket.off('status.upsert', onStatus)
      socket.off('cleared', onCleared)
    }
  }, [socket, mergeMessage, patchMessage, upsertChats])

  /* ------------------------------- actions -------------------------------- */
  const openChat = useCallback(
    (jid) => {
      setActiveJid(jid)
      if (!jid) return
      socket.emit('chat:open', jid, (response) => {
        if (response?.ok) {
          setMessages((prev) => ({ ...prev, [jid]: response.messages || [] }))
        }
      })
      setChats((prev) => prev.map((chat) => (chat.id === jid ? { ...chat, unreadCount: 0 } : chat)))
      api.markRead(jid).catch(() => {})
    },
    [socket],
  )

  const sendTyping = useCallback(
    (jid, typing) => socket.emit('chat:typing', { jid, typing }),
    [socket],
  )

  const react = useCallback(
    async (message, emoji) => {
      await api.react(message.chatId, message.id, emoji)
    },
    [],
  )

  const remove = useCallback(async (message) => {
    await api.deleteMessage(message.chatId, message.id)
    patchMessage(message.chatId, message.id, { deleted: true, text: '', media: null })
  }, [patchMessage])

  const refreshStatuses = useCallback(async () => {
    try {
      const data = await api.statuses()
      setStatuses(data.statuses || [])
    } catch {
      /* silent */
    }
  }, [])

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeJid) || null,
    [chats, activeJid],
  )

  return {
    session,
    setSession,
    chats,
    statuses,
    messages: messages[activeJid] || [],
    allMessages: messages,
    presences,
    presence: presences[activeJid],
    activeJid,
    activeChat,
    socketReady,
    openChat,
    sendTyping,
    react,
    remove,
    refreshStatuses,
  }
}

export default useWhatsApp
