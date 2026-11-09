import { AnimatePresence, motion } from 'motion/react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/lib/theme'
import { cx } from '@/lib/util'

/** Sun/moon button that flips between dark and light mode. */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useTheme()
  const light = theme === 'light'
  return <button type="button" className={cx('fb-theme-toggle', className)} onClick={() => setTheme(light ? 'dark' : 'light')}
    aria-label={light ? 'Switch to dark mode' : 'Switch to light mode'} title={light ? 'Dark mode' : 'Light mode'}>
    <AnimatePresence mode="wait" initial={false}>
      <motion.span key={theme} initial={{ y: 14, opacity: 0, rotate: -40 }} animate={{ y: 0, opacity: 1, rotate: 0 }} exit={{ y: -14, opacity: 0, rotate: 40 }} transition={{ duration: 0.25 }} className="grid place-items-center">
        {light ? <Moon size={16} /> : <Sun size={16} />}
      </motion.span>
    </AnimatePresence>
  </button>
}

/** A labelled Dark / Light choice for settings menus. */
export function ThemeChoice() {
  const [theme, setTheme] = useTheme()
  return <div className="fb-theme-row">
    <span><strong>Appearance</strong><small>{theme === 'light' ? 'Light, for bright rooms' : 'Dark forest, easy on the eyes'}</small></span>
    <span className="fb-theme-seg" role="group" aria-label="Appearance">
      <button type="button" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}><Moon size={13} />Dark</button>
      <button type="button" aria-pressed={theme === 'light'} onClick={() => setTheme('light')}><Sun size={13} />Light</button>
    </span>
  </div>
}
