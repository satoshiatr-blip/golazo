import {
  ALL_FORMATS, AudioBufferSource, AudioSampleSink, BlobSource, BufferTarget, CanvasSink, CanvasSource,
  Input, Mp4OutputFormat, Output, QUALITY_HIGH, canEncodeAudio, canEncodeVideo,
} from 'mediabunny'
import type { Player, Project, Scene, ZoomRect } from './types'
import { impact, riser, slowDown, whoosh } from './sfx'
import { OPEN_SLAM, drawOpening, type OpeningImage } from './opening'

export const OUT_W = 1920
export const OUT_H = 1080
export const FPS = 30
export const SLOW_RATE = 0.5
export const OPEN_SEC = 4
const CLOSE_SEC = 3
const SAMPLE_RATE = 48000
export const FONT = '-apple-system, "Hiragino Sans", "Hiragino Kaku Gothic ProN", sans-serif'

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
export const ease = (u: number) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2)

// ---- シーンの時間計算（元動画の秒 ⇔ 出力の秒） ----

export function slowRange(s: Scene): [number, number] | null {
  if (!s.slow) return null
  const a = clamp(s.slowAt, s.start, s.end)
  const b = clamp(s.slowAt + s.slowLen, s.start, s.end)
  return b - a > 0.05 ? [a, b] : null
}

export function sceneOutDuration(s: Scene) {
  const r = slowRange(s)
  const len = s.end - s.start
  return r ? len + (r[1] - r[0]) * (1 / SLOW_RATE - 1) : len
}

export function srcTimeAt(s: Scene, tOut: number) {
  const r = slowRange(s)
  if (!r) return s.start + tOut
  const a = r[0] - s.start
  const slowOut = (r[1] - r[0]) / SLOW_RATE
  if (tOut < a) return s.start + tOut
  if (tOut < a + slowOut) return r[0] + (tOut - a) * SLOW_RATE
  return r[1] + (tOut - a - slowOut)
}

export function outTimeAt(s: Scene, src: number) {
  const r = slowRange(s)
  if (!r || src < r[0]) return src - s.start
  const a = r[0] - s.start
  if (src < r[1]) return a + (src - r[0]) / SLOW_RATE
  return a + (r[1] - r[0]) / SLOW_RATE + (src - r[1])
}

export const isSlowAt = (s: Scene, src: number) => {
  const r = slowRange(s)
  return !!r && src >= r[0] && src < r[1]
}

export function zoomAt(s: Scene, u: number): ZoomRect {
  const k = ease(clamp(u, 0, 1))
  return {
    cx: s.zoomFrom.cx + (s.zoomTo.cx - s.zoomFrom.cx) * k,
    cy: s.zoomFrom.cy + (s.zoomTo.cy - s.zoomFrom.cy) * k,
    scale: s.zoomFrom.scale + (s.zoomTo.scale - s.zoomFrom.scale) * k,
  }
}

export function cropRect(z: ZoomRect, w: number, h: number) {
  const sw = w / z.scale
  const sh = h / z.scale
  const sx = clamp(z.cx * w - sw / 2, 0, w - sw)
  const sy = clamp(z.cy * h - sh / 2, 0, h - sh)
  return { sx, sy, sw, sh }
}

// ---- 描画（座標は常に 1920x1080 基準。プレビューは setTransform で縮小） ----

export type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

export type DrawInfo = { project: Project; scene: Scene; player: Player | null; tOut: number; dur: number; src: number }

export const INK = '#04060c'
// 差し色はテーマカラーに合わせる（描画関数の入口で設定）
let CYAN = '#ffd400'
const SLASH_SEC = 0.3
const KIND_BIG: Record<Scene['kind'], string> = { goal: 'GOAL', save: 'SAVE', play: 'NICE PLAY' }

// フレーム番号から決まる疑似乱数（プレビューと書き出しで同じ揺れにする）
export const rnd = (n: number) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x) }

let grain: CanvasPattern | null = null
function grainPattern(ctx: Ctx) {
  if (grain) return grain
  const c = new OffscreenCanvas(256, 256)
  const g = c.getContext('2d')!
  const d = g.createImageData(256, 256)
  for (let i = 0; i < d.data.length; i += 4) {
    const v = Math.random() * 255
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v
    d.data[i + 3] = 255
  }
  g.putImageData(d, 0, 0)
  grain = ctx.createPattern(c, 'repeat')
  return grain
}

