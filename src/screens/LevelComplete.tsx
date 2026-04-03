import { useGameStore } from '../store/useGameStore'
import { LEVELS } from '../levels/levelRegistry'
import PixelOverlayMenu from '../hud/PixelOverlayMenu'

export default function LevelComplete() {
  const { score, levelIndex, bestScores, startLevel, setScreen } = useGameStore()
  const level = LEVELS[levelIndex]
  const best = bestScores[level?.id ?? ''] ?? 0
  const hasNext = levelIndex + 1 < LEVELS.length

  return (
    <PixelOverlayMenu
      subtitle="Level Complete"
      title={level?.name ?? ''}
      info={[
        { label: 'Score', value: score },
        { label: 'Best',  value: best  },
      ]}
      items={[
        ...(hasNext ? [{ label: 'Next Level', accent: true, onClick: () => startLevel(levelIndex + 1) }] : []),
        { label: 'Play Again', onClick: () => startLevel(levelIndex) },
        { label: 'Main Menu', secondary: true, onClick: () => setScreen('MAIN_MENU') },
      ]}
    />
  )
}
