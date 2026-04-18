import { useGameStore } from '../store/useGameStore'
import { LEVELS } from '../levels/levelRegistry'
import PixelOverlayMenu from './PixelOverlayMenu'

export default function GameOverOverlay() {
  const { retryLevel, setScreen, levelIndex, score, bestScores } = useGameStore()
  const level = LEVELS[levelIndex]
  const best = level ? (bestScores[level.id] ?? 0) : 0

  return (
    <PixelOverlayMenu
      subtitle="You've run out of battery!"
      subtitleStyle={{ fontSize: 36, letterSpacing: 2, color: '#E03030' }}
      title={level?.name ?? ''}
      info={[
        { label: '🍍 Score',      value: String(score).padStart(6, '0') },
        { label: '🏆 Best Score', value: String(best).padStart(6, '0') },
      ]}
      items={[
        { label: 'Try Again', accent: true,     onClick: () => retryLevel() },
        { label: 'Main Menu', secondary: true,  onClick: () => setScreen('MAIN_MENU') },
      ]}
    />
  )
}
