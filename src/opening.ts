import { loadPhoto } from './idb'
import type { OpeningPhoto, Project } from './types'
import { FONT, INK, OUT_H, OUT_W, clamp, drawGrain, drawSlash, ease, rnd, slanted, type Ctx } from './render'

export type OpeningImage = { photo: OpeningPhoto; img: ImageBitmap }

// 黒い画面の渦 → ポスターが開く瞬間
const REVEAL = 0.72
// メインの文字を叩きつける時刻（効果音もここに合わせる）
export const OPEN_SLAM = REVEAL + 0.5
const SLASH_SEC = 0.3
// 足元は下の帯の裏に隠れる位置。人物をなるべく大きく見せるため帯より下に置く
const FLOOR = 1060
const MAIN_Y = 230
const BAND_Y = 972

// 枚数ごとの並び（中心x・高さ）。先頭が主役で中央・最前面
const SLOTS: [number, number][][] = [
  [],
  [[960, 800]],
  [[770, 780], [1170, 780]],
  [[960, 800], [570, 700], [1350, 700]],
  [[790, 790], [1140, 790], [420, 680], [1510, 680]],
  [[960, 810], [630, 730], [1290, 730], [320, 650], [1600, 650]],
]

let crest: OffscreenCanvas | null = null

// 高柳FCのエンブレム（public/tfc-logo.png）。一度だけ読み込み、描画しやすい大きさにしておく
export async function ensureCrest() {
  if (crest) return
  try {
    const b = await (await fetch(new URL('tfc-logo.png', document.baseURI))).blob()
    const bmp = await createImageBitmap(b)
    const h = 760
    crest = new OffscreenCanvas(Math.round((bmp.width * h) / bmp.height), h)
    crest.getContext('2d')!.drawImage(bmp, 0, 0, crest.width, crest.height)
    bmp.close()
  } catch { /* 読めなくてもエンブレムなしで描く */ }
}

export async function loadOpeningImages(photos: OpeningPhoto[]): Promise<OpeningImage[]> {
  await ensureCrest()
  const out: OpeningImage[] = []
  for (const photo of photos) {
    const b = (photo.cutout && photo.hasCut ? await loadPhoto(photo.id, true) : null) ?? await loadPhoto(photo.id, false)
    if (b) out.push({ photo: { ...photo, cutout: photo.cutout && photo.hasCut }, img: await createImageBitmap(b) })
  }
  return out
}

const isDark = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  return 0.299 * r + 0.587 * g + 0.114 * b < 150
}

export function defaultBottom(p: Project) {
  return [p.date.replaceAll('-', '.'), p.opponent ? `VS ${p.opponent}` : ''].filter(Boolean).join('  ')
}

export function drawOpening(ctx: Ctx, p: Project, images: OpeningImage[], t: number, dur: number) {
  if (p.opening.style === 'tfc') return drawTfc(ctx, p, images, t, dur)
  const C = p.color
  const frame = Math.round(t * 30)
  const u = t - REVEAL

  if (u < 0) {
    ctx.fillStyle = INK
    ctx.fillRect(0, 0, OUT_W, OUT_H)
  } else {
    // 開いた直後は少し寄っていて、引きながら落ち着き、最後にまた少しずつ寄る
    const zoom = 1.08 - 0.08 * ease(clamp(u / 0.6, 0, 1)) + 0.025 * clamp((u - 0.6) / (dur - REVEAL), 0, 1)
    ctx.save()
    ctx.translate(OUT_W / 2, OUT_H / 2)
    ctx.scale(zoom, zoom)
    ctx.translate(-OUT_W / 2, -OUT_H / 2)
    drawPoster(ctx, p, images, u)
    ctx.restore()
    drawGrain(ctx, frame)
  }
  drawSwirl(ctx, C, t)
  if (u >= 0 && u < 0.12) flash(ctx, 0.7 * (1 - u / 0.12))
  const ds = t - OPEN_SLAM
  if (ds >= 0 && ds < 0.1) flash(ctx, 0.55 * (1 - ds / 0.1))
  if (dur - t < SLASH_SEC) drawSlash(ctx, C, -(dur - t) / SLASH_SEC, frame)
}

