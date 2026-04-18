import { useState } from 'react'
import { CHARACTERS, BUDDIES, type CharacterConfig } from '../character/characterRegistry'
import { useGameStore } from '../store/useGameStore'
import { useMenuInput } from '../hooks/useMenuInput'
import CharacterPreviewCanvas from './CharacterPreviewCanvas'
import { px } from './MainMenu'
import bg from '../assets/background1.png?url'

// Zone 0 = mode, Zone 1 = P1 character, Zone 2 = P2/buddy character, Zone 3 = actions
type Zone = 0 | 1 | 2 | 3

const TEXT_OUTLINE_SM = '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000'

function nextIdx(current: number, dir: 1 | -1, list: unknown[], takenId: string | null): number {
  const len = list.length
  let idx = (current + dir + len) % len
  if (takenId && (list[idx] as { id: string }).id === takenId) {
    idx = (idx + dir + len) % len
  }
  return idx
}

export default function CharacterSelect() {
  const {
    player1CharacterId, isTwoPlayer,
    setPlayer1Character, setPlayer2Character, setBuddyCharacter, setTwoPlayer,
    startLevel, levelIndex, setScreen, persistSave,
  } = useGameStore()

  const [zone, setZone] = useState<Zone>(1)

  const [p1Idx, setP1Idx] = useState(
    () => Math.max(0, CHARACTERS.findIndex((c) => c.id === player1CharacterId))
  )
  // Zone 2 list depends on mode: buddies in solo, characters in 2P
  const [p2Idx, setP2Idx] = useState(0)

  // The list shown in zone 2 depends on current mode
  const p2List = isTwoPlayer ? CHARACTERS : BUDDIES

  const p1Id = CHARACTERS[p1Idx].id
  const p2Id = p2List[p2Idx].id

  // P1 is "locked" (visually confirmed) only while zone >= 2
  const p1Locked = zone >= 2

  // Ensure p2 never equals p1 when p1 is locked (only relevant in 2P mode)
  const takenId = p1Locked ? p1Id : null

  const confirmAll = () => {
    setPlayer1Character(p1Id)
    if (isTwoPlayer) setPlayer2Character(p2Id)
    else setBuddyCharacter(p2Id)
    persistSave()
    startLevel(levelIndex)
  }

  const doBack = () => {
    if (zone > 0) setZone((z) => (z - 1) as Zone)
    else setScreen('MAIN_MENU')
  }

  const moveZone = (dir: 1 | -1) => {
    setZone((z) => {
      const next = z + dir
      if (next < 0 || next > 3) return z
      return next as Zone
    })
  }

  // Controls — P1 (or solo player)
  useMenuInput(0, (input) => {
    if (input.up)   moveZone(-1)
    if (input.down) moveZone(1)

    if (input.left || input.right) {
      const dir: 1 | -1 = input.right ? 1 : -1
      if (zone === 0) setTwoPlayer(!isTwoPlayer)
      if (zone === 1) setP1Idx((i) => nextIdx(i, dir, CHARACTERS, null))
      if (zone === 2) setP2Idx((i) => nextIdx(i, dir, p2List, isTwoPlayer ? takenId : null))
    }

    if (input.confirm) {
      if (zone === 1) { setZone(2); return }
      if (zone === 2 || zone === 3) confirmAll()
    }
    if (input.back) doBack()
  })

  // P2 controller (2P mode only)
  useMenuInput(isTwoPlayer ? 1 : 0, (input) => {
    if (!isTwoPlayer) return
    if (input.up)   moveZone(-1)
    if (input.down) moveZone(1)
    if ((input.left || input.right) && zone === 2) {
      setP2Idx((i) => nextIdx(i, input.right ? 1 : -1, p2List, takenId))
    }
    if (input.confirm && (zone === 2 || zone === 3)) confirmAll()
    if (input.back) doBack()
  })

  const p2Label = isTwoPlayer ? 'PLAYER 2' : 'BUDDY'
  const p1Active = zone === 1
  const p2Active = zone === 2

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: `url(${bg}) center/cover no-repeat`,
      imageRendering: 'pixelated',
      display: 'flex', flexDirection: 'column',
      alignItems: 'stretch',
      fontFamily: px.font, position: 'relative', overflow: 'hidden',
    }}>
      {/* Dark overlay */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', pointerEvents: 'none', zIndex: 0 }} />
      {/* Scanlines */}
      <div style={{ position: 'absolute', inset: 0, background: px.scanline, pointerEvents: 'none', zIndex: 1 }} />

      <div style={{
        position: 'relative', zIndex: 2,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'space-between',
        height: '100%', padding: '20px 0 16px',
        gap: 0,
      }}>

        {/* ZONE 0 — MODE SELECTOR */}
        <div
          onClick={() => setZone(0)}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            padding: '10px 0',
            opacity: zone === 0 ? 1 : 0.4,
            transition: 'opacity 0.15s',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={(e) => { e.stopPropagation(); setTwoPlayer(!isTwoPlayer) }} style={modeArrowStyle}>&lt;</button>
            <span style={{
              fontSize: 20, letterSpacing: 2,
              color: zone === 0 ? px.green : px.white,
              textShadow: zone === 0 ? TEXT_OUTLINE_SM : 'none',
              minWidth: 300, textAlign: 'center',
            }}>
              {isTwoPlayer ? 'PLAYER + PLAYER' : 'SOLO + BUDDY'}
            </span>
            <button onClick={(e) => { e.stopPropagation(); setTwoPlayer(!isTwoPlayer) }} style={modeArrowStyle}>&gt;</button>
          </div>
          {zone === 0 && (
            <p style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', letterSpacing: 1 }}>&lt; &gt; TO SWITCH · ↓ TO NAVIGATE</p>
          )}
        </div>

        {/* CHARACTER ROWS */}
        <div style={{
          display: 'flex', flexDirection: 'column', flex: 1,
          width: '100%', gap: 0,
          overflow: 'hidden',
        }}>

          {/* ZONE 1 — PLAYER 1 */}
          <CharacterRow
            label="PLAYER 1"
            list={CHARACTERS}
            charIdx={p1Idx}
            active={p1Active}
            locked={p1Locked}
            onClick={() => setZone(1)}
            onLeft={() => setP1Idx((i) => nextIdx(i, -1, CHARACTERS, null))}
            onRight={() => setP1Idx((i) => nextIdx(i, 1, CHARACTERS, null))}
            accentColor={px.green}
          />

          {/* ZONE 2 — P2 / BUDDY */}
          <CharacterRow
            label={p2Label}
            list={p2List}
            charIdx={p2Idx}
            active={p2Active}
            locked={false}
            onClick={() => setZone(2)}
            onLeft={() => setP2Idx((i) => nextIdx(i, -1, p2List, isTwoPlayer ? takenId : null))}
            onRight={() => setP2Idx((i) => nextIdx(i, 1, p2List, isTwoPlayer ? takenId : null))}
            accentColor={isTwoPlayer ? '#F06080' : '#FFD9C0'}
            dimmed={zone < 2}
          />

        </div>

        {/* ZONE 3 — ACTIONS */}
        <div
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            padding: '10px 0',
            opacity: zone === 3 ? 1 : 0.45,
            transition: 'opacity 0.15s',
            cursor: 'pointer',
          }}
          onClick={() => setZone(3)}
        >
          <div style={{ display: 'flex', gap: 32 }}>
            <button onClick={(e) => { e.stopPropagation(); doBack() }} style={{
              ...actionBtnStyle,
              color: zone === 3 ? px.white : 'rgba(255,255,255,0.5)',
              textShadow: zone === 3 ? TEXT_OUTLINE_SM : 'none',
              border: `3px solid ${zone === 3 ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)'}`,
            }}>(B) BACK</button>
            <button onClick={(e) => { e.stopPropagation(); confirmAll() }} style={{
              ...actionBtnStyle,
              color: zone === 3 ? px.green : 'rgba(255,255,255,0.5)',
              textShadow: zone === 3 ? TEXT_OUTLINE_SM : 'none',
              border: `3px solid ${zone === 3 ? px.green : 'rgba(255,255,255,0.2)'}`,
            }}>{p1Locked ? '(A) START!' : '(A) CONFIRM'}</button>
          </div>
        </div>

      </div>
    </div>
  )
}

