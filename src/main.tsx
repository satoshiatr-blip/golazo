import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ensureAac } from './render.ts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// iOSのdvh/svhはブラウザのツールバー状態によりズレることがあるため、実測した高さをCSS変数として持つ
function setAppHeight() {
  // ホーム画面追加（standalone）ではwindow.innerHeightが実際の表示領域より大きく
  // 返ることがある既知の癖があるため、より正確なvisualViewportを優先する
  const h = window.visualViewport?.height ?? window.innerHeight
  document.documentElement.style.setProperty('--app-height', `${h}px`)
}
setAppHeight()
// standalone起動直後はvisualViewportの値がまだ確定していないことがあるので、少し遅れて測り直す
setTimeout(setAppHeight, 300)
window.addEventListener('resize', setAppHeight)
window.addEventListener('pageshow', setAppHeight)
window.visualViewport?.addEventListener('resize', setAppHeight)

// iOSが容量確保のために保存データ（名簿・BGM）を消さないよう、永続化を頼んでおく
navigator.storage?.persist?.().catch(() => {})

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  // updateViaCache: 'none' で sw.js 自体もブラウザのディスクキャッシュを無視して毎回確かめる
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(async reg => {
    reg.update().catch(() => {}) // 起動のたびに新しい版が出ていないか確かめる
    await navigator.serviceWorker.ready
    // オフラインで書き出すときに要る予備AACエンコーダも、オンラインのうちに取得しておく
    await ensureAac().catch(() => {})
    const urls = [new URL('./', location.href).href, ...performance.getEntriesByType('resource').map(e => e.name)]
      .filter(u => u.startsWith(location.origin))
    reg.active?.postMessage({ type: 'precache', urls })
  })
}