function flash(ctx: Ctx, a: number) {
  ctx.fillStyle = `rgba(255,255,255,${a})`
  ctx.fillRect(0, 0, OUT_W, OUT_H)
}

// 黒地に光の弧が走り、テーマカラーと黒の渦が画面を覆って、ポスターへ抜ける
function drawSwirl(ctx: Ctx, C: string, t: number) {
  if (t > REVEAL + 0.2) return
  const cx = OUT_W / 2, cy = OUT_H / 2
  ctx.save()
  if (t < REVEAL) {
    const k = ease(clamp(t / 0.55, 0, 1))
    const fade = 1 - clamp((t - 0.45) / 0.3, 0, 1)
    ctx.globalCompositeOperation = 'lighter'
    const r = 2600 - 1500 * k
    const x = cx - 900 + 900 * k, y = cy + 1900 - 1500 * k
    for (const [w, a] of [[60, 0.08], [22, 0.25], [6, 0.9]] as const) {
      ctx.lineWidth = w
      ctx.strokeStyle = `rgba(255,255,255,${a * fade})`
      ctx.beginPath()
      ctx.arc(x, y, r, Math.PI * 1.1, Math.PI * 1.75)
      ctx.stroke()
    }
    ctx.globalCompositeOperation = 'source-over'
  }
  const g = clamp((t - 0.3) / (REVEAL - 0.3), 0, 1)
  const out = clamp((t - REVEAL) / 0.2, 0, 1)
  if (g > 0) {
    const spin = t * 7
    // 抜けるときは一気に外へ広げ、ポスターの上に濁りを残さない
    const grow = ease(g) * 1.25 + out * out * 3
    ctx.globalAlpha = 1 - out
    for (let k = 0; k < 16; k++) {
      const a = k * 0.9 + spin * (1 - k * 0.03)
      ctx.lineWidth = 74 * grow
      ctx.strokeStyle = k % 3 === 2 ? INK : C
      ctx.beginPath()
      ctx.arc(cx, cy, (k + 1) * 78 * grow, a, a + Math.PI * (0.9 + 0.5 * ease(g)))
      ctx.stroke()
    }
  }
  ctx.restore()
}

let strokeLayer: OffscreenCanvas | null = null

// かすれた筆の跡を1本描く。毛先ごとに少しずつずらして、ところどころ途切れさせる
function brush(g: OffscreenCanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, width: number, seed: number, color: string) {
  const dx = x1 - x0, dy = y1 - y0
  const len = Math.hypot(dx, dy)
  const nx = -dy / len, ny = dx / len
  g.strokeStyle = color
  g.lineCap = 'round'
  const n = Math.round(width / 1.6)
  for (let i = 0; i < n; i++) {
    const off = (i / n - 0.5) * width
    // 芯は途切れず、縁ほどかすれて短くなる
    const edge = Math.abs(off) / (width / 2)
    const r = rnd(seed + i * 1.37)
    const endK = 1 - rnd(seed + i * 2.11) * (0.08 + 0.4 * edge)
    g.globalAlpha = 0.8 + r * 0.2
    g.lineWidth = 3 + rnd(seed + i * 3.3) * 5
    let k = r * (0.03 + 0.15 * edge)
    while (k < endK) {
      const k2 = Math.min(endK, k + (edge < 0.6 ? 1 : 0.1 + rnd(seed + i + k * 97) * 0.4))
      const bend = Math.sin(k * Math.PI) * width * 0.25
      const bend2 = Math.sin(k2 * Math.PI) * width * 0.25
      g.beginPath()
      g.moveTo(x0 + dx * k + nx * (off + bend), y0 + dy * k + ny * (off + bend))
      g.quadraticCurveTo(
        x0 + dx * (k + k2) / 2 + nx * (off + (bend + bend2) / 2), y0 + dy * (k + k2) / 2 + ny * (off + (bend + bend2) / 2),
        x0 + dx * k2 + nx * (off + bend2), y0 + dy * k2 + ny * (off + bend2))
      g.stroke()
      k = k2 + rnd(seed + i * 7 + k * 13) * 0.05
    }
  }
  g.globalAlpha = 1
}

