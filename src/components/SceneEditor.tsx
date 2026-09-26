import { useCallback, useEffect, useRef, useState } from 'react'
import { OUT_H, OUT_W, cropRect, drawScene, isSlowAt, outTimeAt, sceneOutDuration } from '../render'
import type { Project, Scene, SceneKind, ZoomRect } from '../types'
import { KIND_JA } from '../types'
import { IconBack, IconPlay, IconStop, IconTrash } from './icons'
import { Button, Card, GroupLabel, Row, Segmented, Slider, Toggle, fmt, inputCls, useObjectUrl } from './ui'

type Props = {
  project: Project
  scene: Scene
  file: File | null
  onChange: (s: Scene) => void
  onDelete: () => void
  onClose: () => void
}

type Mode = 'view' | 'zoomFrom' | 'zoomTo'
const PW = 1280
const PH = 720

export default function SceneEditor({ project, scene, file, onChange, onDelete, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [mode, setMode] = useState<Mode>('view')
  const [playing, setPlaying] = useState(false)
  const url = useObjectUrl(file)
  const sceneRef = useRef(scene)
  sceneRef.current = scene
  const modeRef = useRef(mode)
  modeRef.current = mode
  const duration = project.sources.find(s => s.key === scene.sourceKey)?.duration ?? scene.end + 10
  const player = project.players.find(p => p.id === scene.playerId) ?? null
  const set = (patch: Partial<Scene>) => onChange({ ...scene, ...patch })

  const draw = useCallback(() => {
    const v = videoRef.current, c = canvasRef.current
    if (!v || !c || v.readyState < 2) return
    const ctx = c.getContext('2d')!
    const s = sceneRef.current
    const m = modeRef.current
    ctx.setTransform(PW / OUT_W, 0, 0, PH / OUT_H, 0, 0)
    if (m === 'view') {
      const dur = sceneOutDuration(s)
      const src = v.currentTime
      drawScene(ctx, v, v.videoWidth, v.videoHeight, { project, scene: s, player, tOut: outTimeAt(s, src), dur, src })
    } else {
      ctx.drawImage(v, 0, 0, OUT_W, OUT_H)
      const z = m === 'zoomFrom' ? s.zoomFrom : s.zoomTo
      const r = cropRect(z, OUT_W, OUT_H)
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.beginPath()
      ctx.rect(0, 0, OUT_W, OUT_H)
      ctx.rect(r.sx + r.sw, r.sy, -r.sw, r.sh)
      ctx.fill('evenodd')
      ctx.strokeStyle = m === 'zoomFrom' ? '#fff' : '#facc15'
      ctx.lineWidth = 6
      ctx.strokeRect(r.sx, r.sy, r.sw, r.sh)
    }
  }, [project, player])

  useEffect(() => { draw() }, [scene, mode, draw])

  const seekTo = (t: number) => {
    const v = videoRef.current
    if (v && !playing) v.currentTime = t
  }

  function changeMode(m: Mode) {
    stop()
    setMode(m)
    const v = videoRef.current
    if (!v) return
    v.currentTime = m === 'zoomFrom' ? scene.start : m === 'zoomTo' ? Math.max(scene.start, scene.end - 0.1) : scene.mark
  }

  function play() {
    const v = videoRef.current
    if (!v) return
    setMode('view')
    modeRef.current = 'view'
    v.currentTime = scene.start
    v.playbackRate = 1
    v.muted = false
    setPlaying(true)
    v.play()
    const tick = () => {
      const s = sceneRef.current
      if (v.paused && v.currentTime < s.end) { setPlaying(false); return }
      const slow = isSlowAt(s, v.currentTime)
      v.playbackRate = slow ? 0.5 : 1
      v.muted = slow
      draw()
      if (v.currentTime >= s.end) { v.pause(); setPlaying(false); return }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }

  function stop() {
    const v = videoRef.current
    if (v && !v.paused) v.pause()
    setPlaying(false)
  }

  function pointAt(e: React.PointerEvent<HTMLCanvasElement>) {
    if (mode === 'view' || e.buttons === 0 && e.type === 'pointermove') return
    const rect = e.currentTarget.getBoundingClientRect()
    const cx = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    const cy = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
    const z = scene[mode]
    set({ [mode]: { ...z, cx, cy } as ZoomRect })
  }

  const zoom = mode === 'view' ? null : scene[mode]

  return (
    <div className="fixed inset-0 z-40 bg-ink overflow-y-auto">
      <div className="sticky top-0 z-20 bg-ink/90 backdrop-blur-xl border-b border-line pt-[env(safe-area-inset-top)]">
        <div className="max-w-2xl mx-auto h-14 px-2 flex items-center justify-between">
          <button onClick={onClose} className="h-11 px-3 flex items-center gap-1 text-cyan font-bold"><IconBack className="text-xl" />シーン一覧</button>
          <span className="text-[11px] font-black italic tracking-[0.2em] text-muted">EDIT SCENE</span>
          <button onClick={() => confirm('このシーンを削除しますか？') && onDelete()} className="h-11 w-11 grid place-items-center text-danger text-xl" aria-label="削除"><IconTrash /></button>
        </div>
        <div className="max-w-2xl mx-auto px-5 pb-3 space-y-3">
          {url && (
            <video ref={videoRef} src={url} playsInline preload="auto" className="absolute w-px h-px opacity-0 pointer-events-none"
              onLoadedData={e => { e.currentTarget.currentTime = scene.mark }} onSeeked={draw} />
          )}
          <div className="relative">
            <canvas ref={canvasRef} width={PW} height={PH} className="w-full aspect-video rounded-2xl bg-black touch-none border border-line"
              onPointerDown={pointAt} onPointerMove={pointAt} />
            {!url && <p className="absolute inset-0 grid place-items-center text-sm text-muted">「マーク」で動画を選び直すとプレビューできます</p>}
            <span className="absolute top-2 right-2 text-[11px] font-black italic bg-ink/80 rounded-md px-2 py-1 tabular-nums">{sceneOutDuration(scene).toFixed(1)}s</span>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <Segmented value={mode} onChange={changeMode} options={[
                { v: 'view', label: '仕上がり' }, { v: 'zoomFrom', label: '開始の画角' }, { v: 'zoomTo', label: '終了の画角' },
              ]} />
            </div>
            <button disabled={!url} onClick={playing ? stop : play} aria-label={playing ? '停止' : 'プレビュー再生'}
              className="w-12 shrink-0 rounded-xl bg-gradient-to-br from-cyan to-brand text-white text-xl grid place-items-center shadow-[0_0_18px_rgba(34,211,238,0.45)] active:scale-95 disabled:opacity-35">
              {playing ? <IconStop /> : <IconPlay />}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 pt-5 pb-16 space-y-6">
        {zoom && mode !== 'view' && (
          <div>
            <GroupLabel>画角 — {mode === 'zoomFrom' ? 'シーンの始まり' : 'シーンの終わり'}</GroupLabel>
            <Card className="space-y-3">
              <p className="text-sm text-muted">映したい場所を映像の上でタップ（ドラッグ）。枠の中が画面いっぱいになり、始まりから終わりへ滑らかに動きます</p>
              <Slider label="拡大" display={`×${zoom.scale.toFixed(2)}`} min={1} max={2.5} step={0.05} value={zoom.scale}
                onChange={v => set({ [mode]: { ...zoom, scale: v } as ZoomRect })} />
              <Button className="w-full text-sm" onClick={() => set(mode === 'zoomFrom' ? { zoomTo: { ...scene.zoomFrom } } : { zoomFrom: { ...scene.zoomTo } })}>
                {mode === 'zoomFrom' ? '終わりの画角も同じにする' : '始まりの画角も同じにする'}
              </Button>
            </Card>
          </div>
        )}

        <div>
          <GroupLabel>テロップ</GroupLabel>
          <Card className="space-y-3">
            <Segmented value={scene.kind} onChange={k => set({ kind: k as SceneKind })}
              options={(['goal', 'save', 'play'] as SceneKind[]).map(k => ({ v: k, label: KIND_JA[k] }))} />
            <select className={inputCls} value={scene.playerId ?? ''} onChange={e => set({ playerId: e.target.value || null })}>
              <option value="">選手名を出さない</option>
              {project.players.map(p => <option key={p.id} value={p.id}>#{p.number} {p.name}</option>)}
            </select>
          </Card>
        </div>

        <div>
          <GroupLabel>切り出す範囲</GroupLabel>
          <Card className="space-y-4">
            <Slider label="開始（マークより前）" display={`${(scene.mark - scene.start).toFixed(1)}秒前`}
              min={Math.max(0, scene.mark - 20)} max={scene.mark - 0.5} step={0.1} value={scene.start}
              onChange={v => { set({ start: v, slowAt: Math.max(v, scene.slowAt) }); seekTo(v) }} />
            <Slider label="終了（マークより後）" display={`${(scene.end - scene.mark).toFixed(1)}秒後`}
              min={scene.mark + 0.5} max={Math.min(duration, scene.mark + 12)} step={0.1} value={scene.end}
              onChange={v => { set({ end: v }); seekTo(v) }} />
          </Card>
        </div>

        <div>
          <GroupLabel>スロー</GroupLabel>
          <Card className="space-y-4">
            <Row label="スローモーション" hint="決定的な瞬間を0.5倍速で見せる">
              <Toggle label="スロー" checked={scene.slow} onChange={v => set({ slow: v })} />
            </Row>
            {scene.slow && <>
              <Slider label="スロー開始" display={fmt(scene.slowAt)} min={scene.start} max={Math.max(scene.start, scene.end - 0.5)} step={0.1}
                value={scene.slowAt} onChange={v => { set({ slowAt: v }); seekTo(v) }} />
              <Slider label="スローの長さ" display={`${scene.slowLen.toFixed(1)}秒`} min={0.5} max={4} step={0.1}
                value={scene.slowLen} onChange={v => set({ slowLen: v })} />
            </>}
          </Card>
        </div>
      </div>
    </div>
  )
}
