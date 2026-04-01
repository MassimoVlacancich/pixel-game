import { forwardRef, useRef, useImperativeHandle } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CapsuleCollider } from '@react-three/rapier'
import type { RigidBody as RapierRigidBody } from '@dimforge/rapier3d-compat'
import { PALETTE } from '../palette'
import { useCharacterControls } from './useCharacterControls'
import type { JoystickDir } from '../controls/VirtualJoystick'
import { getToonGradient } from '../utils/toonGradient'

export type CharacterRef = THREE.Group

interface CharacterProps {
  joystickDir?: React.MutableRefObject<JoystickDir>
  cameraAngle?: React.MutableRefObject<number>
  jumpRef?: React.MutableRefObject<boolean>
}

function Outlined({
  geo,
  color,
  scale = 1.08,
  castShadow = false,
}: {
  geo: React.ReactNode
  color: string
  scale?: number
  castShadow?: boolean
}) {
  const gradient = getToonGradient()
  return (
    <>
      <mesh castShadow={castShadow}>
        {geo}
        <meshToonMaterial color={color} gradientMap={gradient} />
      </mesh>
      <mesh scale={scale}>
        {geo}
        <meshBasicMaterial color="#1A0800" side={THREE.BackSide} />
      </mesh>
    </>
  )
}

const Character = forwardRef<CharacterRef, CharacterProps>(({ joystickDir, cameraAngle, jumpRef }, ref) => {
  const groupRef = useRef<THREE.Group>(null)
  const bodyRef = useRef<RapierRigidBody>(null)
  useImperativeHandle(ref, () => groupRef.current!)

  const { movingRef, jumpStateRef } = useCharacterControls(groupRef, bodyRef, jumpRef, joystickDir, cameraAngle)

  // Limb refs — pivot points are at the joint (shoulder / hip)
  const armLRef = useRef<THREE.Group>(null)
  const armRRef = useRef<THREE.Group>(null)
  const legLRef = useRef<THREE.Group>(null)
  const legRRef = useRef<THREE.Group>(null)
  const walkTime = useRef(0)
  const swingAmp = useRef(0)

  useFrame((_, delta) => {
    const isMoving = movingRef.current
    const jumpState = jumpStateRef.current

    // Walk animation
    swingAmp.current += ((isMoving && jumpState === 'grounded' ? 0.45 : 0) - swingAmp.current) * Math.min(10 * delta, 1)
    if (isMoving && jumpState === 'grounded') walkTime.current += delta * 8

    const s = Math.sin(walkTime.current) * swingAmp.current

    if (jumpState !== 'grounded') {
      // Jump animation: legs tuck back + spread, arms forward + opposite spread
      const t = Math.min(swingAmp.current + 1, 1) // blend factor
      if (legLRef.current) {
        legLRef.current.rotation.x = THREE.MathUtils.lerp(legLRef.current.rotation.x,  0.65, t)
        legLRef.current.rotation.z = THREE.MathUtils.lerp(legLRef.current.rotation.z, -0.25, t)
      }
      if (legRRef.current) {
        legRRef.current.rotation.x = THREE.MathUtils.lerp(legRRef.current.rotation.x,  0.65, t)
        legRRef.current.rotation.z = THREE.MathUtils.lerp(legRRef.current.rotation.z,  0.25, t)
      }
      if (armLRef.current) {
        armLRef.current.rotation.x = THREE.MathUtils.lerp(armLRef.current.rotation.x, -0.6, t)
        armLRef.current.rotation.z = THREE.MathUtils.lerp(armLRef.current.rotation.z,  0.2, t)
      }
      if (armRRef.current) {
        armRRef.current.rotation.x = THREE.MathUtils.lerp(armRRef.current.rotation.x, -0.6, t)
        armRRef.current.rotation.z = THREE.MathUtils.lerp(armRRef.current.rotation.z, -0.2, t)
      }
    } else {
      // Walk / idle animation
      if (legLRef.current) { legLRef.current.rotation.x = s;       legLRef.current.rotation.z = 0 }
      if (legRRef.current) { legRRef.current.rotation.x = -s;      legRRef.current.rotation.z = 0 }
      if (armLRef.current) { armLRef.current.rotation.x = -s * 0.6; armLRef.current.rotation.z = 0 }
      if (armRRef.current) { armRRef.current.rotation.x =  s * 0.6; armRRef.current.rotation.z = 0 }
    }
  })

  return (
    <>
      {/* Physics body — capsule center at Y=0.95 so bottom touches Y=0 */}
      <RigidBody
        ref={bodyRef}
        type="kinematicPosition"
        colliders={false}
        position={[0, 0.95, -5]}
      >
        <CapsuleCollider args={[0.6, 0.35]} />
      </RigidBody>

      {/* Visual group — synced from body each frame in useCharacterControls */}
      <group ref={groupRef} position={[0, 0, -5]}>
        {/* Body */}
        <group position={[0, 1.05, 0]}>
          <Outlined geo={<boxGeometry args={[0.55, 0.7, 0.3]} />} color={PALETTE.characterBody} castShadow />
        </group>

        {/* Head */}
        <group position={[0, 1.65, 0]}>
          <Outlined geo={<boxGeometry args={[0.45, 0.42, 0.42]} />} color={PALETTE.characterSkin} castShadow />
        </group>

        {/* Hair */}
        <group position={[0, 1.88, 0]}>
          <Outlined geo={<boxGeometry args={[0.47, 0.18, 0.44]} />} color={PALETTE.characterHair} castShadow />
        </group>

        {/* Left arm — pivot at shoulder (top of arm) */}
        <group ref={armLRef} position={[-0.37, 1.31, 0]}>
          <group position={[0, -0.29, 0]}>
            <Outlined geo={<boxGeometry args={[0.18, 0.58, 0.22]} />} color={PALETTE.characterBody} castShadow />
          </group>
        </group>

        {/* Right arm — pivot at shoulder */}
        <group ref={armRRef} position={[0.37, 1.31, 0]}>
          <group position={[0, -0.29, 0]}>
            <Outlined geo={<boxGeometry args={[0.18, 0.58, 0.22]} />} color={PALETTE.characterBody} castShadow />
          </group>
        </group>

        {/* Left leg — pivot at hip (top of leg) */}
        <group ref={legLRef} position={[-0.16, 0.64, 0]}>
          <group position={[0, -0.31, 0]}>
            <Outlined geo={<boxGeometry args={[0.22, 0.62, 0.25]} />} color={PALETTE.characterHair} castShadow />
          </group>
        </group>

        {/* Right leg — pivot at hip */}
        <group ref={legRRef} position={[0.16, 0.64, 0]}>
          <group position={[0, -0.31, 0]}>
            <Outlined geo={<boxGeometry args={[0.22, 0.62, 0.25]} />} color={PALETTE.characterHair} castShadow />
          </group>
        </group>
      </group>
    </>
  )
})

Character.displayName = 'Character'
export default Character
