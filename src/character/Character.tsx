import { forwardRef, useRef, useImperativeHandle } from 'react'
import * as THREE from 'three'
import { PALETTE } from '../palette'
import { useCharacterControls } from './useCharacterControls'
import type { JoystickDir } from '../controls/VirtualJoystick'

export type CharacterRef = THREE.Group

interface CharacterProps {
  joystickDir?: React.MutableRefObject<JoystickDir>
}

const Character = forwardRef<CharacterRef, CharacterProps>(({ joystickDir }, ref) => {
  const groupRef = useRef<THREE.Group>(null)

  useImperativeHandle(ref, () => groupRef.current!)
  useCharacterControls(groupRef, joystickDir)

  return (
    <group ref={groupRef} position={[0, 0, -5]}>
      {/* Body */}
      <mesh position={[0, 1.05, 0]} castShadow>
        <boxGeometry args={[0.55, 0.7, 0.3]} />
        <meshToonMaterial color={PALETTE.characterBody} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 1.65, 0]} castShadow>
        <boxGeometry args={[0.45, 0.42, 0.42]} />
        <meshToonMaterial color={PALETTE.characterSkin} />
      </mesh>

      {/* Hair */}
      <mesh position={[0, 1.88, 0]} castShadow>
        <boxGeometry args={[0.47, 0.18, 0.44]} />
        <meshToonMaterial color={PALETTE.characterHair} />
      </mesh>

      {/* Left arm */}
      <mesh position={[-0.37, 1.02, 0]} castShadow>
        <boxGeometry args={[0.18, 0.58, 0.22]} />
        <meshToonMaterial color={PALETTE.characterBody} />
      </mesh>

      {/* Right arm */}
      <mesh position={[0.37, 1.02, 0]} castShadow>
        <boxGeometry args={[0.18, 0.58, 0.22]} />
        <meshToonMaterial color={PALETTE.characterBody} />
      </mesh>

      {/* Left leg */}
      <mesh position={[-0.16, 0.33, 0]} castShadow>
        <boxGeometry args={[0.22, 0.62, 0.25]} />
        <meshToonMaterial color={PALETTE.characterHair} />
      </mesh>

      {/* Right leg */}
      <mesh position={[0.16, 0.33, 0]} castShadow>
        <boxGeometry args={[0.22, 0.62, 0.25]} />
        <meshToonMaterial color={PALETTE.characterHair} />
      </mesh>
    </group>
  )
})

Character.displayName = 'Character'
export default Character