export function drawScene(ctx: Ctx, img: CanvasImageSource, w: number, h: number, info: DrawInfo) {
  const { project, scene, tOut, dur, src } = info
  const accent = project.color
  CYAN = accent
  const frame = Math.round(tOut * FPS)
  const dt = tOut - outTimeAt(scene, scene.mark)
  const z = zoomAt(scene, tOut / dur)
  const punch = dt >= 0 ? 1 + 0.07 * Math.exp(-dt * 5) : 1
  const { sx, sy, sw, sh } = cropRect({ ...z, scale: z.scale * punch }, w, h)

  ctx.save()
  if (project.grade && 'filter' in ctx) ctx.filter = 'contrast(1.18) saturate(1.1)'
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, OUT_W, OUT_H)
  if ('filter' in ctx) ctx.filter = 'none'
  ctx.restore()

  if (project.grade) {
    ctx.save()
    ctx.globalCompositeOperation = 'soft-light'
    ctx.fillStyle = 'rgba(20,60,160,0.45)'
    ctx.fillRect(0, 0, OUT_W, OUT_H)
    ctx.restore()
  }
  const slow = isSlowAt(scene, src)
  if (slow) {
    ctx.save()
    ctx.globalCompositeOperation = 'saturation'
    ctx.fillStyle = 'rgba(128,128,128,0.35)'
    ctx.fillRect(0, 0, OUT_W, OUT_H)
    ctx.restore()
  }
  drawVignette(ctx, slow ? 0.6 : 0.45)
  drawGrain(ctx, frame)
  if (slow) drawSlowFx(ctx, scene, src, frame)
  drawCorner(ctx, project)
  drawPlate(ctx, info, accent)
  if (dt >= 0 && dt < 1.7) drawSlam(ctx, KIND_BIG[scene.kind], dt, accent)
  if (dt >= 0 && dt < 0.1) {
    ctx.fillStyle = `rgba(255,255,255,${0.75 * (1 - dt / 0.1)})`
    ctx.fillRect(0, 0, OUT_W, OUT_H)
  }
  if (tOut < SLASH_SEC) drawSlash(ctx, accent, tOut / SLASH_SEC, frame)
  else if (dur - tOut < SLASH_SEC) drawSlash(ctx, accent, -(dur - tOut) / SLASH_SEC, frame)
}

function drawVignette(ctx: Ctx, strength: number) {
  const g = ctx.createRadialGradient(OUT_W / 2, OUT_H / 2, OUT_H * 0.35, OUT_W / 2, OUT_H / 2, OUT_H * 1.0)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, `rgba(0,0,8,${strength})`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, OUT_W, OUT_H)
}

export function drawGrain(ctx: Ctx, frame: number) {
  ctx.save()
  ctx.globalAlpha = 0.07
  ctx.globalCompositeOperation = 'overlay'
  ctx.translate(-rnd(frame) * 256, -rnd(frame + 3) * 256)
  ctx.fillStyle = grainPattern(ctx)!
  ctx.fillRect(0, 0, OUT_W + 256, OUT_H + 256)
  ctx.restore()
}

function speedLines(ctx: Ctx, cx: number, cy: number, frame: number, count: number, inner: number, color: string, alpha: number) {
  ctx.save()
  ctx.strokeStyle = color
  for (let i = 0; i < count; i++) {
    const a = rnd(i * 3.1 + Math.floor(frame / 2) * 0.37) * Math.PI * 2
    const r0 = inner + rnd(i + frame) * 200
    ctx.globalAlpha = alpha * (0.4 + rnd(i * 1.7) * 0.6)
    ctx.lineWidth = 2 + rnd(i * 5.3) * 6
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0)
    ctx.lineTo(cx + Math.cos(a) * 2400, cy + Math.sin(a) * 2400)
    ctx.stroke()
  }
  ctx.restore()
}

