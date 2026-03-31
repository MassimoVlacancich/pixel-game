import { Sky } from '@react-three/drei'
import Ground from './Ground'
import Mountains from './Mountain'
import CherryTrees from './CherryTree'
import Shrine from './Shrine'
import Particles from './Particles'
import Character from '../character/Character'
import type { CharacterRef } from '../character/Character'
import type { JoystickDir } from '../controls/VirtualJoystick'
import ThirdPersonCamera from '../camera/ThirdPersonCamera'
import PixelPostProcessing from '../effects/PixelPostProcessing'
import { PALETTE } from '../palette'

interface JapanSceneProps {
  characterRef: React.RefObject<CharacterRef | null>
  joystickDir: React.MutableRefObject<JoystickDir>
}

export default function JapanScene({ characterRef, joystickDir }: JapanSceneProps) {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.9} color="#FFF5E6" />
      <directionalLight
        position={[10, 20, 5]}
        intensity={1.4}
        color="#FFE8D6"
        castShadow
        shadow-mapSize={[512, 512]}
        shadow-camera-near={0.5}
        shadow-camera-far={100}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
      />
      <hemisphereLight args={['#FFD9C0', '#A8C5A0', 0.5]} />

      {/* Sky */}
      <Sky
        distance={400}
        sunPosition={[0.3, 0.2, -1]}
        inclination={0.6}
        azimuth={0.25}
        rayleigh={0.5}
        turbidity={6}
        mieCoefficient={0.003}
        mieDirectionalG={0.7}
      />

      {/* Atmosphere fog */}
      <fog attach="fog" args={[PALETTE.skyPeach, 50, 120]} />

      {/* World */}
      <Ground />
      <Mountains />
      <CherryTrees />
      <Shrine />
      <Particles />

      {/* Character + camera */}
      <Character ref={characterRef} joystickDir={joystickDir} />
      <ThirdPersonCamera target={characterRef} />

      {/* Pixel art post-processing */}
      <PixelPostProcessing granularity={3} />
    </>
  )
}
