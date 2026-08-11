<div align="center">

# KyyWA

**A modern WhatsApp Web alternative for controlling your own account.**

Crafted by **KyyDevv** · React + Vite + Tailwind + Framer Motion · Node.js + Express + Socket.io · [Baileys](https://github.com/WhiskeySockets/Baileys)

</div>

---

> [!WARNING]
> **Unofficial WhatsApp client. Use at your own risk.**
> KyyWA is not affiliated with, endorsed by, or connected to WhatsApp or Meta. It talks to WhatsApp
> through the unofficial [Baileys](https://github.com/WhiskeySockets/Baileys) library. Automating or
> using a non-official client can get your number **rate-limited or permanently banned**.
> Use it only for your own personal number, and never for bulk or unsolicited messaging.

---

## Features

**Connection**
- Link a device with a **QR code** (auto-refreshing, live over WebSocket) or an **8-digit pairing code**
- Explicit state machine surfaced in the UI: `connecting → waiting for scan → connected` / `disconnected` / `logged out` / `error`
- Once linked: profile name, number and avatar, plus **Disconnect** and **Logout** actions
- **Persistent session** — auth state lives on disk, so a restart or redeploy does not force a re-scan
- Automatic reconnect with exponential backoff (2s → 30s)

**Messaging**
- Chat sidebar with search, unread badges, group support, presence and typing indicators
- Send **text, photos, videos, documents and stickers**, with a live upload progress bar
- **Reply** to a message, react with emoji, delete for everyone, mark as read
- WhatsApp text formatting is rendered: `*bold*`, `_italic_`, `~strike~`, `` `mono` ``, links and mentions
- Real-time inbound messages, receipts and reactions over Socket.io
- **Status**: browse contacts' updates and post your own (text or image)

**Interface**
- Glassmorphism, soft gradients and Framer Motion throughout
- **Dark mode by default**, with a full light theme
- Animated splash screen and an all-code (SVG/CSS) hexagon logo — no image assets
- Responsive down to mobile, with toast notifications

---

## Quick start (local)

Requires **Node.js 20.x** (pinned via `engines` and `.nvmrc`; Baileys' native deps are not yet
reliable on Node 24).

```bash
git clone <your-repo-url> kyywa
cd kyywa
npm install
cp .env.example .env      # optional — sane defaults are built in
```

**Development** (Vite dev server on `5173` proxying the API on `8080`, both with hot reload):

```bash
npm run dev
```

**Production build**, served entirely by the Express server on `http://localhost:8080`:

```bash
npm run build
npm start
```

Open the app, choose **QR code** or **Pairing code**, and link the device from your phone via
*WhatsApp → Settings → Linked devices → Link a device*.

---

## Deploying to Railway

1. **Create the service** — push this repo to GitHub and create a Railway project from it.
   `railway.json` is already committed, so the build (`npm run build`), the start command
   (`npm start`) and the healthcheck (`/api/health`) are configured for you.

   > Nixpacks runs its own `npm ci` install phase before the build command, so `railway.json`
   > deliberately runs **only** `npm run build`. Adding `npm ci &&` back makes the build fail with
   > `EBUSY: resource busy or locked, rmdir '/app/node_modules/.cache'`, because the second install
   > tries to remove a directory Docker has mounted as a cache volume.
   > The committed `.npmrc` (`production=false`) is also required — without it a host that sets
   > `NPM_CONFIG_PRODUCTION` drops the devDependencies and the build dies with `vite: not found`.

2. **Add a Volume** — this is the important step. Without it the WhatsApp session is wiped on every
   deploy and you have to re-scan the QR code.
   *Service → Variables → + Volume*, mount it at **`/data`**.

3. **Set the variables**:

   | Variable | Value | Why |
   | --- | --- | --- |
   | `DATA_DIR` | `/data` | Must match the volume mount path |
   | `ACCESS_TOKEN` | a long random string | **Strongly recommended** — see below |
   | `CORS_ORIGIN` | your Railway URL | Lock the API to your own front end |

   `PORT` is injected by Railway automatically. Everything else has a working default.

4. **Deploy and link** — open the generated URL, enter your access token, then scan the QR code.

> [!IMPORTANT]
> A KyyWA instance is a fully authenticated WhatsApp session. Anyone who can reach the URL can read
> and send your messages. **Always set `ACCESS_TOKEN` on a public deployment.** When set, the UI
> prompts for it, the REST API requires an `x-access-token` header, and Socket.io connections must
> present it in their auth payload.

---

## Configuration

All variables are optional; the defaults below apply when unset. See `.env.example`.

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `8080` | HTTP port |
| `HOST` | `0.0.0.0` | Bind address |
| `DATA_DIR` | `./data` | Auth state, message store, cached media, temp uploads |
| `CORS_ORIGIN` | `*` | Comma-separated allowed origins |
| `ACCESS_TOKEN` | *(empty)* | Gates the API, the UI and Socket.io when set |
| `BROWSER_NAME` | `KyyWA` | Device name under *Linked devices* |
| `MAX_UPLOAD_MB` | `64` | Upload size ceiling |
| `MESSAGE_CACHE_SIZE` | `250` | Messages retained per chat |
| `LOG_LEVEL` | `info` | `fatal` · `error` · `warn` · `info` · `debug` · `trace` |
| `VITE_API_URL` | *(empty)* | Build-time only. Leave empty unless the client is hosted separately |

### What lives in `DATA_DIR`

```
data/
├── auth/          Baileys credentials + signal keys  ← losing this means re-scanning
├── store/         chats, contacts and messages snapshot (store.json)
├── media/         downloaded media cache
└── tmp/           in-flight uploads
```

---

## Project layout

```
kyywa/
├── server/src/
│   ├── index.js        entry: express, static client, auth gate, graceful shutdown
│   ├── whatsapp.js     Baileys socket, state machine, reconnect, send/receive
│   ├── routes.js       REST API
│   ├── realtime.js     Socket.io bridge
│   ├── store.js        in-memory store with debounced disk snapshots
│   ├── serialize.js    Baileys message → client-friendly shape
│   ├── config.js       env loading and path resolution
│   └── logger.js       pino
└── client/src/
    ├── App.jsx         shell, routing between connect and main views
    ├── components/     ConnectScreen, Sidebar, ChatWindow, MessageBubble,
    │                   Composer, StatusView, Splash, Logo, Toast, Icons, Avatar
    ├── hooks/          useWhatsApp (socket state), useTheme
    └── lib/            api.js, socket.js, utils.js
```

### Theming

Both themes are driven by CSS custom properties in `client/src/index.css` rather than per-component
overrides. The Tailwind `ink`, `slate`, `white` and accent tokens all resolve to those variables, and
the `slate` ramp is *inverted* in light mode — so `text-slate-100` means "primary text" and
`bg-white/[0.04]` means "subtle hairline" in **both** themes. To adjust a theme, edit the variable
block, not the components.

---

## API reference

All routes are prefixed with `/api` and require `x-access-token` when `ACCESS_TOKEN` is set.

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/health` | Liveness probe used by Railway |
| `GET` | `/session` | Current connection state, profile, QR / pairing code |
| `POST` | `/session/connect` | Start linking. Body: `{ method: 'qr' \| 'pairing', phoneNumber? }` |
| `POST` | `/session/disconnect` | Close the socket, keep credentials |
| `POST` | `/session/logout` | Unlink the device and wipe credentials |
| `POST` | `/session/restart` | Reconnect using the stored session |
| `GET` | `/chats` | Chat list |
| `GET` | `/chats/:jid/messages` | Message history for a chat |
| `POST` | `/chats/:jid/read` | Mark as read |
| `POST` | `/chats/:jid/typing` | Broadcast typing state |
| `GET` | `/chats/:jid/avatar` | Profile picture URL |
| `POST` | `/messages/text` | Send text, optionally quoting a message |
| `POST` | `/messages/media` | Send image / video / document / sticker (multipart) |
| `POST` | `/messages/react` | React to a message |
| `DELETE` | `/messages/:jid/:id` | Delete for everyone |
| `GET` | `/status` | Status updates from contacts |
| `POST` | `/status` | Post a status |
| `GET` | `/media/:jid/:id` | Download decrypted media |
| `GET` | `/contacts` | Known contacts |
| `POST` | `/contacts/check` | Check whether numbers are on WhatsApp |

**Socket.io** (path `/socket.io`) emits `bootstrap` on connect, then `session`, `chats.upsert`,
`chats.update`, `chats.delete`, `contacts.update`, `message`, `message.update`, `message.reaction`,
`message.revoke`, `messages.clear`, `presence`, `status.upsert` and `history`.
Clients can call `chat:open`, `chat:typing` and `session:state`.

---

## Notes and limitations

- **Pairing codes** need the number in full international format without a leading `0`
  (e.g. `628123456789`, not `08123456789`).
- **Media sent before the current process started** cannot be downloaded. Baileys needs the original
  message keys to decrypt, and those live in an in-memory cache; requests for older media return `410`.
- The message store keeps the most recent `MESSAGE_CACHE_SIZE` messages per chat — it is a cache for
  the UI, not a full archive.
- Only one device session per deployment.

---

<div align="center">

**KyyWA v1.0** · crafted by **KyyDevv**

</div>
