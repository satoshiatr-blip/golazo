import { useEffect, useRef, useState } from 'react'
import type { Tab } from '../App'
import { cutoutPerson, shrinkPhoto } from '../cutout'
import { savePhoto } from '../idb'
import { OPEN_SEC, OUT_W } from '../render'
import { defaultBottom, drawOpening, loadOpeningImages, type OpeningImage } from '../opening'
import type { Opening, OpeningPhoto, OpeningStyle } from '../types'
import { uid } from '../types'
import { IconBack, IconPlay, IconPlus, IconStop, IconTrash } from './icons'
import { COLORS } from './SetupTab'
import { Button, Card, Field, FilePicker, GroupLabel, Row, ScreenTitle, Segmented, Slider, Toggle, inputCls, type ProjectProps } from './ui'

const MAX_PHOTOS = 5
// 高柳FC版の赤系（先頭はエンブレムの赤）
const REDS = [
  { c: '#d7232a', name: 'エンブレム' },
  { c: '#b3101f', name: 'クリムゾン' },
  { c: '#ff3040', name: 'スカーレット' },
  { c: '#7d0c1c', name: 'ワイン' },
  { c: '#ff5a3c', name: 'バーミリオン' },
]
// 止めているときに見せる瞬間（全部そろって、まだ場面転換が始まる前）
const STILL_T = 3.3

