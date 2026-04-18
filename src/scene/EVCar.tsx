import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getToonGradient } from '../utils/toonGradient'

interface EVCarProps {
  speedRef: React.RefObject<number>
  wheelAngleRef: React.RefObject<number>
}

const gradient = getToonGradient()

// Car is rendered with its LOCAL +Z face as the "rear" visible to the camera,
// because DriveScene wraps it in rotation={[0, Math.PI, 0]}
export default function EVCar({ speedRef, wheelAngleRef }: EVCarProps) {
  const flRef = useRef<THREE.Mesh>(null)
  const frRef = useRef<THREE.Mesh>(null)
  const blRef = useRef<THREE.Mesh>(null)
  const brRef = useRef<THREE.Mesh>(null)

  useFrame((_, delta) => {
    const speed = speedRef.current ?? 0
    const wheelAngle = wheelAngleRef.current ?? 0
    const spin = speed * delta * 2.5
    // Wheels lie along X axis (rotation.z = PI/2 in JSX), so rolling = change rotation.x
    if (flRef.current) {
      flRef.current.rotation.x += spin
      flRef.current.rotation.y = wheelAngle * 0.022
    }
    if (frRef.current) {
      frRef.current.rotation.x += spin
      frRef.current.rotation.y = wheelAngle * 0.022
    }
    if (blRef.current) blRef.current.rotation.x += spin
    if (brRef.current) brRef.current.rotation.x += spin
  })

  return (
    <group>
      {/* Main body — 1.6 wide, 0.75 tall, 2.4 long */}
      <mesh position={[0, 0.52, 0]} castShadow>
        <boxGeometry args={[1.6, 0.75, 2.4]} />
        <meshToonMaterial color="#1A55BB" gradientMap={gradient} />
      </mesh>

      {/* Body accent stripe */}
      <mesh position={[0, 0.9, 0]}>
        <boxGeometry args={[1.58, 0.06, 2.38]} />
        <meshToonMaterial color="#2A6ADD" gradientMap={gradient} />
      </mesh>

      {/* Cabin */}
      <mesh position={[0, 1.13, -0.1]} castShadow>
        <boxGeometry args={[0.9, 0.56, 1.12]} />
        <meshToonMaterial color="#1E5ACC" gradientMap={gradient} />
      </mesh>

      {/* Rear window — local +Z face = visible to camera */}
      <mesh position={[0, 1.13, 0.48]}>
        <boxGeometry args={[0.86, 0.48, 0.04]} />
        <meshBasicMaterial color="#080818" />
      </mesh>

      {/* Front windscreen — local -Z = faces road */}
      <mesh position={[0, 1.2, -0.67]}>
        <boxGeometry args={[0.86, 0.40, 0.04]} />
        <meshBasicMaterial color="#080818" />
      </mesh>

      {/* Side windows */}
      <mesh position={[-0.46, 1.13, -0.1]}>
        <boxGeometry args={[0.04, 0.44, 0.9]} />
        <meshBasicMaterial color="#080818" />
      </mesh>
      <mesh position={[0.46, 1.13, -0.1]}>
        <boxGeometry args={[0.04, 0.44, 0.9]} />
        <meshBasicMaterial color="#080818" />
      </mesh>

      {/* Rear spoiler (local +Z — visible to camera) */}
      <mesh position={[0, 1.05, 1.17]}>
        <boxGeometry args={[1.56, 0.09, 0.18]} />
        <meshToonMaterial color="#0A0A18" gradientMap={gradient} />
      </mesh>
      <mesh position={[-0.65, 0.99, 1.15]}>
        <boxGeometry args={[0.08, 0.17, 0.09]} />
        <meshToonMaterial color="#0A0A18" gradientMap={gradient} />
      </mesh>
      <mesh position={[0.65, 0.99, 1.15]}>
        <boxGeometry args={[0.08, 0.17, 0.09]} />
        <meshToonMaterial color="#0A0A18" gradientMap={gradient} />
      </mesh>

      {/* Tail lights — LEFT (local +Z, visible to camera) */}
      <mesh position={[-0.72, 0.55, 1.21]}>
        <boxGeometry args={[0.25, 0.17, 0.04]} />
        <meshBasicMaterial color="#FF1010" />
      </mesh>
      {/* Tail lights — RIGHT */}
      <mesh position={[0.72, 0.55, 1.21]}>
        <boxGeometry args={[0.25, 0.17, 0.04]} />
        <meshBasicMaterial color="#FF1010" />
      </mesh>
      {/* Brake light center strip */}
      <mesh position={[0, 0.55, 1.21]}>
        <boxGeometry args={[0.8, 0.06, 0.03]} />
        <meshBasicMaterial color="#FF4444" />
      </mesh>

      {/* Rear bumper */}
      <mesh position={[0, 0.22, 1.21]}>
        <boxGeometry args={[1.6, 0.14, 0.08]} />
        <meshToonMaterial color="#0A0A18" gradientMap={gradient} />
      </mesh>

      {/* Exhaust pipes */}
      <mesh position={[-0.42, 0.17, 1.24]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.065, 0.065, 0.1, 6]} />
        <meshToonMaterial color="#333344" gradientMap={gradient} />
      </mesh>
      <mesh position={[0.42, 0.17, 1.24]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.065, 0.065, 0.1, 6]} />
        <meshToonMaterial color="#333344" gradientMap={gradient} />
      </mesh>

      {/* Front bumper / grille (local -Z = faces road) */}
      <mesh position={[0, 0.38, -1.21]}>
        <boxGeometry args={[1.6, 0.3, 0.08]} />
        <meshToonMaterial color="#0A0A18" gradientMap={gradient} />
      </mesh>
      {/* Headlights */}
      <mesh position={[-0.56, 0.56, -1.22]}>
        <boxGeometry args={[0.28, 0.16, 0.04]} />
        <meshBasicMaterial color="#FFFFCC" />
      </mesh>
      <mesh position={[0.56, 0.56, -1.22]}>
        <boxGeometry args={[0.28, 0.16, 0.04]} />
        <meshBasicMaterial color="#FFFFCC" />
      </mesh>

      {/* Front-left wheel (local: front = -Z, left = -X) */}
      <mesh ref={flRef} position={[-0.87, 0.36, -0.88]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.36, 0.36, 0.22, 8]} />
        <meshToonMaterial color="#181818" gradientMap={gradient} />
      </mesh>
      <mesh position={[-0.88, 0.36, -0.88]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.18, 0.18, 0.24, 8]} />
        <meshToonMaterial color="#7A7A8A" gradientMap={gradient} />
      </mesh>

      {/* Front-right wheel */}
      <mesh ref={frRef} position={[0.87, 0.36, -0.88]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.36, 0.36, 0.22, 8]} />
        <meshToonMaterial color="#181818" gradientMap={gradient} />
      </mesh>
      <mesh position={[0.88, 0.36, -0.88]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.18, 0.18, 0.24, 8]} />
        <meshToonMaterial color="#7A7A8A" gradientMap={gradient} />
      </mesh>

      {/* Rear-left wheel (local +Z side = near camera) */}
      <mesh ref={blRef} position={[-0.87, 0.36, 0.88]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.36, 0.36, 0.22, 8]} />
        <meshToonMaterial color="#181818" gradientMap={gradient} />
      </mesh>
      <mesh position={[-0.88, 0.36, 0.88]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.18, 0.18, 0.24, 8]} />
        <meshToonMaterial color="#7A7A8A" gradientMap={gradient} />
      </mesh>

      {/* Rear-right wheel */}
      <mesh ref={brRef} position={[0.87, 0.36, 0.88]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.36, 0.36, 0.22, 8]} />
        <meshToonMaterial color="#181818" gradientMap={gradient} />
      </mesh>
      <mesh position={[0.88, 0.36, 0.88]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.18, 0.18, 0.24, 8]} />
        <meshToonMaterial color="#7A7A8A" gradientMap={gradient} />
      </mesh>
    </group>
  )
}
