import { useGameStore } from '../store/useGameStore'
import { LEVELS, KITCHEN_SCORE_TARGET } from '../levels/levelRegistry'
import PixelOverlayMenu from '../hud/PixelOverlayMenu'

const DRIVE_SCENE_KEY   = 'DriveScene'
const KITCHEN_SCENE_KEY = 'KitchenScene'

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

  const isKitchen = level?.sceneKey === KITCHEN_SCENE_KEY

  // ── Kitchen-specific result ─────────────────────────────────────────────────
  let subtitle     = level?.winSubtitle ?? 'Level complete!'
  let title        = level?.winTitle    ?? ''
  let subtitleStyle: React.CSSProperties = { fontSize: 30, letterSpacing: 2, color: '#3AE880', lineHeight: 1.5 }
  let kitchenContent: React.ReactNode = null

  if (isKitchen) {
    const ratio      = score / KITCHEN_SCORE_TARGET
    const pineapples = score === 0     ? 0
      : ratio >= 0.6 ? 3
      : ratio >= 0.3 ? 2
      :                1

    const [msg1, msg2] = pineapples === 3
      ? ['Awesome cheffing!',  '']
      : pineapples === 2
      ? ['Nicely done,',       'more cake next time']
      : pineapples === 1
      ? ['Sad birthday,',      'not much cake']
      : ["Are you sure",       "it's your birthday?"]

    subtitle      = msg1
    title         = msg2
    subtitleStyle = { fontSize: 26, letterSpacing: 2, color: '#FFFFFF', lineHeight: 1.6 }

    kitchenContent = (
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', margin: '4px 0 20px' }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            fontSize: 56,
            filter: i < pineapples ? 'none' : 'grayscale(100%) opacity(0.28)',
          }}>🍍</span>
        ))}
      </div>
    )
  }

  return (
    <PixelOverlayMenu
      subtitle={subtitle}
      subtitleStyle={subtitleStyle}
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
    >
      {kitchenContent}
    </PixelOverlayMenu>
  )
}