// 写真の読み込みは「どの画像を使うか」が変わったときだけ。大きさ・位置の変更では読み直さない
export function useOpeningImages(photos: OpeningPhoto[]) {
  const [loaded, setLoaded] = useState<Map<string, OpeningImage>>(new Map())
  const key = photos.map(p => `${p.id}:${p.cutout && p.hasCut}`).join(',')
  useEffect(() => {
    let cancelled = false
    loadOpeningImages(photos).then(list => {
      if (!cancelled) setLoaded(new Map(list.map(x => [x.photo.id, x])))
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return photos.flatMap(ph => {
    const m = loaded.get(ph.id)
    return m ? [{ img: m.img, photo: { ...ph, cutout: m.photo.cutout } }] : []
  })
}

export default function OpeningTab({ project, setProject, go }: ProjectProps & { go: (t: Tab) => void }) {
  const op = project.opening
  const images = useOpeningImages(op.photos)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [playing, setPlaying] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [working, setWorking] = useState<Set<string>>(new Set())
  const [notice, setNotice] = useState('')

  function setStyle(style: OpeningStyle) {
    setProject(p => ({
      ...p,
      // 高柳FC版に切り替えたら、赤系でない色はエンブレムの赤にする
      color: style === 'tfc' && !REDS.some(r => r.c === p.color) ? REDS[0].c : p.color,
      opening: { ...p.opening, style },
    }))
  }

  const setOp = (patch: Partial<Opening>) => setProject(p => ({ ...p, opening: { ...p.opening, ...patch } }))
  const setPhoto = (id: string, patch: Partial<OpeningPhoto>) =>
    setProject(p => ({ ...p, opening: { ...p.opening, photos: p.opening.photos.map(x => x.id === id ? { ...x, ...patch } : x) } }))

  // 描画：再生中は毎フレーム、止めているときは完成形の1枚
  const drawRef = useRef<(t: number) => void>(() => {})
  drawRef.current = (t: number) => {
    const c = canvasRef.current
    if (!c) return
    const w = c.clientWidth * Math.min(2, devicePixelRatio)
    if (c.width !== Math.round(w)) { c.width = Math.round(w); c.height = Math.round(w * 9 / 16) }
    const ctx = c.getContext('2d')!
    ctx.setTransform(c.width / OUT_W, 0, 0, c.width / OUT_W, 0, 0)
    drawOpening(ctx, project, images, t, OPEN_SEC)
  }
  useEffect(() => { if (!playing) drawRef.current(STILL_T) })
  useEffect(() => {
    if (!playing) return
    let raf = 0
    const t0 = performance.now()
    const tick = () => {
      const t = (performance.now() - t0) / 1000
      if (t >= OPEN_SEC) { setPlaying(false); return }
      drawRef.current(t)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  async function addPhotos(list: FileList) {
    const room = MAX_PHOTOS - op.photos.length
    const files = Array.from(list).slice(0, room)
    if (list.length > room) setNotice(`写真は${MAX_PHOTOS}枚までです。先頭の${room}枚だけ追加しました`)
    else setNotice('')
    for (const f of files) {
      const id = uid()
      let small: Blob
      try { small = await shrinkPhoto(f) } catch {
        setNotice(`「${f.name}」は画像として読み込めませんでした`)
        continue
      }
      await savePhoto(id, false, small)
      setProject(p => ({ ...p, opening: { ...p.opening, photos: [...p.opening.photos, { id, cutout: true, hasCut: false, scale: 1, dx: 0, dy: 0 }] } }))
      setSelected(id)
      makeCutout(id, small)
    }
  }

  async function makeCutout(id: string, photo: Blob) {
    setWorking(s => new Set(s).add(id))
    try {
      await savePhoto(id, true, await cutoutPerson(photo))
      setPhoto(id, { hasCut: true })
    } catch (e) {
      setPhoto(id, { cutout: false })
      setNotice(e instanceof Error && e.message.includes('人物') ? '人物を見つけられなかったので、四角い写真のまま使います' : '切り抜きに失敗したので、四角い写真のまま使います')
    } finally {
      setWorking(s => { const n = new Set(s); n.delete(id); return n })
    }
  }

  function removePhoto(id: string) {
    setProject(p => ({ ...p, opening: { ...p.opening, photos: p.opening.photos.filter(x => x.id !== id) } }))
    savePhoto(id, false, null)
    savePhoto(id, true, null)
    setSelected(null)
  }

  function moveFront(id: string) {
    setProject(p => {
      const ph = p.opening.photos.find(x => x.id === id)!
      return { ...p, opening: { ...p.opening, photos: [ph, ...p.opening.photos.filter(x => x.id !== id)] } }
    })
  }

  const sel = op.photos.find(p => p.id === selected) ?? null
  const selIndex = sel ? op.photos.indexOf(sel) : -1

  return (
    <div className="space-y-6">
      <ScreenTitle step="04" en="OPENING" title="オープニング" sub="写真と言葉で、4秒の幕開けをつくります" />

      <Segmented<OpeningStyle> value={op.style} onChange={setStyle}
        options={[{ v: 'poster', label: 'ポスター（筆跡）' }, { v: 'tfc', label: '高柳FC' }]} />

      <div className="sticky top-0 z-10 -mx-5 px-5 pb-3 bg-ink">
        <canvas ref={canvasRef} className="w-full aspect-video rounded-xl bg-black border border-line" />
        <div className="mt-2 flex gap-2">
          <Button variant={playing ? 'secondary' : 'primary'} className="flex-1 min-h-11" onClick={() => setPlaying(v => !v)}>
            {playing ? <><IconStop />止める</> : <><IconPlay />動きを見る</>}
          </Button>
        </div>
      </div>

      <div>
        <GroupLabel>写真（{op.photos.length}/{MAX_PHOTOS}枚）</GroupLabel>
        <Card className="space-y-4">
          <div className="grid grid-cols-5 gap-2">
            {op.photos.map((ph, i) => {
              const im = images.find(x => x.photo.id === ph.id)
              return (
                <button key={ph.id} onClick={() => setSelected(ph.id === selected ? null : ph.id)}
                  className={`relative aspect-[3/4] rounded-lg overflow-hidden border-2 transition ${ph.id === selected ? 'border-cyan' : 'border-line'}`}
                  style={{ background: 'repeating-conic-gradient(#1c2436 0 25%, #121828 0 50%) 0 0 / 12px 12px' }}>
                  {im && <Thumb img={im.img} />}
                  {working.has(ph.id) && <span className="absolute inset-0 grid place-items-center bg-ink/60 text-[10px] font-bold">切り抜き中</span>}
                  {i === 0 && <span className="absolute left-0 top-0 px-1 rounded-br bg-cyan text-ink text-[10px] font-black">主役</span>}
                </button>
              )
            })}
            {op.photos.length < MAX_PHOTOS && (
              <FilePicker accept="image/*" onFiles={addPhotos} className="aspect-[3/4] rounded-lg border-2 border-dashed border-line text-muted flex-col !gap-1 text-[11px]">
                <IconPlus className="text-xl" />追加
              </FilePicker>
            )}
          </div>
          {op.photos.length === 0 && (
            <p className="text-xs text-muted leading-relaxed">写真を選ぶと、人物だけを自動で切り抜いて並べます。1枚目が主役（中央・一番手前）です。初回だけ切り抜きの準備に少し時間がかかります。</p>
          )}
          {notice && <p className="text-xs text-amber-200 bg-amber-400/10 border border-amber-400/30 rounded-xl p-3">{notice}</p>}

          {sel && (
            <div className="space-y-3 pt-3 border-t border-line">
              <Row label={`${selIndex + 1}枚目の写真`} hint={working.has(sel.id) ? '人物を切り抜いています…' : sel.cutout ? '人物だけを切り抜いて使う' : '四角い写真のまま使う'}>
                <Toggle label="人物を切り抜く" checked={sel.cutout} onChange={v => setPhoto(sel.id, { cutout: v })} />
              </Row>
              <Slider label="大きさ" display={`${Math.round(sel.scale * 100)}%`} min={0.5} max={1.6} step={0.02} value={sel.scale} onChange={v => setPhoto(sel.id, { scale: v })} />
              <Slider label="左右の位置" display={String(Math.round(sel.dx / 10))} min={-500} max={500} step={10} value={sel.dx} onChange={v => setPhoto(sel.id, { dx: v })} />
              <Slider label="上下の位置" display={String(Math.round(-sel.dy / 10))} min={-300} max={400} step={10} value={sel.dy} onChange={v => setPhoto(sel.id, { dy: v })} />
              <div className="grid grid-cols-3 gap-2">
                <Button className="min-h-11 text-sm" onClick={() => setPhoto(sel.id, { scale: 1, dx: 0, dy: 0 })}>元に戻す</Button>
                <Button className="min-h-11 text-sm" disabled={selIndex === 0} onClick={() => moveFront(sel.id)}><IconBack />主役にする</Button>
                <Button variant="danger" className="min-h-11 text-sm" onClick={() => removePhoto(sel.id)}><IconTrash />外す</Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      <div>
        <GroupLabel>文字</GroupLabel>
        <Card className="space-y-4">
          <Field label="メインの言葉（改行すると2〜3行。最後の行が大きくなります）">
            <textarea className={`${inputCls} h-auto py-2.5 leading-snug`} rows={3} value={op.main} placeholder="夢の続きへ。" onChange={e => setOp({ main: e.target.value })} />
          </Field>
          <Field label="上の小さな見出し">
            <input className={inputCls} value={op.top} placeholder="この一瞬の、その先へ" onChange={e => setOp({ top: e.target.value })} />
          </Field>
          <Field label="下の帯（空なら日付と対戦相手）">
            <input className={inputCls} value={op.bottom} placeholder={defaultBottom(project) || '2026.09.27  VS 〇〇FC'} onChange={e => setOp({ bottom: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="右下のボックス">
              <input className={inputCls} value={op.badge} placeholder="GOAL!" onChange={e => setOp({ badge: e.target.value })} />
            </Field>
            {op.style === 'poster' && (
              <Field label="右上の四角（空なら出さない）">
                <input className={inputCls} value={op.corner} placeholder="#10" onChange={e => setOp({ corner: e.target.value })} />
              </Field>
            )}
          </div>
        </Card>
      </div>

      <div>
        <GroupLabel>色（動画全体のテーマカラー）</GroupLabel>
        <Card className="space-y-4">
          {op.style === 'tfc' && (
            <div>
              <p className="text-xs text-muted mb-2">赤系</p>
              <div className="grid grid-cols-5 gap-2">
                {REDS.map(r => (
                  <button key={r.c} onClick={() => setProject(p => ({ ...p, color: r.c }))} className="flex flex-col items-center gap-1">
                    <span className={`w-full aspect-square rounded-full transition ${project.color === r.c ? 'ring-2 ring-offset-2 ring-offset-surface ring-fg scale-105' : ''}`} style={{ background: r.c }} />
                    <span className="text-[10px] text-muted">{r.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-8 gap-2">
            {COLORS.map(c => (
              <button key={c} onClick={() => setProject(p => ({ ...p, color: c }))} aria-label={`色 ${c}`}
                className={`aspect-square rounded-full transition ${project.color === c ? 'ring-2 ring-offset-2 ring-offset-surface ring-fg scale-110' : ''}`}
                style={{ background: c }} />
            ))}
          </div>
        </Card>
      </div>

      <Button variant="primary" className="w-full min-h-14 text-lg" onClick={() => go('export')}>次へ：書き出す</Button>
    </div>
  )
}

function Thumb({ img }: { img: ImageBitmap }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current!
    const k = Math.min(160 / img.width, 214 / img.height)
    c.width = Math.round(img.width * k)
    c.height = Math.round(img.height * k)
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  }, [img])
  return <canvas ref={ref} className="absolute inset-0 m-auto max-w-full max-h-full" />
}
