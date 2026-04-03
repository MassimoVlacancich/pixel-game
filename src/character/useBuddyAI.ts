import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import type { RigidBody as RapierRigidBody } from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import type { CharacterRef } from './Character'

const SPEED = 5.6        // 80% of player speed (7)
const FOLLOW_DIST = 3    // start following when farther than this
const MIN_DIST = 1.8     // stop when closer than this
const TELEPORT_DIST = 15 // teleport if too far (unstuck)
const GRAVITY = 35
const JUMP_VEL = Math.sqrt(2 * GRAVITY * 2)

interface KCC {
  setMaxSlopeClimbAngle(a: number): void
  setMinSlopeSlideAngle(a: number): void
  enableSnapToGround(d: number): void
  enableAutostep(h: number, w: number, d: boolean): void
  setSlideEnabled(v: boolean): void
  computeColliderMovement(col: unknown, mv: { x: number; y: number; z: number }): void
  computedMovement(): { x: number; y: number; z: number }
  computedGrounded(): boolean
}

export function useBuddyAI(
  buddyGroupRef: React.RefObject<THREE.Group | null>,
  buddyBodyRef: React.RefObject<RapierRigidBody | null>,
  playerRef: React.RefObject<CharacterRef | null>,
) {
  const { world } = useRapier()
  const ccRef = useRef<KCC | null>(null)
  const verticalVel = useRef(0)
  const isGroundedRef = useRef(true)
  const movingRef = useRef(false)

  useEffect(() => {
    const cc = world.createCharacterController(0.01)
    cc.setMaxSlopeClimbAngle(45 * (Math.PI / 180))
    cc.setMinSlopeSlideAngle(50 * (Math.PI / 180))
    cc.enableSnapToGround(0.5)
    cc.enableAutostep(0.4, 0.2, true)
    cc.setSlideEnabled(true)
    ccRef.current = cc as unknown as KCC
    return () => { world.removeCharacterController(cc) }
  }, [world])

  useFrame((_, delta) => {
    const group = buddyGroupRef.current
    const body = buddyBodyRef.current
    const cc = ccRef.current
    const player = playerRef.current
    if (!group || !body || !cc || !player) return

    const isGrounded = isGroundedRef.current

    // Gravity
    if (isGrounded && verticalVel.current < 0) {
      verticalVel.current = 0
    } else {
      verticalVel.current -= GRAVITY * delta
    }

    // Distance to player
    const bodyPos = body.translation()
    const playerPos = player.position
    const dx = playerPos.x - bodyPos.x
    const dz = playerPos.z - bodyPos.z
    const dist = Math.sqrt(dx * dx + dz * dz)

    // Teleport if stuck too far away
    if (dist > TELEPORT_DIST) {
      body.setNextKinematicTranslation({
        x: playerPos.x - 1.5, y: bodyPos.y, z: playerPos.z - 1.5,
      })
      group.position.set(playerPos.x - 1.5, bodyPos.y - 0.95, playerPos.z - 1.5)
      return
    }

    let moveX = 0, moveZ = 0
    movingRef.current = false

    if (dist > FOLLOW_DIST) {
      movingRef.current = true
      const nx = dx / dist, nz = dz / dist
      moveX = nx * SPEED * delta
      moveZ = nz * SPEED * delta

      // Face toward player
      const targetAngle = Math.atan2(nx, nz)
      const diff = targetAngle - group.rotation.y
      const wrapped = ((diff + Math.PI) % (Math.PI * 2)) - Math.PI
      group.rotation.y += wrapped * Math.min(10 * delta, 1)
    }

    cc.computeColliderMovement(body.collider(0), {
      x: moveX, y: verticalVel.current * delta, z: moveZ,
    })

    const corrected = cc.computedMovement()
    body.setNextKinematicTranslation({
      x: bodyPos.x + corrected.x,
      y: bodyPos.y + corrected.y,
      z: bodyPos.z + corrected.z,
    })

    isGroundedRef.current = cc.computedGrounded()

    const t = body.translation()
    group.position.set(t.x, t.y - 0.95, t.z)
  })

  return { movingRef }
}
