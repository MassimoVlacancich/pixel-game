import { Canvas } from '@react-three/fiber'
import { Suspense, useRef, useEffect, useState, lazy } from 'react'

// Dev tool — tree-shaken in production when ?tool= is never set
const SceneBuilder = lazy(() => import('./tools/sceneBuilder/SceneBuilder'))
import { PALETTE } from './palette'
import { useGameStore } from './store/useGameStore'
import { unlockAudio } from './audio/AudioManager'
import LevelRunner from './game/LevelRunner'
import MainMenu from './screens/MainMenu'
import LevelSelect from './screens/LevelSelect'
import CharacterSelect from './screens/CharacterSelect'
import CarSelect from './screens/CarSelect'
import LevelComplete from './screens/LevelComplete'
import LoadingScreen from './screens/LoadingScreen'
import HUD from './hud/HUD'
import BatteryDisplay from './hud/BatteryDisplay'
import SplatterOverlay from './hud/SplatterOverlay'
import WinFade from './hud/WinFade'
import VirtualJoystick from './controls/VirtualJoystick'
import { LEVELS } from './levels/levelRegistry'
import type { CharacterRef } from './character/Character'
import type { JoystickDir } from './controls/VirtualJoystick'

const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
const isSceneBuilder = new URLSearchParams(window.location.search).get('tool') === 'scene-builder'

export default function App() {
  // Dev tool shortcut — renders nothing else
  if (isSceneBuilder) {
    return (
      <Suspense fallback={<div style={{ color: '#fff', padding: 20 }}>Loading builder…</div>}>
        <SceneBuilder />
      </Suspense>
    )
  }

  const screen = useGameStore((s) => s.screen)
  const levelIndex = useGameStore((s) => s.levelIndex)
  const loadSave = useGameStore((s) => s.loadSave)

  const characterRef = useRef<CharacterRef>(null)
  const joystickDir = useRef<JoystickDir>({ x: 0, z: 0 })
  const jumpRef = useRef(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadSave() }, [loadSave])
  useEffect(() => { wrapperRef.current?.focus() }, [])

  const gameEndFading = useGameStore((s) => s.gameEndFading)
  const isInGame = screen === 'PLAYING' || screen === 'PAUSED' || screen === 'GAME_OVER' || screen === 'LEVEL_COMPLETE' || screen === 'CINEMATIC'

  return (
    <div
      ref={wrapperRef}
      tabIndex={0}
      onPointerDown={() => { wrapperRef.current?.focus(); unlockAudio() }}
      style={{ width: '100vw', height: '100vh', outline: 'none', position: 'relative' }}
    >
      {/* Screens without Canvas */}
      {screen === 'MAIN_MENU' && <MainMenu />}
      {screen === 'LEVEL_SELECT' && <LevelSelect />}
      {screen === 'CHARACTER_SELECT' && <CharacterSelect />}
      {screen === 'CAR_SELECT' && <CarSelect />}
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

      {/* Battery HUD + splatter + win fade for drive level */}
      {isInGame && LEVELS[levelIndex]?.sceneKey === 'DriveScene' && <BatteryDisplay />}
      {isInGame && LEVELS[levelIndex]?.sceneKey === 'DriveScene' && <SplatterOverlay />}
      {isInGame && LEVELS[levelIndex]?.sceneKey === 'DriveScene' && <WinFade />}

      {/* Level complete overlay */}
      {screen === 'LEVEL_COMPLETE' && <LevelComplete />}

      {/* Ending cinematic fade — black overlay that fades in then out over the main menu */}
      {gameEndFading && <EndingFade />}
    </div>
  )
}

// ── Ending fade overlay ───────────────────────────────────────────────────────
// Phase 1: opacity 0 → 1 over 1.5 s (fade to black, then switch to MAIN_MENU)
// Phase 2: opacity 1 → 0 over 1 s   (reveal main menu background)
function EndingFade() {
  const [opacity, setOpacity] = useState(0)
  const [phase, setPhase] = useState<'in' | 'out'>('in')
  const setScreen = useGameStore((s) => s.setScreen)
  const setGameEndFading = useGameStore((s) => s.setGameEndFading)

  // Trigger fade-in on mount
  useEffect(() => {
    // rAF so the browser paints opacity:0 first, then the transition fires
    const id = requestAnimationFrame(() => setOpacity(1))
    return () => cancelAnimationFrame(id)
  }, [])

  const onTransitionEnd = () => {
    if (phase === 'in') {
      // Fully black — switch to main menu, then fade out
      setScreen('MAIN_MENU')
      setPhase('out')
      requestAnimationFrame(() => setOpacity(0))
    } else {
      // Fully transparent — done
      setGameEndFading(false)
    }
  }

  return (
    <div
      onTransitionEnd={onTransitionEnd}
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        opacity,
        transition: phase === 'in' ? 'opacity 1.5s ease-in' : 'opacity 1s ease-out',
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    />
  )
}
