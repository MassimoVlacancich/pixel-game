import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { CharacterRef } from '../character/Character'

interface ThirdPersonCameraProps {
  target: React.RefObject<CharacterRef | null>
  offset?: THREE.Vector3
  orbitAngleRef?: React.MutableRefObject<number>
}

const DEFAULT_OFFSET = new THREE.Vector3(0, 14, -16)

// Derived from DEFAULT_OFFSET — update these if offset changes
const HORIZ_DIST = Math.sqrt(DEFAULT_OFFSET.x ** 2 + DEFAULT_OFFSET.z ** 2)  // 16
const TOTAL_RADIUS = Math.sqrt(DEFAULT_OFFSET.y ** 2 + HORIZ_DIST ** 2)      // ~21.26
const DEFAULT_ELEVATION = Math.atan2(DEFAULT_OFFSET.y, HORIZ_DIST)           // ~0.719 rad (~41°)
const MIN_ELEVATION = 0.1   // ~6° from horizontal
const MAX_ELEVATION = 1.5   // ~86° (nearly top-down)

function dz(v: number, threshold = 0.15): number {
  return Math.abs(v) < threshold ? 0 : v
}

export default function ThirdPersonCamera({
  target,
  offset = DEFAULT_OFFSET,
  orbitAngleRef,
}: ThirdPersonCameraProps) {
  const { camera } = useThree()
  const smoothPos = useRef(new THREE.Vector3())
  const lookTarget = useRef(new THREE.Vector3())
  const orbitActive = useRef(false)
  const isDragging = useRef(false)
  const lastPointerX = useRef(0)
  const lastPointerY = useRef(0)
  const elevation = useRef(DEFAULT_ELEVATION)

  // Backtick toggles mouse-drag orbit mode; resets angles on exit
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Backquote') return
      orbitActive.current = !orbitActive.current
      if (!orbitActive.current) {
        if (orbitAngleRef) orbitAngleRef.current = 0
        elevation.current = DEFAULT_ELEVATION
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [orbitAngleRef])

  // Mouse drag: horizontal = azimuth, vertical = elevation (orbit mode only)
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!orbitActive.current) return
      isDragging.current = true
      lastPointerX.current = e.clientX
      lastPointerY.current = e.clientY
    }
    const onMove = (e: PointerEvent) => {
      if (!isDragging.current || !orbitAngleRef) return
      const dx = e.clientX - lastPointerX.current
      const dy = e.clientY - lastPointerY.current
      orbitAngleRef.current += dx * 0.005
      elevation.current = Math.max(MIN_ELEVATION, Math.min(MAX_ELEVATION,
        elevation.current - dy * 0.005
      ))
      lastPointerX.current = e.clientX
      lastPointerY.current = e.clientY
    }
    const onUp = () => { isDragging.current = false }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [orbitAngleRef])

  useFrame((_, delta) => {
    const t = target.current
    if (!t) return

    // Gamepad right stick: always adjusts camera azimuth + elevation
    const gamepads = navigator.getGamepads()
    for (const gp of gamepads) {
      if (!gp) continue
      const rx = dz(gp.axes[2] ?? 0)
      const ry = dz(gp.axes[3] ?? 0)
      if (orbitAngleRef) orbitAngleRef.current += rx * 2.5 * delta
      elevation.current = Math.max(MIN_ELEVATION, Math.min(MAX_ELEVATION,
        elevation.current + ry * 1.5 * delta
      ))
    }

    const az = orbitAngleRef?.current ?? 0
    const el = elevation.current
    const r = TOTAL_RADIUS

    // Spherical coordinates → world offset
    const desired = new THREE.Vector3(
      t.position.x + Math.sin(az) * r * Math.cos(el),
      t.position.y + r * Math.sin(el),
      t.position.z - Math.cos(az) * r * Math.cos(el),
    )

    smoothPos.current.lerp(desired, 0.12)
    camera.position.copy(smoothPos.current)

    lookTarget.current.set(t.position.x, t.position.y + 0.5, t.position.z)
    camera.lookAt(lookTarget.current)
  })

  return null
}
