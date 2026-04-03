import { useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { CharacterConfig } from '../character/characterRegistry'
import CharacterMesh from '../character/CharacterMesh'

function CameraSetup() {
  const { camera } = useThree()
  camera.lookAt(0, 1.0, 0)
  return null
}

function PreviewCharacter({ config }: { config: CharacterConfig }) {
  const rootRef = useRef<THREE.Group>(null)
  const legLRef = useRef<THREE.Group>(null)
  const legRRef = useRef<THREE.Group>(null)
  const armLRef = useRef<THREE.Group>(null)
  const armRRef = useRef<THREE.Group>(null)
  const walkTime = useRef(0)

  useFrame((_, delta) => {
    if (rootRef.current) rootRef.current.rotation.y += delta * 0.6
    walkTime.current += delta * 3
    const s = Math.sin(walkTime.current) * 0.18
    if (legLRef.current) legLRef.current.rotation.x = s
    if (legRRef.current) legRRef.current.rotation.x = -s
    if (armLRef.current) armLRef.current.rotation.x = -s * 0.6
    if (armRRef.current) armRRef.current.rotation.x =  s * 0.6
  })

  return (
    <group ref={rootRef}>
      <CharacterMesh
        config={config}
        legLRef={legLRef} legRRef={legRRef}
        armLRef={armLRef} armRRef={armRRef}
      />
    </group>
  )
}

interface CharacterPreviewCanvasProps {
  config: CharacterConfig
  size?: number
}

export default function CharacterPreviewCanvas({ config, size = 220 }: CharacterPreviewCanvasProps) {
  return (
    <div style={{
      width: size, height: size,
      imageRendering: 'pixelated',
      flexShrink: 0,
    }}>
      <Canvas
        gl={{ antialias: false, alpha: true }}
        dpr={1}
        camera={{ fov: 42, position: [0, 1.0, 5.0], near: 0.1, far: 50 }}
        style={{ width: '100%', height: '100%', background: 'transparent' }}
      >
        <CameraSetup />
        <ambientLight intensity={1.0} color="#FFF5E6" />
        <directionalLight position={[3, 5, 3]} intensity={1.2} color="#FFE8D6" />
        <PreviewCharacter config={config} />
      </Canvas>
    </div>
  )
}
