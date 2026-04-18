import { useState, useEffect, useRef, useCallback } from 'react'

const FONT = "'Press Start 2P', monospace"
const INIT_SCORE = 301

// Clockwise from top: standard dartboard segment values
const SEG = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]

// SVG board geometry (viewBox 0 0 200 200)
const CX = 100, CY = 100
const R_BOARD  = 90   // outer dark circle
const R_SCORE  = 82   // outer edge of scoring ring
const R_INNER  = 30   // inner edge of scoring ring
const R_BULL   = 16   // inner bull (green)
const R_EYE    = 7    // bullseye (red)
const R_NUM    = 93   // segment number label radius

// ── Scoring ───────────────────────────────────────────────────────────────────

function calcScore(x: number, y: number): number {
  const dx = x - CX, dy = y - CY
  const d = Math.sqrt(dx * dx + dy * dy)
  if (d < R_EYE)   return 50
  if (d < R_BULL)  return 25
  if (d < R_SCORE) {
    // atan2(dx, -dy) gives 0 at top, clockwise positive
    // Add half-segment offset (π/20) so each segment is centred on its angle,
    // matching the visual segPath() which spans [i*18°-9°, i*18°+9°].
    const a = (Math.atan2(dx, -dy) + 2 * Math.PI + Math.PI / 20) % (2 * Math.PI)
    return SEG[Math.floor(a / (2 * Math.PI) * 20) % 20]
  }
  return 0
}

// ── SVG helpers ───────────────────────────────────────────────────────────────

function segPath(i: number, r1: number, r2: number): string {
  const a0 = (i * 18 - 9) * Math.PI / 180
  const a1 = (i * 18 + 9) * Math.PI / 180
  const p = (a: number, r: number) =>
    `${(CX + r * Math.sin(a)).toFixed(2)},${(CY - r * Math.cos(a)).toFixed(2)}`
  return `M${p(a0,r1)}L${p(a0,r2)}A${r2},${r2},0,0,1,${p(a1,r2)}L${p(a1,r1)}A${r1},${r1},0,0,0,${p(a0,r1)}Z`
}

