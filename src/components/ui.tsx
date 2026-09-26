import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Project } from '../types'

export type ProjectProps = {
  project: Project
  setProject: (f: (p: Project) => Project) => void
}

export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <section className={`bg-surface rounded-2xl border border-line p-4 ${className}`}>{children}</section>
)

// 画面ごとの見出し：小さな英字ラベル＋斜体の大見出し
export const ScreenTitle = ({ step, en, title, sub }: { step: string; en: string; title: string; sub?: string }) => (
  <div className="mb-5">
    <p className="text-[11px] font-black italic tracking-[0.25em] text-cyan">STEP {step} — {en}</p>
    <h2 className="mt-1 text-2xl font-black italic -skew-x-6 origin-left">{title}</h2>
    {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
  </div>
)

export const GroupLabel = ({ children }: { children: ReactNode }) => (
  <h3 className="px-1 mb-2 text-xs font-bold tracking-wider text-muted">{children}</h3>
)

export const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="block">
    <span className="block text-xs font-medium text-muted mb-1.5">{label}</span>
    {children}
  </label>
)

export const inputCls = 'w-full h-12 rounded-xl bg-raised border border-line px-3.5 text-base text-fg placeholder:text-muted/60 focus:outline-none focus:border-cyan focus:ring-2 focus:ring-cyan/30 transition'

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }
const VARIANT = {
  primary: 'bg-gradient-to-r from-brand to-[#ffd400] text-ink shadow-[0_6px_24px_-6px_rgba(255,159,10,0.7)]',
  secondary: 'bg-raised text-fg border border-line',
  ghost: 'text-muted',
  danger: 'text-danger',
}
export const Button = ({ variant = 'secondary', className = '', ...p }: BtnProps) => (
  <button {...p}
    className={`inline-flex items-center justify-center gap-2 min-h-12 px-4 rounded-xl font-bold transition active:scale-[0.97] disabled:opacity-35 disabled:active:scale-100 ${VARIANT[variant]} ${className}`} />
)

export const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
  <button role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
    className={`relative w-13 h-8 rounded-full transition ${checked ? 'bg-brand shadow-[0_0_12px_rgba(255,159,10,0.6)]' : 'bg-line'}`}>
    <span className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
  </button>
)

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { v: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="grid gap-1 p-1 rounded-xl bg-raised border border-line" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map(o => (
        <button key={o.v} onClick={() => onChange(o.v)}
          className={`min-h-10 rounded-lg text-sm font-bold transition ${value === o.v ? 'bg-fg text-ink' : 'text-muted'}`}>{o.label}</button>
      ))}
    </div>
  )
}

export function Slider({ label, value, display, min, max, step, onChange }:
  { label: string; value: number; display: string; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-muted">{label}</span>
        <span className="font-bold tabular-nums">{display}</span>
      </div>
      <input type="range" className="w-full h-8" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} />
    </label>
  )
}

export const Row = ({ label, children, hint }: { label: ReactNode; children: ReactNode; hint?: string }) => (
  <div className="flex items-center justify-between gap-3 min-h-12">
    <div>
      <div className="font-medium">{label}</div>
      {hint && <div className="text-xs text-muted mt-0.5">{hint}</div>}
    </div>
    {children}
  </div>
)

export const fmt = (sec: number) => {
  const s = Math.max(0, sec)
  const m = Math.floor(s / 60)
  return `${m}:${(s - m * 60).toFixed(1).padStart(4, '0')}`
}

export const FilePicker = ({ children, onFiles, multiple = true, accept = 'video/*', className = '' }:
  { children: ReactNode; onFiles: (f: FileList) => void; multiple?: boolean; accept?: string; className?: string }) => (
  <label className={`inline-flex items-center justify-center gap-2 cursor-pointer font-bold transition active:scale-[0.97] ${className}`}>
    {children}
    <input type="file" accept={accept || undefined} multiple={multiple} className="hidden"
      onChange={e => { if (e.target.files?.length) onFiles(e.target.files); e.target.value = '' }} />
  </label>
)

export function useObjectUrl(blob: Blob | null | undefined) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!blob) { setUrl(null); return }
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}

export function Toast({ text }: { text: string }) {
  if (!text) return null
  return createPortal(
    <div className="fixed left-1/2 -translate-x-1/2 bottom-28 z-50 px-5 py-3 rounded-full bg-fg text-ink text-sm font-bold shadow-2xl animate-[toast_.25s_ease-out]">
      {text}
    </div>,
    document.body,
  )
}

// 画面切替アニメーションの重なり順に閉じ込められないよう、全画面の重ね物は body 直下に描く
export const Portal = ({ children }: { children: ReactNode }) => createPortal(children, document.body)
