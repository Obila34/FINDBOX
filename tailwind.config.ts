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
      teal: { 50: '#eef6f6', 100: '#d6ebeb', 200: '#a9d9d8', 300: '#33bab7', 400: '#22a3a5', 500: '#13868e', 600: '#0f7378', 700: '#0d6166', 800: '#04414c', 900: '#073847' },
      tile: '#e8e8e8',
      ink: { DEFAULT: '#171717', 2: '#404040', 3: '#666666', 4: '#757575' },
      paper: { DEFAULT: '#ffffff', 2: '#f5f5f5', 3: '#ededed' },
      line: { DEFAULT: '#e5e5e5', strong: '#cecece' },
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