function numPos(i: number): [number, number] {
  const a = i * 18 * Math.PI / 180
  return [CX + R_NUM * Math.sin(a), CY - R_NUM * Math.cos(a)]
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase = 'aim-x' | 'aim-y' | 'result' | 'between' | 'won'

interface Dart { x: number; y: number; score: number; player: 0 | 1 }

interface Props {
  onClose: () => void
  onWin:   () => void
  p1Name:  string
  p2Name:  string
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DartsMinigame({ onClose, onWin, p1Name, p2Name }: Props) {
  const names = [
    p1Name.slice(0, 7).toUpperCase(),
    p2Name.slice(0, 7).toUpperCase(),
  ]

  // ── React state (drives render) ──────────────────────────────────────────
  const [scores,     setScores]     = useState<[number, number]>([INIT_SCORE, INIT_SCORE])
  const [current,    setCurrent]    = useState<0 | 1>(0)
  const [, setThrowsTurn] = useState(0)                               // 0-2
  const [turnSlots,  setTurnSlots]  = useState<(number | null)[]>([null, null, null])
  const [darts,      setDarts]      = useState<Dart[]>([])   // full history (scoreboard RECENT)
  const [handDarts,  setHandDarts]  = useState<Dart[]>([])   // current hand only (board dots)
  const [phase,      setPhase]      = useState<Phase>('aim-x')
  const [lockedX,    setLockedX]    = useState<number | null>(null)
  const [cursorX,    setCursorX]    = useState(CX)
  const [cursorY,    setCursorY]    = useState(CY)
  const [lastScore,  setLastScore]  = useState<number | null>(null)
  const [betweenMsg, setBetweenMsg] = useState('')

  // ── Refs (always fresh, safe inside RAF/setTimeout) ──────────────────────
  const scoresR     = useRef<[number, number]>([INIT_SCORE, INIT_SCORE])
  const currentR    = useRef<0 | 1>(0)
  const throwsTurnR = useRef(0)
  const turnSlotsR  = useRef<(number | null)[]>([null, null, null])
  const dartsR      = useRef<Dart[]>([])
  const handDartsR  = useRef<Dart[]>([])
  const phaseR      = useRef<Phase>('aim-x')
  const lockedXR    = useRef<number | null>(null)
  const cursorXR    = useRef(CX)
  const cursorYR    = useRef(CY)
  const speedR      = useRef(1.8)   // escalates with each throw
  const t0R         = useRef(0)
  const rafR        = useRef(0)
  const timers      = useRef<ReturnType<typeof setTimeout>[]>([])

  // helper — register a timeout that auto-clears on unmount
  const addTimer = (fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms)
    timers.current.push(id)
    return id
  }

  // ── Animation loop ────────────────────────────────────────────────────────
  // Restarted on every phase change so t=0 resets cleanly.
  useEffect(() => {
    t0R.current = performance.now()
    cancelAnimationFrame(rafR.current)

    const tick = (now: number) => {
      const t = (now - t0R.current) / 1000
      const s = speedR.current
      const p = phaseR.current
      if (p === 'aim-x') {
        const x = CX + R_SCORE * Math.sin(t * s)
        cursorXR.current = x
        setCursorX(x)
      } else if (p === 'aim-y') {
        const y = CY + R_SCORE * Math.sin(t * s)
        cursorYR.current = y
        setCursorY(y)
      }
      rafR.current = requestAnimationFrame(tick)
    }
    rafR.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafR.current)
  }, [phase])

  // ── Core throw logic ──────────────────────────────────────────────────────
  const doThrow = useCallback(() => {
    const x    = lockedXR.current ?? cursorXR.current
    const y    = cursorYR.current
    const raw  = calcScore(x, y)
    const p    = currentR.current
    const prev = scoresR.current[p]

    // Bust: throw that would take score below 0 → scores 0 instead
    const bust   = prev - raw < 0
    const scored = bust ? 0 : raw

    // Escalate speed
    speedR.current = Math.min(6.0, 1.8 + dartsR.current.length * 0.20)

    // Update dart lists
    const newDart = { x, y, score: scored, player: p } as Dart
    const newDarts = [...dartsR.current, newDart]
    setDarts(newDarts); dartsR.current = newDarts
    const newHandDarts = [...handDartsR.current, newDart]
    setHandDarts(newHandDarts); handDartsR.current = newHandDarts

    // Update scores
    const newScores: [number, number] = [...scoresR.current] as [number, number]
    newScores[p] = bust ? prev : prev - raw
    setScores(newScores); scoresR.current = newScores

    // Fill this-turn slot
    const slot = throwsTurnR.current
    const newSlots = [...turnSlotsR.current]
    newSlots[slot] = scored
    setTurnSlots(newSlots); turnSlotsR.current = newSlots

    setLastScore(scored)
    setPhase('result'); phaseR.current = 'result'

    const newThrowsTurn = throwsTurnR.current + 1
    setThrowsTurn(newThrowsTurn); throwsTurnR.current = newThrowsTurn

    // Win?
    if (newScores[p] === 0) {
      addTimer(() => {
        setPhase('won'); phaseR.current = 'won'
        addTimer(onWin, 1500)
      }, 900)
      return
    }

    addTimer(() => {
      if (newThrowsTurn >= 3) {
        // End of turn — switch player
        const next = (1 - p) as 0 | 1
        setBetweenMsg(next === 0 ? 'YOUR TURN' : `${names[next]}'S TURN`)
        setPhase('between'); phaseR.current = 'between'

        addTimer(() => {
          setCurrent(next); currentR.current = next
          setThrowsTurn(0); throwsTurnR.current = 0
          setTurnSlots([null, null, null]); turnSlotsR.current = [null, null, null]
          setLockedX(null); lockedXR.current = null
          setLastScore(null)
          setHandDarts([]); handDartsR.current = []   // clear board for new hand
          setPhase('aim-x'); phaseR.current = 'aim-x'
          t0R.current = performance.now()
          if (next === 1) scheduleAI()
        }, 2000)
      } else {
        // Same player, next throw
        setLockedX(null); lockedXR.current = null
        setLastScore(null)
        setPhase('aim-x'); phaseR.current = 'aim-x'
        t0R.current = performance.now()
        if (p === 1) scheduleAI()
      }
    }, 700)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onWin])

  // ── AI (buddy) auto-throw ─────────────────────────────────────────────────
  const scheduleAI = useCallback(() => {
    // Random target in scoring area, slightly biased toward bull
    const r     = 6 + Math.random() * (R_SCORE - 10)
    const angle = Math.random() * Math.PI * 2
    const tX = CX + r * Math.sin(angle)
    const tY = CY - r * Math.cos(angle)
    const delay = 750 + Math.random() * 650

    // Lock X after delay
    addTimer(() => {
      if (currentR.current !== 1) return
      setLockedX(tX); lockedXR.current = tX
      setCursorX(tX); cursorXR.current = tX
      setPhase('aim-y'); phaseR.current = 'aim-y'
      t0R.current = performance.now()

      // Lock Y and throw after another delay
      addTimer(() => {
        if (currentR.current !== 1) return
        setCursorY(tY); cursorYR.current = tY
        doThrow()
      }, delay)
    }, delay)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doThrow])

  // ── Human: lock X axis ────────────────────────────────────────────────────
  const lockX = useCallback(() => {
    if (currentR.current !== 0 || phaseR.current !== 'aim-x') return
    const x = cursorXR.current
    setLockedX(x); lockedXR.current = x
    setPhase('aim-y'); phaseR.current = 'aim-y'
    t0R.current = performance.now()
  }, [])

  // ── Human: confirm throw ─────────────────────────────────────────────────
  const confirmThrow = useCallback(() => {
    if (currentR.current !== 0 || phaseR.current !== 'aim-y') return
    doThrow()
  }, [doThrow])

  // ── Keyboard input ────────────────────────────────────────────────────────
  // Capture phase + stopImmediatePropagation on ALL keys so nothing leaks to
  // the character controller (prevents jumping on Space, movement on WASD, etc.)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Block every key from reaching bubble-phase listeners (character controls, HUD pause)
      e.stopImmediatePropagation()

      if (e.code === 'Escape') { onClose(); return }

      if (['Space', 'Enter', 'KeyA'].includes(e.code)) {
        e.preventDefault()
        if (phaseR.current === 'aim-x') lockX()
        else if (phaseR.current === 'aim-y') confirmThrow()
      }
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [lockX, confirmThrow, onClose])

  // ── Gamepad polling ───────────────────────────────────────────────────────
  useEffect(() => {
    let prevA = false, prevB = false, raf = 0
    const poll = () => {
      const gp = navigator.getGamepads()[0]
      if (gp) {
        const a = gp.buttons[0]?.pressed ?? false
        const b = gp.buttons[1]?.pressed ?? false
        if (a && !prevA) {
          if (phaseR.current === 'aim-x') lockX()
          else if (phaseR.current === 'aim-y') confirmThrow()
        }
        if (b && !prevB) onClose()
        prevA = a; prevB = b
      }
      raf = requestAnimationFrame(poll)
    }
    raf = requestAnimationFrame(poll)
    return () => cancelAnimationFrame(raf)
  }, [lockX, confirmThrow, onClose])

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => () => {
    cancelAnimationFrame(rafR.current)
    timers.current.forEach(clearTimeout)
  }, [])

  // ── Derived display values ────────────────────────────────────────────────
  const isAI = current === 1

  const instruction =
    phase === 'won'    ? `${names[scoresR.current[0] === 0 ? 0 : 1]} WINS!` :
    phase === 'between' ? betweenMsg :
    phase === 'result' ? (
      lastScore === 50 ? 'BULLSEYE!' :
      lastScore === 25 ? 'BULL!' :
      lastScore === 0  ? (isAI ? 'MISS' : 'MISS!') :
      `${lastScore} PTS`
    ) :
    isAI               ? `${names[1]} THROWING...` :
    phase === 'aim-x'  ? 'SPACE — AIM' :
    phase === 'aim-y'  ? 'SPACE — THROW' :
    ''

  const instrColor =
    phase === 'won'                                    ? '#FFD700' :
    phase === 'between'                                ? '#FFDD44' :
    phase === 'result' && lastScore != null && lastScore >= 25 ? '#FFD700' :
    phase === 'result' && lastScore != null && lastScore > 0   ? '#44FF88' :
    phase === 'result'                                 ? '#FF4444' :
    isAI                                               ? '#FF8844' :
    '#44AAFF'

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 60,
      background: 'rgba(2, 2, 12, 0.85)',
      backdropFilter: 'blur(2px)',
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

      {/* Zoomed content wrapper — scales everything 2× without touching individual values */}
      <div style={{ zoom: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1 }}>

      {/* Title */}
      <div style={{ fontSize: 18, color: '#FFD9A0', letterSpacing: 5, marginBottom: 24 }}>
        DARTS
      </div>

      {/* Main row: board + scoreboard */}
      <div style={{ display: 'flex', gap: 48, alignItems: 'flex-start' }}>

        {/* ── Board column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
          <svg
            width={480} height={480}
            viewBox="0 0 200 200"
            style={{ imageRendering: 'pixelated' }}
          >
            {/* Outer board circle */}
            <circle cx={CX} cy={CY} r={R_BOARD} fill="#1A1A1A" />

            {/* Scoring ring: alternating dark-green / dark-brown */}
            {SEG.map((_, i) => (
              <path
                key={i}
                d={segPath(i, R_INNER, R_SCORE)}
                fill={i % 2 === 0 ? '#1C3E1C' : '#6B2E0A'}
                stroke="#111" strokeWidth={0.4}
              />
            ))}

            {/* Inner fill between bull and scoring ring */}
            <circle cx={CX} cy={CY} r={R_INNER} fill="#1A1A1A" />

            {/* Segment numbers */}
            {SEG.map((val, i) => {
              const [nx, ny] = numPos(i)
              return (
                <text
                  key={`n${i}`}
                  x={nx} y={ny}
                  fontSize={6.5}
                  fill="#DDDDDD"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{ fontFamily: 'monospace', fontWeight: 'bold' }}
                >
                  {val}
                </text>
              )
            })}

            {/* Inner bull */}
            <circle cx={CX} cy={CY} r={R_BULL}  fill="#1A6B1A" stroke="#111" strokeWidth={0.5} />
            {/* Bullseye */}
            <circle cx={CX} cy={CY} r={R_EYE}   fill="#CC2222" stroke="#111" strokeWidth={0.5} />

            {/* Current-hand dart marks (cleared on every turn switch) */}
            {handDarts.map((d, i) => (
              <circle
                key={i}
                cx={d.x} cy={d.y} r={3.2}
                fill={d.player === 0 ? '#44AAFF' : '#FF8844'}
                stroke="#FFF" strokeWidth={0.7}
                opacity={0.92}
              />
            ))}

            {/* ── Cursor lines ── */}
            {(phase === 'aim-x' || phase === 'aim-y') && (
              <>
                {/* Locked X — dim vertical line */}
                {lockedX !== null && (
                  <line
                    x1={lockedX} y1={CY - R_BOARD}
                    x2={lockedX} y2={CY + R_BOARD}
                    stroke={isAI ? 'rgba(255,100,0,0.35)' : 'rgba(255,220,0,0.35)'}
                    strokeWidth={1.5}
                  />
                )}

                {/* Active vertical sweep (aim-x) */}
                {phase === 'aim-x' && (
                  <line
                    x1={cursorX} y1={CY - R_BOARD - 2}
                    x2={cursorX} y2={CY + R_BOARD + 2}
                    stroke={isAI ? '#FF5500' : '#FFD700'}
                    strokeWidth={1.5}
                  />
                )}

                {/* Active horizontal sweep (aim-y) */}
                {phase === 'aim-y' && (
                  <line
                    x1={CX - R_BOARD - 2} y1={cursorY}
                    x2={CX + R_BOARD + 2} y2={cursorY}
                    stroke={isAI ? '#FF5500' : '#FFD700'}
                    strokeWidth={1.5}
                  />
                )}
              </>
            )}
          </svg>

          {/* Instruction */}
          <div style={{
            fontSize: 12, letterSpacing: 2,
            color: instrColor,
            minHeight: 24, textAlign: 'center',
          }}>
            {instruction}
          </div>

          {/* Exit hint */}
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', letterSpacing: 1 }}>
            ESC / B — EXIT
          </div>
        </div>

        {/* ── Scoreboard column ── */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 22,
          background: 'rgba(0,0,0,0.45)',
          border: '1px solid rgba(255,255,255,0.14)',
          padding: '28px 32px',
          minWidth: 260,
        }}>

          {/* Player scores */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 28 }}>
            {([0, 1] as const).map(i => {
              const active = current === i
              const col    = i === 0 ? '#44AAFF' : '#FF8844'
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    fontSize: 9, letterSpacing: 1,
                    color: active ? col : 'rgba(255,255,255,0.35)',
                    borderBottom: `2px solid ${active ? col : 'transparent'}`,
                    paddingBottom: 5,
                  }}>
                    {names[i]}
                  </div>
                  <div style={{
                    fontSize: 46, lineHeight: 1,
                    color: scores[i] === 0 ? '#FFD700' : '#FFFFFF',
                    fontFamily: FONT,
                  }}>
                    {scores[i]}
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.1)' }} />

          {/* This-turn throw slots */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', letterSpacing: 2 }}>
              THIS TURN
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {[0, 1, 2].map(i => {
                const val = turnSlots[i]
                const filled = val !== null
                return (
                  <div key={i} style={{
                    flex: 1, padding: '10px 4px',
                    textAlign: 'center', fontSize: 12,
                    border: `1px solid ${filled ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.09)'}`,
                    color: !filled           ? 'rgba(255,255,255,0.18)' :
                           val === 0         ? '#FF4444' :
                           val! >= 25        ? '#FFD700' :
                           '#FFFFFF',
                  }}>
                    {filled ? val : '—'}
                  </div>
                )
              })}
            </div>
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.1)' }} />

          {/* Recent throws per player */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', letterSpacing: 2 }}>
              RECENT
            </div>
            {([0, 1] as const).map(pi => {
              const recent = darts.filter(d => d.player === pi).slice(-3)
              const col    = pi === 0 ? '#44AAFF' : '#FF8844'
              return (
                <div key={pi} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{
                    width: 9, height: 9, borderRadius: '50%',
                    background: col, flexShrink: 0,
                  }} />
                  <div style={{ display: 'flex', gap: 8, fontSize: 9 }}>
                    {recent.length === 0
                      ? <span style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>
                      : recent.map((d, i) => (
                          <span key={i} style={{
                            color: d.score === 0   ? '#FF4444' :
                                   d.score >= 25   ? '#FFD700' :
                                   'rgba(255,255,255,0.7)',
                          }}>
                            {d.score}
                          </span>
                        ))
                    }
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      </div>{/* end zoom wrapper */}
    </div>
  )
}
