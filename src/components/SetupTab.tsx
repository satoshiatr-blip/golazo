import { useState } from 'react'
import type { Tab } from '../App'
import { exportBackup, importBackup } from '../backup'
import { emptyProject } from '../store'
import { uid } from '../types'
import { IconPlus, IconTrash, IconUp } from './icons'
import { Button, Card, Field, FilePicker, GroupLabel, ScreenTitle, inputCls, type ProjectProps } from './ui'

export const COLORS = ['#ffd400', '#ff8a00', '#ff2d55', '#1f6fff', '#1fd06b', '#9b5cff', '#ff5fa2', '#f2f2f2']

export default function SetupTab({ project, setProject, go }: ProjectProps & { go: (t: Tab) => void }) {
  const set = <K extends keyof typeof project>(k: K, v: (typeof project)[K]) => setProject(p => ({ ...p, [k]: v }))
  const updatePlayer = (id: string, patch: { number?: string; name?: string }) =>
    setProject(p => ({ ...p, players: p.players.map(x => x.id === id ? { ...x, ...patch } : x) }))
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function onImportBackup(files: FileList) {
    const f = files[0]
    if (!f) return
    if (!confirm('今のデータを上書きして復元します。よろしいですか？')) return
    const r = await importBackup(f)
    if (r.ok) {
      setImportMsg({ ok: true, text: '復元しました。反映のため再読み込みします…' })
      setTimeout(() => location.reload(), 600)
    } else {
      setImportMsg({ ok: false, text: r.error })
    }
  }

  return (
    <div className="space-y-6">
      <div className="relative -mx-5 -mt-5 mb-2 px-6 pt-8 pb-7 overflow-hidden border-b border-line bg-[radial-gradient(ellipse_60%_70%_at_12%_0%,rgba(34,211,238,0.28),transparent_70%),radial-gradient(ellipse_60%_70%_at_88%_10%,rgba(217,70,239,0.28),transparent_70%),radial-gradient(ellipse_70%_60%_at_80%_100%,rgba(255,138,61,0.16),transparent_70%)]">
        <div className="absolute -inset-1/2 speedlines opacity-60 animate-[spin-slow_90s_linear_infinite]" />
        <div className="relative">
          <p className="text-[11px] font-black italic tracking-[0.3em] text-cyan">ONE MOMENT → SPECIAL CUT</p>
          <h2 className="mt-2 text-[34px] leading-[1.15] font-black italic -skew-x-6 origin-left">あの一瞬を、<br /><span className="bg-[linear-gradient(110deg,#22d3ee,#818cf8_35%,#e879f9_65%,#ffb627)] bg-clip-text text-transparent">特別な一本に。</span></h2>
          <ol className="mt-5 grid grid-cols-5 gap-1.5 text-center">
            {['試合', 'マーク', 'シーン', 'オープニング', '書き出し'].map((t, i) => (
              <li key={t} className="rise rounded-xl bg-ink/60 backdrop-blur border border-line py-2" style={{ animationDelay: `${120 + i * 70}ms` }}>
                <span className="block text-[10px] font-black italic text-cyan">0{i + 1}</span>
                <span className="text-[10px] font-bold tracking-tighter whitespace-nowrap">{t}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <ScreenTitle step="01" en="MATCH INFO" title="試合の情報" sub="オープニングとテロップに使います" />

      <div>
        <GroupLabel>試合</GroupLabel>
        <Card className="space-y-4">
          <Field label="大会名・試合名"><input className={inputCls} value={project.title} placeholder="例: 秋季リーグ 第3節" onChange={e => set('title', e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="自チーム"><input className={inputCls} value={project.team} placeholder="〇〇FC" onChange={e => set('team', e.target.value)} /></Field>
            <Field label="対戦相手"><input className={inputCls} value={project.opponent} placeholder="△△SC" onChange={e => set('opponent', e.target.value)} /></Field>
          </div>
          <Field label="日付"><input type="date" className={`${inputCls} appearance-none min-w-0`} value={project.date} onChange={e => set('date', e.target.value)} /></Field>
        </Card>
      </div>

      <div>
        <GroupLabel>テーマカラー</GroupLabel>
        <Card>
          <div className="grid grid-cols-8 gap-2">
            {COLORS.map(c => (
              <button key={c} onClick={() => set('color', c)} aria-label={`色 ${c}`}
                className={`aspect-square rounded-full transition ${project.color === c ? 'ring-2 ring-offset-2 ring-offset-surface ring-fg scale-110' : ''}`}
                style={{ background: c, boxShadow: project.color === c ? `0 0 14px ${c}` : undefined }} />
            ))}
          </div>
        </Card>
      </div>

      <div>
        <div className="flex items-end justify-between">
          <GroupLabel>選手</GroupLabel>
          <span className="text-[11px] text-muted mb-2 px-1">自動で保存・次の試合でも使えます</span>
        </div>
        <Card className="space-y-2.5">
          {project.players.length === 0 && <p className="text-sm text-muted text-center py-2">背番号と名前がテロップに出ます。先頭の選手がシーンの初期値になります</p>}
          {project.players.map((pl, i) => (
            <div key={pl.id} className="flex gap-2 items-center">
              <input className={`${inputCls} !w-16 text-center font-black italic`} inputMode="numeric" placeholder="#" value={pl.number}
                onChange={e => updatePlayer(pl.id, { number: e.target.value })} />
              <input className={inputCls} placeholder="名前" value={pl.name} onChange={e => updatePlayer(pl.id, { name: e.target.value })} />
              {i === 0
                ? <span className="shrink-0 w-11 text-center text-[10px] font-black text-cyan">主役</span>
                : <button className="shrink-0 w-11 h-11 grid place-items-center rounded-xl text-muted text-lg" aria-label="先頭へ"
                    onClick={() => setProject(p => ({ ...p, players: [pl, ...p.players.filter(x => x.id !== pl.id)] }))}><IconUp /></button>}
              <button className="shrink-0 w-11 h-11 grid place-items-center rounded-xl text-danger text-lg" aria-label="削除"
                onClick={() => setProject(p => ({ ...p, players: p.players.filter(x => x.id !== pl.id) }))}><IconTrash /></button>
            </div>
          ))}
          <Button className="w-full border-dashed" onClick={() => setProject(p => ({ ...p, players: [...p.players, { id: uid(), number: '', name: '' }] }))}>
            <IconPlus /> 選手を追加
          </Button>
        </Card>
      </div>

      <Button variant="primary" className="w-full min-h-14 text-lg" onClick={() => go('mark')}>次へ：動画を選ぶ</Button>

      <div>
        <GroupLabel>データのバックアップ</GroupLabel>
        <Card className="space-y-3">
          <p className="text-xs text-muted">選手名簿・試合設定をファイルに書き出せます（動画本体は含みません）</p>
          <div className="grid grid-cols-2 gap-2">
            <Button className="min-h-11" onClick={exportBackup}>書き出す</Button>
            <FilePicker accept="application/json" multiple={false} onFiles={onImportBackup} className="min-h-11 rounded-xl border border-line">復元する</FilePicker>
          </div>
          {importMsg && <p className={`text-xs ${importMsg.ok ? 'text-emerald-400' : 'text-danger'}`}>{importMsg.text}</p>}
        </Card>
      </div>

      <button className="w-full py-3 text-sm text-danger/80"
        onClick={() => {
          if (confirm('試合の情報とシーンをすべて消して、新しい試合を始めますか？（選手とチームは残ります）'))
            setProject(p => ({ ...emptyProject(), team: p.team, color: p.color, players: p.players, opening: p.opening }))
        }}>
        新しい試合を始める
      </button>
    </div>
  )
}
