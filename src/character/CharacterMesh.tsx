import * as THREE from 'three'
import { getToonGradient } from '../utils/toonGradient'
import type { CharacterConfig } from './characterRegistry'

// ── Shared helpers ────────────────────────────────────────────────────────────

function Outlined({ geo, color, scale = 1.08, castShadow = false }: {
  geo: React.ReactNode; color: string; scale?: number; castShadow?: boolean
}) {
  const gradient = getToonGradient()
  return (
    <>
      <mesh castShadow={castShadow}>{geo}<meshToonMaterial color={color} gradientMap={gradient} /></mesh>
      <mesh scale={scale}>{geo}<meshBasicMaterial color="#1A0800" side={THREE.BackSide} /></mesh>
    </>
  )
}

// White eye + dark pupil, optionally wall-eyed (divergent)
function Eye({ x, wallEyed = false }: { x: number; wallEyed?: boolean }) {
  const pupilOffset = wallEyed ? (x < 0 ? -0.03 : 0.03) : 0
  return (
    <group position={[x, 0, 0]}>
      <mesh><boxGeometry args={[0.1, 0.09, 0.04]} /><meshBasicMaterial color="#FFFFFF" /></mesh>
      <mesh position={[pupilOffset, 0, 0.03]}><boxGeometry args={[0.048, 0.052, 0.04]} /><meshBasicMaterial color="#1A0800" /></mesh>
    </group>
  )
}

// 3-box smile: wide base + two corners slightly above
function Smile({ w = 0.18, z = 0.22 }: { w?: number; z?: number }) {
  return (
    <group>
      <mesh position={[0, 0, z]}><boxGeometry args={[w, 0.04, 0.04]} /><meshBasicMaterial color="#1A0800" /></mesh>
      <mesh position={[-w * 0.5, 0.05, z - 0.01]}><boxGeometry args={[0.04, 0.09, 0.04]} /><meshBasicMaterial color="#1A0800" /></mesh>
      <mesh position={[ w * 0.5, 0.05, z - 0.01]}><boxGeometry args={[0.04, 0.09, 0.04]} /><meshBasicMaterial color="#1A0800" /></mesh>
    </group>
  )
}

// ── Mesh props ────────────────────────────────────────────────────────────────

interface MeshProps {
  legLRef?: React.RefObject<THREE.Group | null>
  legRRef?: React.RefObject<THREE.Group | null>
  armLRef?: React.RefObject<THREE.Group | null>
  armRRef?: React.RefObject<THREE.Group | null>
  castShadow?: boolean
}

// ── Fluffy wool cluster helper ────────────────────────────────────────────────
// Renders a bunch of overlapping spheres to simulate pixel-art fluffiness

