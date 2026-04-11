import { useMemo } from 'react'
import { useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js'
import type { CarConfig } from './carRegistry'

function applyConfig(obj: THREE.Group, cfg: CarConfig) {
  obj.scale.set(1, 1, 1)
  obj.position.set(0, 0, 0)
  obj.rotation.set(cfg.rotX, cfg.rotY, cfg.rotZ)

  obj.traverse((c) => {
    if (!(c instanceof THREE.Mesh)) return
    c.castShadow = true
    c.receiveShadow = true
  })

  const box = new THREE.Box3().setFromObject(obj)
  const size = new THREE.Vector3()
  box.getSize(size)
  const maxDim = Math.max(size.x, size.y, size.z)
  if (maxDim > 0 && isFinite(maxDim)) {
    obj.scale.setScalar(cfg.targetSize / maxDim)
  }
  obj.position.y = cfg.offsetY
}

interface Props {
  config: CarConfig
  speedRef?: React.RefObject<number>
  wheelAngleRef?: React.RefObject<number>
}

export default function DriveCarModel({ config, speedRef: _s, wheelAngleRef: _w }: Props) {
  const materials = useLoader(MTLLoader, config.mtlUrl)
  const raw = useLoader(OBJLoader, config.objUrl, (loader) => {
    materials.preload()
    loader.setMaterials(materials)
  })

  const model = useMemo(() => {
    const clone = raw.clone()
    applyConfig(clone, config)
    return clone
  }, [raw, config])

  return <primitive object={model} />
}