function drawSlowFx(ctx: Ctx, scene: Scene, src: number, frame: number) {
  const r = slowRange(scene)!
  const k = ease(clamp((src - r[0]) / 0.15, 0, 1)) * ease(clamp((r[1] - src) / 0.15, 0, 1))
  speedLines(ctx, OUT_W / 2, OUT_H / 2, frame, 40, 820, '#ffffff', 0.18 * k)
  const bar = 120 * k
  ctx.fillStyle = INK
  ctx.fillRect(0, 0, OUT_W, bar)
  ctx.fillRect(0, OUT_H - bar, OUT_W, bar)
  if (k < 0.5) return
  ctx.save()
  ctx.globalAlpha = (k - 0.5) * 2
  ctx.fillStyle = CYAN
  ctx.fillRect(70, 52, 8, 34)
  ctx.font = `italic 800 32px ${FONT}`
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#fff'
  const x = spaced(ctx, 'SLOW MOTION', 96, 70, 6)
  ctx.fillStyle = CYAN
  ctx.fillText('×0.5', x + 18, 70)
  ctx.restore()
}

function spaced(ctx: Ctx, text: string, x: number, y: number, gap: number) {
  for (const ch of text) {
    ctx.fillText(ch, x, y)
    x += ctx.measureText(ch).width + gap
  }
  return x
}

function drawCorner(ctx: Ctx, p: Project) {
  if (!p.title && !p.opponent) return
  ctx.save()
  ctx.textBaseline = 'middle'
  const x = OUT_W - 70, y = OUT_H - 70
  ctx.textAlign = 'right'
  ctx.globalAlpha = 0.85
  ctx.fillStyle = '#fff'
  ctx.font = `700 26px ${FONT}`
  ctx.fillText(p.title, x, y - 34)
  ctx.fillStyle = CYAN
  ctx.font = `italic 800 26px ${FONT}`
  if (p.opponent) ctx.fillText(`VS ${p.opponent}`, x, y)
  ctx.fillStyle = CYAN
  ctx.fillRect(x + 16, y - 50, 5, 66)
  ctx.restore()
}

// 左下の選手プレート：大きな背番号＋黒い斜めの板に名前
function drawPlate(ctx: Ctx, { scene, player, tOut, dur }: DrawInfo, accent: string) {
  const inT = 0.45
  if (tOut < inT) return
  const k = ease(clamp((tOut - inT) / 0.35, 0, 1))
  const alpha = clamp((dur - SLASH_SEC - tOut) / 0.25, 0, 1)
  if (alpha <= 0) return
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(-(1 - k) * 900, 0)
  const base = OUT_H - 120
  const x = 80
  let nx = x
  ctx.textBaseline = 'alphabetic'
  if (player?.number) {
    ctx.save()
    ctx.translate(x, base + 20)
    ctx.transform(1, 0, -0.22, 1, 0, 0)
    ctx.font = `italic 900 190px ${FONT}`
    const num = player.number.padStart(2, '0')
    ctx.lineWidth = 5
    ctx.strokeStyle = CYAN
    ctx.shadowColor = accent
    ctx.shadowBlur = 24
    ctx.strokeText(num, 0, 0)
    ctx.shadowBlur = 0
    ctx.fillStyle = 'rgba(255,212,0,0.12)'
    ctx.fillText(num, 0, 0)
    nx = x + ctx.measureText(num).width + 10
    ctx.restore()
  }
  const label = { goal: 'GOAL', save: 'NICE SAVE', play: 'NICE PLAY' }[scene.kind]
  ctx.font = `800 64px ${FONT}`
  const name = player?.name ?? ''
  const pw = Math.max(ctx.measureText(name).width + 110, 360)
  const py = base - 96
  ctx.fillStyle = 'rgba(4,6,12,0.88)'
  slanted(ctx, nx, py, pw, 100, 26)
  ctx.save()
  ctx.shadowColor = accent
  ctx.shadowBlur = 18
  ctx.fillStyle = CYAN
  slanted(ctx, nx - 6, py + 100, pw + 6, 7, 2)
  ctx.restore()
  ctx.fillStyle = accent
  slanted(ctx, nx + 18, py - 46, 250, 42, 11)
  ctx.fillStyle = '#fff'
  ctx.font = `italic 900 30px ${FONT}`
  ctx.textBaseline = 'middle'
  spaced(ctx, label, nx + 40, py - 24, 4)
  if (name) {
    ctx.font = `800 64px ${FONT}`
    ctx.fillStyle = '#fff'
    ctx.fillText(name, nx + 50, py + 52)
  }
  ctx.restore()
}

