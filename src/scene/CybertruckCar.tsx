import { useMemo } from 'react'
import { useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'

import modelUrl from '../assets/low-poly/cars/cybertruck/model.obj?url'

// Colours from materials.mtl — applied by material name
const MAT_COLORS: Record<string, string> = {
  mat21: '#F0F4F8',  // white trim
  mat15: '#9CAEBB',  // steel-grey body (cybertruck signature)
  mat23: '#0A0A0A',  // windows / tyre rubber
  mat8:  '#E80808',  // tail lights
  mat22: '#484848',  // wheels / underside
  mat13: '#FF5500',  // orange turn-signal accents
}

const TARGET_SIZE = 3.6   // target max dimension in world units
const ROT_X = -0.082      // baked-in orientation (confirmed by user)
const ROT_Y = -1.902
const ROT_Z = -0.082
const OFFSET_Y = 0.250

function buildMaterials(): Record<string, THREE.MeshToonMaterial> {
  return Object.fromEntries(
    Object.entries(MAT_COLORS).map(([name, hex]) => [
      name,
      new THREE.MeshToonMaterial({ color: new THREE.Color(hex) }),
    ])
  )
}

function applyAndNormalise(obj: THREE.Group, mats: Record<string, THREE.MeshToonMaterial>) {
  // Reset first — safe under React Strict Mode double-invoke
  obj.scale.set(1, 1, 1)
  obj.position.set(0, 0, 0)
  obj.rotation.set(ROT_X, ROT_Y, ROT_Z)

  obj.traverse((c) => {
    if (!(c instanceof THREE.Mesh)) return
    const name = (c.material as THREE.Material)?.name ?? ''
    c.material = mats[name] ?? new THREE.MeshToonMaterial({ color: '#9CAEBB' })
    c.castShadow = true
    c.receiveShadow = true
  })

  const box = new THREE.Box3().setFromObject(obj)
  const size = new THREE.Vector3()
  box.getSize(size)
  const maxDim = Math.max(size.x, size.y, size.z)
  if (maxDim > 0 && isFinite(maxDim)) {
    obj.scale.setScalar(TARGET_SIZE / maxDim)
  }
  obj.position.y = OFFSET_Y
}

interface Props {
  speedRef: React.RefObject<number>
  wheelAngleRef: React.RefObject<number>
}

export default function CybertruckCar({ speedRef: _speed, wheelAngleRef: _wheel }: Props) {
  const raw = useLoader(OBJLoader, modelUrl)
  const mats = useMemo(() => buildMaterials(), [])

  const model = useMemo(() => {
    const clone = raw.clone()
    applyAndNormalise(clone, mats)
    return clone
  }, [raw, mats])

  return <primitive object={model} />
}
