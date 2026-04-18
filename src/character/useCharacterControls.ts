import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import type { RigidBody as RapierRigidBody } from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { useKeyboard } from '../hooks/useKeyboard'
import type { JoystickDir } from '../controls/VirtualJoystick'
import { useGameStore } from '../store/useGameStore'

const SPEED = 7
const TURN_SPEED = 15
const GRAVITY = 35
// v = sqrt(2 * g * h) where h = 2 units
const JUMP_VEL = Math.sqrt(2 * GRAVITY * 2) // ≈ 11.83

type JumpState = 'grounded' | 'rising' | 'falling'

function dz(v: number, threshold = 0.15): number {
  return Math.abs(v) < threshold ? 0 : v
}

// Rapier KCC interface — only the methods we actually call
interface KCC {
  setMaxSlopeClimbAngle(angle: number): void
  setMinSlopeSlideAngle(angle: number): void
  enableSnapToGround(dist: number): void
  enableAutostep(maxHeight: number, minWidth: number, includeDynamicBodies: boolean): void
  setSlideEnabled(enabled: boolean): void
  computeColliderMovement(collider: unknown, movement: { x: number; y: number; z: number }): void
  computedMovement(): { x: number; y: number; z: number }
  computedGrounded(): boolean
}

export function useCharacterControls(
  groupRef: React.RefObject<THREE.Group | null>,
  bodyRef: React.RefObject<RapierRigidBody | null>,
  jumpRef?: React.MutableRefObject<boolean>,
  joystickDir?: React.MutableRefObject<JoystickDir>,
  cameraAngle?: React.MutableRefObject<number>,
  playerIndex: 0 | 1 = 0,
) {
  const keys = useKeyboard()
  const { world } = useRapier()

  const direction = useRef(new THREE.Vector3())
  const targetAngle = useRef(0)
  const movingRef = useRef(false)
  const jumpStateRef = useRef<JumpState>('grounded')
  const verticalVel = useRef(0)
  const wasKeyJump = useRef(false)
  const wasGpJump = useRef(false)
  // Grounded state from the previous frame's computedGrounded() result
  const isGroundedRef = useRef(true)

  const ccRef = useRef<KCC | null>(null)

  useEffect(() => {
    const cc = world.createCharacterController(0.01)
    cc.setMaxSlopeClimbAngle(45 * (Math.PI / 180))
    cc.setMinSlopeSlideAngle(50 * (Math.PI / 180))
    cc.enableSnapToGround(0.5)
    cc.enableAutostep(0.4, 0.2, true)
    cc.setSlideEnabled(true)
    ccRef.current = cc as unknown as KCC
    return () => {
      world.removeCharacterController(cc)
    }
  }, [world])

  useFrame((_, delta) => {
    const group = groupRef.current
    const body = bodyRef.current
    const cc = ccRef.current
    if (!group || !body || !cc) return

    // Gate all input when paused
    const screen = useGameStore.getState().screen
    if (screen === 'PAUSED' || screen === 'GAME_OVER' || screen === 'LEVEL_COMPLETE' || screen === 'CINEMATIC') return

    // Use grounded state from end of last frame
    const isGrounded = isGroundedRef.current

    // --- Input gathering ---
    const { forward, backward, left, right, jump: jumpKey } = keys.current

    direction.current.set(0, 0, 0)
    if (forward)  direction.current.z += 1
    if (backward) direction.current.z -= 1
    if (left)     direction.current.x += 1
    if (right)    direction.current.x -= 1

    if (joystickDir) {
      direction.current.x += joystickDir.current.x
      direction.current.z += joystickDir.current.z
    }

    const gamepads = navigator.getGamepads()
    // Player N reads gamepad N (two-controller 2P support)
    const gp = gamepads[playerIndex]
    if (gp) {
      direction.current.x -= dz(gp.axes[0] ?? 0)
      direction.current.z -= dz(gp.axes[1] ?? 0)
    }

    // Rotate input by camera orbit angle so WASD stays screen-relative
    if (cameraAngle && cameraAngle.current !== 0) {
      const a = cameraAngle.current
      const cos = Math.cos(a), sin = Math.sin(a)
      const rx = direction.current.x * cos - direction.current.z * sin
      const rz = direction.current.x * sin + direction.current.z * cos
      direction.current.set(rx, 0, rz)
    }

    movingRef.current = direction.current.lengthSq() > 0.01

    // --- Jump detection (edge-triggered per input source) ---
    const jumpPressed = jumpKey || (jumpRef?.current ?? false)
    if (jumpRef) jumpRef.current = false // consume mobile pulse

    const gpJump = gamepads[playerIndex]?.buttons[0]?.pressed ?? false

    const keyEdge = jumpPressed && !wasKeyJump.current
    const gpEdge  = gpJump      && !wasGpJump.current
    if ((keyEdge || gpEdge) && isGrounded) {
      verticalVel.current = JUMP_VEL
    }
    wasKeyJump.current = jumpPressed
    wasGpJump.current  = gpJump

    // --- Gravity ---
    if (isGrounded && verticalVel.current < 0) {
      verticalVel.current = 0
    } else {
      verticalVel.current -= GRAVITY * delta
    }

    // --- Horizontal movement + facing ---
    let moveX = 0, moveZ = 0
    if (movingRef.current) {
      direction.current.normalize()
      moveX = direction.current.x * SPEED * delta
      moveZ = direction.current.z * SPEED * delta

      targetAngle.current = Math.atan2(direction.current.x, direction.current.z)
      const angleDiff = targetAngle.current - group.rotation.y
      const wrappedDiff = ((angleDiff + Math.PI) % (Math.PI * 2)) - Math.PI
      group.rotation.y += wrappedDiff * Math.min(TURN_SPEED * delta, 1)
    }

    // --- KCC: compute + apply movement ---
    const collider = body.collider(0)
    cc.computeColliderMovement(collider, { x: moveX, y: verticalVel.current * delta, z: moveZ })

    const corrected = cc.computedMovement()
    const pos = body.translation()
    body.setNextKinematicTranslation({
      x: pos.x + corrected.x,
      y: pos.y + corrected.y,
      z: pos.z + corrected.z,
    })

    // Update grounded state for next frame (must be after computeColliderMovement)
    isGroundedRef.current = cc.computedGrounded()

    // Update jump state for animation
    jumpStateRef.current = isGroundedRef.current
      ? 'grounded'
      : verticalVel.current >= 0 ? 'rising' : 'falling'

    // Sync visual group (capsule center is Y+0.95 above group feet)
    const t = body.translation()
    group.position.set(t.x, t.y - 0.95, t.z)
  })

  return { movingRef, jumpStateRef }
}
