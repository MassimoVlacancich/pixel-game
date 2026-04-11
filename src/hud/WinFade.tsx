import { useGameStore } from '../store/useGameStore'

export default function WinFade() {
  const winFading = useGameStore((s) => s.winFading)

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 25,
      background: '#000',
      opacity: winFading ? 1 : 0,
      transition: 'opacity 3s ease-in',
      pointerEvents: 'none',
    }} />
  )
}
