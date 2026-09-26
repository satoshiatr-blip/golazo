import { useEffect, useRef, useState, type ComponentType, type SVGProps } from 'react'
import type { Tab } from '../App'
import { POST_SEC, PRE_SEC, newScene } from '../store'
import type { SceneKind } from '../types'
import { KIND_JA } from '../types'
import { IconBall, IconForward, IconGlove, IconPlus, IconRewind, IconSpark, IconVideo } from './icons'
import { Button, Card, FilePicker, ScreenTitle, Toast, fmt, useObjectUrl, type ProjectProps } from './ui'
import { Slam } from './brand'
import { playImpactNow } from '../sfx'

type Props = ProjectProps & {
  files: Map<string, File>
  addFiles: (f: FileList) => void
  removeSource: (key: string) => void
  go: (t: Tab) => void
}

const SPEEDS = [1, 2, 4]
export const KIND_UI: Record<SceneKind, { Icon: ComponentType<SVGProps<SVGSVGElement>>; btn: string; dot: string }> = {
  goal: { Icon: IconBall, btn: 'bg-gradient-to-br from-brand to-[#ffd400] text-white shadow-[0_8px_28px_-8px_rgba(255,159,10,0.9)]', dot: 'bg-brand' },
  save: { Icon: IconGlove, btn: 'bg-raised text-cyan border border-cyan/60 shadow-[0_8px_28px_-10px_rgba(255,212,0,0.6)]', dot: 'bg-cyan' },
  play: { Icon: IconSpark, btn: 'bg-fg text-ink', dot: 'bg-fg' },
}

