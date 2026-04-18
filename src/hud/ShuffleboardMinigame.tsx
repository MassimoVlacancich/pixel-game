import { useState, useEffect, useRef, useCallback } from 'react'

const FONT = "'Press Start 2P', monospace"
const WIN_SCORE = 15

// ── SVG perspective constants ─────────────────────────────────────────────────
const SVG_W = 500, SVG_H = 480
const NEAR_Y = 455, FAR_Y = 55
const NEAR_HW = 210, FAR_HW = 88
const PUCK_R_NEAR = 13, PUCK_R_FAR = 6

// Perspective helpers
const toScreenY = (gy: number) => NEAR_Y - gy * (NEAR_Y - FAR_Y)
const toHalfW   = (gy: number) => NEAR_HW - gy * (NEAR_HW - FAR_HW)
const toScreenX = (gx: number, gy: number) => SVG_W / 2 + gx * toHalfW(gy)
const toPuckR   = (gy: number) => PUCK_R_NEAR - gy * (PUCK_R_NEAR - PUCK_R_FAR)

// Table trapezoid corner points
const TL = [SVG_W / 2 - FAR_HW,  FAR_Y ]
const TR = [SVG_W / 2 + FAR_HW,  FAR_Y ]
const BR = [SVG_W / 2 + NEAR_HW, NEAR_Y]
const BL = [SVG_W / 2 - NEAR_HW, NEAR_Y]
const tablePoints   = `${TL[0]},${TL[1]} ${TR[0]},${TR[1]} ${BR[0]},${BR[1]} ${BL[0]},${BL[1]}`
const leftGutterPts = `${TL[0]-12},${TL[1]-4} ${TL[0]},${TL[1]} ${BL[0]},${BL[1]} ${BL[0]-20},${BL[1]+4}`
const rightGutterPts= `${TR[0]},${TR[1]} ${TR[0]+12},${TR[1]-4} ${BR[0]+20},${BR[1]+4} ${BR[0]},${BR[1]}`

// ── Zone boundaries (game-Y: 0=near/player, 1=far/scoring) ───────────────────
const ZONE_LINES = [0.50, 0.72, 0.87]   // dead/1 | 1/2 | 2/3

// ── Physics constants ─────────────────────────────────────────────────────────
// distance = v0 / -ln(FRICTION).  FRICTION=0.008 → -ln(0.008)=4.83
// Full bar → Y≈0.92 → MAX_SPEED = 0.92 × 4.83 = 4.44
// Stop time at full power ≈ 1.1s; at half power ≈ 1.0s
const MAX_SPEED    = 4.44
const FRICTION     = 0.008 // exponential velocity decay per second (stiff — stops in ~1s)
const PUCK_DIAM    = 0.09
const SIDE_LIMIT   = 1.05

// ── Strength bar ──────────────────────────────────────────────────────────────
const BAR_MIN_SPEED    = 0.4
const BAR_MAX_SPEED    = 2.5
const BAR_RETURN_SPEED = 1.5

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase =
  | 'aim-strength'
  | 'aim-direction'
  | 'sliding'
  | 'result'
  | 'between'
  | 'scoring'
  | 'won'

interface Puck {
  id: number; x: number; y: number
  vx: number; vy: number
  player: 0 | 1; inPlay: boolean
}

interface Props {
  onClose: () => void
  onWin:   () => void
  p1Name:  string
  p2Name:  string
}

// ── Scoring ───────────────────────────────────────────────────────────────────

