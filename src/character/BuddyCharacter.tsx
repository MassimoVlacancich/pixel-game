import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CapsuleCollider } from '@react-three/rapier'
import type { RigidBody as RapierRigidBody } from '@dimforge/rapier3d-compat'
import { useBuddyAI } from './useBuddyAI'
import type { CharacterConfig } from './characterRegistry'
import type { CharacterRef } from './Character'
import CharacterMesh from './CharacterMesh'

interface BuddyCharacterProps {
  config: CharacterConfig
  startPosition?: [number, number, number]
  playerRef: React.RefObject<CharacterRef | null>
}

export default function BuddyCharacter({ config, startPosition = [0, 0.95, -5], playerRef }: BuddyCharacterProps) {
  const groupRef = useRef<THREE.Group>(null)
  const bodyRef = useRef<RapierRigidBody>(null)
  const armLRef = useRef<THREE.Group>(null)
  const armRRef = useRef<THREE.Group>(null)
  const legLRef = useRef<THREE.Group>(null)
  const legRRef = useRef<THREE.Group>(null)
  const walkTime = useRef(0)
  const swingAmp = useRef(0)

  const { movingRef } = useBuddyAI(groupRef, bodyRef, playerRef)

  useFrame((_, delta) => {
    const isMoving = movingRef.current
    swingAmp.current += ((isMoving ? 0.45 : 0) - swingAmp.current) * Math.min(10 * delta, 1)
    if (isMoving) walkTime.current += delta * 8
    const s = Math.sin(walkTime.current) * swingAmp.current
    if (legLRef.current) { legLRef.current.rotation.x = s;        legLRef.current.rotation.z = 0 }
    if (legRRef.current) { legRRef.current.rotation.x = -s;       legRRef.current.rotation.z = 0 }
    if (armLRef.current) { armLRef.current.rotation.x = -s * 0.6; armLRef.current.rotation.z = 0 }
    if (armRRef.current) { armRRef.current.rotation.x =  s * 0.6; armRRef.current.rotation.z = 0 }
  })

  const [sx, sy, sz] = startPosition
  return (
    <>
      <RigidBody ref={bodyRef} type="kinematicPosition" colliders={false} position={[sx, sy, sz]}>
        <CapsuleCollider args={[0.6, 0.35]} />
      </RigidBody>
      {/* Scale buddies to ~waist height. scale(0.55) shrinks everything;
          the mesh feet are at y=0 at full scale, so after scale the feet
          are still at y=0 in the group's local space — no extra offset needed. */}
      <group ref={groupRef} position={[sx, sy - 0.95, sz]}>
        <group scale={config.meshType === 'sheep' ? 1.1 : 0.55}>
          <CharacterMesh
            config={config}
            legLRef={legLRef} legRRef={legRRef}
            armLRef={armLRef} armRRef={armRRef}
            castShadow
          />
        </group>
      </group>
    </>
  )
}
