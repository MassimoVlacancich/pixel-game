import { useGameStore } from '../store/useGameStore'
import { LEVELS } from '../levels/levelRegistry'
import PixelOverlayMenu from './PixelOverlayMenu'

export default function GameOverOverlay() {
  const { retryLevel, setScreen, levelIndex } = useGameStore()
  const level = LEVELS[levelIndex]

  return (
    <PixelOverlayMenu
      subtitle="Game Over"
      title={level?.name ?? ''}
      items={[
        { label: 'Try Again', accent: true, onClick: () => retryLevel() },
        { label: 'Main Menu', secondary: true, onClick: () => setScreen('MAIN_MENU') },
      ]}
    />
  )
}
