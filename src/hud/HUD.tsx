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

export default function HUD({ joystickNode, jumpButtonNode }: HUDProps) {
  const screen = useGameStore((s) => s.screen)
  const levelIndex = useGameStore((s) => s.levelIndex)
  const level = LEVELS[levelIndex]

  const isPlaying = screen === 'PLAYING' || screen === 'PAUSED'

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {isPlaying && (
        <>
          <ScoreDisplay />
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
