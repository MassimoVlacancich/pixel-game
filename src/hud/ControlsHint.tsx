const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0

export default function ControlsHint() {
  if (isTouchDevice) return null
  return (
    <div style={{
      position: 'absolute', bottom: 20, right: 20,
      background: 'rgba(0,0,0,0.28)', color: '#fff',
      fontFamily: 'monospace', fontSize: 12,
      padding: '5px 12px', borderRadius: 6,
      letterSpacing: 1, pointerEvents: 'none',
    }}>
      WASD / ↑↓←→ · Space: jump · [Esc] pause · [`] orbit
    </div>
  )
}
