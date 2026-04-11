import { useGameStore } from '../store/useGameStore'
import { LEVELS } from '../levels/levelRegistry'
import PixelOverlayMenu from '../hud/PixelOverlayMenu'

const DRIVE_SCENE_KEY = 'DriveScene'

export default function LevelComplete() {
  const { score, levelIndex, bestScores, startLevel, setLevelIndex, setScreen } = useGameStore()
  const level = LEVELS[levelIndex]
  const best = bestScores[level?.id ?? ''] ?? 0
  const nextIndex = levelIndex + 1
  const hasNext = nextIndex < LEVELS.length

  const goNext = () => {
    setLevelIndex(nextIndex)
    if (LEVELS[nextIndex]?.sceneKey === DRIVE_SCENE_KEY) {
      setScreen('CAR_SELECT')
    } else {
      startLevel(nextIndex)
    }
  }

  const subtitle = level?.winSubtitle ?? 'Level complete!'
  const title    = level?.winTitle    ?? ''

  return (
    <PixelOverlayMenu
      subtitle={subtitle}
      subtitleStyle={{ fontSize: 30, letterSpacing: 2, color: '#3AE880', lineHeight: 1.5 }}
      title={title}
      info={[
        { label: 'Score', value: score },
        { label: 'Best',  value: best  },
      ]}
      items={[
        ...(hasNext ? [{ label: 'Next Level', accent: true, onClick: goNext }] : []),
        { label: 'Play Again', onClick: () => startLevel(levelIndex) },
        { label: 'Main Menu', secondary: true, onClick: () => setScreen('MAIN_MENU') },
      ]}
    />
  )
}