function getStrokes() {
  if (strokeLayer) return strokeLayer
  strokeLayer = new OffscreenCanvas(OUT_W, OUT_H)
  const g = strokeLayer.getContext('2d')!
  brush(g, -100, 900, 2050, 150, 330, 11, INK)
  brush(g, 200, 1150, 1900, 520, 170, 29, INK)
  brush(g, 1150, -80, 2100, 380, 190, 47, INK)
  brush(g, -80, 520, 1100, 160, 60, 63, 'rgba(255,255,255,0.9)')
  g.fillStyle = INK
  for (let i = 0; i < 70; i++) {
    g.globalAlpha = 0.5 + rnd(i * 2.2) * 0.5
    g.beginPath()
    g.arc(rnd(i * 5.1) * OUT_W, rnd(i * 8.7) * OUT_H, 2 + rnd(i * 3.9) ** 3 * 16, 0, Math.PI * 2)
    g.fill()
  }
  g.globalAlpha = 1
  return strokeLayer
}

function drawPoster(ctx: Ctx, p: Project, images: OpeningImage[], u: number) {
  const C = p.color
  const dark = isDark(C)
  const op = p.opening
  ctx.fillStyle = C
  ctx.fillRect(0, 0, OUT_W, OUT_H)
  const v = ctx.createRadialGradient(OUT_W * 0.5, OUT_H * 0.45, OUT_H * 0.2, OUT_W * 0.5, OUT_H * 0.45, OUT_W * 0.75)
  v.addColorStop(0, 'rgba(255,255,255,0.18)')
  v.addColorStop(1, 'rgba(0,0,0,0.28)')
  ctx.fillStyle = v
  ctx.fillRect(0, 0, OUT_W, OUT_H)

  // 筆の跡：左下から右上へ塗り広げる
  const edge = -600 + ease(clamp(u / 0.45, 0, 1)) * (OUT_W + 1300)
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(-10, OUT_H + 10)
  ctx.lineTo(edge, OUT_H + 10)
  ctx.lineTo(edge + 600, -10)
  ctx.lineTo(-10, -10)
  ctx.closePath()
  ctx.clip()
  ctx.drawImage(getStrokes(), 0, 0)
  ctx.restore()

  drawPlayers(ctx, images, u, mainBottom(op.main))
  drawMain(ctx, op.main, u, dark)
  drawTop(ctx, op.top, u, C)
  drawBand(ctx, op.bottom || defaultBottom(p), op.badge, u, C, dark)
  drawCornerBox(ctx, op.corner, u)
}

const mainLines = (text: string) => text.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 3)
const mainBase = (n: number) => (n === 1 ? 190 : n === 2 ? 140 : 104)

// メインの文字の下端。人物の頭がここより上に出ないようにする（傾き・縁取り・叩きつけ後の寄りの分も見込む）
function mainBottom(text: string) {
  const lines = mainLines(text)
  if (!lines.length) return 130
  const base = mainBase(lines.length)
  const total = lines.reduce((a, _, i) => a + base * (i === lines.length - 1 && lines.length > 1 ? 1.2 : 1) * 1.02, 0)
  return MAIN_Y + (total / 2) * 1.07 + 60
}

