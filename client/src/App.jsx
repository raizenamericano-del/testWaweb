import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import ChatWindow from './components/ChatWindow.jsx'
import ConnectScreen from './components/ConnectScreen.jsx'
import Sidebar from './components/Sidebar.jsx'
import Splash from './components/Splash.jsx'
import StatusView from './components/StatusView.jsx'
import { useToast } from './components/Toast.jsx'
import useTheme from './hooks/useTheme.js'
import useWhatsApp from './hooks/useWhatsApp.js'
import { api, getToken, setToken } from './lib/api.js'
import { LogoWordmark } from './components/Logo.jsx'
import { IconRefresh } from './components/Icons.jsx'
import { cx, jidToNumber } from './lib/utils.js'

/* ---------------------------- access token gate --------------------------- */

function TokenGate({ onSubmit }) {
  const [value, setValue] = useState('')
  return (
    <div className="grid min-h-dvh place-items-center bg-mesh px-4">
      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit(value.trim())
        }}
        className="glass-strong w-full max-w-sm rounded-3xl p-7 text-center"
      >
        <div className="mb-5 flex justify-center">
          <LogoWordmark size={46} />
        </div>
        <h1 className="text-[17px] font-bold text-slate-100">Access token required</h1>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-500">
          This KyyWA instance is protected. Enter the token configured in{' '}
          <code className="rounded bg-white/[0.07] px-1 py-0.5 text-[11px]">ACCESS_TOKEN</code>.
        </p>
        <input
          autoFocus
          type="password"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Access token"
          className="input mt-5 text-center"
        />
        <button type="submit" disabled={!value.trim()} className="btn btn-primary mt-3 w-full">
          Unlock
        </button>
      </motion.form>
    </div>
  )
}

/* --------------------------------- shell --------------------------------- */

export default function App() {
  const toast = useToast()
  const { theme, toggle } = useTheme()
  const [booted, setBooted] = useState(false)
  const [needsToken, setNeedsToken] = useState(false)
  const [tab, setTab] = useState('chats')
  const [mobilePane, setMobilePane] = useState('list') // list | chat
  const [busy, setBusy] = useState(false)
  const audioRef = useRef(null)

  /* notification sound + browser notification */
  const notify = useCallback(
    (message, chat) => {
      const who = chat?.name || message.senderName || jidToNumber(message.chatId)
      const body = message.text || `[${message.kind}]`
      toast.info(body.slice(0, 90), { title: who })
      try {
        audioRef.current?.play?.().catch(() => {})
      } catch {
        /* noop */
      }
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(`KyyWA · ${who}`, { body: body.slice(0, 120), silent: true })
      }
    },
    [toast],
  )

  const wa = useWhatsApp({ onNotify: notify })
  const { session } = wa
  const connected = session.state === 'connected'

  /* boot: health check + token detection */
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await api.session()
      } catch (err) {
        if (err.status === 401) {
          if (!cancelled) setNeedsToken(true)
        }
      }
      const timer = setTimeout(() => !cancelled && setBooted(true), 2100)
      return () => clearTimeout(timer)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      const timer = setTimeout(() => Notification.requestPermission().catch(() => {}), 6000)
      return () => clearTimeout(timer)
    }
  }, [])

  /* keep the tab title in sync with the unread count */
  useEffect(() => {
    const unread = wa.chats.reduce((total, chat) => total + (chat.unreadCount || 0), 0)
    document.title = unread > 0 ? `(${unread}) KyyWA · by KyyDevv` : 'KyyWA · by KyyDevv'
  }, [wa.chats])

  const handleSelect = (jid) => {
    wa.openChat(jid)
    setMobilePane('chat')
  }

  const handleLogout = async () => {
    if (!window.confirm('Log out this device? You will need to scan the QR code again.')) return
    setBusy(true)
    try {
      await api.logout()
      toast.success('Device unlinked from WhatsApp', { title: 'Logged out' })
    } catch (err) {
      toast.error(err.message, { title: 'Logout failed' })
    } finally {
      setBusy(false)
    }
  }

  if (needsToken) {
    return (
      <TokenGate
        onSubmit={(value) => {
          setToken(value)
          window.location.reload()
        }}
      />
    )
  }

  return (
    <>
      <AnimatePresence>{!booted && <Splash key="splash" />}</AnimatePresence>

      {/* soft notification blip, generated inline so there is no asset to ship */}
      <audio
        ref={audioRef}
        preload="auto"
        src="data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="
      />

      <AnimatePresence mode="wait">
        {!connected ? (
          <motion.div
            key="connect"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            transition={{ duration: 0.35 }}
          >
            <ConnectScreen session={session} theme={theme} onToggleTheme={toggle} />
          </motion.div>
        ) : (
          <motion.div
            key="main"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="flex h-dvh w-full overflow-hidden bg-ink-950"
          >
            {/* sidebar */}
            <aside
              className={cx(
                'h-full w-full shrink-0 border-r border-white/[0.06] bg-ink-900/60 backdrop-blur-2xl lg:flex lg:w-[340px] xl:w-[380px]',
                mobilePane === 'chat' ? 'hidden lg:block' : 'block',
              )}
            >
              <Sidebar
                chats={wa.chats}
                activeJid={wa.activeJid}
                onSelect={handleSelect}
                session={session}
                theme={theme}
                onToggleTheme={toggle}
                onLogout={handleLogout}
                tab={tab}
                onTabChange={setTab}
                statusCount={wa.statuses.length}
                presences={wa.presences}
                connectionLost={!wa.socketReady}
              />
            </aside>

            {/* main pane */}
            <main
              className={cx(
                'relative h-full min-w-0 flex-1',
                mobilePane === 'chat' ? 'block' : 'hidden lg:block',
              )}
            >
              <AnimatePresence mode="wait">
                {tab === 'status' ? (
                  <motion.div
                    key="status"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.25 }}
                    className="h-full"
                  >
                    <StatusView
                      statuses={wa.statuses}
                      connected={connected}
                      onRefresh={wa.refreshStatuses}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key={wa.activeJid || 'empty'}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="h-full"
                  >
                    <ChatWindow
                      chat={wa.activeChat}
                      messages={wa.messages}
                      presence={wa.presence}
                      connected={connected}
                      onBack={() => setMobilePane('list')}
                      onTyping={wa.sendTyping}
                      onReact={wa.react}
                      onDelete={wa.remove}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </main>

            {/* socket lost banner */}
            <AnimatePresence>
              {!wa.socketReady && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="fixed left-1/2 top-3 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-amber-400/25 bg-amber-500/10 px-4 py-2 text-[12px] font-medium text-amber-200 backdrop-blur-xl"
                >
                  <IconRefresh className="h-3.5 w-3.5 animate-spin-slow" />
                  Reconnecting to the KyyWA server…
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