export default function MarkTab({ project, setProject, files, addFiles, removeSource, go }: Props) {
  const [activeKey, setActiveKey] = useState(project.sources[0]?.key ?? '')
  const [speed, setSpeed] = useState(1)
  const [time, setTime] = useState(0)
  const [toast, setToast] = useState('')
  const [slam, setSlam] = useState<{ n: number; word: string }>({ n: 0, word: '' })
  const videoRef = useRef<HTMLVideoElement>(null)

  const active = project.sources.find(s => s.key === activeKey) ?? project.sources[0]
  const file = active && files.get(active.key)
  const url = useObjectUrl(file)
  const marks = project.scenes.filter(s => s.sourceKey === active?.key)
  const missing = project.sources.filter(s => !files.has(s.key))
  const dur = active?.duration || 1

  useEffect(() => { if (videoRef.current) videoRef.current.playbackRate = speed }, [speed, url])

  const seek = (d: number) => {
    const v = videoRef.current
    if (v) v.currentTime = Math.min(v.duration || 0, Math.max(0, v.currentTime + d))
  }

  function mark(kind: SceneKind) {
    const v = videoRef.current
    if (!v || !active) return
    const s = newScene(active.key, v.currentTime, v.duration || active.duration, kind, project.players[0]?.id ?? null)
    setProject(p => ({ ...p, scenes: [...p.scenes, s] }))
    playImpactNow()
    setSlam({ n: Date.now(), word: { goal: 'GOAL!', save: 'SAVE!', play: 'NICE!' }[kind] })
    setToast(`${KIND_JA[kind]}を追加  ${fmt(v.currentTime)}`)
    setTimeout(() => setToast(''), 1600)
  }

  if (project.sources.length === 0) {
    return (
      <div>
        <ScreenTitle step="02" en="MARK" title="見せ場をマーク" />
        <Card className="text-center py-12 px-6 space-y-4">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-raised border border-line grid place-items-center text-3xl text-cyan"><IconVideo /></div>
          <div>
            <p className="font-bold text-lg">試合の動画を選ぶ</p>
            <p className="text-sm text-muted mt-1">前半・後半など複数あればまとめて選べます</p>
          </div>
          <FilePicker onFiles={addFiles} className="w-full min-h-14 rounded-xl text-lg bg-gradient-to-r from-brand to-[#ffd400] text-white shadow-[0_6px_24px_-6px_rgba(255,159,10,0.7)]">
            動画を選ぶ
          </FilePicker>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ScreenTitle step="02" en="MARK" title="見せ場をマーク" sub={`決定的な瞬間でタップ。前${PRE_SEC}秒・後${POST_SEC}秒がシーンになります`} />

      {missing.length > 0 && (
        <Card className="!border-amber-400/50 !bg-amber-400/10 space-y-3">
          <p className="text-sm text-amber-200">アプリを開き直したので、次の動画をもう一度選んでください</p>
          <ul className="text-xs text-amber-200/80 list-disc pl-5">{missing.map(m => <li key={m.key}>{m.name}</li>)}</ul>
          <FilePicker onFiles={addFiles} className="w-full min-h-11 rounded-xl bg-amber-400 text-ink">動画を選び直す</FilePicker>
        </Card>
      )}

      <div className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-1 [scrollbar-width:none]">
        {project.sources.map((s, i) => (
          <button key={s.key} onClick={() => setActiveKey(s.key)}
            className={`shrink-0 h-9 px-4 rounded-full text-sm font-bold border transition ${s.key === active?.key ? 'bg-fg text-ink border-fg' : 'bg-surface text-muted border-line'}`}>
            {i + 1}. {s.name}
          </button>
        ))}
        <FilePicker onFiles={addFiles} className="shrink-0 h-9 px-4 rounded-full text-sm border border-dashed border-line text-muted"><IconPlus />追加</FilePicker>
      </div>

      <div className="-mx-5 sm:mx-0 sm:rounded-2xl overflow-hidden bg-black border-y sm:border border-line">
        {url ? (
          <video ref={videoRef} src={url} playsInline controls className="w-full aspect-video"
            onTimeUpdate={e => setTime(e.currentTarget.currentTime)} onLoadedMetadata={e => (e.currentTarget.playbackRate = speed)} />
        ) : (
          <div className="aspect-video grid place-items-center text-muted text-sm">動画を選び直してください</div>
        )}
      </div>

      <div>
        <div className="relative h-10 rounded-xl bg-surface border border-line overflow-hidden">
          <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-brand/10 to-brand/30 border-r-2 border-cyan" style={{ width: `${(time / dur) * 100}%` }} />
          {marks.map(m => (
            <button key={m.id} aria-label={`${KIND_JA[m.kind]} ${fmt(m.mark)}`} onClick={() => videoRef.current && (videoRef.current.currentTime = m.start)}
              className="absolute inset-y-0 w-6 -ml-3 grid place-items-center" style={{ left: `${(m.mark / dur) * 100}%` }}>
              <span className={`w-1.5 h-6 rounded-full ${KIND_UI[m.kind].dot}`} />
            </button>
          ))}
        </div>
        <div className="flex justify-between text-[11px] text-muted mt-1 px-1 tabular-nums">
          <span>{fmt(time)}</span><span>{marks.length}件マーク済み</span><span>{fmt(dur)}</span>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2">
        <Button className="!px-0 text-sm" onClick={() => seek(-10)} aria-label="10秒戻る"><IconRewind />10</Button>
        <Button className="!px-0 text-sm" onClick={() => seek(-3)} aria-label="3秒戻る"><IconRewind />3</Button>
        <Button className="!px-0 text-sm !bg-fg !text-ink" onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}>×{speed}</Button>
        <Button className="!px-0 text-sm" onClick={() => seek(3)} aria-label="3秒進む">3<IconForward /></Button>
        <Button className="!px-0 text-sm" onClick={() => seek(10)} aria-label="10秒進む">10<IconForward /></Button>
      </div>

      <div className="grid grid-cols-3 gap-3 pt-1">
        {(['goal', 'save', 'play'] as SceneKind[]).map(k => {
          const { Icon, btn } = KIND_UI[k]
          return (
            <button key={k} disabled={!url} onClick={() => mark(k)}
              className={`flex flex-col items-center justify-center gap-1.5 h-24 rounded-2xl font-black italic text-lg transition active:scale-95 disabled:opacity-35 ${btn}`}>
              <Icon className="text-3xl" />
              {KIND_JA[k]}
            </button>
          )
        })}
      </div>

      {project.scenes.length > 0 && (
        <Button variant="primary" className="w-full min-h-14 text-lg" onClick={() => go('scenes')}>
          次へ：シーンを仕上げる（{project.scenes.length}）
        </Button>
      )}

      {active && <button className="w-full py-3 text-xs text-muted" onClick={() => removeSource(active.key)}>この動画を外す</button>}

      <Toast text={toast} />
      <Slam word={slam.word} trigger={slam.n} sub={`SCENE ${String(project.scenes.length).padStart(2, '0')}`} />
    </div>
  )
}
