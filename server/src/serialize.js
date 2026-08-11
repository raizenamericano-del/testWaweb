import * as baileys from '@whiskeysockets/baileys'
import { store } from './store.js'

const { getContentType, jidNormalizedUser, isJidGroup, isJidBroadcast } = baileys

const MEDIA_TYPES = {
  imageMessage: 'image',
  videoMessage: 'video',
  audioMessage: 'audio',
  documentMessage: 'document',
  stickerMessage: 'sticker',
  documentWithCaptionMessage: 'document',
}

export const STATUS_JID = 'status@broadcast'

/** Peel ephemeral / viewOnce / edit wrappers until we hit the real content. */
export function unwrap(message) {
  let content = message
  let guard = 0
  while (content && guard++ < 6) {
    const type = getContentType(content)
    if (type === 'ephemeralMessage') content = content.ephemeralMessage?.message
    else if (type === 'viewOnceMessage') content = content.viewOnceMessage?.message
    else if (type === 'viewOnceMessageV2') content = content.viewOnceMessageV2?.message
    else if (type === 'viewOnceMessageV2Extension')
      content = content.viewOnceMessageV2Extension?.message
    else if (type === 'documentWithCaptionMessage')
      content = content.documentWithCaptionMessage?.message
    else if (type === 'editedMessage') content = content.editedMessage?.message
    else if (type === 'protocolMessage' && content.protocolMessage?.editedMessage)
      content = content.protocolMessage.editedMessage
    else break
  }
  return content || message
}

export function extractText(content) {
  if (!content) return ''
  const type = getContentType(content)
  switch (type) {
    case 'conversation':
      return content.conversation || ''
    case 'extendedTextMessage':
      return content.extendedTextMessage?.text || ''
    case 'imageMessage':
      return content.imageMessage?.caption || ''
    case 'videoMessage':
      return content.videoMessage?.caption || ''
    case 'documentMessage':
      return content.documentMessage?.caption || ''
    case 'buttonsResponseMessage':
      return content.buttonsResponseMessage?.selectedDisplayText || ''
    case 'listResponseMessage':
      return content.listResponseMessage?.title || ''
    case 'templateButtonReplyMessage':
      return content.templateButtonReplyMessage?.selectedDisplayText || ''
    case 'reactionMessage':
      return content.reactionMessage?.text || ''
    case 'pollCreationMessage':
    case 'pollCreationMessageV2':
    case 'pollCreationMessageV3':
      return content[type]?.name || 'Poll'
    default:
      return ''
  }
}

function mediaMeta(content, kind) {
  const node =
    content?.imageMessage ||
    content?.videoMessage ||
    content?.audioMessage ||
    content?.documentMessage ||
    content?.stickerMessage
  if (!node) return null
  return {
    kind,
    mimetype: node.mimetype || null,
    fileLength: Number(node.fileLength || 0) || null,
    fileName: node.fileName || node.title || null,
    seconds: node.seconds ? Number(node.seconds) : null,
    ptt: Boolean(node.ptt),
    width: node.width || null,
    height: node.height || null,
    pages: node.pageCount || null,
    animated: Boolean(node.isAnimated),
    gif: Boolean(node.gifPlayback),
    viewOnce: Boolean(node.viewOnce),
    thumbnail: node.jpegThumbnail
      ? `data:image/jpeg;base64,${Buffer.from(node.jpegThumbnail).toString('base64')}`
      : null,
  }
}

function quotedInfo(content) {
  const ctx =
    content?.extendedTextMessage?.contextInfo ||
    content?.imageMessage?.contextInfo ||
    content?.videoMessage?.contextInfo ||
    content?.documentMessage?.contextInfo ||
    content?.audioMessage?.contextInfo ||
    content?.stickerMessage?.contextInfo
  if (!ctx?.quotedMessage) return null
  const inner = unwrap(ctx.quotedMessage)
  const innerType = getContentType(inner)
  return {
    id: ctx.stanzaId || null,
    participant: ctx.participant ? jidNormalizedUser(ctx.participant) : null,
    text: extractText(inner),
    kind: MEDIA_TYPES[innerType] || 'text',
  }
}

function mentionsOf(content) {
  const ctx =
    content?.extendedTextMessage?.contextInfo ||
    content?.imageMessage?.contextInfo ||
    content?.videoMessage?.contextInfo
  return ctx?.mentionedJid || []
}

/**
 * Normalise a raw Baileys message into the compact shape the UI consumes.
 */
export function serializeMessage(raw, { selfJid } = {}) {
  if (!raw?.key) return null
  const remoteJid = raw.key.remoteJid
  if (!remoteJid) return null

  const content = unwrap(raw.message)
  const type = getContentType(content) || 'unknown'
  const kind = MEDIA_TYPES[type] || (type === 'reactionMessage' ? 'reaction' : 'text')
  const fromMe = Boolean(raw.key.fromMe)
  const participant = raw.key.participant || raw.participant || null

  const senderJid = fromMe
    ? selfJid || null
    : participant
      ? jidNormalizedUser(participant)
      : jidNormalizedUser(remoteJid)

  return {
    id: raw.key.id,
    chatId: remoteJid,
    fromMe,
    sender: senderJid,
    senderName: raw.pushName || null,
    isGroup: isJidGroup(remoteJid) || false,
    isStatus: isJidBroadcast(remoteJid) && remoteJid === STATUS_JID,
    timestamp: Number(raw.messageTimestamp?.low ?? raw.messageTimestamp ?? 0) || Math.floor(Date.now() / 1000),
    type,
    kind,
    text: extractText(content),
    media: kind !== 'text' && kind !== 'reaction' ? mediaMeta(content, kind) : null,
    quoted: quotedInfo(content),
    mentions: mentionsOf(content),
    reaction:
      type === 'reactionMessage'
        ? {
            emoji: content.reactionMessage?.text || '',
            targetId: content.reactionMessage?.key?.id || null,
          }
        : null,
    status: typeof raw.status === 'number' ? raw.status : null,
    starred: Boolean(raw.starred),
    edited: Boolean(raw.message?.editedMessage),
    deleted: type === 'protocolMessage' && content?.protocolMessage?.type === 0,
    ack: raw.status ?? 0,
  }
}

export function chatPreview(message) {
  if (!message) return ''
  if (message.kind === 'image') return message.text || '📷 Photo'
  if (message.kind === 'video') return message.text || '🎥 Video'
  if (message.kind === 'audio') return message.media?.ptt ? '🎤 Voice message' : '🎵 Audio'
  if (message.kind === 'document') return `📄 ${message.media?.fileName || 'Document'}`
  if (message.kind === 'sticker') return '🪄 Sticker'
  if (message.kind === 'reaction') return `${message.reaction?.emoji || ''} Reaction`
  return message.text || ''
}

export function displayName(jid, fallback) {
  if (!jid) return fallback || 'Unknown'
  const contact = store.getContact(jid)
  const chat = store.chats.get(jid)
  return (
    contact?.name ||
    contact?.notify ||
    contact?.verifiedName ||
    chat?.name ||
    fallback ||
    jid.split('@')[0]
  )
}
