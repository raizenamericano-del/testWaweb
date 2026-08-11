import { useCallback, useEffect, useState } from 'react'

const KEY = 'kyywa:theme'

/** Dark by default; the choice is mirrored into <html class="dark"> and localStorage. */
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'dark'
    return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'
  })

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    root.classList.toggle('light', theme === 'light')
    root.style.colorScheme = theme
    localStorage.setItem(KEY, theme)
  }, [theme])

  const toggle = useCallback(() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark')), [])

  return { theme, setTheme, toggle }
}

export default useTheme
