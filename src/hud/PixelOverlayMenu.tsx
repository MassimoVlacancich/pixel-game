import { useState } from 'react'
import { px } from '../screens/MainMenu'
import { useMenuInput } from '../hooks/useMenuInput'
import { isTouchDevice } from '../App'

const TEXT_OUTLINE = '-3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 3px 3px 0 #000'
const TEXT_OUTLINE_SM = '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000'

export interface PixelMenuItem {
  label: string
  accent?: boolean    // green accent
  secondary?: boolean // dimmed/outline style
  onClick: () => void
}

export interface PixelInfoRow {
  label: string
  value: string | number
}

interface Props {
  title: string
  subtitle?: string
  subtitleStyle?: React.CSSProperties
  info?: PixelInfoRow[]
  items: PixelMenuItem[]
  children?: React.ReactNode
}

export default function PixelOverlayMenu({ title, subtitle, subtitleStyle, info, items, children }: Props) {
  const [cursor, setCursor] = useState(0)
  const m = isTouchDevice

  useMenuInput(0, (input) => {
    if (input.up)      setCursor((c) => (c - 1 + items.length) % items.length)
    if (input.down)    setCursor((c) => (c + 1) % items.length)
    if (input.confirm) items[cursor]?.onClick()
    // Back maps to the last item (usually "Main Menu" / secondary)
    if (input.back)    items[items.length - 1]?.onClick()
  })

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 50,
      background: 'rgba(0,0,0,0.82)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: px.font,
      pointerEvents: 'auto',
      overflowY: 'auto',
    }}>
      {/* Scanlines */}
      <div style={{ position: 'absolute', inset: 0, background: px.scanline, pointerEvents: 'none' }} />

      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 0, textAlign: 'center', width: '100%', maxWidth: 520,
        padding: m ? '8px 16px' : '0 24px',
      }}>
        {/* Subtitle (e.g. "LEVEL COMPLETE") */}
        {subtitle && (
          <p style={{
            fontSize: m ? 6 : 9, letterSpacing: 4, color: px.green,
            textShadow: TEXT_OUTLINE_SM,
            marginBottom: m ? 6 : 12,
            ...subtitleStyle,
            ...(m && subtitleStyle?.fontSize ? { fontSize: Number(subtitleStyle.fontSize) * 0.65 } : {}),
          }}>{subtitle.toUpperCase()}</p>
        )}

        {/* Title */}
        <h1 style={{
          fontSize: m ? 18 : 32, color: px.white, letterSpacing: 3,
          textShadow: TEXT_OUTLINE,
          marginBottom: m ? 12 : (info && info.length ? 32 : 48),
          lineHeight: 1.4,
        }}>{title.toUpperCase()}</h1>

        {/* Custom content slot (pineapples, etc.) */}
        {children}

        {/* Info rows (score, best, etc.) */}
        {info && info.length > 0 && (
          <div style={{
            width: '100%', marginBottom: m ? 12 : 40,
            border: `${m ? 2 : 4}px solid ${px.dim}`,
            boxShadow: '4px 4px 0 #000',
          }}>
            {info.map((row, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: m ? '6px 14px' : '12px 24px',
                background: i % 2 === 0 ? px.panel : px.bg,
                borderBottom: i < info.length - 1 ? `2px solid ${px.dim}` : undefined,
              }}>
                <span style={{ fontSize: m ? 5 : 8, color: px.dim, letterSpacing: 2 }}>{row.label.toUpperCase()}</span>
                <span style={{ fontSize: m ? 9 : 14, color: px.cream, textShadow: TEXT_OUTLINE_SM }}>{row.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Menu items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: m ? 8 : 16, width: '100%' }}>
          {items.map((item, i) => {
            const focused = i === cursor
            const borderColor = focused
              ? px.white
              : item.secondary ? px.dim : item.accent ? px.green : px.cream
            const bg = item.secondary
              ? (focused ? 'rgba(255,255,255,0.08)' : 'transparent')
              : item.accent ? px.green : px.cream
            const color = item.secondary ? (focused ? px.white : px.dim) : '#1A0800'
            return (
              <button
                key={i}
                onMouseEnter={() => setCursor(i)}
                onClick={item.onClick}
                style={{
                  fontFamily: px.font,
                  fontSize: m ? 8 : 14, letterSpacing: 2,
                  padding: m ? '10px 16px' : '16px 32px',
                  cursor: 'pointer',
                  border: `${m ? 2 : 4}px solid ${borderColor}`,
                  background: bg,
                  color,
                  textShadow: focused && item.secondary ? TEXT_OUTLINE_SM : 'none',
                  boxShadow: focused ? '0 0 0 2px #fff, 4px 4px 0 #000' : 'none',
                  outline: 'none',
                  width: '100%',
                  transform: focused ? 'scale(1.03)' : 'none',
                  transition: 'transform 0.08s',
                  opacity: focused ? 1 : 0.7,
                }}
              >
                {focused ? '► ' : ''}{item.label.toUpperCase()}
              </button>
            )
          })}
        </div>

        {!m && (
          <p style={{ marginTop: 24, fontSize: 7, color: 'rgba(255,255,255,0.3)', letterSpacing: 1 }}>
            ↑ ↓ TO SELECT · A / ENTER TO CONFIRM
          </p>
        )}
      </div>
    </div>
  )
}
