import { forwardRef, useRef, useImperativeHandle } from 'react'
import * as THREE from 'three'
import { PALETTE } from '../palette'
import { useCharacterControls } from './useCharacterControls'
import type { JoystickDir } from '../controls/VirtualJoystick'
import { getToonGradient } from '../utils/toonGradient'

export type CharacterRef = THREE.Group

interface CharacterProps {
  joystickDir?: React.MutableRefObject<JoystickDir>
}

// Render a mesh with a hull outline sibling
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

const Character = forwardRef<CharacterRef, CharacterProps>(({ joystickDir }, ref) => {
  const groupRef = useRef<THREE.Group>(null)
  useImperativeHandle(ref, () => groupRef.current!)
  useCharacterControls(groupRef, joystickDir)

  return (
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

      {/* Left arm */}
      <group position={[-0.37, 1.02, 0]}>
        <Outlined geo={<boxGeometry args={[0.18, 0.58, 0.22]} />} color={PALETTE.characterBody} castShadow />
      </group>

      {/* Right arm */}
      <group position={[0.37, 1.02, 0]}>
        <Outlined geo={<boxGeometry args={[0.18, 0.58, 0.22]} />} color={PALETTE.characterBody} castShadow />
      </group>

      {/* Left leg */}
      <group position={[-0.16, 0.33, 0]}>
        <Outlined geo={<boxGeometry args={[0.22, 0.62, 0.25]} />} color={PALETTE.characterHair} castShadow />
      </group>

      {/* Right leg */}
      <group position={[0.16, 0.33, 0]}>
        <Outlined geo={<boxGeometry args={[0.22, 0.62, 0.25]} />} color={PALETTE.characterHair} castShadow />
      </group>
    </group>
  )
})

Character.displayName = 'Character'
export default Character