function scoreRound(pucks: Puck[]): [number, number] {
  const alive = pucks.filter(p => p.inPlay)
  const furthest = [
    Math.max(-Infinity, ...alive.filter(p => p.player === 0).map(p => p.y)),
    Math.max(-Infinity, ...alive.filter(p => p.player === 1).map(p => p.y)),
  ]
  if (!isFinite(furthest[0]) && !isFinite(furthest[1])) return [0, 0]
  if (furthest[0] === furthest[1]) return [0, 0]

  const scorer  = furthest[0] > furthest[1] ? 0 : 1
  const oppBest = furthest[1 - scorer]

  let pts = 0
  for (const p of alive.filter(p => p.player === scorer)) {
    if (p.y <= oppBest)      continue
    if (p.y < ZONE_LINES[0]) continue   // dead zone
    pts += p.y >= ZONE_LINES[2] ? 3 : p.y >= ZONE_LINES[1] ? 2 : 1
  }
  const result: [number, number] = [0, 0]
  result[scorer] = pts
  return result
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ShuffleboardMinigame({ onClose, onWin, p1Name, p2Name }: Props) {
  const names = [
    p1Name.slice(0, 7).toUpperCase(),
    p2Name.slice(0, 7).toUpperCase(),
  ]

  // ── React state ──────────────────────────────────────────────────────────
  const [phase,          setPhase]          = useState<Phase>('aim-strength')
  const [scores,         setScores]         = useState<[number, number]>([0, 0])
  const [roundScores,    setRoundScores]    = useState<[number, number]>([0, 0])
  const [current,        setCurrent]        = useState<0 | 1>(0)
  const [pucksThrown,    setPucksThrown]    = useState(0)
  const [round,          setRound]          = useState(1)
  const [pucks,          setPucks]          = useState<Puck[]>([])
  const [barLevel,       setBarLevel]       = useState(0)
  const [, setBarGoingUp] = useState(true)
  const [aimOffset,      setAimOffset]      = useState(0)
  const [lockedStrength, setLockedStrength] = useState<number | null>(null)
  const [betweenMsg,     setBetweenMsg]     = useState('')

  // ── Refs (RAF/setTimeout safe) ────────────────────────────────────────────
  const phaseR          = useRef<Phase>('aim-strength')
  const scoresR         = useRef<[number, number]>([0, 0])
  const roundScoresR    = useRef<[number, number]>([0, 0])
  const currentR        = useRef<0 | 1>(0)
  const pucksThrownR    = useRef(0)
  const roundR          = useRef(1)
  const pucksR          = useRef<Puck[]>([])
  const barLevelR       = useRef(0)
  const barGoingUpR     = useRef(true)
  const aimOffsetR      = useRef(0)
  const aimDirR         = useRef(1)
  const lockedStrengthR = useRef<number | null>(null)
  const puckIdR         = useRef(0)
  const prevFrameR      = useRef(0)
  const rafR            = useRef(0)
  const timers          = useRef<ReturnType<typeof setTimeout>[]>([])

  const addTimer = (fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms)
    timers.current.push(id)
    return id
  }

  // ── Bar color ─────────────────────────────────────────────────────────────
  const barColor = (level: number) => {
    const r = Math.round(level * 220)
    const g = Math.round(200 - level * 140)
    const b = Math.round(50  - level * 50)
    return `rgb(${r},${g},${b})`
  }

  // ── doThrow ───────────────────────────────────────────────────────────────
  const doThrow = useCallback(() => {
    if (phaseR.current !== 'aim-direction') return

    const strength = lockedStrengthR.current ?? 0.5
    const aim      = aimOffsetR.current
    const speed    = strength * MAX_SPEED

    const newPuck: Puck = {
      id: puckIdR.current++,
      x: aim * 0.85, y: 0.02,   // launch from cursor position (aim ±1 → x ±0.85)
      vx: 0,                     // straight shot — position IS the aim, not angle
      vy: speed,
      player: currentR.current,
      inPlay: true,
    }

    const newPucks = [...pucksR.current, newPuck]
    setPucks(newPucks); pucksR.current = newPucks

    const newThrown = pucksThrownR.current + 1
    setPucksThrown(newThrown); pucksThrownR.current = newThrown

    setLockedStrength(null); lockedStrengthR.current = null
    setPhase('sliding'); phaseR.current = 'sliding'
  }, [])

  // ── AI throw ──────────────────────────────────────────────────────────────
  const scheduleAI = useCallback(() => {
    const p1Pucks = pucksR.current.filter(p => p.player === 0 && p.inPlay)
    const oppFar  = p1Pucks.sort((a, b) => b.y - a.y)[0]
    const tactical = oppFar && oppFar.y >= ZONE_LINES[1]

    const strength = tactical ? 0.65 + Math.random() * 0.25 : 0.45 + Math.random() * 0.4
    const aim      = tactical
      ? oppFar.x + Math.random() * 0.1 - 0.05
      : Math.random() * 0.5 - 0.25

    const delay = 700 + Math.random() * 600

    addTimer(() => {
      if (currentR.current !== 1) return
      // Lock strength + transition to aim-direction
      barLevelR.current = strength; setBarLevel(strength)
      lockedStrengthR.current = strength; setLockedStrength(strength)
      aimOffsetR.current = aim; setAimOffset(aim)
      setPhase('aim-direction'); phaseR.current = 'aim-direction'

      addTimer(() => {
        if (currentR.current !== 1) return
        doThrow()
      }, delay)
    }, delay)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doThrow])

  // ── transitionToResult ────────────────────────────────────────────────────
  const transitionToResult = useCallback(() => {
    setPhase('result'); phaseR.current = 'result'
    addTimer(() => {
      const next = (currentR.current === 0 ? 1 : 0) as 0 | 1
      setCurrent(next);       currentR.current = next
      setLockedStrength(null); lockedStrengthR.current = null
      setBarLevel(0);          barLevelR.current = 0
      setBarGoingUp(true);     barGoingUpR.current = true
      setAimOffset(0);         aimOffsetR.current = 0
      setPhase('aim-strength'); phaseR.current = 'aim-strength'
      if (next === 1) scheduleAI()
    }, 700)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleAI])

  // ── transitionToScoring ───────────────────────────────────────────────────
  const transitionToScoring = useCallback(() => {
    const rndPts   = scoreRound(pucksR.current)
    const newScores: [number, number] = [
      scoresR.current[0] + rndPts[0],
      scoresR.current[1] + rndPts[1],
    ]
    setRoundScores(rndPts);    roundScoresR.current = rndPts
    setScores(newScores);      scoresR.current = newScores
    setPhase('scoring');       phaseR.current = 'scoring'

    addTimer(() => {
      if (newScores[0] >= WIN_SCORE || newScores[1] >= WIN_SCORE) {
        setPhase('won'); phaseR.current = 'won'
        addTimer(onWin, 1500)
        return
      }
      // Build between message
      const msg = newScores[0] > newScores[1]
        ? `${names[0]} LEADS ${newScores[0]}-${newScores[1]}`
        : newScores[1] > newScores[0]
        ? `${names[1]} LEADS ${newScores[1]}-${newScores[0]}`
        : `TIED ${newScores[0]}-${newScores[1]}`
      setBetweenMsg(msg)

      // Clear board
      setPucks([]);              pucksR.current = []
      setPucksThrown(0);         pucksThrownR.current = 0
      setRound(r => r + 1);      roundR.current++
      setCurrent(0);             currentR.current = 0
      setLockedStrength(null);   lockedStrengthR.current = null
      setBarLevel(0);            barLevelR.current = 0
      setBarGoingUp(true);       barGoingUpR.current = true
      setAimOffset(0);           aimOffsetR.current = 0
      setRoundScores([0, 0]);    roundScoresR.current = [0, 0]
      setPhase('between');       phaseR.current = 'between'

      addTimer(() => {
        setPhase('aim-strength'); phaseR.current = 'aim-strength'
        if (currentR.current === 1) scheduleAI()
      }, 2000)
    }, 2000)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onWin, scheduleAI])

  // ── RAF animation loop ────────────────────────────────────────────────────
  useEffect(() => {
    prevFrameR.current = performance.now()
    cancelAnimationFrame(rafR.current)

    const tick = (now: number) => {
      const dt = Math.min((now - prevFrameR.current) / 1000, 0.05)
      prevFrameR.current = now
      const p = phaseR.current

      // ── Strength bar oscillation ──
      if (p === 'aim-strength') {
        let level   = barLevelR.current
        let goingUp = barGoingUpR.current
        if (goingUp) {
          const speed = BAR_MIN_SPEED + level * (BAR_MAX_SPEED - BAR_MIN_SPEED)
          level += speed * dt
          if (level >= 1.0) { level = 1.0; goingUp = false }
        } else {
          level -= BAR_RETURN_SPEED * dt
          if (level <= 0) { level = 0; goingUp = true }
        }
        barLevelR.current = level;     setBarLevel(level)
        barGoingUpR.current = goingUp; setBarGoingUp(goingUp)
      }

      // ── Aim cursor — joystick or auto-sweep ──
      if (p === 'aim-direction') {
        const gp    = navigator.getGamepads()[0]
        const axisX = gp?.axes[0] ?? 0

        if (Math.abs(axisX) > 0.15) {
          // Controller: left stick drives aim directly
          let off = Math.max(-1, Math.min(1, aimOffsetR.current + axisX * 1.8 * dt))
          aimOffsetR.current = off; setAimOffset(off)
        } else {
          // Keyboard fallback: auto-sweep left/right
          let off = aimOffsetR.current
          let dir = aimDirR.current
          off += dir * 0.9 * dt
          if (off >  1.0) { off =  1.0; dir = -1 }
          if (off < -1.0) { off = -1.0; dir =  1 }
          aimOffsetR.current = off; setAimOffset(off)
          aimDirR.current    = dir
        }
      }

      // ── Physics (sliding) ──
      if (p === 'sliding') {
        const ps = pucksR.current.map(q => ({ ...q }))
        const decay = Math.pow(FRICTION, dt)

        for (const q of ps) {
          if (!q.inPlay) continue
          q.x += q.vx * dt
          q.y += q.vy * dt
          q.vx *= decay
          q.vy *= decay
          const spd = Math.sqrt(q.vx * q.vx + q.vy * q.vy)
          if (spd < 0.02) { q.vx = 0; q.vy = 0 }
          if (q.y > 1.0 || Math.abs(q.x) > SIDE_LIMIT) q.inPlay = false
        }

        // Elastic puck-puck collisions
        for (let i = 0; i < ps.length; i++) {
          for (let j = i + 1; j < ps.length; j++) {
            const a = ps[i], b = ps[j]
            if (!a.inPlay || !b.inPlay) continue
            const dx   = b.x - a.x
            const dy   = b.y - a.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist < PUCK_DIAM && dist > 0) {
              const nx = dx / dist, ny = dy / dist
              const dvn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
              if (dvn < 0) {
                a.vx += dvn * nx;  a.vy += dvn * ny
                b.vx -= dvn * nx;  b.vy -= dvn * ny
              }
              const sep = (PUCK_DIAM * 1.02 - dist) / 2
              a.x -= sep * nx;  a.y -= sep * ny
              b.x += sep * nx;  b.y += sep * ny
            }
          }
        }

        pucksR.current = ps
        setPucks([...ps])

        const anyMoving = ps.some(q => q.inPlay && (Math.abs(q.vx) > 0.02 || Math.abs(q.vy) > 0.02))
        if (!anyMoving) {
          if (pucksThrownR.current >= 8) transitionToScoring()
          else transitionToResult()
          return
        }
      }

      rafR.current = requestAnimationFrame(tick)
    }
    rafR.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafR.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // ── Keyboard input (capture phase, blocks character controls) ────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      e.stopImmediatePropagation()
      if (e.code === 'Escape') { onClose(); return }
      if (['Space', 'Enter', 'KeyA'].includes(e.code)) {
        e.preventDefault()
        if (currentR.current !== 0) return   // only P1 (human)
        if (phaseR.current === 'aim-strength') {
          const locked = barLevelR.current
          setLockedStrength(locked); lockedStrengthR.current = locked
          setBarGoingUp(false);      barGoingUpR.current = false
          setAimOffset(0);           aimOffsetR.current = 0
          aimDirR.current = 1
          setPhase('aim-direction'); phaseR.current = 'aim-direction'
        } else if (phaseR.current === 'aim-direction') {
          doThrow()
        }
      }
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [doThrow, onClose])

  // ── Gamepad polling ───────────────────────────────────────────────────────
  useEffect(() => {
    let prevA = false, prevB = false, raf = 0
    const poll = () => {
      const gp = navigator.getGamepads()[0]
      if (gp) {
        const a = gp.buttons[0]?.pressed ?? false
        const b = gp.buttons[1]?.pressed ?? false
        if (a && !prevA && currentR.current === 0) {
          if (phaseR.current === 'aim-strength') {
            const locked = barLevelR.current
            setLockedStrength(locked); lockedStrengthR.current = locked
            setBarGoingUp(false);      barGoingUpR.current = false
            setAimOffset(0);           aimOffsetR.current = 0
            aimDirR.current = 1
            setPhase('aim-direction'); phaseR.current = 'aim-direction'
          } else if (phaseR.current === 'aim-direction') {
            doThrow()
          }
        }
        if (b && !prevB) onClose()
        prevA = a; prevB = b
      }
      raf = requestAnimationFrame(poll)
    }
    raf = requestAnimationFrame(poll)
    return () => cancelAnimationFrame(raf)
  }, [doThrow, onClose])

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => () => {
    cancelAnimationFrame(rafR.current)
    timers.current.forEach(clearTimeout)
  }, [])

  // ── Derived display ───────────────────────────────────────────────────────
  const isAI = current === 1

  const instruction =
    phase === 'won'         ? `${names[scoresR.current[0] >= WIN_SCORE ? 0 : 1]} WINS!` :
    phase === 'between'     ? betweenMsg :
    phase === 'scoring'     ? (roundScores[0] > 0 ? `${names[0]} SCORES ${roundScores[0]}!` :
                               roundScores[1] > 0 ? `${names[1]} SCORES ${roundScores[1]}!` : 'NO SCORE') :
    phase === 'result'      ? '' :
    isAI                    ? `${names[1]} THROWING...` :
    phase === 'aim-strength'? 'SPACE — SET POWER' :
    phase === 'aim-direction'? 'SPACE — THROW' :
    phase === 'sliding'     ? '...' :
    ''

  const instrColor =
    phase === 'won'     ? '#FFD700' :
    phase === 'between' ? '#FFDD44' :
    phase === 'scoring' ? '#44FF88' :
    isAI                ? '#FF8844' :
    '#44AAFF'

  // Zone label: zoneIdx 0→zone1 (ZONE_LINES[0]..ZONE_LINES[1]), 1→zone2, 2→zone3
  const zoneLabel = (zoneIdx: number, label: string) => {
    const lo  = ZONE_LINES[zoneIdx]
    const hi  = zoneIdx === 2 ? 1.0 : ZONE_LINES[zoneIdx + 1]
    const mid = (lo + hi) / 2
    const sx  = toScreenX(0, mid)
    const sy  = toScreenY(mid)
    const fs  = 10 - mid * 5
    return (
      <text key={label} x={sx} y={sy} fontSize={fs} fill="rgba(255,255,255,0.35)"
        textAnchor="middle" dominantBaseline="middle" fontFamily="monospace" fontWeight="bold">
        {label}
      </text>
    )
  }

  // ── SVG: zone divider line across the trapezoid ───────────────────────────
  const zoneLine = (gy: number) => {
    const sy = toScreenY(gy)
    const hw = toHalfW(gy)
    return <line key={gy} x1={SVG_W / 2 - hw} y1={sy} x2={SVG_W / 2 + hw} y2={sy}
      stroke="#C8A96A" strokeWidth={1.8} />
  }

  // Dead zone trapezoid (between near end and first zone line)
  const deadZonePts = (() => {
    const y0 = toScreenY(0)
    const y1 = toScreenY(ZONE_LINES[0])
    const hw0 = toHalfW(0)
    const hw1 = toHalfW(ZONE_LINES[0])
    return `${SVG_W/2 - hw1},${y1} ${SVG_W/2 + hw1},${y1} ${SVG_W/2 + hw0},${y0} ${SVG_W/2 - hw0},${y0}`
  })()

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 60,
      background: 'rgba(2, 2, 12, 0.85)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: FONT,
      pointerEvents: 'all',
      userSelect: 'none',
    }}>
      {/* Scanlines */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.10) 2px, rgba(0,0,0,0.10) 4px)',
      }} />

      {/* Zoom wrapper */}
      <div style={{ zoom: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1 }}>

        {/* Title */}
        <div style={{ fontSize: 14, color: '#FFD9A0', letterSpacing: 4, marginBottom: 18 }}>
          SHUFFLEBOARD
        </div>

        {/* Main row */}
        <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start' }}>

          {/* ── LEFT: Strength bar ── */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)', letterSpacing: 2 }}>POWER</div>
            <div style={{
              position: 'relative', width: 28, height: 220,
              border: '2px solid #555', background: 'rgba(0,0,0,0.4)',
              overflow: 'hidden',
            }}>
              {/* Fill */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                height: `${barLevel * 100}%`,
                background: barColor(barLevel),
                transition: 'background 0.05s',
              }} />
              {/* 50% tick */}
              <div style={{
                position: 'absolute', left: 0, right: 0, bottom: '50%',
                borderTop: '1px dashed rgba(255,255,255,0.3)',
              }} />
              {/* Top tick */}
              <div style={{
                position: 'absolute', left: 0, right: 0, top: 0,
                borderTop: '2px solid rgba(255,80,80,0.6)',
              }} />
            </div>
            {/* Locked strength indicator */}
            {lockedStrength !== null && (
              <div style={{ fontSize: 7, color: '#FFD700', letterSpacing: 1 }}>
                {Math.round(lockedStrength * 100)}%
              </div>
            )}
            {phase === 'aim-strength' && currentR.current === 0 && (
              <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.3)', letterSpacing: 1, textAlign: 'center' }}>
                SPACE
              </div>
            )}
          </div>

          {/* ── CENTER: Table SVG + instruction ── */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <svg
              width={SVG_W} height={SVG_H}
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              style={{ imageRendering: 'pixelated' }}
            >
              {/* 1. Background */}
              <rect width={SVG_W} height={SVG_H} fill="#1A1008" />

              {/* 2. Side gutters */}
              <polygon points={leftGutterPts}  fill="#2A1E0E" />
              <polygon points={rightGutterPts} fill="#2A1E0E" />

              {/* 3. Table surface */}
              <polygon points={tablePoints} fill="#5C3D1E" />

              {/* 4. Dead zone tint */}
              <polygon points={deadZonePts} fill="rgba(0,0,0,0.28)" />

              {/* 5. Zone divider lines */}
              {ZONE_LINES.map(gy => zoneLine(gy))}

              {/* 6. Zone labels */}
              {zoneLabel(0, '1')}
              {zoneLabel(1, '2')}
              {zoneLabel(2, '3')}

              {/* 7. Far-end rail */}
              <line
                x1={SVG_W / 2 - FAR_HW} y1={FAR_Y}
                x2={SVG_W / 2 + FAR_HW} y2={FAR_Y}
                stroke="#8B6914" strokeWidth={3}
              />

              {/* 8. Side edge rails */}
              <line x1={TL[0]} y1={TL[1]} x2={BL[0]} y2={BL[1]} stroke="#8B6914" strokeWidth={2.5} />
              <line x1={TR[0]} y1={TR[1]} x2={BR[0]} y2={BR[1]} stroke="#8B6914" strokeWidth={2.5} />

              {/* 9. Pucks (ascending y = near on top) */}
              {[...pucks]
                .filter(p => p.inPlay)
                .sort((a, b) => a.y - b.y)
                .map(p => {
                  const sx = toScreenX(p.x, p.y)
                  const sy = toScreenY(p.y)
                  const r  = toPuckR(p.y)
                  const col = p.player === 0 ? '#44AAFF' : '#FF8844'
                  return (
                    <g key={p.id}>
                      <circle cx={sx} cy={sy} r={r} fill={col} stroke="#FFF" strokeWidth={0.8} opacity={0.95} />
                      <circle cx={sx - r * 0.28} cy={sy - r * 0.28} r={r * 0.22} fill="rgba(255,255,255,0.45)" />
                    </g>
                  )
                })
              }

              {/* 10. Aim cursor (aim-direction phase only) */}
              {phase === 'aim-direction' && (() => {
                const gy = 0.05
                const sx = toScreenX(aimOffset, gy)
                const sy = toScreenY(gy)
                const r  = toPuckR(gy)
                const col = current === 0 ? '#FFD700' : '#FF5500'
                const pCol = current === 0 ? 'rgba(68,170,255,0.35)' : 'rgba(255,136,68,0.35)'
                const pStroke = current === 0 ? '#44AAFF' : '#FF8844'
                return (
                  <g>
                    <line x1={sx} y1={NEAR_Y - 30} x2={sx} y2={NEAR_Y + 8} stroke={col} strokeWidth={2} />
                    <circle cx={sx} cy={sy} r={r} fill={pCol} stroke={pStroke} strokeWidth={1.2} />
                  </g>
                )
              })()}

              {/* Throw position indicator during aim-strength (center ghost) */}
              {phase === 'aim-strength' && currentR.current === 0 && (() => {
                const gy = 0.05
                const sx = toScreenX(0, gy)
                const sy = toScreenY(gy)
                const r  = toPuckR(gy)
                return (
                  <circle cx={sx} cy={sy} r={r}
                    fill="rgba(68,170,255,0.15)" stroke="rgba(68,170,255,0.4)" strokeWidth={1} strokeDasharray="3 3" />
                )
              })()}
            </svg>

            {/* Instruction */}
            <div style={{ fontSize: 11, color: instrColor, minHeight: 22, letterSpacing: 2, textAlign: 'center' }}>
              {instruction}
            </div>
            <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.22)', letterSpacing: 1 }}>
              ESC / B — EXIT
            </div>
          </div>

          {/* ── RIGHT: Scoreboard ── */}
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 16,
            background: 'rgba(0,0,0,0.45)',
            border: '1px solid rgba(255,255,255,0.14)',
            padding: '22px 26px',
            minWidth: 200,
          }}>
            {/* Round */}
            <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.35)', letterSpacing: 2 }}>ROUND {round}</div>

            <div style={{ height: 1, background: 'rgba(255,255,255,0.1)' }} />

            {/* Player scores */}
            {([0, 1] as const).map(i => {
              const active = current === i
              const col    = i === 0 ? '#44AAFF' : '#FF8844'
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{
                    fontSize: 8, letterSpacing: 1,
                    color: active ? col : 'rgba(255,255,255,0.35)',
                    borderBottom: `2px solid ${active ? col : 'transparent'}`,
                    paddingBottom: 4,
                  }}>
                    {names[i]}
                  </div>
                  {/* Score number */}
                  <div style={{ fontSize: 36, lineHeight: 1, color: scores[i] >= WIN_SCORE ? '#FFD700' : '#FFF' }}>
                    {scores[i]}
                  </div>
                  {/* Progress bar toward 15 */}
                  <div style={{ height: 5, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 2,
                      width: `${Math.min(scores[i] / WIN_SCORE, 1) * 100}%`,
                      background: col,
                    }} />
                  </div>
                  <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.25)' }}>{scores[i]} / {WIN_SCORE}</div>
                </div>
              )
            })}

            <div style={{ height: 1, background: 'rgba(255,255,255,0.1)' }} />

            {/* This round — puck slots */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)', letterSpacing: 2 }}>THIS ROUND</div>
              {([0, 1] as const).map(pi => {
                const col = pi === 0 ? '#44AAFF' : '#FF8844'
                return (
                  <div key={pi} style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: col, flexShrink: 0 }} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[0, 1, 2, 3].map(slot => {
                        const throwIdx = pi === 0 ? slot * 2 : slot * 2 + 1
                        const thrown   = throwIdx < pucksThrown
                        const isNext   = throwIdx === pucksThrown && current === pi
                        return (
                          <div key={slot} style={{
                            width: 14, height: 14, borderRadius: '50%',
                            background: thrown ? col : 'transparent',
                            border: `2px solid ${isNext ? '#FFD700' : col + '66'}`,
                            opacity: thrown ? 1 : 0.5,
                          }} />
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Round scores (shown after round ends) */}
            {(phase === 'scoring' || phase === 'between' || phase === 'won') && (
              <>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.1)' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)', letterSpacing: 2 }}>ROUND SCORE</div>
                  {([0, 1] as const).map(i => roundScores[i] > 0 && (
                    <div key={i} style={{ fontSize: 12, color: i === 0 ? '#44AAFF' : '#FF8844' }}>
                      {names[i]} +{roundScores[i]}
                    </div>
                  ))}
                  {roundScores[0] === 0 && roundScores[1] === 0 && (
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>NO SCORE</div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
