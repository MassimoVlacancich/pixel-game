import { useEffect } from 'react'
import { useGameStore } from '../store/useGameStore'
import { LEVELS } from '../levels/levelRegistry'
import ScoreDisplay from './ScoreDisplay'
import LevelNameBanner from './LevelNameBanner'
import TutorialPrompt from './TutorialPrompt'
import ControlsHint from './ControlsHint'
import PauseMenu from './PauseMenu'
import GameOverOverlay from './GameOverOverlay'

interface HUDProps {
  joystickNode?: React.ReactNode
  jumpButtonNode?: React.ReactNode
}

function togglePause() {
  const s = useGameStore.getState().screen
  if (s === 'PLAYING') useGameStore.getState().setScreen('PAUSED')
  else if (s === 'PAUSED') useGameStore.getState().setScreen('PLAYING')
}

export default function HUD({ joystickNode, jumpButtonNode }: HUDProps) {
  const screen = useGameStore((s) => s.screen)
  const levelIndex = useGameStore((s) => s.levelIndex)
  const level = LEVELS[levelIndex]

  const isPlaying = (screen === 'PLAYING' || screen === 'PAUSED') && screen !== 'CINEMATIC'

  // ── Global pause toggle: Escape key + gamepad Start button (button 9) ──────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') togglePause()
    }
    window.addEventListener('keydown', onKey)

    let prevStart = false
    let raf = 0
    const pollStart = () => {
      const gp = navigator.getGamepads()[0]
      const pressed = gp?.buttons[9]?.pressed ?? false
      if (pressed && !prevStart) togglePause()
      prevStart = pressed
      raf = requestAnimationFrame(pollStart)
    }
    raf = requestAnimationFrame(pollStart)

    return () => {
      window.removeEventListener('keydown', onKey)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {isPlaying && (
        <>
          {!level?.hideScoreDisplay && <ScoreDisplay />}
          <LevelNameBanner name={level?.name ?? ''} />
          {level?.tutorialMessages && <TutorialPrompt messages={level.tutorialMessages} />}
          <ControlsHint />
        </>
      )}

      {/* Mobile controls — pointer-events re-enabled inside each control */}
      {joystickNode}
      {jumpButtonNode}

      {screen === 'PAUSED' && <PauseMenu />}
      {screen === 'GAME_OVER' && <GameOverOverlay />}
    </div>
  )
}