function drawPlayers(ctx: Ctx, images: OpeningImage[], u: number, top: number) {
  const n = Math.min(images.length, 5)
  const slots = SLOTS[n]
  for (let i = n - 1; i >= 0; i--) {
    const { photo, img } = images[i]
    const [sx, sh] = slots[i]
    const k = ease(clamp((u - 0.08 - i * 0.07) / 0.32, 0, 1))
    if (k <= 0) continue
    const slide = (1 - k) * (i % 2 ? -260 : 260)
    // 頭が文字にかからないよう、はみ出す分だけ小さくする（足元の位置はそのまま）
    const room = FLOOR + photo.dy - top
    const h = Math.min(sh * photo.scale, photo.cutout ? room : (room - 40) / 0.86)
    if (h <= 40) continue
    ctx.save()
    ctx.globalAlpha = clamp(k * 1.6, 0, 1)
    ctx.shadowColor = 'rgba(0,0,0,0.45)'
    ctx.shadowBlur = 30
    ctx.shadowOffsetX = 14
    ctx.shadowOffsetY = 10
    if (photo.cutout) {
      const w = (h * img.width) / img.height
      ctx.drawImage(img, sx + photo.dx - w / 2 + slide, FLOOR + photo.dy - h, w, h)
    } else {
      const fh = h * 0.86, fw = fh * 0.66, s = fh * 0.12
      const x = sx + photo.dx - fw / 2 + slide
      const y = FLOOR + photo.dy - fh - 40
      const path = () => {
        ctx.beginPath()
        ctx.moveTo(x + s, y)
        ctx.lineTo(x + fw + s, y)
        ctx.lineTo(x + fw - s, y + fh)
        ctx.lineTo(x - s, y + fh)
        ctx.closePath()
      }
      ctx.fillStyle = '#fff'
      path()
      ctx.fill()
      ctx.shadowColor = 'transparent'
      ctx.save()
      path()
      ctx.clip()
      const cover = Math.max((fw + 2 * s) / img.width, fh / img.height)
      const iw = img.width * cover, ih = img.height * cover
      ctx.drawImage(img, x + fw / 2 - iw / 2, y + fh / 2 - ih / 2, iw, ih)
      ctx.restore()
      ctx.lineWidth = 10
      ctx.strokeStyle = '#fff'
      path()
      ctx.stroke()
    }
    ctx.restore()
  }
}

// メインの文字：太い斜体を叩きつけて止める。改行で最大3行、最後の行を大きく
function drawMain(ctx: Ctx, text: string, u: number, dark: boolean) {
  const lines = mainLines(text)
  if (!lines.length) return
  const ds = u - (OPEN_SLAM - REVEAL)
  if (ds < 0) return
  const k = ease(clamp(ds / 0.16, 0, 1))
  const scale = 1.7 - 0.7 * k + 0.02 * clamp(ds - 0.16, 0, 3)
  const shake = ds < 0.25 ? (rnd(Math.round(ds * 30)) - 0.5) * 18 * (1 - ds / 0.25) : 0
  const maxW = 1560
  const base = mainBase(lines.length)
  ctx.save()
  ctx.globalAlpha = clamp(k * 2, 0, 1)
  ctx.translate(960 + shake, MAIN_Y + shake * 0.5)
  ctx.rotate(-0.06)
  ctx.scale(scale, scale)
  ctx.transform(1, 0, -0.2, 1, 0, 0)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  const sizes = lines.map((l, i) => {
    const want = base * (i === lines.length - 1 && lines.length > 1 ? 1.2 : 1)
    ctx.font = `italic 900 ${want}px ${FONT}`
    return Math.min(want, (want * maxW) / Math.max(1, ctx.measureText(l).width))
  })
  let y = -sizes.reduce((a, b) => a + b * 1.02, 0) / 2
  lines.forEach((l, i) => {
    const size = sizes[i]
    y += size * 0.51
    ctx.font = `italic 900 ${size}px ${FONT}`
    ctx.lineWidth = size * 0.16
    ctx.strokeStyle = dark ? INK : '#fff'
    ctx.shadowColor = 'rgba(0,0,0,0.35)'
    ctx.shadowBlur = 20
    ctx.shadowOffsetY = 8
    ctx.strokeText(l, 0, y)
    ctx.shadowColor = 'transparent'
    ctx.fillStyle = dark ? '#fff' : INK
    ctx.fillText(l, 0, y)
    y += size * 0.51
  })
  ctx.restore()
}

