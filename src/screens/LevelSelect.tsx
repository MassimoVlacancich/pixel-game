import { useState, useEffect } from 'react'
import { LEVELS } from '../levels/levelRegistry'
import { useGameStore } from '../store/useGameStore'
import { useMenuInput } from '../hooks/useMenuInput'
import { px } from './MainMenu'
import bg from '../assets/background1.png?url'

const TEXT_OUTLINE = '-3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 3px 3px 0 #000'

export default function LevelSelect() {
  const { unlockedLevels, setLevelIndex, setScreen } = useGameStore()
  const [cursor, setCursor] = useState(0)
  const [blink, setBlink] = useState(true)

  useEffect(() => {
    const t = setInterval(() => setBlink((b) => !b), 500)
    return () => clearInterval(t)
  }, [])

  const selectLevel = (i: number) => {
    if (!unlockedLevels.includes(i)) return
    setLevelIndex(i)
    setScreen('CHARACTER_SELECT')
  }

  useMenuInput(0, (input) => {
    if (input.up)    setCursor((c) => Math.max(0, c - 1))
    if (input.down)  setCursor((c) => Math.min(LEVELS.length - 1, c + 1))
    if (input.confirm) selectLevel(cursor)
    if (input.back)  setScreen('MAIN_MENU')
  })

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: `url(${bg}) center/cover no-repeat`,
      imageRendering: 'pixelated',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'space-between',
      fontFamily: px.font, position: 'relative', overflow: 'hidden',
      paddingBottom: 32, paddingTop: 40,
    }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.50)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'absolute', inset: 0, background: px.scanline, pointerEvents: 'none', zIndex: 1 }} />

      {/* Title */}
      <div style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
        <h1 style={{ fontSize: 24, color: px.green, marginBottom: 0, textShadow: TEXT_OUTLINE, letterSpacing: 3 }}>
          SELECT LEVEL
        </h1>
      </div>

      {/* Level list */}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: 32, alignItems: 'center' }}>
        {LEVELS.map((level, i) => {
          const unlocked = unlockedLevels.includes(i)
          const selected = cursor === i

          return (
            <div
              key={level.id}
              onMouseEnter={() => setCursor(i)}
              onClick={() => selectLevel(i)}
              style={{
                display: 'flex', alignItems: 'center', gap: 20,
                cursor: unlocked ? 'pointer' : 'default',
                userSelect: 'none',
                opacity: unlocked ? 1 : 0.35,
              }}
            >
              <span style={{
                color: px.green, fontSize: 24,
                textShadow: TEXT_OUTLINE,
                visibility: selected && blink && unlocked ? 'visible' : 'hidden',
                width: 20,
              }}>►</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{
                  fontSize: 20,
                  color: selected && unlocked ? px.white : 'rgba(255,255,255,0.45)',
                  letterSpacing: 3,
                  textShadow: selected && unlocked ? TEXT_OUTLINE : 'none',
                }}>
                  {level.name.toUpperCase()}
                </span>
                <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', letterSpacing: 2 }}>
                  LEVEL {i + 1}
                </span>
              </div>
              <span style={{
                fontSize: 16,
                color: unlocked ? px.green : 'rgba(255,255,255,0.3)',
                textShadow: unlocked ? TEXT_OUTLINE : 'none',
                marginLeft: 8,
              }}>
                {unlocked ? '✓' : '🔒'}
              </span>
            </div>
          )
        })}
      </div>

      <p style={{ position: 'relative', zIndex: 2, fontSize: 8, color: 'rgba(255,255,255,0.55)', letterSpacing: 2, textAlign: 'center' }}>
        ARROW KEYS / D-PAD · ENTER / A · ESC / B = BACK
      </p>
    </div>
  )
}
