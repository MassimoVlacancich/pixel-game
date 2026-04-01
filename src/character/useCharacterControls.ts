import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useKeyboard } from '../hooks/useKeyboard'
import type { JoystickDir } from '../controls/VirtualJoystick'

const SPEED = 7
const TURN_SPEED = 10

export function useCharacterControls(
  groupRef: React.RefObject<THREE.Group | null>,
  joystickDir?: React.MutableRefObject<JoystickDir>,
) {
  const keys = useKeyboard()
  const direction = useRef(new THREE.Vector3())
  const targetAngle = useRef(0)

  useFrame((_, delta) => {
    const group = groupRef.current
    if (!group) return

    const { forward, backward, left, right } = keys.current

    // Keyboard input
    direction.current.set(0, 0, 0)
    if (forward)  direction.current.z += 1
    if (backward) direction.current.z -= 1
    if (left)     direction.current.x -= 1
    if (right)    direction.current.x += 1

    // Joystick input (additive — whichever is active wins)
    if (joystickDir) {
      direction.current.x += joystickDir.current.x
      direction.current.z += joystickDir.current.z
    }

    if (direction.current.lengthSq() > 0.01) {
      direction.current.normalize()

      targetAngle.current = Math.atan2(direction.current.x, direction.current.z)
      const angleDiff = targetAngle.current - group.rotation.y
      const wrappedDiff = ((angleDiff + Math.PI) % (Math.PI * 2)) - Math.PI
      group.rotation.y += wrappedDiff * Math.min(TURN_SPEED * delta, 1)

      group.position.x += direction.current.x * SPEED * delta
      group.position.z += direction.current.z * SPEED * delta
    }
  })
}
