import { useRef } from 'react'
import { Sky } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import * as THREE from 'three'
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
import { RigidBody } from '@react-three/rapier'
import { getToonGradient } from '../utils/toonGradient'

interface JapanSceneProps {
  characterRef: React.RefObject<CharacterRef | null>
  joystickDir: React.MutableRefObject<JoystickDir>
  jumpRef: React.MutableRefObject<boolean>
}

const gradient = getToonGradient()

export default function JapanScene({ characterRef, joystickDir, jumpRef }: JapanSceneProps) {
  const orbitAngle = useRef(0)

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

      <Physics gravity={[0, -20, 0]}>
        {/* World */}
        <Ground />
        <Mountains />
        <CherryTrees />
        <Shrine />

        {/* Ramp */}
        <RigidBody type="fixed" position={[5, 0.96, 5]} rotation={[-Math.PI * 25 / 180, 0, 0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[3, 0.25, 5]} />
            <meshToonMaterial color={PALETTE.pathStone} gradientMap={gradient} />
          </mesh>
        </RigidBody>

        {/* Ramp landing platform */}
        <RigidBody type="fixed" position={[5, 1.80, 9]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[4, 0.3, 3]} />
            <meshToonMaterial color={PALETTE.pathStone} gradientMap={gradient} />
          </mesh>
        </RigidBody>

        {/* Rocks to jump over */}
        {(
          [
            [1.5,  0.225, -1 ],
            [-1.2, 0.225,  1 ],
            [0.6,  0.225,  4 ],
            [2,    0.225,  8 ],
            [-1.8, 0.225, -3 ],
          ] as [number, number, number][]
        ).map(([x, y, z], i) => (
          <RigidBody key={i} type="fixed" position={[x, y, z]}>
            <mesh castShadow receiveShadow>
              <sphereGeometry args={[0.35, 5, 4]} />
              <meshToonMaterial color={PALETTE.pathStone} gradientMap={gradient} />
            </mesh>
          </RigidBody>
        ))}

        {/* Character + camera */}
        <Character ref={characterRef} joystickDir={joystickDir} cameraAngle={orbitAngle} jumpRef={jumpRef} />
      </Physics>

      <ThirdPersonCamera target={characterRef} orbitAngleRef={orbitAngle} />
      <Particles />

      {/* Atmospheric vignette */}
      <PixelPostProcessing />
    </>
  )
}
