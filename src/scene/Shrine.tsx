import { PALETTE } from '../palette'

const TORII_RED = PALETTE.toriRed

export default function Shrine() {
  return (
    <group position={[0, 0, 20]}>
      {/* Left pillar */}
      <mesh position={[-2.2, 2.5, 0]} castShadow>
        <boxGeometry args={[0.4, 5, 0.4]} />
        <meshToonMaterial color={TORII_RED} />
      </mesh>

      {/* Right pillar */}
      <mesh position={[2.2, 2.5, 0]} castShadow>
        <boxGeometry args={[0.4, 5, 0.4]} />
        <meshToonMaterial color={TORII_RED} />
      </mesh>

      {/* Top crossbeam (kasagi) — extends past pillars */}
      <mesh position={[0, 5.3, 0]} castShadow>
        <boxGeometry args={[5.6, 0.35, 0.55]} />
        <meshToonMaterial color={TORII_RED} />
      </mesh>

      {/* Slight upward curve ends — left */}
      <mesh position={[-2.6, 5.55, 0]} rotation={[0, 0, 0.25]} castShadow>
        <boxGeometry args={[0.6, 0.35, 0.55]} />
        <meshToonMaterial color={TORII_RED} />
      </mesh>
      {/* Slight upward curve ends — right */}
      <mesh position={[2.6, 5.55, 0]} rotation={[0, 0, -0.25]} castShadow>
        <boxGeometry args={[0.6, 0.35, 0.55]} />
        <meshToonMaterial color={TORII_RED} />
      </mesh>

      {/* Lower tie beam (nuki) */}
      <mesh position={[0, 4.1, 0]} castShadow>
        <boxGeometry args={[4.8, 0.22, 0.35]} />
        <meshToonMaterial color={TORII_RED} />
      </mesh>

      {/* Small stone lantern left */}
      <group position={[-3.8, 0, 0.5]}>
        <mesh position={[0, 0.3, 0]} castShadow>
          <boxGeometry args={[0.5, 0.6, 0.5]} />
          <meshToonMaterial color={PALETTE.pathStone} />
        </mesh>
        <mesh position={[0, 0.85, 0]} castShadow>
          <boxGeometry args={[0.65, 0.3, 0.65]} />
          <meshToonMaterial color={PALETTE.pathStone} />
        </mesh>
        <mesh position={[0, 1.15, 0]} castShadow>
          <boxGeometry args={[0.4, 0.3, 0.4]} />
          <meshToonMaterial color={PALETTE.snowWhite} />
        </mesh>
      </group>

      {/* Small stone lantern right */}
      <group position={[3.8, 0, 0.5]}>
        <mesh position={[0, 0.3, 0]} castShadow>
          <boxGeometry args={[0.5, 0.6, 0.5]} />
          <meshToonMaterial color={PALETTE.pathStone} />
        </mesh>
        <mesh position={[0, 0.85, 0]} castShadow>
          <boxGeometry args={[0.65, 0.3, 0.65]} />
          <meshToonMaterial color={PALETTE.pathStone} />
        </mesh>
        <mesh position={[0, 1.15, 0]} castShadow>
          <boxGeometry args={[0.4, 0.3, 0.4]} />
          <meshToonMaterial color={PALETTE.snowWhite} />
        </mesh>
      </group>
    </group>
  )
}
