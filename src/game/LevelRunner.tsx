import { Suspense, useRef, useEffect } from 'react'
import type { LevelConfig } from '../levels/levelRegistry'
import { LEVELS } from '../levels/levelRegistry'
import { SCENE_MAP } from '../levels/sceneMap'
import { useGameStore } from '../store/useGameStore'
import type { CharacterRef } from '../character/Character'
import type { JoystickDir } from '../controls/VirtualJoystick'

export interface LevelSceneProps {
  config: LevelConfig
  characterRef: React.RefObject<CharacterRef | null>
  joystickDir: React.MutableRefObject<JoystickDir>
  jumpRef: React.MutableRefObject<boolean>
}

interface LevelRunnerProps {
  characterRef: React.RefObject<CharacterRef | null>
  joystickDir: React.MutableRefObject<JoystickDir>
  jumpRef: React.MutableRefObject<boolean>
}

export default function LevelRunner({ characterRef, joystickDir, jumpRef }: LevelRunnerProps) {
  const levelIndex = useGameStore((s) => s.levelIndex)
  const levelKey = useGameStore((s) => s.levelKey)
  const setScreen = useGameStore((s) => s.setScreen)

  const config = LEVELS[levelIndex]
  const SceneComponent = config ? SCENE_MAP[config.sceneKey] : null

  // When scene mounts after Suspense resolves, flip to PLAYING
  const mountedRef = useRef(false)
  useEffect(() => {
    if (mountedRef.current) return
    mountedRef.current = true
    setScreen('PLAYING')
  })

  if (!config || !SceneComponent) return null

  return (
    <Suspense fallback={null}>
      <SceneComponent
        key={`${levelIndex}-${levelKey}`}
        config={config}
        characterRef={characterRef}
        joystickDir={joystickDir}
        jumpRef={jumpRef}
      />
    </Suspense>
  )
}
