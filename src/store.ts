import { useEffect, useState } from 'react'
import { idbGet, idbSet } from './idb'
import type { Opening, Player, Project, Scene, SceneKind } from './types'
import { uid } from './types'

const KEY = 'golazo:project'
const ROSTER_KEY = 'golazo:roster'

// チーム名簿は試合データと別に、localStorage と IndexedDB の両方へ保存する（片方が消えても戻せる）
type Roster = { team: string; color: string; players: Player[] }

function readRoster(): Roster | null {
  try {
    const raw = localStorage.getItem(ROSTER_KEY)
    if (raw) return JSON.parse(raw)
    // 初回は MATCHCUT の名簿を借りる（同じ github.io 上なので読める）。色はこのアプリの既定を使う
    const mc = localStorage.getItem('matchcut:roster')
    return mc ? { ...JSON.parse(mc), color: '' } : null
  } catch { return null }
}

const today = () => new Date().toISOString().slice(0, 10)

export const emptyProject = (): Project => ({
  title: '',
  date: today(),
  team: '',
  opponent: '',
  color: '#ffd400',
  players: [],
  sources: [],
  scenes: [],
  gameVolume: 0.8,
  bgmVolume: 0.5,
  grade: true,
  sfx: true,
  sfxVolume: 0.8,
  bgmStart: 0,
  opening: emptyOpening(),
})

export const emptyOpening = (): Opening => ({
  style: 'poster',
  top: 'この一瞬の、その先へ',
  main: '夢の続きへ。',
  bottom: '',
  badge: 'GOAL!',
  corner: '',
  photos: [],
})

export function useProject() {
  const [project, setProject] = useState<Project>(() => {
    let p = emptyProject()
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) { const saved = JSON.parse(raw); p = { ...p, ...saved, opening: { ...p.opening, ...saved.opening } } }
    } catch { /* 破損時は新規 */ }
    const roster = readRoster()
    if (roster && p.players.length === 0) p = { ...p, team: p.team || roster.team, color: roster.color || p.color, players: roster.players }
    return p
  })

  useEffect(() => {
    if (project.players.length > 0) return
    idbGet<Roster>(ROSTER_KEY).then(r => {
      if (r?.players.length) setProject(p => p.players.length ? p : { ...p, team: p.team || r.team, color: r.color || p.color, players: r.players })
    })
    // 起動時の復元だけ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(project)) } catch { /* 容量超過などは無視 */ }
  }, [project])

  const rosterJson = JSON.stringify({ team: project.team, color: project.color, players: project.players })
  useEffect(() => {
    const r: Roster = JSON.parse(rosterJson)
    if (!r.players.length && !r.team) return
    try { localStorage.setItem(ROSTER_KEY, rosterJson) } catch { /* 無視 */ }
    idbSet(ROSTER_KEY, r)
  }, [rosterJson])

  return [project, setProject] as const
}

export const PRE_SEC = 7
export const POST_SEC = 3

export function newScene(sourceKey: string, mark: number, duration: number, kind: SceneKind, playerId: string | null): Scene {
  const start = Math.max(0, mark - PRE_SEC)
  const end = Math.min(duration, mark + POST_SEC)
  return {
    id: uid(),
    sourceKey,
    mark,
    start,
    end,
    kind,
    playerId,
    slow: kind === 'goal',
    slowAt: Math.max(start, mark - 1.5),
    slowLen: 2,
    zoomFrom: { cx: 0.5, cy: 0.55, scale: 1.2 },
    zoomTo: { cx: 0.5, cy: 0.55, scale: 1.6 },
  }
}
