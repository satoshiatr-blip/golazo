import { useState } from 'react'
import { useProject } from './store'
import type { SourceMeta } from './types'
import { sourceKey } from './types'
import SetupTab from './components/SetupTab'
import MarkTab from './components/MarkTab'
import ScenesTab from './components/ScenesTab'
import ExportTab from './components/ExportTab'
import { IconExport, IconFlag, IconLayers, IconSpark, IconTarget } from './components/icons'
import OpeningTab from './components/OpeningTab'
import { Logo, Wordmark } from './components/brand'
import { Toast } from './components/ui'

export type Tab = 'setup' | 'mark' | 'scenes' | 'opening' | 'export'
const TABS = [
  { id: 'setup', label: '試合', Icon: IconFlag },
  { id: 'mark', label: 'マーク', Icon: IconTarget },
  { id: 'scenes', label: 'シーン', Icon: IconLayers },
  { id: 'opening', label: 'オープニング', Icon: IconSpark },
  { id: 'export', label: '書き出し', Icon: IconExport },
] as const

// 動画の長さ。大きな4K動画では video 要素が読み込みを終えないことがあるので、時間で打ち切り、読み込み部品で測り直す
function readDuration(f: File) {
  return new Promise<number>(resolve => {
    const v = document.createElement('video')
    const done = (d: number) => { resolve(d); URL.revokeObjectURL(v.src) }
    v.preload = 'metadata'
    v.onloadedmetadata = () => done(v.duration)
    v.onerror = () => done(0)
    setTimeout(() => done(0), 10000)
    v.src = URL.createObjectURL(f)
  }).then(d => (d > 0 && Number.isFinite(d) ? d : durationFromFile(f)))
}

async function durationFromFile(f: File) {
  try {
    const { Input, BlobSource, ALL_FORMATS } = await import('mediabunny')
    const input = new Input({ source: new BlobSource(f), formats: ALL_FORMATS })
    try { return await input.computeDuration() } finally { input.dispose() }
  } catch { return 0 }
}

const baseName = (n: string) => n.replace(/\.[^.]+$/, '').toLowerCase()

export default function App() {
  const [project, setProject] = useProject()
  const [files, setFiles] = useState<Map<string, File>>(new Map())
  const [tab, setTab] = useState<Tab>(project.sources.length ? 'mark' : 'setup')

  const go = (t: Tab) => setTab(t)

  const [loading, setLoading] = useState('')

  async function addFiles(list: FileList) {
    setLoading('動画を読み込んでいます…')
    try {
      const next = new Map(files)
      const metas: SourceMeta[] = []
      // 選び直しで iPhone が名前やサイズを変えて渡してくることがあるので、名前（拡張子を除く）か長さで元の動画に結び付ける
      const missing = project.sources.filter(s => !files.has(s.key))
      for (const f of Array.from(list)) {
        let key = sourceKey(f)
        const duration = await readDuration(f)
        if (!project.sources.some(s => s.key === key)) {
          const m = missing.find(s => baseName(s.name) === baseName(f.name))
            ?? missing.find(s => duration > 0 && Math.abs(s.duration - duration) < 0.6)
          if (m) {
            key = m.key
            missing.splice(missing.indexOf(m), 1)
          }
        }
        next.set(key, f)
        metas.push({ key, name: f.name, size: f.size, duration })
      }
      setFiles(next)
      setProject(p => {
        const known = new Set(p.sources.map(s => s.key))
        return { ...p, sources: [...p.sources, ...metas.filter(m => !known.has(m.key))] }
      })
    } finally {
      setLoading('')
    }
  }

  function removeSource(key: string) {
    if (!confirm('この動画と、その中のシーンを外しますか？')) return
    setProject(p => ({ ...p, sources: p.sources.filter(s => s.key !== key), scenes: p.scenes.filter(s => s.sourceKey !== key) }))
  }

  return (
    <div className="bg-ink text-fg flex flex-col overflow-hidden" style={{ position: 'fixed', inset: 0 }}>
      <Toast text={loading} />
      <header className="shrink-0 bg-ink/85 backdrop-blur-xl border-b border-line px-5 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Logo size={38} />
          <div className="min-w-0">
            <h1 className="text-lg"><Wordmark /></h1>
            <p className="text-xs text-muted truncate">{project.title ? `${project.title}${project.opponent ? `  VS ${project.opponent}` : ''}` : '一瞬の見せ場を、特別な一本に'}</p>
          </div>
        </div>
      </header>

      <main key={tab} className="rise flex-1 min-h-0 overflow-y-auto max-w-2xl w-full mx-auto px-5 pt-5 pb-5">
        {tab === 'setup' && <SetupTab project={project} setProject={setProject} go={go} />}
        {tab === 'mark' && <MarkTab project={project} setProject={setProject} files={files} addFiles={addFiles} removeSource={removeSource} go={go} />}
        {tab === 'scenes' && <ScenesTab project={project} setProject={setProject} files={files} go={go} />}
        {tab === 'opening' && <OpeningTab project={project} setProject={setProject} go={go} />}
        {tab === 'export' && <ExportTab project={project} setProject={setProject} files={files} addFiles={addFiles} />}
      </main>

      <nav className="shrink-0 bg-surface/90 backdrop-blur-xl border-t border-line pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-2xl mx-auto grid grid-cols-5">
          {TABS.map(({ id, label, Icon }, i) => {
            const active = tab === id
            return (
              <button key={id} onClick={() => go(id)} className={`relative flex flex-col items-center gap-1 pt-2.5 pb-2 transition ${active ? 'text-cyan' : 'text-muted'}`}>
                {active && <span className="absolute top-0 h-0.5 w-10 rounded-full bg-cyan shadow-[0_0_10px_#22d3ee]" />}
                <span className="relative text-2xl">
                  <Icon />
                  {id === 'scenes' && project.scenes.length > 0 && (
                    <span className="absolute -top-1.5 -right-3 min-w-5 h-5 px-1 rounded-full bg-brand text-ink text-[11px] font-bold grid place-items-center">{project.scenes.length}</span>
                  )}
                </span>
                <span className="text-[10.5px] font-bold whitespace-nowrap tracking-tight"><span className="opacity-50 mr-0.5">0{i + 1}</span>{label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
