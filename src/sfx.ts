// 効果音はすべてその場で合成する（音源ファイルを持たないので権利の心配がなく、オフラインでも鳴る）。
// 安っぽく聞こえないよう、音を何層も重ね、左右に振り、合成した残響（ホールの響き）に送る

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

// 残響：左右で別々の減衰ノイズを畳み込みに使う。高音ほど早く消えるよう少しずつ丸める
const reverbCache = new WeakMap<AudioNode, AudioNode>()
function reverb(ac: BaseAudioContext, out: AudioNode) {
  let input = reverbCache.get(out)
  if (input) return input
  const sec = 2.6
  const len = Math.round(ac.sampleRate * sec)
  const ir = ac.createBuffer(2, len, ac.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch)
    let lp = 0
    for (let i = 0; i < len; i++) {
      const u = i / len
      const k = 0.35 + 0.6 * u
      lp += (Math.random() * 2 - 1 - lp) * (1 - k)
      d[i] = lp * Math.pow(1 - u, 3.2)
    }
  }
  const conv = ac.createConvolver()
  conv.buffer = ir
  const pre = ac.createDelay(0.1)
  pre.delayTime.value = 0.025
  const g = ac.createGain()
  g.gain.value = 0.55
  pre.connect(conv).connect(g).connect(out)
  input = pre
  reverbCache.set(out, input)
  return input
}

const shaperCache = new WeakMap<BaseAudioContext, WaveShaperNode['curve']>()
// 軽い歪み：低音に芯と倍音を足して、小さいスピーカーでも「ドン」が聞こえるようにする
function saturate(ac: BaseAudioContext, drive: number) {
  const ws = ac.createWaveShaper()
  let curve = shaperCache.get(ac)
  if (!curve) {
    curve = new Float32Array(2048)
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1
      curve[i] = Math.tanh(x * 2.2) / Math.tanh(2.2)
    }
    shaperCache.set(ac, curve)
  }
  ws.curve = curve
  const pre = ac.createGain()
  pre.gain.value = drive
  pre.connect(ws)
  return { input: pre, output: ws }
}

// 音量の倍率。試合の歓声やBGMの邪魔をしない控えめな大きさにしている
const LEVEL = { whoosh: 0.18, impact: 0.31, riser: 0.37, slow: 0.22 }

function env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
  // 最初の予約時刻より前は既定の音量1で鳴ってしまう（プツッという雑音になる）ので、最初から絞っておく
  g.gain.value = 0.0001
  g.gain.setValueAtTime(0.0001, Math.max(0, t - attack))
  g.gain.exponentialRampToValueAtTime(peak, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
}

function panner(ac: BaseAudioContext, pan: number) {
  const p = ac.createStereoPanner()
  p.pan.value = pan
  return p
}

// 斬撃ワイプの「シュッ」：左から右へ抜ける風切り音＋低い「ウォン」。center で最も強くなる
export function whoosh(ac: BaseAudioContext, out: AudioNode, center: number, vol = 1) {
  vol *= LEVEL.whoosh
  const t0 = Math.max(0, center - 0.35), t1 = center + 0.35
  const wet = reverb(ac, out)

  const src = noiseSource(ac)
  const bp = ac.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 0.9
  bp.frequency.setValueAtTime(300, t0)
  bp.frequency.exponentialRampToValueAtTime(3200, center)
  bp.frequency.exponentialRampToValueAtTime(500, t1)
  const g = ac.createGain()
  env(g, center, 0.75 * vol, center - t0, t1 - center)
  const pan = ac.createStereoPanner()
  pan.pan.setValueAtTime(-0.8, t0)
  pan.pan.linearRampToValueAtTime(0.8, t1)
  src.connect(bp).connect(g).connect(pan)
  pan.connect(out)
  pan.connect(wet)
  src.start(t0)
  src.stop(t1 + 0.05)

  // 高い空気の擦れ
  const air = noiseSource(ac)
  const hp = ac.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 6000
  const ag = ac.createGain()
  env(ag, center, 0.18 * vol, 0.12, 0.2)
  air.connect(hp).connect(ag).connect(pan)
  air.start(center - 0.15)
  air.stop(center + 0.25)

  // 低い「ウォン」：通り過ぎるときの胴鳴り
  const osc = ac.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(95, center - 0.1)
  osc.frequency.exponentialRampToValueAtTime(48, t1)
  const og = ac.createGain()
  env(og, center, 0.35 * vol, 0.1, 0.35)
  osc.connect(og).connect(out)
  osc.start(center - 0.12)
  osc.stop(t1 + 0.05)
}

