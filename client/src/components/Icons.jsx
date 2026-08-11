/** Minimal stroke icon set — inline SVG, no icon-font dependency. */

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  viewBox: '0 0 24 24',
}

const make = (children) =>
  function Icon({ className = 'h-5 w-5', ...rest }) {
    return (
      <svg {...base} className={className} {...rest}>
        {children}
      </svg>
    )
  }

export const IconSearch = make(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" />
  </>,
)

export const IconSend = make(<path d="M4.5 12 20 4.6l-4 15.8-4.4-6.1z M11.6 14.3 20 4.6" />)

export const IconPaperclip = make(
  <path d="M20 11.5 12.4 19a4.6 4.6 0 0 1-6.5-6.5l8-8a3.1 3.1 0 0 1 4.4 4.4l-8 8a1.6 1.6 0 1 1-2.2-2.2l7-7" />,
)

export const IconSmile = make(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 14.2a4.4 4.4 0 0 0 7 0" />
    <path d="M9 9.5v.6M15 9.5v.6" strokeWidth="2.4" />
  </>,
)

export const IconImage = make(
  <>
    <rect x="3" y="4.5" width="18" height="15" rx="2.6" />
    <circle cx="8.6" cy="9.8" r="1.6" />
    <path d="m4 17 4.6-4.6a2 2 0 0 1 2.8 0L16 17m-1.4-1.4 1.6-1.6a2 2 0 0 1 2.8 0L21 15.6" />
  </>,
)

export const IconVideo = make(
  <>
    <rect x="2.5" y="6" width="13" height="12" rx="2.4" />
    <path d="m15.5 10.6 6-3.1v9l-6-3.1z" />
  </>,
)

export const IconDoc = make(
  <>
    <path d="M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z" />
    <path d="M13.5 3v5.5H19M8.8 13h6.4M8.8 16.6h4.4" />
  </>,
)

export const IconSticker = make(
  <>
    <path d="M4 12a8 8 0 1 1 10.6 7.6L20 14a8 8 0 0 0-8-10 8 8 0 0 0-8 8Z" />
    <path d="M13.6 20A8 8 0 0 0 20 13.6c-4.2-.4-6.8 2-6.4 6.4Z" />
    <path d="M9 10.4v.4M14.4 10v.4M9.4 14.4a3.4 3.4 0 0 0 3.6 1.4" />
  </>,
)

export const IconMic = make(
  <>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
  </>,
)

export const IconMoon = make(<path d="M20.5 14.3A8.6 8.6 0 0 1 9.7 3.5a8.6 8.6 0 1 0 10.8 10.8Z" />)

export const IconSun = make(
  <>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.6v2.2M12 19.2v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.6 12h2.2M19.2 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" />
  </>,
)

export const IconLogout = make(
  <>
    <path d="M15 4.6h3A2.4 2.4 0 0 1 20.4 7v10a2.4 2.4 0 0 1-2.4 2.4h-3" />
    <path d="M10.5 8 6.6 12l3.9 4M6.6 12H15" />
  </>,
)

export const IconQr = make(
  <>
    <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.4" />
    <rect x="14" y="3.5" width="6.5" height="6.5" rx="1.4" />
    <rect x="3.5" y="14" width="6.5" height="6.5" rx="1.4" />
    <path d="M14 14h2.6v2.6H14zM17.9 17.9h2.6v2.6h-2.6zM14 20.5h1.2M20.5 14v1.2" />
  </>,
)

export const IconKeypad = make(
  <>
    <rect x="4" y="2.6" width="16" height="18.8" rx="3" />
    <path d="M8.4 7.4h.01M12 7.4h.01M15.6 7.4h.01M8.4 11.2h.01M12 11.2h.01M15.6 11.2h.01M8.4 15h.01M12 15h.01M15.6 15h.01M10.4 18.6h3.2" strokeWidth="2.5" />
  </>,
)

export const IconReply = make(<path d="M9.4 7.6 4.6 12l4.8 4.4v-2.7h3.4c3 0 5.2 1.4 6.6 4.1-.3-5.6-3.3-8.4-10-8.4V7.6Z" />)

export const IconClose = make(<path d="M18 6 6 18M6 6l12 12" />)

export const IconChevronLeft = make(<path d="M14.5 6 8.5 12l6 6" />)

export const IconCheck = make(<path d="M20 6 9 17l-5-5" />)

export const IconCheckDouble = make(
  <>
    <path d="M2.5 12.6 6 16l8.4-9" />
    <path d="M9.6 15.2 11.6 17 20 8" />
  </>,
)

export const IconClock = make(
  <>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M12 7.4V12l3 1.8" />
  </>,
)

