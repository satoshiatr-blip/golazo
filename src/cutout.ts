import type { ImageSegmenter } from '@mediapipe/tasks-vision'

const MAX_SIDE = 1600

let segmenter: Promise<ImageSegmenter> | null = null

// 人物切り抜きのモデル（約16MB）とWASMはアプリに同梱。写真は端末の外へ出さない
function getSegmenter() {
  segmenter ??= (async () => {
    const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision')
    const base = new URL('mediapipe/', document.baseURI).href
    const fileset = await FilesetResolver.forVisionTasks(base)
    return ImageSegmenter.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: base + 'selfie_multiclass.tflite', delegate: 'CPU' },
      runningMode: 'IMAGE',
      outputConfidenceMasks: true,
      outputCategoryMask: false,
    })
  })()
  segmenter.catch(() => { segmenter = null })
  return segmenter
}

const toBlob = (c: HTMLCanvasElement, type: string, q?: number) =>
  new Promise<Blob>((resolve, reject) => c.toBlob(b => (b ? resolve(b) : reject(new Error('画像を作れませんでした'))), type, q))

// 大きすぎる写真は縮めて JPEG にしておく（保存容量と処理時間のため）
export async function shrinkPhoto(file: Blob) {
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * k)
  c.height = Math.round(bmp.height * k)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  bmp.close()
  return toBlob(c, 'image/jpeg', 0.9)
}

// 背景を透明にした PNG を返す。人物の周りだけに切り詰める
export async function cutoutPerson(photo: Blob) {
  const seg = await getSegmenter()
  const bmp = await createImageBitmap(photo)
  const c = document.createElement('canvas')
  c.width = bmp.width
  c.height = bmp.height
  const g = c.getContext('2d')!
  g.drawImage(bmp, 0, 0)
  bmp.close()

  const res = seg.segment(c)
  const bg = res.confidenceMasks![0]
  const mw = bg.width, mh = bg.height
  const conf = bg.getAsFloat32Array()
  const m = document.createElement('canvas')
  m.width = mw
  m.height = mh
  const mg = m.getContext('2d')!
  const data = mg.createImageData(mw, mh)
  for (let i = 0; i < conf.length; i++) {
    // 背景らしさ 0.35〜0.65 の境目をなめらかに（輪郭のギザギザを抑える）
    const u = Math.min(1, Math.max(0, (0.65 - conf[i]) / 0.3))
    data.data[i * 4 + 3] = Math.round(u * u * (3 - 2 * u) * 255)
  }
  mg.putImageData(data, 0, 0)
  res.close()

  g.globalCompositeOperation = 'destination-in'
  g.imageSmoothingQuality = 'high'
  g.filter = `blur(${Math.max(1, c.width / 800)}px)`
  g.drawImage(m, 0, 0, c.width, c.height)
  g.filter = 'none'

  const box = opaqueBox(g, c.width, c.height)
  if (!box) throw new Error('人物が見つかりませんでした')
  const pad = Math.round(Math.max(c.width, c.height) * 0.01)
  const x = Math.max(0, box.x - pad), y = Math.max(0, box.y - pad)
  const w = Math.min(c.width - x, box.w + pad * 2), h = Math.min(c.height - y, box.h + pad * 2)
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  out.getContext('2d')!.drawImage(c, x, y, w, h, 0, 0, w, h)
  return toBlob(out, 'image/png')
}

function opaqueBox(g: CanvasRenderingContext2D, w: number, h: number) {
  const a = g.getImageData(0, 0, w, h).data
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (a[(y * w + x) * 4 + 3] > 40) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}
