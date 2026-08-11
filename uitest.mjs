import { chromium } from 'playwright-core'

const now = Math.floor(Date.now() / 1000)
const me = { id: '6281234567890@s.whatsapp.net', name: 'Kyy Devv', phone: '6281234567890' }

const chats = [
  { id: '6281111111111@s.whatsapp.net', name: 'Rani Puspita', isGroup: false, unreadCount: 2, conversationTimestamp: now - 60,
    lastMessage: { id: 'a1', text: 'Oke besok aku kirim filenya ya 🙌', fromMe: false, timestamp: now - 60, ack: 4, kind: 'text' } },
  { id: '628999000111-1600000000@g.us', name: 'KyyDevv · Dev Team', isGroup: true, unreadCount: 0, conversationTimestamp: now - 900,
    lastMessage: { id: 'a2', text: '📷 Photo', fromMe: true, timestamp: now - 900, ack: 3, kind: 'image' } },
  { id: '6285555555555@s.whatsapp.net', name: 'Budi Santoso', isGroup: false, unreadCount: 0, conversationTimestamp: now - 7200,
    lastMessage: { id: 'a3', text: '📄 invoice-agustus.pdf', fromMe: false, timestamp: now - 7200, ack: 4, kind: 'document' } },
  { id: '6287777777777@s.whatsapp.net', name: 'Mama', isGroup: false, unreadCount: 0, conversationTimestamp: now - 90000,
    lastMessage: { id: 'a4', text: 'Sudah makan belum?', fromMe: false, timestamp: now - 90000, ack: 4, kind: 'text' } },
]

const jid = chats[0].id
const messages = [
  { id: 'm1', chatId: jid, fromMe: false, sender: jid, senderName: 'Rani', isGroup: false, timestamp: now - 8000, kind: 'text', type: 'conversation',
    text: 'Halo Kyy! Jadi ya meeting nanti sore jam 4?', ack: 4, reactions: {} },
  { id: 'm2', chatId: jid, fromMe: true, sender: me.id, senderName: 'You', timestamp: now - 7600, kind: 'text',
    text: 'Jadi dong. Aku share deck-nya sekarang, cek ya https://kyydevv.dev/deck', ack: 4, reactions: { [jid]: '👍' } },
  { id: 'm3', chatId: jid, fromMe: false, sender: jid, senderName: 'Rani', timestamp: now - 5400, kind: 'text',
    text: 'Mantap! *Ini bold* dan _ini italic_ ya. Btw ~yang lama~ sudah dihapus.', ack: 4, reactions: {} },
  { id: 'm4', chatId: jid, fromMe: true, sender: me.id, timestamp: now - 3600, kind: 'text',
    text: 'Siap, nanti aku follow up.', ack: 3,
    quoted: { id: 'm3', text: 'Mantap! Ini bold dan ini italic ya.', senderName: 'Rani', fromMe: false }, reactions: {} },
  { id: 'm5', chatId: jid, fromMe: false, sender: jid, senderName: 'Rani', timestamp: now - 600, kind: 'document',
    text: '', media: { fileName: 'brief-kyywa-v2.pdf', fileLength: 284213, mimetype: 'application/pdf' }, ack: 4, reactions: {} },
  { id: 'm6', chatId: jid, fromMe: false, sender: jid, senderName: 'Rani', timestamp: now - 60, kind: 'text',
    text: 'Oke besok aku kirim filenya ya 🙌', ack: 4, reactions: { [me.id]: '❤️' } },
]

const statuses = [
  { id: 's1', sender: me.id, name: 'Kyy Devv', fromMe: true, timestamp: now - 1200, kind: 'text', text: 'Shipping KyyWA v1.0 tonight 🚀', media: null },
  { id: 's2', sender: chats[0].id, name: 'Rani Puspita', fromMe: false, timestamp: now - 5000, kind: 'text', text: 'Coffee first ☕', media: null },
  { id: 's3', sender: chats[2].id, name: 'Budi Santoso', fromMe: false, timestamp: now - 20000, kind: 'text', text: 'On the way to Jakarta', media: null },
]

const session = { state: 'connected', method: 'qr', qr: null, qrExpiresAt: null, pairingCode: null, me, hasSession: true, lastError: null, startedAt: Date.now() - 60000, reconnectAttempts: 0, uptime: 60000 }

const browser = await chromium.launch({ args: ['--no-sandbox'] })
const errors = []

async function shot(name, { width = 1440, height = 900, mobile = false, after } = {}) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile })
  // Opt into the production debug handle (window.__kyywa) before any app code runs.
  await page.addInitScript(() => { try { localStorage.setItem('kyywa:debug', '1') } catch {} })
  page.on('pageerror', (e) => errors.push(`[${name}] pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${name}] console: ${m.text()}`) })
  await page.goto('http://127.0.0.1:8080/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2600)
  await page.evaluate(([session, chats, statuses]) => {
    const s = window.__kyywa
    const fire = (evt, payload) => s.listeners(evt).forEach((fn) => fn(payload))
    fire('bootstrap', { session, chats, statuses, contacts: 12, serverTime: Date.now() })
  }, [session, chats, statuses])
  await page.waitForTimeout(900)
  if (after) await after(page)
  await page.waitForTimeout(700)
  await page.screenshot({ path: `/home/user/shots/${name}.png` })
  const text = (await page.textContent('#root').catch(() => '') || '').replace(/\s+/g, ' ').slice(0, 220)
  console.log(`--- ${name}: ${text}`)
  await page.close()
}

const openChat = async (page) => {
  await page.evaluate(([jid, messages]) => {
    const s = window.__kyywa
    // intercept the chat:open ack so the UI receives history
    const origEmit = s.emit.bind(s)
    s.emit = (evt, ...args) => {
      if (evt === 'chat:open') { const cb = args[1]; cb?.({ ok: true, messages }); return s }
      return origEmit(evt, ...args)
    }
  }, [jid, messages])
  await page.getByText('Rani Puspita').first().click()
  await page.waitForTimeout(1100)
}

await shot('main-empty')
await shot('main-chat', { after: openChat })
await shot('main-status', { after: async (page) => { await page.getByRole('button', { name: /Status/i }).first().click(); await page.waitForTimeout(800) } })
await shot('mobile-list', { width: 414, height: 896, mobile: true })
await shot('mobile-chat', { width: 414, height: 896, mobile: true, after: openChat })
await shot('light-chat', { after: async (page) => { await openChat(page); await page.click('[title*="light mode"]').catch(()=>{}); await page.waitForTimeout(900) } })
await shot('light-empty', { after: async (page) => { await page.click('[title*="light mode"]').catch(()=>{}); await page.waitForTimeout(900) } })

console.log('=== errors:', errors.length)
errors.slice(0, 15).forEach((e) => console.log(' ', e.slice(0, 300)))
await browser.close()