// 決定的瞬間に叩きつけるワード（RGBずれ→収束）
// 決定的瞬間に叩きつけるワード（単色＋差し色1本のミニマル構成。海外ハイライトのロワーサード傾向に合わせグリッチ二重像は廃止）
function drawSlam(ctx: Ctx, word: string, dt: number, accent: string) {
  const inK = ease(clamp(dt / 0.14, 0, 1))
  const out = clamp((1.7 - dt) / 0.35, 0, 1)
  const scale = 1.5 - 0.5 * inK
  ctx.save()
  ctx.globalAlpha = out
  // 中央だと選手が隠れるので右上（空・背景側）に置く。ポップイン時の1.5倍スケールでも上端が切れない余白を確保
  ctx.translate(OUT_W - 90, 260)
  ctx.rotate(-0.04)
  ctx.scale(scale, scale)
  ctx.transform(1, 0, -0.16, 1, 0, 0)
  ctx.font = `italic 900 ${word.length > 5 ? 120 : 160}px ${FONT}`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 14
  ctx.strokeStyle = INK
  ctx.shadowColor = accent
  ctx.shadowBlur = 32
  ctx.strokeText(word, 0, 0)
  ctx.shadowBlur = 0
  ctx.fillStyle = '#fff'
  ctx.fillText(word, 0, 0)
  // 差し色の細い一本線（海外の最小構成ロワーサードに寄せたアクセント）
  const w = ctx.measureText(word).width
  ctx.fillStyle = accent
  ctx.fillRect(-w - 4, 28, w + 4, 6)
  ctx.restore()
}

