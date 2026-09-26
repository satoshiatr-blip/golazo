export type SceneKind = 'goal' | 'save' | 'play'

export const KIND_LABEL: Record<SceneKind, string> = { goal: 'GOAL!', save: 'NICE SAVE!', play: 'NICE PLAY!' }
export const KIND_JA: Record<SceneKind, string> = { goal: 'ゴール', save: 'セーブ', play: '好プレー' }

export type Player = { id: string; number: string; name: string }

// cx, cy は元動画に対する正規化座標(0〜1)、scale は拡大率
export type ZoomRect = { cx: number; cy: number; scale: number }

export type Scene = {
  id: string
  sourceKey: string
  mark: number
  start: number
  end: number
  kind: SceneKind
  playerId: string | null
  slow: boolean
  slowAt: number
  slowLen: number
  zoomFrom: ZoomRect
  zoomTo: ZoomRect
}

// オープニングの写真。画像本体は IndexedDB（photo:<id> 元画像、cut:<id> 切り抜き）に置く
// scale は枠に対する倍率、dx/dy は 1920x1080 基準の px ずらし
export type OpeningPhoto = { id: string; cutout: boolean; hasCut: boolean; scale: number; dx: number; dy: number }

export type Opening = {
  top: string
  main: string
  bottom: string
  badge: string
  corner: string
  photos: OpeningPhoto[]
}

export type SourceMeta = { key: string; name: string; size: number; duration: number }

export type Project = {
  title: string
  date: string
  team: string
  opponent: string
  color: string
  players: Player[]
  sources: SourceMeta[]
  scenes: Scene[]
  gameVolume: number
  bgmVolume: number
  grade: boolean
  sfx: boolean
  sfxVolume: number
  bgmStart: number
  opening: Opening
}

export const sourceKey = (f: File) => `${f.name}:${f.size}`

export const uid = () => Math.random().toString(36).slice(2, 10)