// 叩きつけの「ドーン」：沈み込む重低音＋胴鳴り＋破裂音＋金属的な余韻を重ね、ホールに響かせる
export function impact(ac: BaseAudioContext, out: AudioNode, t: number, vol = 1) {
  vol *= LEVEL.impact
  const wet = reverb(ac, out)

  // 重低音：ゆっくり沈む
  const sub = ac.createOscillator()
  sub.type = 'sine'
  sub.frequency.setValueAtTime(62, t)
  sub.frequency.exponentialRampToValueAtTime(29, t + 1.4)
  const sg = ac.createGain()
  env(sg, t, 0.95 * vol, 0.004, 1.8)
  const sSat = saturate(ac, 1.4)
  sub.connect(sSat.input)
  sSat.output.connect(sg).connect(out)
  sub.start(t)
  sub.stop(t + 1.9)

  // 胴鳴り：太鼓のように一瞬で音程が落ちる
  const body = ac.createOscillator()
  body.type = 'sine'
  body.frequency.setValueAtTime(190, t)
  body.frequency.exponentialRampToValueAtTime(52, t + 0.14)
  const bg = ac.createGain()
  env(bg, t, 0.8 * vol, 0.002, 0.42)
  const bSat = saturate(ac, 2.5)
  body.connect(bSat.input)
  bSat.output.connect(bg)
  bg.connect(out)
  bg.connect(wet)
  body.start(t)
  body.stop(t + 0.5)

  // 破裂音：左右に少しずらして広げる
  for (const [pan, f, dl] of [[-0.45, 1400, 0], [0.45, 2100, 0.012]] as const) {
    const n = noiseSource(ac)
    const bp = ac.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 0.7
    bp.frequency.setValueAtTime(f * 1.6, t + dl)
    bp.frequency.exponentialRampToValueAtTime(f * 0.4, t + dl + 0.25)
    const ng = ac.createGain()
    env(ng, t + dl, 0.55 * vol, 0.002, 0.28)
    const p = panner(ac, pan)
    n.connect(bp).connect(ng).connect(p)
    p.connect(out)
    p.connect(wet)
    n.start(t + dl)
    n.stop(t + dl + 0.32)
  }

  // 立ち上がりの「カッ」
  const click = noiseSource(ac)
  const chp = ac.createBiquadFilter()
  chp.type = 'highpass'
  chp.frequency.value = 3000
  const cg = ac.createGain()
  env(cg, t, 0.35 * vol, 0.001, 0.035)
  click.connect(chp).connect(cg).connect(out)
  click.start(t)
  click.stop(t + 0.05)

  // 金属的な余韻：倍音が整数倍でない音を重ねて、映画の予告編のような「ガーン」に
  for (const [ratio, pan, a] of [[1, -0.3, 0.07], [2.76, 0.3, 0.05], [5.4, -0.15, 0.03], [8.93, 0.2, 0.018]] as const) {
    const o = ac.createOscillator()
    o.type = 'sine'
    o.frequency.value = 98 * ratio
    const og = ac.createGain()
    env(og, t, a * vol, 0.003, 1.4 / Math.sqrt(ratio))
    const p = panner(ac, pan)
    o.connect(og).connect(p)
    p.connect(out)
    p.connect(wet)
    o.start(t)
    o.stop(t + 1.5)
  }
}