// 場面転換：ギザギザの黒い斬撃がシアンの光をまとって横切る。p: -1→0 で覆い、0→1 で抜ける
export function drawSlash(ctx: Ctx, accent: string, p: number, frame: number) {
  const span = OUT_W + 1100
  ctx.save()
  ctx.translate(p * span, 0)
  const path = (x0: number, x1: number) => {
    ctx.beginPath()
    ctx.moveTo(x0 + 550, 0)
    ctx.lineTo(x1 + 550, 0)
    const n = 9
    for (let i = 1; i <= n; i++) ctx.lineTo(x1 + 550 - (550 * i) / n + (i % 2 ? 40 : -40), (OUT_H * i) / n)
    ctx.lineTo(x0, OUT_H)
    for (let i = n - 1; i >= 1; i--) ctx.lineTo(x0 + (550 * (n - i)) / n + (i % 2 ? -40 : 40), (OUT_H * i) / n)
    ctx.closePath()
  }
  ctx.fillStyle = INK
  path(-550, OUT_W + 550)
  ctx.fill()
  ctx.shadowColor = accent
  ctx.shadowBlur = 30
  ctx.strokeStyle = CYAN
  ctx.lineWidth = 8
  ctx.stroke()
  ctx.shadowBlur = 0
  speedLines(ctx, OUT_W / 2, OUT_H / 2, frame, 24, 300, accent, 0.35)
  ctx.restore()
  if (Math.abs(p) < 0.12) {
    ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - Math.abs(p) / 0.12)})`
    ctx.fillRect(0, 0, OUT_W, OUT_H)
  }
}

export function slanted(ctx: Ctx, x: number, y: number, w: number, h: number, s: number) {
  ctx.beginPath()
  ctx.moveTo(x + s, y)
  ctx.lineTo(x + w + s, y)
  ctx.lineTo(x + w - s, y + h)
  ctx.lineTo(x - s, y + h)
  ctx.closePath()
  ctx.fill()
}

function glitchText(ctx: Ctx, text: string, x: number, y: number, split: number, accent: string) {
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.fillStyle = 'rgba(255,0,90,0.65)'
  ctx.fillText(text, x + split, y)
  ctx.fillStyle = 'rgba(0,200,255,0.75)'
  ctx.fillText(text, x - split, y)
  ctx.restore()
  ctx.save()
  ctx.shadowColor = accent
  ctx.shadowBlur = 30
  ctx.fillStyle = '#fff'
  ctx.fillText(text, x, y)
  ctx.restore()
}

export function drawCard(ctx: Ctx, p: Project, kind: 'open' | 'close', t: number, dur: number) {
  const accent = p.color
  CYAN = accent
  const frame = Math.round(t * FPS)
  ctx.fillStyle = INK
  ctx.fillRect(0, 0, OUT_W, OUT_H)
  const glow = ctx.createRadialGradient(OUT_W / 2, OUT_H / 2, 0, OUT_W / 2, OUT_H / 2, OUT_W * 0.6)
  glow.addColorStop(0, `${accent}8c`)
  glow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, OUT_W, OUT_H)
  speedLines(ctx, OUT_W / 2, OUT_H / 2, frame, 70, 380, accent, 0.5)

  ctx.save()
  ctx.translate(OUT_W / 2, OUT_H / 2)
  ctx.rotate(-0.12)
  ctx.font = `italic 900 330px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.globalAlpha = 0.1
  ctx.lineWidth = 3
  ctx.strokeStyle = CYAN
  ctx.strokeText(kind === 'open' ? 'HIGHLIGHTS' : 'NEXT STAGE', 60 - t * 40, 20)
  ctx.restore()

  const k = ease(clamp((t - 0.15) / 0.25, 0, 1))
  const split = 22 * (1 - k) + (rnd(frame) < 0.15 ? 14 : 2)
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.globalAlpha = k
  ctx.fillStyle = CYAN
  ctx.font = `italic 800 38px ${FONT}`
  const top = kind === 'open' ? 'MATCH  HIGHLIGHTS' : 'TO  BE  CONTINUED'
  ctx.fillText(top.split('').join(' '), OUT_W / 2, OUT_H / 2 - 190)

  ctx.save()
  ctx.translate(OUT_W / 2, OUT_H / 2 - 40)
  ctx.scale(1.35 - 0.35 * k, 1.35 - 0.35 * k)
  ctx.transform(1, 0, -0.18, 1, 0, 0)
  const main = kind === 'open' ? (p.title || 'HIGHLIGHTS') : (p.team || 'HIGHLIGHTS')
  ctx.font = `italic 900 ${main.length > 10 ? 110 : 140}px ${FONT}`
  glitchText(ctx, main, 0, 0, split, accent)
  ctx.restore()

  const sub = kind === 'open' ? [p.team, p.opponent].filter(Boolean).join('   VS   ') : ''
  const k2 = ease(clamp((t - 0.5) / 0.3, 0, 1))
  if (sub) {
    ctx.font = `italic 900 52px ${FONT}`
    const sw = ctx.measureText(sub).width + 120
    ctx.globalAlpha = k2
    ctx.fillStyle = '#fff'
    slanted(ctx, OUT_W / 2 - sw / 2 + (1 - k2) * 200, OUT_H / 2 + 80, sw, 80, 20)
    ctx.fillStyle = INK
    ctx.fillText(sub, OUT_W / 2 + (1 - k2) * 200, OUT_H / 2 + 122)
  }
  if (p.date) {
    ctx.globalAlpha = k2 * 0.85
    ctx.fillStyle = '#fff'
    ctx.font = `600 34px ${FONT}`
    ctx.fillText(p.date.replaceAll('-', '.'), OUT_W / 2, OUT_H / 2 + (sub ? 220 : 110))
  }
  ctx.restore()

  drawGrain(ctx, frame)
  if (t < 0.08) {
    ctx.fillStyle = `rgba(255,255,255,${1 - t / 0.08})`
    ctx.fillRect(0, 0, OUT_W, OUT_H)
  }
  if (kind === 'open' && dur - t < SLASH_SEC) drawSlash(ctx, accent, -(dur - t) / SLASH_SEC, frame)
  if (kind === 'close') {
    if (t < SLASH_SEC) drawSlash(ctx, accent, t / SLASH_SEC, frame)
    if (dur - t < 0.6) {
      ctx.fillStyle = `rgba(0,0,0,${1 - (dur - t) / 0.6})`
      ctx.fillRect(0, 0, OUT_W, OUT_H)
    }
  }
}

// ---- 書き出し ----

let aacReady: Promise<void> | null = null
// Safari が AAC を書き出せない場合だけ WASM 版エンコーダを読み込む
export function ensureAac() {
  aacReady ??= (async () => {
    if (await canEncodeAudio('aac', { numberOfChannels: 2, sampleRate: SAMPLE_RATE })) return
    const { registerAacEncoder } = await import('@mediabunny/aac-encoder')
    registerAacEncoder()
  })()
  return aacReady
}

export function totalDuration(scenes: Scene[]) {
  return OPEN_SEC + CLOSE_SEC + scenes.reduce((a, s) => a + sceneOutDuration(s), 0)
}

