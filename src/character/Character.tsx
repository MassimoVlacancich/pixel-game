import { forwardRef, useRef, useImperativeHandle } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CapsuleCollider } from '@react-three/rapier'
import type { RigidBody as RapierRigidBody } from '@dimforge/rapier3d-compat'
import { useCharacterControls } from './useCharacterControls'
import type { CharacterConfig } from './characterRegistry'
import { CHARACTERS } from './characterRegistry'
import type { JoystickDir } from '../controls/VirtualJoystick'
import CharacterMesh from './CharacterMesh'

export type CharacterRef = THREE.Group

interface CharacterProps {
  config?: CharacterConfig
  startPosition?: [number, number, number]
  joystickDir?: React.MutableRefObject<JoystickDir>
  cameraAngle?: React.MutableRefObject<number>
  jumpRef?: React.MutableRefObject<boolean>
  playerIndex?: 0 | 1
  /** When true the arms animate to a raised forward position (~70°) */
  holdingItemRef?: React.MutableRefObject<boolean>
  /** Rendered inside the visual group — use for held items that follow the character */
  children?: React.ReactNode
}

const HOLD_ANGLE = -(70 * THREE.MathUtils.DEG2RAD)  // arms raised 70° forward

const Character = forwardRef<CharacterRef, CharacterProps>((
  { config, startPosition = [0, 0.95, -5], joystickDir, cameraAngle, jumpRef, playerIndex = 0, holdingItemRef, children },
  ref,
) => {
  const cfg = config ?? CHARACTERS[0]
  const groupRef = useRef<THREE.Group>(null)
  const bodyRef = useRef<RapierRigidBody>(null)
  useImperativeHandle(ref, () => groupRef.current!)

  const { movingRef, jumpStateRef } = useCharacterControls(
    groupRef, bodyRef, jumpRef, joystickDir, cameraAngle, playerIndex,
  )

  const armLRef = useRef<THREE.Group>(null)
  const armRRef = useRef<THREE.Group>(null)
  const legLRef = useRef<THREE.Group>(null)
  const legRRef = useRef<THREE.Group>(null)
  const walkTime = useRef(0)
  const swingAmp = useRef(0)

  useFrame((_, delta) => {
    const isMoving = movingRef.current
    const jumpState = jumpStateRef.current

    swingAmp.current += ((isMoving && jumpState === 'grounded' ? 0.45 : 0) - swingAmp.current) * Math.min(10 * delta, 1)
    if (isMoving && jumpState === 'grounded') walkTime.current += delta * 8

    const s = Math.sin(walkTime.current) * swingAmp.current

    const holding = holdingItemRef?.current ?? false

    if (jumpState !== 'grounded') {
      const t = 0.12
      if (legLRef.current) { legLRef.current.rotation.x = THREE.MathUtils.lerp(legLRef.current.rotation.x, 0.65, t); legLRef.current.rotation.z = THREE.MathUtils.lerp(legLRef.current.rotation.z, -0.25, t) }
      if (legRRef.current) { legRRef.current.rotation.x = THREE.MathUtils.lerp(legRRef.current.rotation.x, 0.65, t); legRRef.current.rotation.z = THREE.MathUtils.lerp(legRRef.current.rotation.z,  0.25, t) }
      if (armLRef.current) { armLRef.current.rotation.x = THREE.MathUtils.lerp(armLRef.current.rotation.x, -0.6, t); armLRef.current.rotation.z = THREE.MathUtils.lerp(armLRef.current.rotation.z,  0.2, t) }
      if (armRRef.current) { armRRef.current.rotation.x = THREE.MathUtils.lerp(armRRef.current.rotation.x, -0.6, t); armRRef.current.rotation.z = THREE.MathUtils.lerp(armRRef.current.rotation.z, -0.2, t) }
    } else if (holding) {
      const t = 0.18
      if (armLRef.current) { armLRef.current.rotation.x = THREE.MathUtils.lerp(armLRef.current.rotation.x, HOLD_ANGLE, t); armLRef.current.rotation.z = THREE.MathUtils.lerp(armLRef.current.rotation.z, 0, t) }
      if (armRRef.current) { armRRef.current.rotation.x = THREE.MathUtils.lerp(armRRef.current.rotation.x, HOLD_ANGLE, t); armRRef.current.rotation.z = THREE.MathUtils.lerp(armRRef.current.rotation.z, 0, t) }
      if (legLRef.current) { legLRef.current.rotation.x = s;  legLRef.current.rotation.z = 0 }
      if (legRRef.current) { legRRef.current.rotation.x = -s; legRRef.current.rotation.z = 0 }
    } else {
      if (legLRef.current) { legLRef.current.rotation.x = s;        legLRef.current.rotation.z = 0 }
      if (legRRef.current) { legRRef.current.rotation.x = -s;       legRRef.current.rotation.z = 0 }
      if (armLRef.current) { armLRef.current.rotation.x = -s * 0.6; armLRef.current.rotation.z = 0 }
      if (armRRef.current) { armRRef.current.rotation.x =  s * 0.6; armRRef.current.rotation.z = 0 }
    }
  })

  const [sx, sy, sz] = startPosition
  return (
    <>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <RigidBody
        ref={bodyRef as any}
        type="kinematicPosition"
        colliders={false}
        position={[sx, sy, sz]}
        userData={{ type: 'player', playerIndex }}
      >
        <CapsuleCollider args={[0.6, 0.35]} />
      </RigidBody>
      <group ref={groupRef} position={[sx, sy - 0.95, sz]}>
        <CharacterMesh
          config={cfg}
          legLRef={legLRef} legRRef={legRRef}
          armLRef={armLRef} armRRef={armRRef}
          castShadow
        />
        {children}
      </group>
    </>
  )
})

Character.displayName = 'Character'
export default Character