export const IconPlus = make(<path d="M12 5v14M5 12h14" />)

export const IconTrash = make(
  <>
    <path d="M4.6 6.5h14.8M9.4 6.5V4.8a1.2 1.2 0 0 1 1.2-1.2h2.8a1.2 1.2 0 0 1 1.2 1.2v1.7" />
    <path d="M6.4 6.5 7.3 19a1.6 1.6 0 0 0 1.6 1.5h6.2a1.6 1.6 0 0 0 1.6-1.5l.9-12.5" />
  </>,
)

export const IconDownload = make(<path d="M12 3.5v11m0 0 4-4m-4 4-4-4M4.5 17v1.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V17" />)

export const IconStatus = make(
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3.2v1.4M12 19.4v1.4M3.2 12h1.4M19.4 12h1.4M5.8 5.8l1 1M17.2 17.2l1 1M5.8 18.2l1-1M17.2 6.8l1-1" />
  </>,
)

export const IconChats = make(
  <path d="M4 5.6A2.1 2.1 0 0 1 6.1 3.5h11.8A2.1 2.1 0 0 1 20 5.6v8.2a2.1 2.1 0 0 1-2.1 2.1H9.4L4.8 19.6a.5.5 0 0 1-.8-.4Z" />,
)

export const IconSettings = make(
  <>
    <circle cx="12" cy="12" r="3.1" />
    <path d="M19.2 14.4a1.5 1.5 0 0 0 .3 1.7l.1.1a1.8 1.8 0 1 1-2.6 2.6l-.1-.1a1.5 1.5 0 0 0-1.7-.3 1.5 1.5 0 0 0-.9 1.4v.3a1.8 1.8 0 1 1-3.6 0v-.2a1.5 1.5 0 0 0-1-1.4 1.5 1.5 0 0 0-1.7.3l-.1.1a1.8 1.8 0 1 1-2.6-2.6l.1-.1a1.5 1.5 0 0 0 .3-1.7 1.5 1.5 0 0 0-1.4-.9h-.3a1.8 1.8 0 1 1 0-3.6h.2a1.5 1.5 0 0 0 1.4-1 1.5 1.5 0 0 0-.3-1.7l-.1-.1A1.8 1.8 0 1 1 7.5 4.6l.1.1a1.5 1.5 0 0 0 1.7.3H9.4a1.5 1.5 0 0 0 .9-1.4v-.3a1.8 1.8 0 1 1 3.6 0v.2a1.5 1.5 0 0 0 .9 1.4 1.5 1.5 0 0 0 1.7-.3l.1-.1a1.8 1.8 0 1 1 2.6 2.6l-.1.1a1.5 1.5 0 0 0-.3 1.7v.1a1.5 1.5 0 0 0 1.4.9h.3a1.8 1.8 0 1 1 0 3.6h-.2a1.5 1.5 0 0 0-1.4.9Z" />
  </>,
)

export const IconWarning = make(
  <>
    <path d="M12 3.6 2.8 19.6h18.4z" />
    <path d="M12 9.6v4.2M12 16.8v.4" strokeWidth="2.3" />
  </>,
)

export const IconRefresh = make(
  <>
    <path d="M20.4 11.2a8.4 8.4 0 1 0-.6 4.6" />
    <path d="M20.4 5.6v5.6h-5.6" />
  </>,
)

export const IconPhone = make(
  <path d="M6.6 3.6h3l1.5 3.8-2 1.4a11.4 11.4 0 0 0 5.1 5.1l1.4-2 3.8 1.5v3a1.8 1.8 0 0 1-2 1.8A15.6 15.6 0 0 1 4.8 5.6a1.8 1.8 0 0 1 1.8-2Z" />,
)

export const IconLink = make(
  <>
    <path d="M10 13.4a3.6 3.6 0 0 0 5.4.4l2.6-2.6a3.6 3.6 0 0 0-5.1-5.1L11.4 7.6" />
    <path d="M14 10.6a3.6 3.6 0 0 0-5.4-.4L6 12.8a3.6 3.6 0 0 0 5.1 5.1l1.4-1.4" />
  </>,
)

export const IconEye = make(
  <>
    <path d="M2.6 12S6 5.8 12 5.8 21.4 12 21.4 12 18 18.2 12 18.2 2.6 12 2.6 12Z" />
    <circle cx="12" cy="12" r="3" />
  </>,
)

export const IconMore = make(
  <>
    <circle cx="12" cy="5.4" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="18.6" r="1.4" fill="currentColor" stroke="none" />
  </>,
)

export const IconPlay = make(<path d="M7.5 5.2 18 12 7.5 18.8z" />)
