import type { Config } from 'tailwindcss'

/** Palette values mirror src/styles/tokens.css. They are literal here so Tailwind alpha modifiers
 *  (bg-teal-900/80, from-teal-900/85 …) work; var() colours cannot take an alpha channel. */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    screens: { xs: '360px', sm: '640px', md: '768px', lg: '1024px', xl: '1280px' },
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: '#ffffff',
      black: '#000000',
      teal: { 50: '#16211a', 100: '#1d2a22', 200: '#2a3b2f', 300: '#7f9a6c', 400: '#8fa77c', 500: '#9fb48c', 600: '#aebe9e', 700: '#c3d0b4', 800: '#d6dfca', 900: '#e7ecde' },
      tile: '#1a231d',
      ink: { DEFAULT: '#f8f9f3', 2: '#d3d9cc', 3: '#a9b1a5', 4: '#8a9286' },
      paper: { DEFAULT: '#0e1410', 2: '#050806', 3: '#1a231d' },
      line: { DEFAULT: '#222c25', strong: '#33403a' },
      status: { lost: '#a35d12', match: '#13868e', ready: '#0d6166', done: '#2e7d4f', review: '#6a5aa8', danger: '#b3261e' },
      /* Cinematic surfaces (landing and sign-in), drawn from the FindBox sage and forest palette. */
      primary: '#e7ecde',
      cream: { DEFAULT: '#e7ecde', soft: '#f8f9f3' },
      sage: { DEFAULT: '#aebe9e', deep: '#657b56', forest: '#174c39' },
      night: { DEFAULT: '#050806', card: '#0e1410', tile: '#18201a' },
      gray: { 300: '#c4c9c0', 400: '#9da59a', 500: '#78806f', 600: '#596154' },
    },
    fontFamily: {
      display: ['Arial', 'Helvetica', 'system-ui', 'sans-serif'],
      sans: ['Arial', 'Helvetica', 'system-ui', 'sans-serif'],
      serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
      mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
    },
    borderRadius: { none: '0', xs: 'var(--r-xs)', sm: 'var(--r-sm)', DEFAULT: 'var(--r-md)', md: 'var(--r-md)', lg: 'var(--r-lg)', xl: 'var(--r-xl)', '2xl': '1rem', '3xl': '1.5rem', full: '9999px' },
    boxShadow: { tile: 'var(--sh-tile)', raise: 'var(--sh-raise)', sheet: 'var(--sh-sheet)', lg: '0 10px 30px -10px rgba(0,0,0,.45)', '2xl': '0 30px 80px -20px rgba(0,0,0,.7)', none: 'none' },
    extend: {
      transitionDuration: { fast: '160ms', base: '260ms', slow: '420ms' },
      transitionTimingFunction: { out: 'var(--ease-out)', inout: 'var(--ease-inout)', spring: 'var(--ease-spring)' },
    },
  },
  plugins: [],
} satisfies Config
