import { cn } from "@/lib/utils"

interface AuthCardProps {
  title:    string
  subtitle: string
  error?:   string | null
  children: React.ReactNode
}

export function AuthCard({ title, subtitle, error, children }: AuthCardProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)] px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-9 h-9 rounded-xl bg-[var(--color-brand-500)] flex items-center justify-center text-white font-bold">
            F
          </div>
          <span className="text-xl font-bold tracking-tight">FinTrack</span>
        </div>

        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-7 shadow-sm">
          <h1 className="text-xl font-bold mb-1">{title}</h1>
          <p className="text-sm text-[var(--color-muted)] mb-6">{subtitle}</p>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
              {error}
            </div>
          )}

          {children}
        </div>
      </div>
    </div>
  )
}

interface FieldProps {
  label:       string
  name:        string
  type?:       string
  placeholder?: string
  required?:   boolean
}

export function Field({ label, name, type = "text", placeholder, required }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium">{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        className={cn(
          "w-full px-3.5 py-2.5 text-sm rounded-lg border border-[var(--color-border)]",
          "bg-[var(--color-background)] outline-none transition-shadow",
          "focus:ring-2 focus:ring-[var(--color-brand-500)] focus:border-transparent",
          "placeholder:text-[var(--color-muted)]"
        )}
      />
    </div>
  )
}

interface SubmitButtonProps { label: string }

export function SubmitButton({ label }: SubmitButtonProps) {
  return (
    <button
      type="submit"
      className={cn(
        "w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white",
        "bg-[var(--color-brand-500)] hover:bg-[var(--color-brand-600)]",
        "transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)] focus:ring-offset-2"
      )}
    >
      {label}
    </button>
  )
}