function WoolCluster({ cx, cy, cz, color, castShadow }: {
  cx: number; cy: number; cz: number; color: string; castShadow?: boolean
}) {
  const g = getToonGradient()
  const blobs: [number, number, number, number][] = [
    [ 0,     0,    0,    0.26],
    [ 0.18,  0.06, 0,    0.22],
    [-0.18,  0.06, 0,    0.22],
    [ 0.10, -0.10, 0.08, 0.20],
    [-0.10, -0.10, 0.08, 0.20],
    [ 0,     0.14, 0.06, 0.20],
    [ 0.20, -0.06,-0.06, 0.18],
    [-0.20, -0.06,-0.06, 0.18],
    [ 0,    -0.08,-0.12, 0.19],
  ]
  return (
    <group position={[cx, cy, cz]}>
      {blobs.map(([x, y, z, r], i) => (
        <group key={i} position={[x, y, z]}>
          <mesh castShadow={castShadow && i === 0}>
            <sphereGeometry args={[r, 6, 5]} />
            <meshToonMaterial color={color} gradientMap={g} />
          </mesh>
          <mesh scale={1.12}>
            <sphereGeometry args={[r, 6, 5]} />
            <meshBasicMaterial color="#1A0800" side={THREE.BackSide} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// Solid-colour sphere used for the jumper tufts
function WoolTuft({ cx, cy, cz, r, color }: { cx: number; cy: number; cz: number; r: number; color: string }) {
  const g = getToonGradient()
  return (
    <group position={[cx, cy, cz]}>
      <mesh>
        <sphereGeometry args={[r, 6, 5]} />
        <meshToonMaterial color={color} gradientMap={g} />
      </mesh>
      <mesh scale={1.1}>
        <sphereGeometry args={[r, 6, 5]} />
        <meshBasicMaterial color="#1A0800" side={THREE.BackSide} />
      </mesh>
    </group>
  )
}

// ── 1. WOOLLY THE SHEEP ───────────────────────────────────────────────────────

function SheepMesh({ legLRef, legRRef, armLRef, armRRef, castShadow }: MeshProps) {
  const WOOL    = '#8A4FCC'  // purple wool
  const WOOL_SH = '#6A3A9E'  // darker purple for depth
  const WHITE   = '#F5F5F5'

  return (
    <group>
      {/* ── Fluffy purple wool body — lowered so bottom meets leg tops ── */}
      <group scale={[0.68, 0.68, 0.68]} position={[0, -0.16, 0]}>
      <WoolCluster cx={0}     cy={1.10} cz={0}     color={WOOL}    castShadow={castShadow} />
      <WoolCluster cx={0.28}  cy={1.04} cz={0.10}  color={WOOL_SH} />
      <WoolCluster cx={-0.28} cy={1.04} cz={0.10}  color={WOOL_SH} />
      <WoolCluster cx={0}     cy={1.02} cz={0.22}  color={WOOL} />
      <WoolCluster cx={0}     cy={1.02} cz={-0.18} color={WOOL_SH} />
      </group>{/* end wool scale group */}

      {/* ── Head — white face ── */}
      <group position={[0, 0.96, 0.10]}>
        <Outlined geo={<boxGeometry args={[0.36, 0.33, 0.32]} />} color={WHITE} castShadow={castShadow} />
        {/* Wall eyes */}
        <group position={[0, 0.06, 0.17]}>
          <Eye x={-0.10} wallEyed />
          <Eye x={ 0.10} wallEyed />
        </group>
        {/* Snout */}
        <group position={[0, -0.06, 0.19]}>
          <Outlined geo={<boxGeometry args={[0.20, 0.12, 0.09]} />} color={WHITE} />
          <mesh position={[-0.045, 0.01, 0.055]}><boxGeometry args={[0.045, 0.038, 0.03]} /><meshBasicMaterial color="#1A0800" /></mesh>
          <mesh position={[ 0.045, 0.01, 0.055]}><boxGeometry args={[0.045, 0.038, 0.03]} /><meshBasicMaterial color="#1A0800" /></mesh>
          <mesh position={[0, -0.035, 0.055]}><boxGeometry args={[0.12, 0.028, 0.03]} /><meshBasicMaterial color="#1A0800" /></mesh>
        </group>
        {/* Wool tuft on top of head */}
        <WoolTuft cx={0} cy={0.22} cz={0} r={0.13} color={WOOL} />
      </group>

      {/* Floppy ears — white */}
      <group position={[-0.21, 1.00, 0.06]} rotation={[0, 0,  0.3]}>
        <Outlined geo={<boxGeometry args={[0.08, 0.20, 0.10]} />} color={WHITE} />
      </group>
      <group position={[ 0.21, 1.00, 0.06]} rotation={[0, 0, -0.3]}>
        <Outlined geo={<boxGeometry args={[0.08, 0.20, 0.10]} />} color={WHITE} />
      </group>

      {/* ── 4 short white legs — pivot at body bottom (~0.34) ── */}
      <group ref={legLRef} position={[-0.20, 0.34, 0.16]}>
        <group position={[0, -0.11, 0]}>
          <Outlined geo={<boxGeometry args={[0.14, 0.22, 0.14]} />} color={WHITE} castShadow={castShadow} />
        </group>
        <mesh position={[0, -0.24, 0]}><boxGeometry args={[0.15, 0.05, 0.15]} /><meshBasicMaterial color="#3A2010" /></mesh>
      </group>
      <group ref={legRRef} position={[ 0.20, 0.34, 0.16]}>
        <group position={[0, -0.11, 0]}>
          <Outlined geo={<boxGeometry args={[0.14, 0.22, 0.14]} />} color={WHITE} castShadow={castShadow} />
        </group>
        <mesh position={[0, -0.24, 0]}><boxGeometry args={[0.15, 0.05, 0.15]} /><meshBasicMaterial color="#3A2010" /></mesh>
      </group>
      <group ref={armLRef} position={[-0.20, 0.34, -0.14]}>
        <group position={[0, -0.11, 0]}>
          <Outlined geo={<boxGeometry args={[0.14, 0.22, 0.14]} />} color={WHITE} castShadow={castShadow} />
        </group>
        <mesh position={[0, -0.24, 0]}><boxGeometry args={[0.15, 0.05, 0.15]} /><meshBasicMaterial color="#3A2010" /></mesh>
      </group>
      <group ref={armRRef} position={[ 0.20, 0.34, -0.14]}>
        <group position={[0, -0.11, 0]}>
          <Outlined geo={<boxGeometry args={[0.14, 0.22, 0.14]} />} color={WHITE} castShadow={castShadow} />
        </group>
        <mesh position={[0, -0.24, 0]}><boxGeometry args={[0.15, 0.05, 0.15]} /><meshBasicMaterial color="#3A2010" /></mesh>
      </group>
    </group>
  )
}

// ── 2. RUGGER THE RUGBY BALL ──────────────────────────────────────────────────
// White oval tilted right. Coloured panels are sphereGeometry SECTORS so they
// conform to the ball surface. Seam tori live inside the scale group so they
// also stretch into the oval shape.

function RugbyMesh({ legLRef, legRRef, armLRef, armRRef, castShadow }: MeshProps) {
  const WHITE = '#F8F8F8'
  const BLUE  = '#1A3A9A'
  const RED   = '#CC2233'
  const SEAM  = '#555555'
  const TILT  = 0.30
  const g = getToonGradient()
  const R = 0.44
  const Q = Math.PI / 2  // 90°

  // phiStart is measured from +Z going counter-clockwise viewed from above.
  // Panels: white front (−45°→45°), blue right (45°→135°),
  //         white back (135°→225°), red left (225°→315°)
  const panels: [number, string][] = [
    [7 * Q / 2,  WHITE],  // front  −45° = 7*PI/4
    [Q / 2,      BLUE ],  // right   45°
    [3 * Q / 2,  WHITE],  // back   135°
    [5 * Q / 2,  RED  ],  // left   225°
  ]

  return (
    <group rotation={[0, 0, TILT]}>
      {/* ── Oval ball: all panels + seams inside ONE scale group ── */}
      <group position={[0, 1.12, 0]} scale={[0.88, 1.45, 0.88]}>

        {/* 4 sphere-sector panels — geometry that IS the ball surface */}
        {panels.map(([phiStart, color], i) => (
          <mesh key={i} castShadow={i === 0 && castShadow}>
            <sphereGeometry args={[R, 8, 10, phiStart, Q]} />
            <meshToonMaterial color={color} gradientMap={g} />
          </mesh>
        ))}

        {/* 2 vertical seam tori at ±45° — inside the scale group so they go oval */}
        <mesh rotation={[0, Math.PI / 4, 0]}>
          <torusGeometry args={[R + 0.005, 0.016, 6, 28]} />
          <meshBasicMaterial color={SEAM} />
        </mesh>
        <mesh rotation={[0, -Math.PI / 4, 0]}>
          <torusGeometry args={[R + 0.005, 0.016, 6, 28]} />
          <meshBasicMaterial color={SEAM} />
        </mesh>

        {/* Outer outline */}
        <mesh scale={1.09}>
          <sphereGeometry args={[R, 8, 10]} />
          <meshBasicMaterial color="#1A0800" side={THREE.BackSide} />
        </mesh>
      </group>

      {/* Face on the front white panel (unscaled world pos) */}
      <group position={[0, 1.26, 0.41]}>
        <Eye x={-0.10} />
        <Eye x={ 0.10} />
      </group>
      <group position={[0, 1.04, 0]}>
        <Smile w={0.20} z={0.40} />
      </group>

      {/* Tiny arms */}
      <group ref={armLRef} position={[-0.44, 1.12, 0]}>
        <group position={[-0.08, 0, 0]}>
          <Outlined geo={<boxGeometry args={[0.17, 0.09, 0.10]} />} color={WHITE} castShadow={castShadow} />
        </group>
      </group>
      <group ref={armRRef} position={[ 0.44, 1.12, 0]}>
        <group position={[0.08, 0, 0]}>
          <Outlined geo={<boxGeometry args={[0.17, 0.09, 0.10]} />} color={WHITE} castShadow={castShadow} />
        </group>
      </group>

      {/* Tiny legs */}
      <group ref={legLRef} position={[-0.13, 0.38, 0]}>
        <group position={[0, -0.11, 0]}>
          <Outlined geo={<boxGeometry args={[0.12, 0.22, 0.12]} />} color={WHITE} castShadow={castShadow} />
        </group>
        <mesh position={[0, -0.24, 0]}><boxGeometry args={[0.13, 0.05, 0.13]} /><meshBasicMaterial color="#444" /></mesh>
      </group>
      <group ref={legRRef} position={[ 0.13, 0.38, 0]}>
        <group position={[0, -0.11, 0]}>
          <Outlined geo={<boxGeometry args={[0.12, 0.22, 0.12]} />} color={WHITE} castShadow={castShadow} />
        </group>
        <mesh position={[0, -0.24, 0]}><boxGeometry args={[0.13, 0.05, 0.13]} /><meshBasicMaterial color="#444" /></mesh>
      </group>
    </group>
  )
}

// ── 3. SPROUT THE PLANT ───────────────────────────────────────────────────────
// White vase body with smile + dot eyes, tiny legs, left branch longer, right shorter

function PlantMesh({ legLRef, legRRef, armLRef, armRRef, castShadow }: MeshProps) {
  const WHITE = '#F5F4EE'
  const GREEN = '#4AA840'
  const LEAF  = '#5DC845'
  const SOIL  = '#7A5030'

  // All Y positions shifted down 0.46 so vase bottom sits just above legs
  return (
    <group>
      {/* Vase body — bottom now at ~0.06 */}
      <group position={[0, 0.36, 0]}>
        <Outlined geo={<boxGeometry args={[0.52, 0.6, 0.44]} />} color={WHITE} castShadow={castShadow} />
        <mesh position={[-0.1, 0.08, 0.23]}><boxGeometry args={[0.09, 0.09, 0.04]} /><meshBasicMaterial color="#1A0800" /></mesh>
        <mesh position={[ 0.1, 0.08, 0.23]}><boxGeometry args={[0.09, 0.09, 0.04]} /><meshBasicMaterial color="#1A0800" /></mesh>
        <group position={[0, -0.08, 0]}><Smile w={0.2} z={0.23} /></group>
      </group>

      {/* Vase rim */}
      <group position={[0, 0.68, 0]}>
        <Outlined geo={<boxGeometry args={[0.58, 0.1, 0.5]} />} color={WHITE} castShadow={castShadow} />
      </group>

      {/* Soil */}
      <group position={[0, 0.74, 0]}>
        <Outlined geo={<boxGeometry args={[0.5, 0.06, 0.42]} />} color={SOIL} />
      </group>

      {/* Stem */}
      <group position={[0, 0.87, 0]}>
        <Outlined geo={<boxGeometry args={[0.08, 0.24, 0.08]} />} color={GREEN} />
      </group>

      {/* Left branch — LONGER */}
      <group ref={armLRef} position={[0, 1.02, 0]}>
        <group rotation={[0, 0, Math.PI - 0.28]}>
          <mesh position={[0.28, 0, 0]}>
            <boxGeometry args={[0.56, 0.07, 0.08]} />
            <meshToonMaterial color={GREEN} gradientMap={getToonGradient()} />
          </mesh>
          <mesh scale={1.08} position={[0.28, 0, 0]}>
            <boxGeometry args={[0.56, 0.07, 0.08]} />
            <meshBasicMaterial color="#1A0800" side={THREE.BackSide} />
          </mesh>
          <group position={[0.58, 0.06, 0]} rotation={[0, 0, 0.4]}>
            <Outlined geo={<boxGeometry args={[0.12, 0.3, 0.06]} />} color={LEAF} />
          </group>
        </group>
      </group>

      {/* Right branch — SHORTER */}
      <group ref={armRRef} position={[0, 1.06, 0]}>
        <group rotation={[0, 0, 0.28]}>
          <mesh position={[0.2, 0, 0]}>
            <boxGeometry args={[0.4, 0.07, 0.08]} />
            <meshToonMaterial color={GREEN} gradientMap={getToonGradient()} />
          </mesh>
          <mesh scale={1.08} position={[0.2, 0, 0]}>
            <boxGeometry args={[0.4, 0.07, 0.08]} />
            <meshBasicMaterial color="#1A0800" side={THREE.BackSide} />
          </mesh>
          <group position={[0.42, 0.05, 0]} rotation={[0, 0, -0.4]}>
            <Outlined geo={<boxGeometry args={[0.1, 0.24, 0.06]} />} color={LEAF} />
          </group>
        </group>
      </group>

      {/* Tiny legs — pivot at vase bottom (~0.06), reach ground */}
      <group ref={legLRef} position={[-0.13, 0.14, 0]}>
        <group position={[0, -0.07, 0]}>
          <Outlined geo={<boxGeometry args={[0.10, 0.14, 0.10]} />} color={WHITE} castShadow={castShadow} />
        </group>
      </group>
      <group ref={legRRef} position={[ 0.13, 0.14, 0]}>
        <group position={[0, -0.07, 0]}>
          <Outlined geo={<boxGeometry args={[0.10, 0.14, 0.10]} />} color={WHITE} castShadow={castShadow} />
        </group>
      </group>
    </group>
  )
}

// ── 4. PAIGE THE BOOK ─────────────────────────────────────────────────────────
// Slightly tilted, red cover, cream pages visible between, big cute smile

function BookMesh({ legLRef, legRRef, castShadow }: MeshProps) {
  const RED      = '#C0392B'
  const RED_DARK = '#8E2218'
  const PAGES    = '#FFF5DC'

  return (
    // Whole book tilted a little
    <group rotation={[0, 0, 0.2]}>
      {/* Pages — visible between covers */}
      <group position={[0, 1.06, 0]}>
        <Outlined geo={<boxGeometry args={[0.6, 1.22, 0.24]} />} color={PAGES} castShadow={castShadow} />
      </group>

      {/* Front cover */}
      <group position={[0, 1.06, 0.16]}>
        <Outlined geo={<boxGeometry args={[0.64, 1.26, 0.07]} />} color={RED} castShadow={castShadow} />

        {/* Eyes */}
        <group position={[0, 0.2, 0.05]}>
          <Eye x={-0.14} />
          <Eye x={ 0.14} />
        </group>

        {/* Big smile */}
        <group position={[0, -0.06, 0]}>
          <Smile w={0.3} z={0.06} />
        </group>
      </group>

      {/* Back cover */}
      <group position={[0, 1.06, -0.16]}>
        <Outlined geo={<boxGeometry args={[0.64, 1.26, 0.07]} />} color={RED_DARK} castShadow={castShadow} />
      </group>

      {/* Spine */}
      <group position={[-0.35, 1.06, 0]}>
        <Outlined geo={<boxGeometry args={[0.07, 1.26, 0.4]} />} color={RED_DARK} castShadow={castShadow} />
      </group>

      {/* Tiny legs */}
      <group ref={legLRef} position={[-0.16, 0.38, 0]}>
        <group position={[0, -0.19, 0]}>
          <Outlined geo={<boxGeometry args={[0.11, 0.38, 0.11]} />} color={RED} castShadow={castShadow} />
        </group>
      </group>
      <group ref={legRRef} position={[ 0.16, 0.38, 0]}>
        <group position={[0, -0.19, 0]}>
          <Outlined geo={<boxGeometry args={[0.11, 0.38, 0.11]} />} color={RED} castShadow={castShadow} />
        </group>
      </group>
    </group>
  )
}

// ── 5. HUMAN CHARACTER ────────────────────────────────────────────────────────

function HumanMesh({ config, legLRef, legRRef, armLRef, armRRef, castShadow }: MeshProps & { config: CharacterConfig }) {
  const bodyColor  = config.bodyColor  ?? '#4A7AC8'
  const pantsColor = config.pantsColor ?? config.hairColor ?? '#2A1800'
  const skinColor  = config.skinColor  ?? '#F5CBA7'
  const hairColor  = config.hairColor  ?? '#2A1800'
  const hairStyle  = config.hairStyle  ?? 'short'

  return (
    <group>
      {/* ── Torso ── */}
      <group position={[0, 1.05, 0]}>
        <Outlined geo={<boxGeometry args={[0.55, 0.7, 0.3]} />} color={bodyColor} castShadow={castShadow} />
      </group>

      {/* ── Head ── */}
      <group position={[0, 1.65, 0]}>
        <Outlined geo={<boxGeometry args={[0.45, 0.42, 0.42]} />} color={skinColor} castShadow={castShadow} />

        {/* Eyes */}
        <group position={[0, 0.06, 0.22]}>
          <Eye x={-0.11} />
          <Eye x={ 0.11} />
        </group>

        {/* Smile */}
        <group position={[0, -0.06, 0]}>
          <Smile w={0.18} z={0.22} />
        </group>
      </group>

      {/* ── Hair ── */}
      {/* Top cap — all styles */}
      <group position={[0, 1.88, 0]}>
        <Outlined geo={<boxGeometry args={[0.47, 0.18, 0.44]} />} color={hairColor} castShadow={castShadow} />
      </group>

      {hairStyle === 'bob' && (
        /* Bob: side panels down to chin level */
        <>
          <group position={[-0.25, 1.62, 0]}>
            <Outlined geo={<boxGeometry args={[0.07, 0.40, 0.40]} />} color={hairColor} />
          </group>
          <group position={[ 0.25, 1.62, 0]}>
            <Outlined geo={<boxGeometry args={[0.07, 0.40, 0.40]} />} color={hairColor} />
          </group>
          {/* Back panel */}
          <group position={[0, 1.66, -0.24]}>
            <Outlined geo={<boxGeometry args={[0.47, 0.46, 0.07]} />} color={hairColor} />
          </group>
        </>
      )}

      {hairStyle === 'long' && (
        /* Long: back panel flowing down to shoulder */
        <>
          <group position={[0, 1.46, -0.22]}>
            <Outlined geo={<boxGeometry args={[0.44, 0.84, 0.08]} />} color={hairColor} />
          </group>
          {/* Side strands */}
          <group position={[-0.24, 1.50, -0.08]}>
            <Outlined geo={<boxGeometry args={[0.07, 0.76, 0.30]} />} color={hairColor} />
          </group>
          <group position={[ 0.24, 1.50, -0.08]}>
            <Outlined geo={<boxGeometry args={[0.07, 0.76, 0.30]} />} color={hairColor} />
          </group>
        </>
      )}

      {/* ── Arms (sleeves = body colour) ── */}
      <group ref={armLRef} position={[-0.37, 1.31, 0]}>
        <group position={[0, -0.29, 0]}>
          <Outlined geo={<boxGeometry args={[0.18, 0.58, 0.22]} />} color={bodyColor} castShadow={castShadow} />
        </group>
      </group>
      <group ref={armRRef} position={[0.37, 1.31, 0]}>
        <group position={[0, -0.29, 0]}>
          <Outlined geo={<boxGeometry args={[0.18, 0.58, 0.22]} />} color={bodyColor} castShadow={castShadow} />
        </group>
      </group>

      {/* ── Legs (pants colour) ── */}
      <group ref={legLRef} position={[-0.16, 0.64, 0]}>
        <group position={[0, -0.31, 0]}>
          <Outlined geo={<boxGeometry args={[0.22, 0.62, 0.25]} />} color={pantsColor} castShadow={castShadow} />
        </group>
      </group>
      <group ref={legRRef} position={[0.16, 0.64, 0]}>
        <group position={[0, -0.31, 0]}>
          <Outlined geo={<boxGeometry args={[0.22, 0.62, 0.25]} />} color={pantsColor} castShadow={castShadow} />
        </group>
      </group>
    </group>
  )
}

// ── Public component ──────────────────────────────────────────────────────────

interface CharacterMeshProps extends MeshProps {
  config: CharacterConfig
}

export default function CharacterMesh({ config, legLRef, legRRef, armLRef, armRRef, castShadow = false }: CharacterMeshProps) {
  const props = { legLRef, legRRef, armLRef, armRRef, castShadow }
  switch (config.meshType) {
    case 'sheep': return <SheepMesh {...props} />
    case 'rugby': return <RugbyMesh {...props} />
    case 'plant': return <PlantMesh {...props} />
    case 'book':  return <BookMesh  {...props} />
    default:      return <HumanMesh config={config} {...props} />
  }
}
