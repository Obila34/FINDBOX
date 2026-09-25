import { useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cx } from '@/lib/util'

interface FieldWrapProps { label: string; hint?: string; error?: string; required?: boolean; children: (id: string, describedBy: string | undefined) => ReactNode; className?: string }

export function FieldWrap({ label, hint, error, required, children, className }: FieldWrapProps) {
  const id = useId()
  const hintId = `${id}-hint`; const errId = `${id}-err`
  const describedBy = [hint ? hintId : null, error ? errId : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-[0.85rem] font-medium text-ink-2">
        {label}{required && <span className="text-status-danger" aria-hidden="true"> *</span>}
      </label>
      {children(id, describedBy)}
      {hint && !error && <p id={hintId} className="text-[0.78rem] text-ink-3">{hint}</p>}
      {error && <p id={errId} role="alert" className="text-[0.78rem] font-medium text-status-danger">{error}</p>}
    </div>
  )
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> { label: string; hint?: string; error?: string }
export function Input({ label, hint, error, required, className, ...rest }: InputProps) {
  return (
    <FieldWrap label={label} hint={hint} error={error} required={required} className={className}>
      {(id, describedBy) => <input id={id} aria-describedby={describedBy} aria-invalid={!!error} required={required} className="fb-input" {...rest} />}
    </FieldWrap>
  )
}

export function PasswordInput({ label, hint, error, required, className, ...rest }: InputProps) {
  const [show, setShow] = useState(false)
  return (
    <FieldWrap label={label} hint={hint} error={error} required={required} className={className}>
      {(id, describedBy) => (
        <div className="relative">
          <input id={id} type={show ? 'text' : 'password'} aria-describedby={describedBy} aria-invalid={!!error} required={required} className="fb-input pr-12" {...rest} />
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded-sm p-2 text-ink-3 hover:bg-paper-2 hover:text-ink">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      )}
    </FieldWrap>
  )
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> { label: string; hint?: string; error?: string }
export function Textarea({ label, hint, error, required, className, rows = 3, ...rest }: TextareaProps) {
  return (
    <FieldWrap label={label} hint={hint} error={error} required={required} className={className}>
      {(id, describedBy) => <textarea id={id} rows={rows} aria-describedby={describedBy} aria-invalid={!!error} required={required} className="fb-input" {...rest} />}
    </FieldWrap>
  )
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> { label: string; hint?: string; error?: string; options: { value: string; label: string }[] }
export function Select({ label, hint, error, required, className, options, ...rest }: SelectProps) {
  return (
    <FieldWrap label={label} hint={hint} error={error} required={required} className={className}>
      {(id, describedBy) => (
        <select id={id} aria-describedby={describedBy} aria-invalid={!!error} required={required} className="fb-input appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%235f7275%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-10" {...rest}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}
    </FieldWrap>
  )
}

export function Checkbox({ label, hint, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; hint?: string }) {
  const id = useId()
  return (
    <label htmlFor={id} className={cx('flex cursor-pointer items-start gap-3 rounded-md border border-line bg-paper p-3 has-[:checked]:border-teal-500 has-[:checked]:bg-teal-50', className)}>
      <input id={id} type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[#0d6166]" {...rest} />
      <span className="text-[0.9rem] leading-snug">
        <span className="font-medium text-ink">{label}</span>
        {hint && <span className="block text-[0.78rem] text-ink-3">{hint}</span>}
      </span>
    </label>
  )
}