type ExportOpts = {
  project: Project
  files: Map<string, File>
  bgm: File | null
  openingImages: OpeningImage[]
  onProgress: (p: number, label: string) => void
  signal: AbortSignal
}

export async function exportHighlight({ project, files, bgm, openingImages, onProgress, signal }: ExportOpts): Promise<File> {
  const scenes = project.scenes
  const inputs = new Map<string, Input>()
  const getInput = (key: string) => {
    let inp = inputs.get(key)
    if (!inp) {
      const f = files.get(key)
      if (!f) throw new Error('動画ファイルが読み込まれていません')
      inp = new Input({ source: new BlobSource(f), formats: ALL_FORMATS })
      inputs.set(key, inp)
    }
    return inp
  }

  try {
    if (!(await canEncodeVideo('avc', { width: OUT_W, height: OUT_H })))
      throw new Error('この端末のブラウザは動画の書き出し（H.264）に対応していません。iOSを最新にしてお試しください')
    await ensureAac()
    const total = totalDuration(scenes)
    onProgress(0, '音声を準備中')
    const audio = await renderAudio(project, getInput, bgm, total)

    const canvas = new OffscreenCanvas(OUT_W, OUT_H)
    const ctx = canvas.getContext('2d')!
    const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() })
    const video = new CanvasSource(canvas, { codec: 'avc', bitrate: QUALITY_HIGH })
    output.addVideoTrack(video, { frameRate: FPS })
    const audioSrc = new AudioBufferSource({ codec: 'aac', bitrate: QUALITY_HIGH })
    output.addAudioTrack(audioSrc)
    await output.start()

    const totalFrames = Math.round(total * FPS)
    let frame = 0
    const emit = async () => {
      if (signal.aborted) throw new DOMException('中止しました', 'AbortError')
      await video.add(frame / FPS, 1 / FPS)
      frame++
      if (frame % 10 === 0) onProgress(frame / totalFrames, `映像を書き出し中 ${Math.round((frame / totalFrames) * 100)}%`)
    }

    for (let i = 0; i < OPEN_SEC * FPS; i++) {
      drawOpening(ctx, project, openingImages, i / FPS, OPEN_SEC)
      await emit()
    }
    const sinks = new Map<string, CanvasSink>()
    for (const scene of scenes) {
      const vTrack = await getInput(scene.sourceKey).getPrimaryVideoTrack()
      if (!vTrack) throw new Error('映像トラックがありません')
      let sink = sinks.get(scene.sourceKey)
      if (!sink) {
        sink = new CanvasSink(vTrack, { poolSize: 2 })
        sinks.set(scene.sourceKey, sink)
      }
      const w = await vTrack.getDisplayWidth()
      const h = await vTrack.getDisplayHeight()
      const dur = sceneOutDuration(scene)
      const n = Math.round(dur * FPS)
      const times = Array.from({ length: n }, (_, k) => srcTimeAt(scene, k / FPS))
      const player = project.players.find(p => p.id === scene.playerId) ?? null
      let k = 0
      for await (const wc of sink.canvasesAtTimestamps(times)) {
        if (wc) drawScene(ctx, wc.canvas, w, h, { project, scene, player, tOut: k / FPS, dur, src: times[k] })
        await emit()
        k++
      }
    }
    for (let i = 0; i < CLOSE_SEC * FPS; i++) {
      drawCard(ctx, project, 'close', i / FPS, CLOSE_SEC)
      await emit()
    }

    onProgress(1, '仕上げ中')
    await audioSrc.add(audio)
    await output.finalize()
    const buf = (output.target as BufferTarget).buffer!
    const name = `${project.date}_${project.opponent || 'highlight'}.mp4`.replace(/[\\/:*?"<>|\s]/g, '_')
    return new File([buf], name, { type: 'video/mp4' })
  } finally {
    inputs.forEach(i => i.dispose())
  }
}

