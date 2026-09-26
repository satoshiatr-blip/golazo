import { useEffect, useState } from 'react'
import type { Tab } from '../App'
import { sceneOutDuration, totalDuration } from '../render'
import type { Scene } from '../types'
import { KIND_JA } from '../types'
import { IconDown, IconLayers, IconUp } from './icons'
import { KIND_UI } from './MarkTab'
import SceneEditor from './SceneEditor'
import { Button, Card, Portal, ScreenTitle, fmt, type ProjectProps } from './ui'

type Props = ProjectProps & { files: Map<string, File>; go: (t: Tab) => void }

// シーンのサムネイルを1枚ずつ順番に作る（同時に大量のデコードをしない）
function useThumbnails(scenes: Scene[], files: Map<string, File>) {
  const [thumbs, setThumbs] = useState<Record<string, string>>({})
  useEffect(() => {
    let cancelled = false
    const todo = scenes.filter(s => !thumbs[`${s.id}:${s.mark}`] && files.has(s.sourceKey))
    if (!todo.length) return
    ;(async () => {
      const v = document.createElement('video')
      v.muted = true
      v.playsInline = true
      const c = document.createElement('canvas')
      c.width = 320
      c.height = 180
      const ctx = c.getContext('2d')!
      let curKey = ''
      for (const s of todo) {
        if (cancelled) break
        if (curKey !== s.sourceKey) {
          if (v.src) URL.revokeObjectURL(v.src)
          v.src = URL.createObjectURL(files.get(s.sourceKey)!)
          curKey = s.sourceKey
          await new Promise(r => { v.onloadeddata = r; v.onerror = r })
        }
        v.currentTime = s.mark
        await new Promise(r => { v.onseeked = r; v.onerror = r })
        await new Promise(r => setTimeout(r, 120))
        ctx.drawImage(v, 0, 0, 320, 180)
        const url = c.toDataURL('image/jpeg', 0.7)
        if (!cancelled) setThumbs(t => ({ ...t, [`${s.id}:${s.mark}`]: url }))
      }
      if (v.src) URL.revokeObjectURL(v.src)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenes.map(s => `${s.id}:${s.mark}`).join(), files])
  return thumbs
}

export default function ScenesTab({ project, setProject, files, go }: Props) {
  const [editing, setEditing] = useState<string | null>(null)
  const scenes = project.scenes
  const editScene = scenes.find(s => s.id === editing)
  const thumbs = useThumbnails(scenes, files)

  const move = (i: number, d: number) => setProject(p => {
    const arr = [...p.scenes]
    const j = i + d
    if (j < 0 || j >= arr.length) return p
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    return { ...p, scenes: arr }
  })

  if (scenes.length === 0) {
    return (
      <div>
        <ScreenTitle step="03" en="SCENES" title="シーンを仕上げる" />
        <Card className="text-center py-12 px-6 space-y-4">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-raised border border-line grid place-items-center text-3xl text-cyan"><IconLayers /></div>
          <p className="text-muted">「マーク」で見せ場をタップすると<br />ここにシーンが並びます</p>
          <Button onClick={() => go('mark')} className="w-full">マークへ</Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ScreenTitle step="03" en="SCENES" title="シーンを仕上げる" sub="タップして画角・スロー・テロップを調整" />

      <div className="grid grid-cols-2 gap-3">
        <Card className="!p-3"><p className="text-[11px] text-muted font-bold tracking-wider">SCENES</p><p className="text-2xl font-black italic">{scenes.length}</p></Card>
        <Card className="!p-3"><p className="text-[11px] text-muted font-bold tracking-wider">DURATION</p><p className="text-2xl font-black italic tabular-nums">{fmt(totalDuration(project))}</p></Card>
      </div>

      <ol className="space-y-2.5">
        {scenes.map((s, i) => {
          const player = project.players.find(p => p.id === s.playerId)
          const thumb = thumbs[`${s.id}:${s.mark}`]
          const { Icon, dot } = KIND_UI[s.kind]
          return (
            <li key={s.id} className="rise flex items-stretch gap-3 bg-surface border border-line rounded-2xl p-2 pr-1" style={{ animationDelay: `${i * 60}ms` }}>
              <button className="flex-1 flex items-center gap-3 min-w-0 text-left active:opacity-70" onClick={() => setEditing(s.id)}>
                <div className="relative w-28 shrink-0 aspect-video rounded-xl overflow-hidden bg-raised">
                  {thumb && <img src={thumb} alt="" className="w-full h-full object-cover" />}
                  <span className="absolute top-1 left-1 text-[10px] font-black italic bg-ink/80 rounded px-1.5 py-0.5">{String(i + 1).padStart(2, '0')}</span>
                  {s.slow && <span className="absolute bottom-1 right-1 text-[9px] font-black bg-cyan text-ink rounded px-1">SLOW</span>}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-muted">
                    <span className={`w-2 h-2 rounded-full ${dot}`} /><Icon className="text-sm" />{KIND_JA[s.kind]}
                  </div>
                  <div className="font-bold truncate mt-0.5">{player ? `#${player.number} ${player.name}` : '選手名なし'}</div>
                  <div className="text-xs text-muted mt-0.5 tabular-nums">{fmt(s.mark)}・{sceneOutDuration(s).toFixed(1)}秒</div>
                </div>
              </button>
              <div className="flex flex-col justify-center">
                <button className="w-10 h-10 grid place-items-center text-muted text-lg disabled:opacity-20" disabled={i === 0} onClick={() => move(i, -1)} aria-label="上へ"><IconUp /></button>
                <button className="w-10 h-10 grid place-items-center text-muted text-lg disabled:opacity-20" disabled={i === scenes.length - 1} onClick={() => move(i, 1)} aria-label="下へ"><IconDown /></button>
              </div>
            </li>
          )
        })}
      </ol>

      <Button variant="ghost" className="w-full text-sm"
        onClick={() => setProject(p => ({ ...p, scenes: [...p.scenes].sort((a, b) =>
          p.sources.findIndex(x => x.key === a.sourceKey) - p.sources.findIndex(x => x.key === b.sourceKey) || a.mark - b.mark) }))}>
        時間順に並べ直す
      </Button>

      <Button variant="primary" className="w-full min-h-14 text-lg" onClick={() => go('opening')}>次へ：オープニング</Button>

      {editScene && (
        <Portal><SceneEditor project={project} scene={editScene} file={files.get(editScene.sourceKey) ?? null}
          onChange={ns => setProject(p => ({ ...p, scenes: p.scenes.map(x => x.id === ns.id ? ns : x) }))}
          onDelete={() => { setProject(p => ({ ...p, scenes: p.scenes.filter(x => x.id !== editScene.id) })); setEditing(null) }}
          onClose={() => setEditing(null)} /></Portal>
      )}
    </div>
  )
}