function drawTop(ctx: Ctx, text: string, u: number, C: string) {
  if (!text) return
  const k = ease(clamp((u - 0.75) / 0.3, 0, 1))
  if (k <= 0) return
  ctx.save()
  ctx.globalAlpha = k
  ctx.font = `italic 800 40px ${FONT}`
  const w = ctx.measureText(text).width + 70
  const x = 110 - (1 - k) * 300, y = 44
  ctx.fillStyle = INK
  slanted(ctx, x, y, w, 62, 14)
  ctx.fillStyle = C
  slanted(ctx, x - 22, y, 12, 62, 14)
  ctx.fillStyle = '#fff'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + 34, y + 33)
  ctx.restore()
}

function drawBand(ctx: Ctx, text: string, badge: string, u: number, C: string, dark: boolean) {
  const k = ease(clamp((u - 0.3) / 0.3, 0, 1))
  if (k <= 0) return
  ctx.save()
  ctx.translate(0, (1 - k) * 140)
  ctx.fillStyle = INK
  ctx.fillRect(0, BAND_Y, OUT_W, OUT_H - BAND_Y)
  ctx.fillStyle = C
  ctx.fillRect(0, BAND_Y, OUT_W, 6)
  ctx.textBaseline = 'middle'
  const cy = BAND_Y + (OUT_H - BAND_Y) / 2 + 3
  if (text) {
    ctx.fillStyle = '#fff'
    ctx.font = `800 46px ${FONT}`
    ctx.fillText(text, 90, cy, badge ? 1250 : 1740)
  }
  if (badge) {
    const kb = ease(clamp((u - 0.95) / 0.2, 0, 1))
    ctx.font = `italic 900 50px ${FONT}`
    const bw = Math.min(560, ctx.measureText(badge).width + 110)
    ctx.save()
    ctx.translate(OUT_W - 90 - bw / 2, cy)
    ctx.scale(0.6 + 0.4 * kb, 0.6 + 0.4 * kb)
    ctx.globalAlpha = kb
    ctx.fillStyle = C
    slanted(ctx, -bw / 2, -36, bw, 72, 16)
    ctx.fillStyle = dark ? '#fff' : INK
    ctx.textAlign = 'center'
    ctx.fillText(badge, 0, 2, bw - 50)
    ctx.restore()
  }
  ctx.restore()
}

// 右上の四角いロゴ枠（チーム名の略称や背番号など）
function drawCornerBox(ctx: Ctx, text: string, u: number) {
  if (!text) return
  const k = clamp((u - 0.5) / 0.25, 0, 1)
  if (k <= 0) return
  const lines = text.split('\n').slice(0, 2)
  const s = 150, x = OUT_W - 60 - s, y = 44
  ctx.save()
  ctx.globalAlpha = k
  ctx.fillStyle = INK
  ctx.fillRect(x, y, s, s)
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const size = lines.length > 1 ? 44 : 58
  ctx.font = `900 ${size}px ${FONT}`
  lines.forEach((l, i) => ctx.fillText(l, x + s / 2, y + s / 2 + (i - (lines.length - 1) / 2) * size * 1.05, s - 20))
  ctx.restore()
}

// ---- 高柳FC版：黒地にエンブレムが光って現れ、赤白の縦縞ポスターへ ----

const CREST_END = 1.05
export const TFC_TIMES = { crest: 0.22, slam: CREST_END + 0.55 }

