import { Canvas } from '@react-three/fiber'
import { Suspense, useRef, useEffect } from 'react'
import { PALETTE } from './palette'
import { useGameStore } from './store/useGameStore'
import { unlockAudio } from './audio/AudioManager'
import LevelRunner from './game/LevelRunner'
import MainMenu from './screens/MainMenu'
import CharacterSelect from './screens/CharacterSelect'
import LevelComplete from './screens/LevelComplete'
import LoadingScreen from './screens/LoadingScreen'
import HUD from './hud/HUD'
import VirtualJoystick from './controls/VirtualJoystick'
import type { CharacterRef } from './character/Character'
import type { JoystickDir } from './controls/VirtualJoystick'

const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0

export default function App() {
  const screen = useGameStore((s) => s.screen)
  const loadSave = useGameStore((s) => s.loadSave)

  const characterRef = useRef<CharacterRef>(null)
  const joystickDir = useRef<JoystickDir>({ x: 0, z: 0 })
  const jumpRef = useRef(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadSave() }, [loadSave])
  useEffect(() => { wrapperRef.current?.focus() }, [])

  const isInGame = screen === 'PLAYING' || screen === 'PAUSED' || screen === 'GAME_OVER' || screen === 'LEVEL_COMPLETE'

  return (
    <div
      ref={wrapperRef}
      tabIndex={0}
      onPointerDown={() => { wrapperRef.current?.focus(); unlockAudio() }}
      style={{ width: '100vw', height: '100vh', outline: 'none', position: 'relative' }}
    >
      {/* Screens without Canvas */}
      {screen === 'MAIN_MENU' && <MainMenu />}
      {screen === 'CHARACTER_SELECT' && <CharacterSelect />}
      {screen === 'LOADING' && <LoadingScreen />}

      {/* 3D Canvas — only while in-game */}
      {isInGame && (
        <Canvas
          gl={{ antialias: false }}
          dpr={1}
          shadows="basic"
          camera={{ fov: 40, near: 0.1, far: 300, position: [0, 14, -16] }}
          style={{ background: PALETTE.skyPeach, width: '100%', height: '100%', display: 'block' }}
        >
          <Suspense fallback={null}>
            <LevelRunner
              characterRef={characterRef}
              joystickDir={joystickDir}
              jumpRef={jumpRef}
            />
          </Suspense>
        </Canvas>
      )}

      {/* HUD + mobile controls overlay */}
      {isInGame && (
        <HUD
          joystickNode={isTouchDevice ? (
            <div style={{ pointerEvents: 'auto' }}>
              <VirtualJoystick dirRef={joystickDir} />
            </div>
          ) : undefined}
          jumpButtonNode={isTouchDevice ? (
            <div
              onPointerDown={() => { jumpRef.current = true }}
              style={{
                position: 'absolute',
                bottom: 'calc(28px + env(safe-area-inset-bottom))',
                right: 'calc(28px + env(safe-area-inset-right))',
                width: 64, height: 64, borderRadius: '50%',
                background: 'rgba(255,255,255,0.22)',
                border: '2.5px solid rgba(255,255,255,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                touchAction: 'none', userSelect: 'none',
                color: 'rgba(255,255,255,0.85)', fontSize: 22,
                pointerEvents: 'auto',
              }}
            >↑</div>
          ) : undefined}
        />
      )}

      {/* Level complete overlay */}
      {screen === 'LEVEL_COMPLETE' && <LevelComplete />}
    </div>
  )
}
