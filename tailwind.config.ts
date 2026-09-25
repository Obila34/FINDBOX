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
      teal: { 50: '#eef6f6', 100: '#d6ebeb', 200: '#a9d9d8', 300: '#33bab7', 400: '#22a3a5', 500: '#13868e', 600: '#0f7378', 700: '#0d6166', 800: '#04414c', 900: '#073847' },
      tile: '#e8e8e8',
      ink: { DEFAULT: '#171717', 2: '#404040', 3: '#666666', 4: '#757575' },
      paper: { DEFAULT: '#ffffff', 2: '#f5f5f5', 3: '#ededed' },
      line: { DEFAULT: '#e5e5e5', strong: '#cecece' },
      status: { lost: '#a35d12', match: '#13868e', ready: '#0d6166', done: '#2e7d4f', review: '#6a5aa8', danger: '#b3261e' },
    },
    fontFamily: {
      display: ['Arial', 'Helvetica', 'system-ui', 'sans-serif'],
      sans: ['Arial', 'Helvetica', 'system-ui', 'sans-serif'],
      mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
    },
    borderRadius: { none: '0', xs: 'var(--r-xs)', sm: 'var(--r-sm)', DEFAULT: 'var(--r-md)', md: 'var(--r-md)', lg: 'var(--r-lg)', xl: 'var(--r-xl)', full: '9999px' },
    boxShadow: { tile: 'var(--sh-tile)', raise: 'var(--sh-raise)', sheet: 'var(--sh-sheet)', none: 'none' },
    extend: {
      transitionDuration: { fast: '160ms', base: '260ms', slow: '420ms' },
      transitionTimingFunction: { out: 'var(--ease-out)', inout: 'var(--ease-inout)', spring: 'var(--ease-spring)' },
    },
  },
  plugins: [],
} satisfies Config