function drawTfc(ctx: Ctx, p: Project, images: OpeningImage[], t: number, dur: number) {
  const C = p.color
  const frame = Math.round(t * 30)
  const u = t - CREST_END
  if (u < 0) drawCrestIntro(ctx, C, t, frame)
  else {
    const zoom = 1.06 - 0.06 * ease(clamp(u / 0.5, 0, 1)) + 0.02 * clamp((u - 0.5) / (dur - CREST_END), 0, 1)
    ctx.save()
    ctx.translate(OUT_W / 2, OUT_H / 2)
    ctx.scale(zoom, zoom)
    ctx.translate(-OUT_W / 2, -OUT_H / 2)
    drawTfcPoster(ctx, p, images, u)
    ctx.restore()
    drawGrain(ctx, frame)
    // 黒い幕が左右に開いてポスターが見える
    if (u < 0.35) {
      const k = ease(u / 0.35)
      const half = OUT_W / 2
      ctx.fillStyle = INK
      ctx.fillRect(0, 0, half * (1 - k), OUT_H)
      ctx.fillRect(half + half * k, 0, half, OUT_H)
      ctx.fillStyle = C
      ctx.fillRect(half * (1 - k) - 24, 0, 24, OUT_H)
      ctx.fillRect(half + half * k, 0, 24, OUT_H)
    }
    if (u < 0.1) flash(ctx, 0.6 * (1 - u / 0.1))
  }
  const ds = t - TFC_TIMES.slam
  if (ds >= 0 && ds < 0.1) flash(ctx, 0.5 * (1 - ds / 0.1))
  if (dur - t < SLASH_SEC) drawSlash(ctx, C, -(dur - t) / SLASH_SEC, frame)
}

function rays(ctx: Ctx, cx: number, cy: number, frame: number, color: string, alpha: number, spin: number) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(spin)
  ctx.fillStyle = color
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2
    ctx.globalAlpha = alpha * (0.35 + rnd(i * 3.7 + Math.floor(frame / 3)) * 0.65)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(Math.cos(a - 0.05) * 1500, Math.sin(a - 0.05) * 1500)
    ctx.lineTo(Math.cos(a + 0.05) * 1500, Math.sin(a + 0.05) * 1500)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

let shineCanvas: OffscreenCanvas | null = null

// エンブレムに斜めの光を走らせる（エンブレムの形の内側だけ光る）。k: 0→1 で光が横切る
function drawCrestShine(ctx: Ctx, x: number, y: number, h: number, k: number) {
  if (!crest) return
  const w = (crest.width * h) / crest.height
  if (k <= 0 || k >= 1) { ctx.drawImage(crest, x, y, w, h); return }
  shineCanvas ??= new OffscreenCanvas(crest.width, crest.height)
  const g = shineCanvas.getContext('2d')!
  g.globalCompositeOperation = 'source-over'
  g.clearRect(0, 0, crest.width, crest.height)
  g.drawImage(crest, 0, 0)
  g.globalCompositeOperation = 'source-atop'
  const cx = -crest.width * 0.6 + k * crest.width * 2.2
  const grad = g.createLinearGradient(cx - 160, 0, cx + 160, crest.height * 0.4)
  grad.addColorStop(0, 'rgba(255,255,255,0)')
  grad.addColorStop(0.5, 'rgba(255,255,255,0.75)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, crest.width, crest.height)
  ctx.drawImage(shineCanvas, x, y, w, h)
}

function drawCrestIntro(ctx: Ctx, C: string, t: number, frame: number) {
  ctx.fillStyle = INK
  ctx.fillRect(0, 0, OUT_W, OUT_H)
  const t0 = TFC_TIMES.crest
  const glow = ctx.createRadialGradient(OUT_W / 2, OUT_H / 2, 0, OUT_W / 2, OUT_H / 2, 900)
  glow.addColorStop(0, C + (t < t0 ? '33' : 'aa'))
  glow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, OUT_W, OUT_H)
  if (t >= t0) rays(ctx, OUT_W / 2, OUT_H / 2, frame, C, 0.5 * clamp((t - t0) / 0.15, 0, 1), t * 0.4)
  if (!crest) return
  // 大きな状態から落ちてきて叩きつけ、少し跳ね返る
  const k = clamp(t / t0, 0, 1)
  const land = t < t0 ? 2.4 - 1.4 * k * k : 1 + 0.06 * Math.exp(-(t - t0) * 9) * Math.cos((t - t0) * 30)
  const out = clamp((t - (CREST_END - 0.2)) / 0.2, 0, 1)
  const h = 480 * land * (1 + out * 0.25)
  const w = (crest.width * h) / crest.height
  ctx.save()
  ctx.globalAlpha = (t < t0 ? k : 1) * (1 - out)
  ctx.shadowColor = 'rgba(0,0,0,0.6)'
  ctx.shadowBlur = 40
  ctx.shadowOffsetY = 16
  drawCrestShine(ctx, OUT_W / 2 - w / 2, OUT_H / 2 - h / 2, h, (t - 0.4) / 0.4)
  ctx.restore()
  if (t >= t0 && t < t0 + 0.1) flash(ctx, 0.8 * (1 - (t - t0) / 0.1))
}

