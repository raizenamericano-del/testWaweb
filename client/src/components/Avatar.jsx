import { memo } from 'react'
import { avatarGradient, initials, cx, isGroupJid } from '../lib/utils.js'

export const Avatar = memo(function Avatar({
  jid = '',
  name = '',
  src = null,
  size = 46,
  online = false,
  className = '',
  ring = true,
}) {
  const group = isGroupJid(jid)
  return (
    <div className={cx('relative shrink-0', className)} style={{ width: size, height: size }}>
      <div
        className={cx(
          'grid h-full w-full place-items-center overflow-hidden rounded-2xl font-bold text-pure/95',
          ring && 'ring-1 ring-white/10',
        )}
        style={{
          background: avatarGradient(jid || name),
          fontSize: Math.max(11, size * 0.36),
        }}
      >
        {src ? (
          <img src={src} alt={name} className="h-full w-full object-cover" loading="lazy" />
        ) : group ? (
          <svg viewBox="0 0 24 24" className="h-1/2 w-1/2" fill="currentColor">
            <path d="M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2ZM8.5 12.8c-2.6 0-6 1.3-6 3.9V19h9.3v-2.3c0-1 .4-2 1.1-2.8-1.3-.7-3-1.1-4.4-1.1Zm7.4.4c-1 0-2 .2-2.9.6 1 .8 1.6 1.8 1.6 3v2.2h6.9v-2c0-2.3-3-3.8-5.6-3.8Z" />
          </svg>
        ) : (
          initials(name || jid)
        )}
      </div>
      {online && (
        <span className="absolute -bottom-0.5 -right-0.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-ink-900">
          <span className="h-2.5 w-2.5 rounded-full bg-kyy-400 shadow-[0_0_10px_rgba(31,233,200,.9)]" />
        </span>
      )}
    </div>
  )
})

export default Avatar
