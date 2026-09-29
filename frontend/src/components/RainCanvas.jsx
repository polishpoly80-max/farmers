import { useEffect, useRef } from 'react'

const TAU = Math.PI * 2
const rand = (a, b) => a + Math.random() * (b - a)

// Three depth layers: far/mid/near. Nearer drops are faster, longer and brighter.
const LAYERS = [
  { spMin: 240, spMax: 360, lenMin: 8,  lenMax: 14, wMin: 0.6, wMax: 0.9, aMin: 0.10, aMax: 0.20 },
  { spMin: 420, spMax: 560, lenMin: 16, lenMax: 26, wMin: 0.9, wMax: 1.4, aMin: 0.18, aMax: 0.32 },
  { spMin: 640, spMax: 880, lenMin: 26, lenMax: 46, wMin: 1.3, wMax: 2.2, aMin: 0.30, aMax: 0.52 },
]

/**
 * Realistic rain:
 *  - parallax streaks with motion-blur gradient tails and wind slant
 *  - crown-splash + ripple where drops hit the ground line
 *  - condensation beads on the glass that grow, then slide down
 *    wobbling, shedding a trail of residual droplets and absorbing
 *    smaller beads they pass over (volume-conserving).
 */
export default function RainCanvas({ tint = 0.12 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const host = canvas.parentElement
    const ctx = canvas.getContext('2d')
    if (!ctx || !host) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let w = 0
    let h = 0
    let dpr = 1
    let drops = []
    let beads = []
    let splashes = []
    let raf = 0
    let lastTime = 0
    let time = 0
    let windX = 0
    let inView = true

    const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))
    const wantDrops = () => Math.round(clamp((w * h) / 7000, 50, 150))
    const wantBeads = () => Math.round(clamp(w / 26, 10, 34))
    const maxBeadTotal = () => wantBeads() + 90

    /* ------------------------- spawn helpers ------------------------- */

    function newDrop(anywhere) {
      const d = Math.random() < 0.45 ? 0 : Math.random() < 0.65 ? 1 : 2
      const L = LAYERS[d]
      return {
        d,
        x: rand(-40, w + 40),
        y: anywhere ? rand(-h, h) : rand(-h * 0.5, -8),
        sp: rand(L.spMin, L.spMax),
        len: rand(L.lenMin, L.lenMax),
        lw: rand(L.wMin, L.wMax),
        a: rand(L.aMin, L.aMax),
      }
    }

    function newBead(fromTop) {
      const r = fromTop ? rand(1.6, 3.6) : rand(1.8, 7)
      return {
        x: rand(r + 4, Math.max(r + 6, w - r - 4)),
        y: fromTop ? rand(-12, 10) : rand(6, Math.max(24, h - 8)),
        r,
        maxR: rand(5.5, 10),
        grow: rand(0.08, 0.2),
        vy: 0,
        sliding: false,
        t: 0,
        trailAcc: 0,
        phase: rand(0, TAU),
        trail: false,
        life: 0,
      }
    }

    function spawnSplash(x, y) {
      const bits = []
      const n = 2 + ((Math.random() * 3) | 0)
      for (let i = 0; i < n; i++) {
        bits.push({
          x,
          y,
          vx: rand(-70, 70),
          vy: rand(-270, -110),
          r: rand(0.7, 1.9),
        })
      }
      splashes.push({ x, y, t: 0, life: rand(0.4, 0.65), size: rand(0.75, 1.4), bits })
    }

    function seed() {
      drops = Array.from({ length: wantDrops() }, () => newDrop(true))
      beads = Array.from({ length: wantBeads() }, () => newBead(false))
      splashes = []
    }

    function clampBead(b) {
      const hi = Math.max(b.r + 3, w - b.r - 2)
      b.x = clamp(b.x, b.r + 2, hi)
      b.y = clamp(b.y, b.r + 2, Math.max(b.r + 4, h - 2))
    }

    /* ---------------------------- sizing ----------------------------- */

    function resize() {
      const rect = host.getBoundingClientRect()
      const nw = Math.round(rect.width)
      const nh = Math.round(rect.height)
      const ndpr = Math.min(window.devicePixelRatio || 1, 2)
      if (nw < 2 || nh < 2) return
      if (nw === w && nh === h && ndpr === dpr) return

      w = nw
      h = nh
      dpr = ndpr
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      if (!drops.length) {
        seed()
      } else {
        const wd = wantDrops()
        while (drops.length > wd) drops.pop()
        while (drops.length < wd) drops.push(newDrop(true))
        const wb = wantBeads()
        const solid = beads.filter((b) => !b.trail).length
        for (let i = solid; i < wb; i++) beads.push(newBead(false))
        drops.forEach((d) => {
          d.x = clamp(d.x, -40, w + 40)
        })
        beads.forEach(clampBead)
      }
      if (reduce) draw()
    }

    /* ---------------------------- update ----------------------------- */

    function update(dt) {
      time += dt
      windX = Math.sin(time * 0.35) * 22 + Math.sin(time * 0.13) * 10

      // --- falling streaks ---
      for (const dr of drops) {
        dr.x += windX * dt * (0.6 + dr.d * 0.25)
        dr.y += dr.sp * dt

        if (dr.y - 12 > h) {
          if (dr.d === 2 && splashes.length < 24 && Math.random() < 0.4) {
            spawnSplash(dr.x, h - 1)
          }
          Object.assign(dr, newDrop(false))
        } else if (dr.x < -70) {
          dr.x = w + 45
        } else if (dr.x > w + 70) {
          dr.x = -45
        }
      }

      // --- splashes ---
      for (let i = splashes.length - 1; i >= 0; i--) {
        const s = splashes[i]
        s.t += dt
        if (s.t >= s.life) {
          splashes.splice(i, 1)
          continue
        }
        for (const b of s.bits) {
          b.vy += 1500 * dt
          b.x += b.vx * dt
          b.y += b.vy * dt
        }
      }

      // --- glass beads ---
      for (let i = beads.length - 1; i >= 0; i--) {
        const b = beads[i]

        if (b.trail) {
          b.life -= dt
          b.r -= dt * 0.35
          if (b.life <= 0 || b.r < 0.35) beads.splice(i, 1)
          continue
        }

        if (!b.sliding) {
          b.r = Math.min(b.r + b.grow * dt, b.maxR)
          // big beads let go sooner; small ones let go rarely
          const chance = b.r >= b.maxR ? 1 : dt * 0.02 * (b.r / b.maxR) ** 2
          if (Math.random() < chance) b.sliding = true
          continue
        }

        b.t += dt
        b.vy = Math.min(b.vy + (100 + b.r * 50) * dt, 40 + b.r * 35)
        b.y += b.vy * dt
        b.x += Math.sin(b.t * 6 + b.phase) * (10 + b.r * 3) * dt
        b.x = clamp(b.x, b.r + 1, Math.max(b.r + 2, w - b.r - 1))

        // shed residual droplets behind the moving bead
        b.trailAcc += dt
        if (b.trailAcc > 0.06) {
          b.trailAcc = 0
          beads.push({
            ...newBead(false),
            x: b.x + rand(-b.r * 0.5, b.r * 0.5),
            y: b.y - b.r * 0.6,
            r: rand(0.6, b.r * 0.28),
            trail: true,
            life: rand(2, 5),
            sliding: false,
            maxR: 0,
            grow: 0,
          })
        }

        // absorb anything it passes over - volume conserving
        for (let j = beads.length - 1; j >= 0; j--) {
          if (j === i) continue
          const o = beads[j]
          if (o.sliding) continue
          const dx = o.x - b.x
          const dy = o.y - b.y
          if (dx * dx + dy * dy < (b.r + o.r * 0.7) ** 2) {
            b.r = Math.min(Math.sqrt(b.r * b.r + o.r * o.r), 14)
            beads.splice(j, 1)
            if (j < i) i--
          }
        }

        if (b.y - b.r > h + 6) Object.assign(b, newBead(true))
      }

      // keep the residual trail from growing without bound
      if (beads.length > maxBeadTotal()) {
        const idx = beads.findIndex((b) => b.trail)
        if (idx >= 0) beads.splice(idx, 1)
      }
    }

    /* ----------------------------- draw ------------------------------ */

    function drawBead(b) {
      const r = b.r
      if (r < 0.3) return
      const st = b.sliding ? Math.min(b.vy / 500, 0.55) : 0
      const rx = r * (1 - st * 0.3)
      const ry = r * (1 + st)

      // contact shadow
      ctx.globalAlpha = 0.3
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.beginPath()
      ctx.ellipse(b.x + rx * 0.18, b.y + ry * 0.3, rx * 1.02, ry * 0.95, 0, 0, TAU)
      ctx.fill()

      // refracting body: bright at top-left, pooling light at the bottom rim
      ctx.globalAlpha = 1
      const g = ctx.createRadialGradient(
        b.x - rx * 0.35, b.y - ry * 0.4, r * 0.08,
        b.x, b.y, r * 1.05
      )
      g.addColorStop(0, 'rgba(255,255,255,0.55)')
      g.addColorStop(0.45, 'rgba(198,224,255,0.16)')
      g.addColorStop(0.86, 'rgba(255,255,255,0.09)')
      g.addColorStop(1, 'rgba(226,240,255,0.5)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.ellipse(b.x, b.y, rx, ry, 0, 0, TAU)
      ctx.fill()

      // bottom rim light
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'
      ctx.lineWidth = Math.max(0.5, r * 0.13)
      ctx.beginPath()
      ctx.ellipse(b.x, b.y, rx * 0.9, ry * 0.9, 0, Math.PI * 0.15, Math.PI * 0.85)
      ctx.stroke()

      // specular highlight, upper-left
      ctx.fillStyle = 'rgba(255,255,255,0.92)'
      ctx.beginPath()
      ctx.ellipse(b.x - rx * 0.34, b.y - ry * 0.4, rx * 0.26, ry * 0.19, -0.5, 0, TAU)
      ctx.fill()

      // secondary glint, lower-right
      if (r > 2) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)'
        ctx.beginPath()
        ctx.arc(b.x + rx * 0.3, b.y + ry * 0.36, rx * 0.1, 0, TAU)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    function drawSplash(s) {
      const p = Math.min(s.t / s.life, 1)
      const e = 1 - (1 - p) * (1 - p)
      const rx = (2 + e * 15) * s.size
      const ry = rx * 0.3

      ctx.strokeStyle = 'rgba(226,240,255,1)'
      ctx.globalAlpha = (1 - p) * 0.55
      ctx.lineWidth = Math.max(0.4, 1.6 * (1 - p))
      ctx.beginPath()
      ctx.ellipse(s.x, s.y, rx, ry, 0, 0, TAU)
      ctx.stroke()

      ctx.globalAlpha = (1 - p) * 0.3
      ctx.beginPath()
      ctx.ellipse(s.x, s.y, rx * 0.5, ry * 0.5, 0, 0, TAU)
      ctx.stroke()

      ctx.fillStyle = 'rgba(235,245,255,0.95)'
      const br = Math.max(0, 1 - p)
      for (const b of s.bits) {
        ctx.globalAlpha = br * 0.9
        ctx.beginPath()
        ctx.arc(b.x, b.y, b.r * br + 0.2, 0, TAU)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    function draw() {
      ctx.clearRect(0, 0, w, h)

      // moody rain tint so white streaks read over the photo
      if (tint > 0) {
        ctx.fillStyle = `rgba(8,18,32,${tint})`
        ctx.fillRect(0, 0, w, h)
      }

      ctx.lineCap = 'round'

      // far -> near so nearer drops overlay farther ones
      for (let L = 0; L < 3; L++) {
        for (const dr of drops) {
          if (dr.d !== L) continue
          const ang = Math.atan2(dr.sp, windX * (0.6 + dr.d * 0.25))
          const ux = Math.cos(ang)
          const uy = Math.sin(ang)
          const tx = dr.x - ux * dr.len
          const ty = dr.y - uy * dr.len

          ctx.beginPath()
          ctx.moveTo(tx, ty)
          ctx.lineTo(dr.x, dr.y)
          ctx.lineWidth = dr.lw

          if (L === 2) {
            // motion-blur gradient: transparent tail -> bright head
            const g = ctx.createLinearGradient(tx, ty, dr.x, dr.y)
            g.addColorStop(0, 'rgba(214,232,255,0)')
            g.addColorStop(1, `rgba(235,245,255,${dr.a})`)
            ctx.strokeStyle = g
          } else {
            ctx.globalAlpha = dr.a
            ctx.strokeStyle = '#e6f0ff'
          }
          ctx.stroke()
          ctx.globalAlpha = 1
        }
      }

      for (const s of splashes) drawSplash(s)
      for (const b of beads) drawBead(b)
    }

    /* ---------------------------- loop ------------------------------- */

    function frame(now) {
      raf = requestAnimationFrame(frame)
      if (!lastTime) lastTime = now
      // clamp so a background tab doesn't jump everything on return
      const dt = Math.min((now - lastTime) / 1000, 0.05)
      lastTime = now
      if (!inView || document.hidden) return
      update(dt)
      draw()
    }

    resize()

    const ro = new ResizeObserver(resize)
    ro.observe(host)

    const io = new IntersectionObserver(
      (entries) => {
        inView = entries[0].isIntersecting
        if (inView) lastTime = 0
      },
      { threshold: 0 }
    )
    io.observe(canvas)

    const onVis = () => {
      lastTime = 0
    }
    document.addEventListener('visibilitychange', onVis)

    if (!reduce) raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [tint])

  return <canvas ref={canvasRef} className="rain-canvas" aria-hidden="true" />
}
