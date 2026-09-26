// 端末内データ（選手名簿・試合設定）のバックアップ・復元。
// 動画本体（数GB）は対象外——大きすぎて1ファイルに詰め込めないので、復元後は動画を選び直す前提
const KEYS = ['golazo:project', 'golazo:roster'] as const
const APP = 'golazo'

export function exportBackup() {
  const data: Record<string, unknown> = {}
  for (const k of KEYS) {
    const raw = localStorage.getItem(k)
    if (raw != null) { try { data[k] = JSON.parse(raw) } catch { /* 壊れた値は無視 */ } }
  }
  const payload = { app: APP, version: 1, exportedAt: new Date().toISOString(), data }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `golazo-backup_${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importBackup(file: File): Promise<{ ok: true } | { ok: false; error: string }> {
  let payload: { app?: string; data?: Record<string, unknown> }
  try {
    payload = JSON.parse(await file.text())
  } catch {
    return { ok: false, error: 'ファイルを読み込めませんでした（壊れているか、対応していない形式です）' }
  }
  if (payload.app !== APP || !payload.data) return { ok: false, error: 'GOLAZOのバックアップファイルではありません' }
  for (const k of KEYS) {
    if (k in payload.data) localStorage.setItem(k, JSON.stringify(payload.data[k]))
  }
  return { ok: true }
}
