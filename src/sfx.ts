// 効果音はすべてその場で合成する（音源ファイルを持たないので権利の心配がなく、オフラインでも鳴る）

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>()
function noise(ac: BaseAudioContext) {
  let b = noiseCache.get(ac)
  if (!b) {
    b = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate)
    const d = b.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    noiseCache.set(ac, b)
  }
  return b
}

function noiseSource(ac: BaseAudioContext) {
  const s = ac.createBufferSource()
  s.buffer = noise(ac)
  s.loop = true
  return s
}

// 斬撃ワイプの「シュッ」：center で最も強くなる
export function whoosh(ac: BaseAudioContext, out: AudioNode, center: number, vol = 1) {
  const t0 = Math.max(0, center - 0.3), t1 = center + 0.25
  const src = noiseSource(ac)
  const bp = ac.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 1.2
  bp.frequency.setValueAtTime(350, t0)
  bp.frequency.exponentialRampToValueAtTime(5500, center)
  bp.frequency.exponentialRampToValueAtTime(900, t1)
  const g = ac.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(0.9 * vol, center)
  g.gain.exponentialRampToValueAtTime(0.0001, t1)
  src.connect(bp).connect(g).connect(out)
  src.start(t0)
  src.stop(t1 + 0.05)
}

// 叩きつけの「ドン」：低い胴鳴り＋破裂音＋高い「パキッ」
export function impact(ac: BaseAudioContext, out: AudioNode, t: number, vol = 1) {
  const osc = ac.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(110, t)
  osc.frequency.exponentialRampToValueAtTime(32, t + 0.7)
  const og = ac.createGain()
  og.gain.setValueAtTime(1.0 * vol, t)
  og.gain.exponentialRampToValueAtTime(0.0001, t + 1.3)
  osc.connect(og).connect(out)
  osc.start(t)
  osc.stop(t + 1.4)

  const burst = noiseSource(ac)
  const lp = ac.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(2500, t)
  lp.frequency.exponentialRampToValueAtTime(200, t + 0.4)
  const bg = ac.createGain()
  bg.gain.setValueAtTime(0.7 * vol, t)
  bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.45)
  burst.connect(lp).connect(bg).connect(out)
  burst.start(t)
  burst.stop(t + 0.5)

  const crack = noiseSource(ac)
  const hp = ac.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 3500
  const cg = ac.createGain()
  cg.gain.setValueAtTime(0.5 * vol, t)
  cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.09)
  crack.connect(hp).connect(cg).connect(out)
  crack.start(t)
  crack.stop(t + 0.12)
}

// オープニングの「ゴォー」と盛り上がる音
export function riser(ac: BaseAudioContext, out: AudioNode, t0: number, t1: number, vol = 1) {
  const src = noiseSource(ac)
  const bp = ac.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 2
  bp.frequency.setValueAtTime(200, t0)
  bp.frequency.exponentialRampToValueAtTime(6000, t1)
  const g = ac.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(0.6 * vol, t1 - 0.02)
  g.gain.linearRampToValueAtTime(0, t1)
  src.connect(bp).connect(g).connect(out)
  src.start(t0)
  src.stop(t1 + 0.05)

  const osc = ac.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(90, t0)
  osc.frequency.exponentialRampToValueAtTime(440, t1)
  const lp = ac.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 900
  const og = ac.createGain()
  og.gain.setValueAtTime(0.0001, t0)
  og.gain.exponentialRampToValueAtTime(0.15 * vol, t1 - 0.02)
  og.gain.linearRampToValueAtTime(0, t1)
  osc.connect(lp).connect(og).connect(out)
  osc.start(t0)
  osc.stop(t1 + 0.05)
}

// スローに入る瞬間の「ヒュゥン」と沈む音
export function slowDown(ac: BaseAudioContext, out: AudioNode, t: number, vol = 1) {
  const osc = ac.createOscillator()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(700, t)
  osc.frequency.exponentialRampToValueAtTime(70, t + 0.7)
  const g = ac.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.35 * vol, t + 0.05)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8)
  osc.connect(g).connect(out)
  osc.start(t)
  osc.stop(t + 0.85)
  whoosh(ac, out, t + 0.12, 0.5 * vol)
}

let live: AudioContext | null = null
// アプリ内でタップしたときの手応え用
export function playImpactNow() {
  try {
    live ??= new AudioContext()
    if (live.state === 'suspended') live.resume()
    const master = live.createGain()
    master.gain.value = 0.6
    master.connect(live.destination)
    impact(live, master, live.currentTime + 0.01, 0.8)
  } catch { /* 音が出せない環境では黙って続行 */ }
}