async function renderAudio(project: Project, getInput: (k: string) => Input, bgm: File | null, total: number) {
  const ac = new OfflineAudioContext(2, Math.ceil(total * SAMPLE_RATE), SAMPLE_RATE)
  // 効果音・試合音・BGMを重ねても割れないよう、最後にコンプレッサーを通す
  const master = ac.createDynamicsCompressor()
  master.threshold.value = -10
  master.ratio.value = 6
  master.attack.value = 0.001
  const trim = ac.createGain()
  trim.gain.value = 0.85
  // 立ち上がりの速い「ドン」はコンプが追いつかないので柔らかく頭打ちにする。AAC化での行き過ぎ分の余白も残す
  const clip = ac.createWaveShaper()
  clip.curve = Float32Array.from({ length: 2048 }, (_, i) => Math.tanh(((i / 2047) * 2 - 1) * 1.5) / Math.tanh(1.5) * 0.89)
  master.connect(trim).connect(clip).connect(ac.destination)
  let t = OPEN_SEC
  for (const scene of project.scenes) {
    const aTrack = await getInput(scene.sourceKey).getPrimaryAudioTrack()
    const dur = sceneOutDuration(scene)
    if (aTrack) {
      const buf = await readAudio(ac, aTrack, scene.start, scene.end)
      const r = slowRange(scene)
      const parts: [number, number][] = r ? [[scene.start, r[0]], [r[1], scene.end]] : [[scene.start, scene.end]]
      for (const [a, b] of parts) {
        if (b - a < 0.05) continue
        const node = ac.createBufferSource()
        node.buffer = buf
        const gain = ac.createGain()
        const when = t + outTimeAt(scene, a)
        const len = b - a
        const f = Math.min(0.15, len / 3)
        gain.gain.setValueAtTime(0, when)
        gain.gain.linearRampToValueAtTime(project.gameVolume, when + f)
        gain.gain.setValueAtTime(project.gameVolume, when + len - f)
        gain.gain.linearRampToValueAtTime(0, when + len)
        node.connect(gain).connect(master)
        node.start(when, a - scene.start, len)
      }
    }
    t += dur
  }
  if (bgm) {
    const music = await ac.decodeAudioData(await bgm.arrayBuffer())
    const node = ac.createBufferSource()
    node.buffer = music
    node.loop = true
    const gain = ac.createGain()
    const v = project.bgmVolume
    gain.gain.setValueAtTime(0, 0)
    gain.gain.linearRampToValueAtTime(v, 1)
    gain.gain.setValueAtTime(v, Math.max(1, total - 2.5))
    gain.gain.linearRampToValueAtTime(0, total)
    node.connect(gain).connect(master)
    node.start(0, Math.min(project.bgmStart, Math.max(0, music.duration - 1)))
  }
  if (project.sfx) scheduleSfx(ac, master, project, total)
  return ac.startRendering()
}

function scheduleSfx(ac: BaseAudioContext, dest: AudioNode, project: Project, total: number) {
  const out = ac.createGain()
  out.gain.value = project.sfxVolume
  out.connect(dest)
  whoosh(ac, out, 0.35, 0.8)
  impact(ac, out, OPEN_SLAM, 0.9)
  riser(ac, out, 2.2, OPEN_SEC)
  let t = OPEN_SEC
  for (const scene of project.scenes) {
    whoosh(ac, out, t)
    const r = slowRange(scene)
    if (r) slowDown(ac, out, t + outTimeAt(scene, r[0]), 0.8)
    if (scene.mark > scene.start && scene.mark < scene.end) impact(ac, out, t + outTimeAt(scene, scene.mark))
    t += sceneOutDuration(scene)
  }
  whoosh(ac, out, t)
  impact(ac, out, Math.min(total - 0.5, t + 0.15), 0.7)
}

async function readAudio(ac: BaseAudioContext, track: NonNullable<Awaited<ReturnType<Input['getPrimaryAudioTrack']>>>, start: number, end: number) {
  const sr = await track.getSampleRate()
  const out = ac.createBuffer(2, Math.max(1, Math.ceil((end - start) * sr)), sr)
  const L = out.getChannelData(0)
  const R = out.getChannelData(1)
  const sink = new AudioSampleSink(track)
  for await (const s of sink.samples(start, end)) {
    const b = s.toAudioBuffer()
    const offset = Math.round((s.timestamp - start) * sr)
    const l = b.getChannelData(0)
    const r = b.numberOfChannels > 1 ? b.getChannelData(1) : l
    for (let i = 0; i < l.length; i++) {
      const j = offset + i
      if (j >= 0 && j < L.length) { L[j] = l[i]; R[j] = r[i] }
    }
    s.close()
  }
  return out
}
