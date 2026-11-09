import type { Config } from 'tailwindcss'

/** Palette values mirror src/styles/tokens.css. They are literal here so Tailwind alpha modifiers
 *  (bg-teal-900/80, from-teal-900/85 …) work; var() colours cannot take an alpha channel. */
/** A theme-aware colour: the value lives in a CSS variable (see src/styles/theme-vars.css) so light and dark mode can swap it. */
const v = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    screens: { xs: '360px', sm: '640px', md: '768px', lg: '1024px', xl: '1280px' },
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: '#ffffff',
      black: '#000000',
      teal: { 50: v('teal-50'), 100: v('teal-100'), 200: v('teal-200'), 300: v('teal-300'), 400: v('teal-400'), 500: v('teal-500'), 600: v('teal-600'), 700: v('teal-700'), 800: v('teal-800'), 900: v('teal-900') },
      tile: v('tile'),
      ink: { DEFAULT: v('ink'), 2: v('ink-2'), 3: v('ink-3'), 4: v('ink-4') },
      paper: { DEFAULT: v('paper'), 2: v('paper-2'), 3: v('paper-3') },
      line: { DEFAULT: v('line'), strong: v('line-strong') },
      status: { lost: '#a35d12', match: '#13868e', ready: '#0d6166', done: '#2e7d4f', review: '#6a5aa8', danger: '#b3261e' },
      /* Cinematic surfaces (landing and sign-in), drawn from the FindBox sage and forest palette. */
      primary: v('primary'),
      cream: { DEFAULT: v('cream'), soft: v('cream-soft') },
      sage: { DEFAULT: v('sage'), deep: '#657b56', forest: '#174c39' },
      night: { DEFAULT: v('night'), card: v('night-card'), tile: v('night-tile') },
      gray: { 300: v('gray-300'), 400: v('gray-400'), 500: v('gray-500'), 600: v('gray-600') },
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
