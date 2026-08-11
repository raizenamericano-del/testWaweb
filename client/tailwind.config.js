/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter var', 'Inter', 'SF Pro Display', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      // Extra alpha stops so the glass/gradient surfaces can be tuned finely.
      opacity: {
        2: '0.02',
        3: '0.03',
        4: '0.04',
        6: '0.06',
        7: '0.07',
        8: '0.08',
        12: '0.12',
        15: '0.15',
        18: '0.18',
        22: '0.22',
        35: '0.35',
        45: '0.45',
        55: '0.55',
        65: '0.65',
        85: '0.85',
        92: '0.92',
        95: '0.95',
      },
      colors: {
        // Theme-aware surfaces. The RGB triplets live in index.css and are
        // swapped wholesale when <html> loses the .dark class, so every
        // component gets light mode for free.
        app: 'rgb(var(--c-app) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        elevated: 'rgb(var(--c-elevated) / <alpha-value>)',
        raised: 'rgb(var(--c-raised) / <alpha-value>)',

        // `white` is theme-aware too: in light mode it flips to a dark ink so
        // that every bg-white/[0.04] hairline keeps the same visual weight.
        white: 'rgb(var(--c-white) / <alpha-value>)',
        // Literal white/black for content painted over media or gradients.
        pure: '#ffffff',
        carbon: '#000000',
        // Foreground for anything sitting on the teal/violet accent gradient.
        // Always dark — the accent has the same luminance in both themes.
        onaccent: '#05070c',

        // Reversed in light mode: slate-100 stays "primary text", slate-500
        // stays "muted", regardless of theme.
        slate: {
          50: 'rgb(var(--s-50) / <alpha-value>)',
          100: 'rgb(var(--s-100) / <alpha-value>)',
          200: 'rgb(var(--s-200) / <alpha-value>)',
          300: 'rgb(var(--s-300) / <alpha-value>)',
          400: 'rgb(var(--s-400) / <alpha-value>)',
          500: 'rgb(var(--s-500) / <alpha-value>)',
          600: 'rgb(var(--s-600) / <alpha-value>)',
          700: 'rgb(var(--s-700) / <alpha-value>)',
          800: 'rgb(var(--s-800) / <alpha-value>)',
          900: 'rgb(var(--s-900) / <alpha-value>)',
          950: 'rgb(var(--s-950) / <alpha-value>)',
        },

        // Accent "text" shades (200/300) are theme-aware: the pale neon that
        // reads well on ink is unreadable on white, so light mode swaps in a
        // saturated dark variant. Fills/borders (400+) are identical in both.
        amber: {
          200: 'rgb(var(--a-200) / <alpha-value>)',
          300: 'rgb(var(--a-300) / <alpha-value>)',
        },
        rose: {
          300: 'rgb(var(--r-300) / <alpha-value>)',
        },
        kyy: {
          50: '#ecfffb',
          100: '#c9fff3',
          200: 'rgb(var(--t-200) / <alpha-value>)',
          300: 'rgb(var(--t-300) / <alpha-value>)',
          400: '#1fe9c8',
          500: '#06cfb0',
          600: '#00a68f',
          700: '#058473',
          800: '#0a685d',
          900: '#0d564d',
          950: '#00332f',
        },
        violetx: {
          400: '#a98bff',
          500: '#8b5cf6',
          600: '#7c3aed',
        },
        // Surface ramp. Dark: near-black → slate. Light: white → grey.
        // 950 is always the deepest "page" tone, 500 the lightest chrome.
        ink: {
          950: 'rgb(var(--k-950) / <alpha-value>)',
          900: 'rgb(var(--k-900) / <alpha-value>)',
          850: 'rgb(var(--k-850) / <alpha-value>)',
          800: 'rgb(var(--k-800) / <alpha-value>)',
          750: 'rgb(var(--k-750) / <alpha-value>)',
          700: 'rgb(var(--k-700) / <alpha-value>)',
          600: 'rgb(var(--k-600) / <alpha-value>)',
          500: 'rgb(var(--k-500) / <alpha-value>)',
        },
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(31,233,200,.18), 0 8px 40px -8px rgba(31,233,200,.35)',
        'glow-violet': '0 0 0 1px rgba(169,139,255,.18), 0 8px 40px -8px rgba(139,92,246,.4)',
        glass: 'var(--glass-shadow)',
        soft: '0 2px 14px rgba(0,0,0,.16)',
      },
      backgroundImage: {
        'kyy-gradient': 'linear-gradient(120deg,#1fe9c8 0%,#22d3ee 45%,#a98bff 100%)',
        'kyy-gradient-soft': 'linear-gradient(120deg,rgba(31,233,200,.16),rgba(139,92,246,.16))',
        mesh: 'radial-gradient(at 12% 8%, rgba(31,233,200,.18) 0px, transparent 55%), radial-gradient(at 88% 12%, rgba(139,92,246,.20) 0px, transparent 50%), radial-gradient(at 60% 92%, rgba(34,211,238,.14) 0px, transparent 55%)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: 0, transform: 'translateY(8px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'spin-slow': {
          to: { transform: 'rotate(360deg)' },
        },
        'spin-rev': {
          to: { transform: 'rotate(-360deg)' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        pulseRing: {
          '0%': { transform: 'scale(.85)', opacity: 0.7 },
          '80%,100%': { transform: 'scale(1.5)', opacity: 0 },
        },
        typing: {
          '0%,60%,100%': { transform: 'translateY(0)', opacity: 0.45 },
          '30%': { transform: 'translateY(-4px)', opacity: 1 },
        },
      },
      animation: {
        'fade-up': 'fade-up .35s cubic-bezier(.22,1,.36,1) both',
        shimmer: 'shimmer 2.6s linear infinite',
        'spin-slow': 'spin-slow 14s linear infinite',
        'spin-rev': 'spin-rev 22s linear infinite',
        float: 'float 5s ease-in-out infinite',
        pulseRing: 'pulseRing 2.4s cubic-bezier(.22,1,.36,1) infinite',
      },
    },
  },
  plugins: [],
}
