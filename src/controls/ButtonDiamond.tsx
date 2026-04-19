// Four-button diamond overlay — rendered on the right side of the screen on touch devices.
// Mirrors the standard gamepad face buttons (A / B / X / Y):
//   Y (top)    — dispatches KeyF    (interact / sit)
//   B (left)   — dispatches Escape  (pause / back)
//   X (right)  — dispatches KeyX    (first-person toggle)
//   A (bottom) — pulses jumpRef     (jump)

const BTN = 44     // button diameter in px
const OFF = 28     // distance from diamond centre to each button centre
const SZ  = 2 * (OFF + BTN / 2)  // container size = 100 px

function dispatch(code: string) {
  window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }))
}

interface Props {
  jumpRef: React.MutableRefObject<boolean>
}

interface BtnDef {
  label: string
  color: string
  style: React.CSSProperties
  onPress: () => void
}

export default function ButtonDiamond({ jumpRef }: Props) {
  const base: React.CSSProperties = {
    position: 'absolute',
    width: BTN,
    height: BTN,
    borderRadius: '50%',
    border: '2.5px solid rgba(255,255,255,0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Press Start 2P', monospace",
    fontSize: 11,
    color: '#fff',
    textShadow: '0 1px 3px rgba(0,0,0,0.7)',
    touchAction: 'none',
    userSelect: 'none',
    pointerEvents: 'auto',
    cursor: 'pointer',
  }

  const cx = (SZ - BTN) / 2   // = OFF — left/top when centred in the container

  const buttons: BtnDef[] = [
    {
      label: 'Y',
      color: 'rgba(210,170,20,0.75)',
      style: { left: cx, top: 0 },
      onPress: () => dispatch('KeyF'),
    },
    {
      label: 'B',
      color: 'rgba(210,50,50,0.75)',
      style: { left: 0, top: cx },
      onPress: () => dispatch('Escape'),
    },
    {
      label: 'X',
      color: 'rgba(50,100,210,0.75)',
      style: { right: 0, top: cx },
      onPress: () => dispatch('KeyX'),
    },
    {
      label: 'A',
      color: 'rgba(40,170,80,0.75)',
      style: { left: cx, bottom: 0 },
      onPress: () => { jumpRef.current = true },
    },
  ]

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 'calc(44px + env(safe-area-inset-bottom))',
        right: 'calc(28px + env(safe-area-inset-right))',
        width: SZ,
        height: SZ,
        pointerEvents: 'none',
      }}
    >
      {buttons.map(({ label, color, style, onPress }) => (
        <div
          key={label}
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); onPress() }}
          style={{ ...base, background: color, ...style }}
        >
          {label}
        </div>
      ))}
    </div>
  )
}
