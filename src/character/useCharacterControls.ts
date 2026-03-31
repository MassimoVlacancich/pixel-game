import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useKeyboard } from '../hooks/useKeyboard'

const SPEED = 7
const TURN_SPEED = 8

export function useCharacterControls(groupRef: React.RefObject<THREE.Group | null>) {
  const keys = useKeyboard()
  const direction = useRef(new THREE.Vector3())
  const targetAngle = useRef(0)

  useFrame((_, delta) => {
    const group = groupRef.current
    if (!group) return

    const { forward, backward, left, right } = keys.current
    const moving = forward || backward || left || right

    // Build movement direction in world XZ
    direction.current.set(0, 0, 0)
    if (forward)  direction.current.z += 1
    if (backward) direction.current.z -= 1
    if (left)     direction.current.x -= 1
    if (right)    direction.current.x += 1

    if (moving && direction.current.lengthSq() > 0) {
      direction.current.normalize()

      // Rotate character to face movement direction
      targetAngle.current = Math.atan2(direction.current.x, direction.current.z)
      const angleDiff = targetAngle.current - group.rotation.y
      const wrappedDiff = ((angleDiff + Math.PI) % (Math.PI * 2)) - Math.PI
      group.rotation.y += wrappedDiff * Math.min(TURN_SPEED * delta, 1)

      // Move
      group.position.x += direction.current.x * SPEED * delta
      group.position.z += direction.current.z * SPEED * delta
    }
  })
}
