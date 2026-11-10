import { useState, type InputHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import './reveal-password.css'

/**
 * A password input with an eye button on the right that shows or hides what is typed.
 * Drop it inside an existing <label>; `label` keeps the input's accessible name exact.
 */
export function RevealPassword({ label = 'Password', className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label?: string }) {
  const [show, setShow] = useState(false)
  return (
    <span className="pw-wrap">
      <input {...rest} type={show ? 'text' : 'password'} aria-label={label} className={className} autoCapitalize="off" spellCheck={false} />
      <button type="button" className="pw-eye" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show} title={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </span>
  )
}
