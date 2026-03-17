import { useEffect, useRef } from 'react'

let _audioCtx = null
function getCtx() {
  if (!_audioCtx || _audioCtx.state === 'closed') {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  return _audioCtx
}

function buildNodes(ctx, type) {
  const master = ctx.createGain()
  master.connect(ctx.destination)
  master.gain.value = 0

  if (type === 'off') {
    return { master, stop: () => {} }
  }

  if (type === 'focus') {
    // Binaural beats: 220Hz left + 260Hz right (~40Hz gamma difference)
    const oscL = ctx.createOscillator()
    const oscR = ctx.createOscillator()
    const panL = ctx.createStereoPanner()
    const panR = ctx.createStereoPanner()
    const gL   = ctx.createGain()
    const gR   = ctx.createGain()

    panL.pan.value = -1
    panR.pan.value = 1
    gL.gain.value  = 0.4
    gR.gain.value  = 0.4

    oscL.type = 'sine'; oscL.frequency.value = 220
    oscR.type = 'sine'; oscR.frequency.value = 260

    oscL.connect(gL); gL.connect(panL); panL.connect(master)
    oscR.connect(gR); gR.connect(panR); panR.connect(master)
    oscL.start(); oscR.start()

    return { master, stop: () => { try { oscL.stop(); oscR.stop() } catch {} } }
  }

  // Shared noise buffer helper
  function makeNoiseBuffer() {
    const bufLen = ctx.sampleRate * 3
    const buf    = ctx.createBuffer(1, bufLen, ctx.sampleRate)
    const data   = buf.getChannelData(0)

    if (type === 'brown') {
      let last = 0
      for (let i = 0; i < bufLen; i++) {
        const white = (Math.random() * 2 - 1) * 0.5
        last = (last + 0.02 * white) / 1.02
        data[i] = last * 3.5
      }
    } else {
      // white noise for rain / ocean
      for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1
    }
    return buf
  }

  const source = ctx.createBufferSource()
  source.buffer = makeNoiseBuffer()
  source.loop = true

  if (type === 'brown') {
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'; lp.frequency.value = 800
    source.connect(lp); lp.connect(master)
    source.start()
    return { master, stop: () => { try { source.stop() } catch {} } }
  }

  if (type === 'rain') {
    const bp   = ctx.createBiquadFilter()
    bp.type = 'bandpass'; bp.frequency.value = 400; bp.Q.value = 0.5

    const lfo     = ctx.createOscillator()
    const lfoGain = ctx.createGain()
    const envGain = ctx.createGain()

    lfo.type = 'sine'; lfo.frequency.value = 0.3
    lfoGain.gain.value = 0.3
    envGain.gain.value = 0.5

    lfo.connect(lfoGain); lfoGain.connect(envGain.gain)
    source.connect(bp); bp.connect(envGain); envGain.connect(master)
    lfo.start(); source.start()
    return { master, stop: () => { try { source.stop(); lfo.stop() } catch {} } }
  }

  if (type === 'ocean') {
    const lp   = ctx.createBiquadFilter()
    lp.type = 'lowpass'; lp.frequency.value = 200

    const lfo     = ctx.createOscillator()
    const lfoGain = ctx.createGain()
    const envGain = ctx.createGain()

    lfo.type = 'sine'; lfo.frequency.value = 0.08
    lfoGain.gain.value = 0.4
    envGain.gain.value = 0.5

    lfo.connect(lfoGain); lfoGain.connect(envGain.gain)
    source.connect(lp); lp.connect(envGain); envGain.connect(master)
    lfo.start(); source.start()
    return { master, stop: () => { try { source.stop(); lfo.stop() } catch {} } }
  }

  // fallback silence
  return { master, stop: () => {} }
}

export default function useAmbientSound(type, volume, active) {
  const nodesRef = useRef(null)
  const typeRef  = useRef(null)

  // Rebuild nodes when type changes
  useEffect(() => {
    if (typeRef.current === type) return
    typeRef.current = type

    // Tear down old nodes — capture reference before nulling so the timeout
    // doesn't accidentally stop the newly created nodes 300ms later
    if (nodesRef.current) {
      const old = nodesRef.current
      nodesRef.current = null
      try {
        old.master.gain.setTargetAtTime(0, getCtx().currentTime, 0.1)
        setTimeout(() => old.stop(), 300)
      } catch {}
    }

    if (type === 'off') return

    try {
      const ctx   = getCtx()
      ctx.resume()
      const nodes = buildNodes(ctx, type)
      nodesRef.current = nodes
    } catch {}
  }, [type])

  // Fade volume in/out based on active + volume
  useEffect(() => {
    if (!nodesRef.current) return
    try {
      const ctx    = getCtx()
      const target = active ? volume : 0
      nodesRef.current.master.gain.setTargetAtTime(target, ctx.currentTime, 0.3)
    } catch {}
  }, [active, volume, type])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (nodesRef.current) {
        const old = nodesRef.current
        nodesRef.current = null
        try { old.master.gain.setTargetAtTime(0, getCtx().currentTime, 0.1) } catch {}
        setTimeout(() => old.stop(), 300)
      }
    }
  }, [])
}
