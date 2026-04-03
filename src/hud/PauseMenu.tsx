import { useGameStore } from '../store/useGameStore'
import PixelOverlayMenu from './PixelOverlayMenu'

export default function PauseMenu() {
  const { setScreen, retryLevel } = useGameStore()

  return (
    <PixelOverlayMenu
      title="Paused"
      items={[
        { label: 'Resume',        accent: true,     onClick: () => setScreen('PLAYING') },
        { label: 'Restart Level',                   onClick: () => retryLevel() },
        { label: 'Main Menu',     secondary: true,  onClick: () => setScreen('MAIN_MENU') },
      ]}
    />
  )
}