function drawTfcPoster(ctx: Ctx, p: Project, images: OpeningImage[], u: number) {
  const C = p.color
  const op = p.opening
  ctx.fillStyle = C
  ctx.fillRect(0, 0, OUT_W, OUT_H)
  const v = ctx.createRadialGradient(OUT_W * 0.5, OUT_H * 0.4, OUT_H * 0.15, OUT_W * 0.5, OUT_H * 0.4, OUT_W * 0.7)
  v.addColorStop(0, 'rgba(255,255,255,0.14)')
  v.addColorStop(1, 'rgba(0,0,0,0.45)')
  ctx.fillStyle = v
  ctx.fillRect(0, 0, OUT_W, OUT_H)
  // エンブレムの赤・白・赤の縦縞を、斜めの太い白帯として背景に敷く
  const k = ease(clamp(u / 0.5, 0, 1))
  ctx.save()
  ctx.translate(OUT_W / 2, OUT_H / 2)
  ctx.transform(1, 0, -0.32, 1, 0, 0)
  const bw = 520, top = -OUT_H / 2 - 40, len = OUT_H + 80
  ctx.fillStyle = 'rgba(255,255,255,0.93)'
  ctx.fillRect(-bw / 2, top - (1 - k) * 1200, bw, len)
  ctx.fillStyle = INK
  ctx.fillRect(-bw / 2 - 34, top + (1 - k) * 1200, 14, len)
  ctx.fillRect(bw / 2 + 20, top + (1 - k) * 1200, 14, len)
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  for (let i = 0; i < 6; i++) ctx.fillRect(-900 + i * 330 + rnd(i) * 80, top, 6 + rnd(i * 2) * 10, len)
  ctx.restore()
  // 背景に大きく薄い TFC
  ctx.save()
  ctx.globalAlpha = 0.1 * k
  ctx.font = `900 560px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 6
  ctx.strokeStyle = '#fff'
  ctx.strokeText('TFC', OUT_W / 2 - 40 + u * 30, OUT_H / 2 + 80)
  ctx.restore()

  drawPlayers(ctx, images, u, mainBottom(op.main))
  // 叩きつけの時刻をポスター版とそろえた相対時間で渡す
  drawMain(ctx, op.main, u - (TFC_TIMES.slam - CREST_END) + (OPEN_SLAM - REVEAL), true)
  drawTop(ctx, op.top, u, C)
  drawBand(ctx, op.bottom || defaultBottom(p), op.badge, u, C, true)
  if (!crest) return
  const kc = ease(clamp((u - 0.35) / 0.3, 0, 1))
  if (kc <= 0) return
  ctx.save()
  ctx.globalAlpha = kc
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 24
  ctx.shadowOffsetY = 8
  const h = 190 * (1.3 - 0.3 * kc)
  drawCrestShine(ctx, OUT_W - 60 - (crest.width * h) / crest.height, 34, h, (u - 0.9) / 0.5)
  ctx.restore()
}