// ── Sub-component for a character selection row ──────────────────────────────

interface CharacterRowProps {
  label: string
  list: CharacterConfig[]
  charIdx: number
  active: boolean
  locked: boolean
  accentColor: string
  dimmed?: boolean
  onClick: () => void
  onLeft: () => void
  onRight: () => void
}

function CharacterRow({ label, list, charIdx, active, locked, accentColor, dimmed, onClick, onLeft, onRight }: CharacterRowProps) {
  const char = list[charIdx]
  const opacity = dimmed ? 0.25 : active ? 1 : 0.45

  return (
    <div
      onClick={onClick}
      style={{
        flex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', minHeight: 0,
        opacity,
        transition: 'opacity 0.2s',
        cursor: locked ? 'default' : 'pointer',
      }}
    >
      {/* Dark strip behind preview */}
      <div style={{
        position: 'absolute', inset: 0,
        background: active ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.3)',
        transition: 'background 0.2s',
        pointerEvents: 'none',
      }} />

      {/* Active outline */}
      {active && (
        <div style={{
          position: 'absolute', inset: 4,
          border: `3px solid ${accentColor}`,
          pointerEvents: 'none', zIndex: 1,
          boxShadow: `0 0 12px ${accentColor}44`,
        }} />
      )}

      {/* Left arrow */}
      {!locked && (
        <button
          onClick={(e) => { e.stopPropagation(); onLeft() }}
          style={{ ...charArrowStyle, position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}
        >&lt;</button>
      )}

      {/* Canvas with overlaid text */}
      <div style={{ position: 'relative', zIndex: 2, flexShrink: 0 }}>
        <CharacterPreviewCanvas config={char} size={440} />

        {/* Row label — top overlay */}
        <div style={{
          position: 'absolute', top: 10, left: 0, right: 0,
          display: 'flex', justifyContent: 'center', pointerEvents: 'none',
        }}>
          <p style={{
            fontSize: 8, letterSpacing: 3,
            color: active ? accentColor : 'rgba(255,255,255,0.55)',
            textShadow: '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000',
          }}>
            {locked ? `${label}  ✓` : label}
          </p>
        </div>

        {/* Character name + dots — bottom overlay */}
        <div style={{
          position: 'absolute', bottom: 12, left: 0, right: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          pointerEvents: 'none',
        }}>
          <p style={{
            fontSize: 16, letterSpacing: 3,
            color: active ? '#FFFFFF' : 'rgba(255,255,255,0.6)',
            textShadow: '-3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 3px 3px 0 #000',
          }}>{char.name.toUpperCase()}</p>
          <div style={{ display: 'flex', gap: 8 }}>
            {list.map((c, i) => (
              <div key={c.id} style={{
                width: 10, height: 10,
                background: i === charIdx ? accentColor : 'rgba(255,255,255,0.25)',
                border: `2px solid ${i === charIdx ? '#fff' : 'rgba(255,255,255,0.25)'}`,
              }} />
            ))}
          </div>
        </div>
      </div>

      {/* Right arrow */}
      {!locked && (
        <button
          onClick={(e) => { e.stopPropagation(); onRight() }}
          style={{ ...charArrowStyle, position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}
        >&gt;</button>
      )}
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const modeArrowStyle: React.CSSProperties = {
  fontFamily: "'Press Start 2P', monospace",
  fontSize: 54,
  color: px.white,
  textShadow: '-3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 3px 3px 0 #000',
  background: 'transparent', border: 'none',
  width: 72, height: 72,
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}

const charArrowStyle: React.CSSProperties = {
  fontFamily: "'Press Start 2P', monospace",
  fontSize: 108,
  color: '#FFFFFF',
  textShadow: '-5px -5px 0 #000, 5px -5px 0 #000, -5px 5px 0 #000, 5px 5px 0 #000',
  background: 'transparent', border: 'none',
  width: 140,
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}

const actionBtnStyle: React.CSSProperties = {
  fontFamily: "'Press Start 2P', monospace",
  fontSize: 9, letterSpacing: 2,
  padding: '10px 14px', cursor: 'pointer',
  background: 'transparent',
  outline: 'none',
  boxShadow: '3px 3px 0 #000',
}
