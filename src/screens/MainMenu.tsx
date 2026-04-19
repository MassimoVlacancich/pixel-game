import { useState, useEffect } from 'react'
import { useGameStore } from '../store/useGameStore'
import { useMenuInput } from '../hooks/useMenuInput'
import bg from '../assets/background1.png?url'
import { isTouchDevice } from '../App'

// iOS Safari doesn't support requestFullscreen — detect it so we can show a hint
const isIosSafari = /iP(hone|ad|od)/.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream

const ITEMS = ['PLAY', 'SETTINGS'] as const
type MenuItem = typeof ITEMS[number]

// Shared pixel-art CSS helpers
export const px = {
  font: "'Press Start 2P', monospace",
  bg: '#1A0800',
  panel: '#2A1000',
  border: '4px solid #1A0800',
  shadow: '4px 4px 0 #000',
  pink: '#F06080',
  green: '#3AB87A',
  white: '#FFFFFF',
  cream: '#FFD9C0',
  dim: '#8B5A3C',
  scanline: `repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0,0,0,0.06) 2px,
    rgba(0,0,0,0.06) 4px
  )`,
}

const TEXT_OUTLINE = '-3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 3px 3px 0 #000'

export default function MainMenu() {
  const setScreen = useGameStore((s) => s.setScreen)
  const [cursor, setCursor] = useState(0)
  const [blink, setBlink] = useState(true)

  // Blinking cursor
  useEffect(() => {
    const t = setInterval(() => setBlink((b) => !b), 500)
    return () => clearInterval(t)
  }, [])

  const activate = (item: MenuItem) => {
    if (item === 'PLAY') setScreen('LEVEL_SELECT')
    // SETTINGS: placeholder
  }

  useMenuInput(0, (input) => {
    if (input.up || input.left) setCursor((c) => (c - 1 + ITEMS.length) % ITEMS.length)
    if (input.down || input.right) setCursor((c) => (c + 1) % ITEMS.length)
    if (input.confirm) activate(ITEMS[cursor])
  })

  const m = isTouchDevice

  return (
    <div style={{
      width: '100vw', height: '100dvh',
      background: `url(${bg}) center/cover no-repeat`,
      imageRendering: 'pixelated',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'space-between',
      fontFamily: px.font, position: 'relative', overflow: 'hidden',
      paddingBottom: m ? 16 : 32, paddingTop: m ? 16 : 40,
    }}>
      {/* Dark overlay */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', pointerEvents: 'none', zIndex: 0 }} />
      {/* Scanlines */}
      <div style={{ position: 'absolute', inset: 0, background: px.scanline, pointerEvents: 'none', zIndex: 1 }} />

      {/* Decorative pixel corners */}
      {(['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] as const).map((pos) => (
        <div key={pos} style={{
          position: 'absolute',
          top: pos.startsWith('top') ? 12 : undefined,
          bottom: pos.startsWith('bottom') ? 12 : undefined,
          left: pos.endsWith('Left') ? 12 : undefined,
          right: pos.endsWith('Right') ? 12 : undefined,
          width: 40, height: 40,
          borderTop: pos.startsWith('top') ? `4px solid rgba(255,255,255,0.4)` : undefined,
          borderBottom: pos.startsWith('bottom') ? `4px solid rgba(255,255,255,0.4)` : undefined,
          borderLeft: pos.endsWith('Left') ? `4px solid rgba(255,255,255,0.4)` : undefined,
          borderRight: pos.endsWith('Right') ? `4px solid rgba(255,255,255,0.4)` : undefined,
          zIndex: 2,
        }} />
      ))}

      {/* Title — top */}
      <div style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
        <h1 style={{
          fontSize: m ? 18 : 32, color: px.green, marginBottom: 0,
          textShadow: TEXT_OUTLINE, lineHeight: 1.5, letterSpacing: 3,
        }}>NICK & PHOEBE'S</h1>
        <h1 style={{
          fontSize: m ? 18 : 32, color: px.white, marginBottom: 0,
          textShadow: TEXT_OUTLINE, lineHeight: 1.5, letterSpacing: 3,
        }}>ADVENTURE TIME</h1>
      </div>

      {/* Menu items — center */}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: m ? 14 : 28, alignItems: 'center' }}>
        {ITEMS.map((item, i) => (
          <div
            key={item}
            onMouseEnter={() => setCursor(i)}
            onClick={() => activate(item)}
            style={{
              display: 'flex', alignItems: 'center', gap: m ? 12 : 20,
              cursor: 'pointer', userSelect: 'none',
            }}
          >
            <span style={{
              color: px.green, fontSize: m ? 16 : 28,
              textShadow: TEXT_OUTLINE,
              visibility: i === cursor && blink ? 'visible' : 'hidden',
              width: m ? 14 : 24,
            }}>►</span>
            <span style={{
              fontSize: m ? 16 : 28,
              color: i === cursor ? px.white : 'rgba(255,255,255,0.4)',
              letterSpacing: 4,
              textShadow: i === cursor ? TEXT_OUTLINE : 'none',
            }}>{item}</span>
          </div>
        ))}
      </div>

      {/* Hint — bottom */}
      <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.55)', letterSpacing: 2 }}>
          ARROW KEYS / D-PAD · ENTER / A
        </p>
        {isIosSafari && (
          <p style={{ fontSize: 7, color: 'rgba(255,255,255,0.38)', letterSpacing: 1 }}>
            TAP ⬆ SHARE → ADD TO HOME SCREEN FOR FULLSCREEN
          </p>
        )}
      </div>
    </div>
  )
}