// オープニングの盛り上がり：ずらした3本の音と風の音が高まり、震えが速くなって、最後に途切れる
export function riser(ac: BaseAudioContext, out: AudioNode, t0: number, t1: number, vol = 1) {
  vol *= LEVEL.riser
  const wet = reverb(ac, out)

  // 震え（トレモロ）：だんだん速くなる
  const trem = ac.createGain()
  trem.gain.value = 1
  const lfo = ac.createOscillator()
  lfo.frequency.setValueAtTime(3, t0)
  lfo.frequency.exponentialRampToValueAtTime(18, t1)
  const depth = ac.createGain()
  depth.gain.setValueAtTime(0, t0)
  depth.gain.linearRampToValueAtTime(0.35, t1)
  lfo.connect(depth).connect(trem.gain)
  lfo.start(t0)
  lfo.stop(t1 + 0.05)

  const swell = ac.createGain()
  swell.gain.setValueAtTime(0.0001, t0)
  swell.gain.exponentialRampToValueAtTime(vol, t1 - 0.03)
  swell.gain.linearRampToValueAtTime(0, t1)
  trem.connect(swell)
  swell.connect(out)
  swell.connect(wet)

  // 音程が上がっていく3本の音（少しずつずらして厚みを出し、左右に広げる）
  const lp = ac.createBiquadFilter()
  lp.type = 'lowpass'
  lp.Q.value = 2
  lp.frequency.setValueAtTime(300, t0)
  lp.frequency.exponentialRampToValueAtTime(5000, t1)
  lp.connect(trem)
  for (const [detune, pan] of [[-14, -0.6], [0, 0], [13, 0.6]] as const) {
    const o = ac.createOscillator()
    o.type = 'sawtooth'
    o.detune.value = detune
    o.frequency.setValueAtTime(110, t0)
    o.frequency.exponentialRampToValueAtTime(440, t1)
    const g = ac.createGain()
    g.gain.value = 0.07
    const p = panner(ac, pan)
    o.connect(g).connect(p).connect(lp)
    o.start(t0)
    o.stop(t1 + 0.05)
  }

  // 風の音：帯域が上がっていく
  const n = noiseSource(ac)
  const bp = ac.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 1.1
  bp.frequency.setValueAtTime(400, t0)
  bp.frequency.exponentialRampToValueAtTime(7000, t1)
  const ng = ac.createGain()
  ng.gain.value = 0.3
  n.connect(bp).connect(ng).connect(trem)
  n.start(t0)
  n.stop(t1 + 0.05)

  // 下支えの低音
  const low = ac.createOscillator()
  low.type = 'sine'
  low.frequency.setValueAtTime(45, t0)
  low.frequency.exponentialRampToValueAtTime(70, t1)
  const lg = ac.createGain()
  lg.gain.setValueAtTime(0.0001, t0)
  lg.gain.exponentialRampToValueAtTime(0.3 * vol, t1 - 0.03)
  lg.gain.linearRampToValueAtTime(0, t1)
  low.connect(lg).connect(out)
  low.start(t0)
  low.stop(t1 + 0.05)
}

// スローに入る瞬間：テープが止まるように音程が沈み、風切り音が抜ける
export function slowDown(ac: BaseAudioContext, out: AudioNode, t: number, vol = 1) {
  vol *= LEVEL.slow
  const wet = reverb(ac, out)
  const o = ac.createOscillator()
  o.type = 'sawtooth'
  o.frequency.setValueAtTime(320, t)
  o.frequency.exponentialRampToValueAtTime(38, t + 0.8)
  const lp = ac.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(2200, t)
  lp.frequency.exponentialRampToValueAtTime(180, t + 0.8)
  const g = ac.createGain()
  env(g, t + 0.03, 0.22 * vol, 0.03, 0.85)
  o.connect(lp).connect(g)
  g.connect(out)
  g.connect(wet)
  o.start(t)
  o.stop(t + 0.95)
  whoosh(ac, out, t + 0.12, 0.45 * vol / LEVEL.slow)
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
