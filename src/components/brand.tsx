import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

// アプリアイコンと同じ画像を使う（別物に見えないよう、ヘッダーのロゴも差し替え済みアイコンで統一）
export const Logo = ({ size = 36 }: { size?: number }) => (
  <img src="icon-512.png" width={size} height={size} className="rounded-[22%]" alt="" />
)

export const Wordmark = () => (
  <span className="font-black italic tracking-tight leading-none">
    GOL<span className="text-cyan">AZO</span>
  </span>
)

// 画面いっぱいに一瞬だけ言葉を叩きつける演出（書き出す動画と同じ世界観）
export function Slam({ word, trigger, sub }: { word: string; trigger: number; sub?: string }) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (!trigger) return
    setShown(trigger)
    const t = setTimeout(() => setShown(0), 1100)
    return () => clearTimeout(t)
  }, [trigger])
  if (!shown) return null
  return createPortal(
    <div key={shown} className="fixed inset-0 z-[60] pointer-events-none grid place-items-center overflow-hidden">
      <div className="absolute inset-0 bg-white animate-[flash_.35s_ease-out_both]" />
      <div className="absolute -inset-1/2 speedlines animate-[flash_1.1s_ease-out_both]" />
      <div className="text-center animate-[slam_1.1s_cubic-bezier(.2,.8,.2,1)_both]">
        <p className="text-7xl font-black italic text-white [text-shadow:0_0_24px_#ff9f0a,4px_0_0_rgba(255,0,90,.7),-4px_0_0_rgba(0,200,255,.8)] [-webkit-text-stroke:2px_#04060c]">{word}</p>
        {sub && <p className="mt-2 text-sm font-bold text-cyan tracking-[0.3em]">{sub}</p>}
      </div>
    </div>,
    document.body,
  )
}
