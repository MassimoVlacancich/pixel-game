import { Suspense, useRef, useEffect, useMemo, useState, useCallback } from 'react'
import type React from 'react'
import { Canvas, useLoader, useThree } from '@react-three/fiber'
import { OrbitControls, TransformControls, Text, PerspectiveCamera } from '@react-three/drei'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import { useGLTF, useAnimations } from '@react-three/drei'
import * as THREE from 'three'
import type { PlacedObject, LiveRefs, MarkerPositions, MarkerScales, CameraConfig, SceneZone, SceneLight, SceneAmbient, TerrainData, TerrainLiveRefs } from './useSceneBuilderState'
import { MARKERS } from './useSceneBuilderState'
import { COLLIDER_PATH_PREFIX } from './allAssets'
import type { AssetEntry } from './allAssets'
import CharacterMesh from '../../character/CharacterMesh'
import { CHARACTERS } from '../../character/characterRegistry'

// ── Auto-normalise raw OBJ to ~2 world units max dim ────────────────────────

function normaliseGroup(obj: THREE.Group, targetSize = 2): THREE.Group {
  const clone = obj.clone()
  const box = new THREE.Box3().setFromObject(clone)
  const size = new THREE.Vector3(); box.getSize(size)
  const maxDim = Math.max(size.x, size.y, size.z)
  if (maxDim > 0 && isFinite(maxDim)) clone.scale.setScalar(targetSize / maxDim)
  return clone
}

// ── Model loaders ────────────────────────────────────────────────────────────

function ObjModelRaw({ url }: { url: string }) {
  const raw = useLoader(OBJLoader, url)
  const model = useMemo(() => normaliseGroup(raw as unknown as THREE.Group), [raw])
  return <primitive object={model} />
}

// OBJ with companion MTL.
function ObjModelWithMtl({ url, mtlUrl }: { url: string; mtlUrl: string }) {
  const mtlCreator = useLoader(MTLLoader, mtlUrl)
  const rawObj     = useLoader(OBJLoader, url)

  const model = useMemo(() => {
    mtlCreator.preload()
    const sized = normaliseGroup(rawObj as unknown as THREE.Group)
    sized.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      if (Array.isArray(child.material)) {
        child.material = child.material.map((m: THREE.Material) => {
          if (!m?.name) return m
          try { return mtlCreator.create(m.name) ?? m } catch { return m }
        })
      } else {
        const name = child.material?.name
        if (name) {
          try {
            const mat = mtlCreator.create(name)
            if (mat) child.material = mat
          } catch { /* name not in MTL — keep OBJLoader default */ }
        }
      }
    })
    return sized
  }, [rawObj, mtlCreator])

  return <primitive object={model} />
}

function GlbModel({ url, animate }: { url: string; animate?: boolean }) {
  const { scene, animations } = useGLTF(url)
  const groupRef = useRef<THREE.Group>(null)

  const model = useMemo(() => {
    // SkeletonUtils.clone properly rebinds skeletons for skinned/animated meshes.
    // A plain scene.clone() leaves shared bone references, making skinned models invisible.
    const clone = SkeletonUtils.clone(scene) as THREE.Group

    // Force world-matrix computation on the freshly-cloned hierarchy.
    // Without this, child nodes retain identity matrixWorld regardless of their
    // local transforms — which breaks the bounding-box calculation below.
    clone.updateWorldMatrix(true, true)

    // Compute bounds from each mesh's geometry + its world matrix.
    // Box3.setFromObject on a not-yet-rendered SkinnedMesh can return empty/wrong
    // bounds because bone transforms haven't been evaluated by the GPU yet.
    // Reading the position attribute directly (rest-pose) is reliable and fast.
    const box = new THREE.Box3()
    clone.traverse(child => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh) return
      const geo = mesh.geometry as THREE.BufferGeometry
      if (!geo.attributes.position) return
      if (!geo.boundingBox) geo.computeBoundingBox()
      if (geo.boundingBox && !geo.boundingBox.isEmpty()) {
        // Transform from geometry-local → world space using the node's world matrix.
        // This correctly accounts for large-scale export nodes (e.g. scale=100 for
        // assets exported in centimetre units from Blender/Maya).
        const worldBox = geo.boundingBox.clone().applyMatrix4(mesh.matrixWorld)
        box.union(worldBox)
      }
    })

    // Fallback for models with no geometry attributes (procedural / empty scenes)
    if (box.isEmpty()) box.setFromObject(clone)

    const size = new THREE.Vector3()
    box.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z)
    if (maxDim > 0 && isFinite(maxDim)) clone.scale.setScalar(2 / maxDim)
    return clone
  }, [scene])

  // useAnimations creates a mixer on groupRef. The clips reference bones by name;
  // since SkeletonUtils.clone preserves node names, the mixer finds them in the clone.
  const { actions } = useAnimations(animations, groupRef)

  useEffect(() => {
    if (!animate || !actions) return
    const keys = Object.keys(actions)
    if (keys.length === 0) return

    // Prefer bare "Idle", then "AnyArmature|..._Idle", then any clip with "idle".
    const idleKey =
      keys.find(k => k === 'Idle') ??
      keys.find(k => /\|Idle$/i.test(k)) ??
      keys.find(k => /idle/i.test(k) && !/headlow|hitreact|_2/i.test(k)) ??
      keys[0]

    const action = actions[idleKey!]
    if (!action) return
    action.reset().fadeIn(0.3).play()
    return () => { action.fadeOut(0.3) }
  }, [animate, actions])

  return <group ref={groupRef}><primitive object={model} /></group>
}

function AssetModel({ url, mtlUrl, animate }: { url: string; mtlUrl?: string; animate?: boolean }) {
  if (!url) return null
  if (url.endsWith('.glb') || url.endsWith('.gltf')) return <GlbModel url={url} animate={animate} />
  if (mtlUrl) return <ObjModelWithMtl url={url} mtlUrl={mtlUrl} />
  return <ObjModelRaw url={url} />
}

// ── Collision-box visual (shown only in builder) ─────────────────────────────

function ColliderBox() {
  return (
    <>
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#00FF88" transparent opacity={0.08} depthWrite={false} />
      </mesh>
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#00FF88" wireframe />
      </mesh>
    </>
  )
}

// ── A single placed object ───────────────────────────────────────────────────

interface PlacedObjectMeshProps {
  obj: PlacedObject
  selected: boolean
  visible: boolean
  previewMode: boolean
  liveRefs: LiveRefs
  onClick: () => void
}

function PlacedObjectMesh({ obj, selected, visible, previewMode, liveRefs, onClick }: PlacedObjectMeshProps) {
  const groupRef = useRef<THREE.Group>(null)

  useEffect(() => {
    if (groupRef.current) liveRefs.set(obj.id, groupRef.current)
    return () => { liveRefs.delete(obj.id) }
  }, [obj.id, liveRefs])

  useEffect(() => {
    const g = groupRef.current; if (!g) return
    g.position.set(...obj.position)
    g.rotation.set(
      obj.rotation[0] * THREE.MathUtils.DEG2RAD,
      obj.rotation[1] * THREE.MathUtils.DEG2RAD,
      obj.rotation[2] * THREE.MathUtils.DEG2RAD,
    )
    g.scale.set(...obj.scale)
  }, [obj.position, obj.rotation, obj.scale])

  useEffect(() => {
    if (groupRef.current) groupRef.current.visible = visible
  }, [visible])

  const isCollider = obj.assetPath.startsWith(COLLIDER_PATH_PREFIX)

  return (
    <group
      ref={groupRef}
      position={obj.position}
      rotation={[
        obj.rotation[0] * THREE.MathUtils.DEG2RAD,
        obj.rotation[1] * THREE.MathUtils.DEG2RAD,
        obj.rotation[2] * THREE.MathUtils.DEG2RAD,
      ]}
      scale={obj.scale}
      onClick={(e) => { e.stopPropagation(); onClick() }}
    >
      {selected && (
        <mesh>
          <boxGeometry args={isCollider ? [1.06, 1.06, 1.06] : [2.2, 2.2, 2.2]} />
          <meshBasicMaterial color="#44AAFF" wireframe />
        </mesh>
      )}
      {isCollider
        ? <ColliderBox />
        : (
          <Suspense fallback={null}>
            <AssetModel url={obj.assetUrl} mtlUrl={obj.assetMtlUrl} animate={previewMode} />
          </Suspense>
        )
      }
      {/* Center dot — builder-only selection indicator, hidden in preview */}
      {!previewMode && (
        <mesh>
          <sphereGeometry args={[0.14, 8, 6]} />
          <meshBasicMaterial color={selected ? '#44AAFF' : '#888888'} />
        </mesh>
      )}
    </group>
  )
}

// ── A named position marker ──────────────────────────────────────────────────

interface MarkerMeshProps {
  id: string
  label: string
  color: string
  position: [number, number, number]
  scale: [number, number, number]
  selected: boolean
  liveRefs: LiveRefs
  onClick: () => void
}

function MarkerMesh({ id, label, color, position, scale, selected, liveRefs, onClick }: MarkerMeshProps) {
  const groupRef = useRef<THREE.Group>(null)

  useEffect(() => {
    if (groupRef.current) liveRefs.set(`marker:${id}`, groupRef.current)
    return () => { liveRefs.delete(`marker:${id}`) }
  }, [id, liveRefs])

  useEffect(() => {
    if (groupRef.current && position) groupRef.current.position.set(...position)
  }, [position])

  useEffect(() => {
    if (groupRef.current && scale) groupRef.current.scale.set(...scale)
  }, [scale])

  if (!position) return null

  const invS: [number, number, number] = [1 / scale[0], 1 / scale[1], 1 / scale[2]]
  const labelLocalY = 0.5 + 0.4 * invS[1]

  return (
    <group ref={groupRef} position={position} scale={scale} onClick={(e) => { e.stopPropagation(); onClick() }}>
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={color} transparent opacity={0.12} depthWrite={false} />
      </mesh>
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={color} wireframe />
      </mesh>
      {selected && (
        <mesh>
          <boxGeometry args={[1.06, 1.06, 1.06]} />
          <meshBasicMaterial color="#FFFFFF" wireframe />
        </mesh>
      )}
      <group position={[0, labelLocalY, 0]} scale={invS}>
        <Suspense fallback={null}>
          <Text
            fontSize={0.22}
            color={color}
            anchorX="center"
            anchorY="bottom"
            outlineWidth={0.03}
            outlineColor="#000000"
            font="/fonts/PressStart2P-Regular.ttf"
          >
            {label}
          </Text>
        </Suspense>
      </group>
    </group>
  )
}

// ── Zone mesh ─────────────────────────────────────────────────────────────────

interface ZoneMeshProps {
  zone: SceneZone
  selected: boolean
  liveRefs: LiveRefs
  onClick: () => void
}

function ZoneMesh({ zone, selected, liveRefs, onClick }: ZoneMeshProps) {
  const groupRef = useRef<THREE.Group>(null)

  useEffect(() => {
    if (groupRef.current) liveRefs.set(`zone:${zone.id}`, groupRef.current)
    return () => { liveRefs.delete(`zone:${zone.id}`) }
  }, [zone.id, liveRefs])

  useEffect(() => {
    if (groupRef.current) groupRef.current.position.set(...zone.position)
  }, [zone.position])

  useEffect(() => {
    if (groupRef.current) groupRef.current.scale.set(...zone.scale)
  }, [zone.scale])

  const invS: [number, number, number] = [1 / zone.scale[0], 1 / zone.scale[1], 1 / zone.scale[2]]
  const labelLocalY = 0.5 + 0.4 * invS[1]

  return (
    <group
      ref={groupRef}
      position={zone.position}
      scale={zone.scale}
      onClick={(e) => { e.stopPropagation(); onClick() }}
    >
      {/* Translucent fill */}
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={zone.color} transparent opacity={0.15} depthWrite={false} />
      </mesh>
      {/* Dashed wireframe — rendered as solid wireframe in Three.js */}
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={zone.color} wireframe />
      </mesh>
      {/* Selection highlight */}
      {selected && (
        <mesh>
          <boxGeometry args={[1.06, 1.06, 1.06]} />
          <meshBasicMaterial color="#FFFFFF" wireframe />
        </mesh>
      )}
      {/* Label */}
      <group position={[0, labelLocalY, 0]} scale={invS}>
        <Suspense fallback={null}>
          <Text
            fontSize={0.22}
            color={zone.color}
            anchorX="center"
            anchorY="bottom"
            outlineWidth={0.03}
            outlineColor="#000000"
            font="/fonts/PressStart2P-Regular.ttf"
          >
            {zone.name}
          </Text>
        </Suspense>
      </group>
    </group>
  )
}

// ── Light mesh ────────────────────────────────────────────────────────────────

interface LightMeshProps {
  light: SceneLight
  selected: boolean
  liveRefs: LiveRefs
  onClick: () => void
}

function LightMesh({ light, selected, liveRefs, onClick }: LightMeshProps) {
  const groupRef = useRef<THREE.Group>(null)

  useEffect(() => {
    if (groupRef.current) liveRefs.set(`light:${light.id}`, groupRef.current)
    return () => { liveRefs.delete(`light:${light.id}`) }
  }, [light.id, liveRefs])

  useEffect(() => {
    groupRef.current?.position.set(...light.position)
  }, [light.position])

  return (
    <group
      ref={groupRef}
      position={light.position}
    >
      {/* Actual point light — illuminates the scene in the builder */}
      <pointLight
        color={light.color}
        intensity={light.intensity}
        distance={light.distance}
        decay={2}
      />

      {/* Visual indicator — only this mesh is clickable */}
      <mesh onClick={(e) => { e.stopPropagation(); onClick() }}>
        <octahedronGeometry args={[0.18, 0]} />
        <meshBasicMaterial color={light.color} />
      </mesh>

      {/* Wireframe sphere showing the falloff distance (hidden when distance = 0) */}
      {light.distance > 0 && (
        <mesh>
          <sphereGeometry args={[light.distance, 12, 8]} />
          <meshBasicMaterial color={light.color} wireframe transparent opacity={0.08} depthWrite={false} />
        </mesh>
      )}

      {/* Selection ring */}
      {selected && (
        <mesh>
          <octahedronGeometry args={[0.26, 0]} />
          <meshBasicMaterial color="#FFFFFF" wireframe />
        </mesh>
      )}

      {/* Label */}
      <Suspense fallback={null}>
        <Text
          position={[0, 0.4, 0]}
          fontSize={0.18}
          color={light.color}
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.03}
          outlineColor="#000000"
          font="/fonts/PressStart2P-Regular.ttf"
        >
          {light.name}
        </Text>
      </Suspense>
    </group>
  )
}

// ── Sun (directional light source) — moveable, selectable ───────────────────

interface SunMeshProps {
  position: [number, number, number]
  color: string
  selected: boolean
  liveRefs: LiveRefs
  onClick: () => void
}

function SunMesh({ position, color, selected, liveRefs, onClick }: SunMeshProps) {
  const groupRef = useRef<THREE.Group>(null)

  useEffect(() => {
    if (groupRef.current) liveRefs.set('sun', groupRef.current)
    return () => { liveRefs.delete('sun') }
  }, [liveRefs])

  useEffect(() => {
    groupRef.current?.position.set(...position)
  }, [position])

  return (
    <group ref={groupRef} position={position}>
      {/* Visual indicator — only this mesh is clickable */}
      <mesh onClick={(e) => { e.stopPropagation(); onClick() }}>
        <sphereGeometry args={[0.3, 12, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {/* Line toward scene origin to show direction */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([0, 0, 0, -position[0], -position[1], -position[2]]), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color={color} transparent opacity={0.25} />
      </line>

      {selected && (
        <mesh>
          <sphereGeometry args={[0.42, 12, 8]} />
          <meshBasicMaterial color="#FFFFFF" wireframe />
        </mesh>
      )}

      <Suspense fallback={null}>
        <Text
          position={[0, 0.55, 0]}
          fontSize={0.18}
          color={color}
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.03}
          outlineColor="#000000"
          font="/fonts/PressStart2P-Regular.ttf"
        >
          SUN
        </Text>
      </Suspense>
    </group>
  )
}

// ── Character reference — moveable, selectable ───────────────────────────────

const REFERENCE_CHAR = CHARACTERS.find(c => !c.meshType) ?? CHARACTERS[0]

interface CharacterRefProps {
  position: [number, number, number]
  selected: boolean
  liveRefs: LiveRefs
  onClick: () => void
}

function CharacterRef({ position, selected, liveRefs, onClick }: CharacterRefProps) {
  const groupRef = useRef<THREE.Group>(null)

  useEffect(() => {
    if (groupRef.current) liveRefs.set('player_ref', groupRef.current)
    return () => { liveRefs.delete('player_ref') }
  }, [liveRefs])

  useEffect(() => {
    groupRef.current?.position.set(...position)
  }, [position])

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(e) => { e.stopPropagation(); onClick() }}
    >
      {selected && (
        <mesh position={[0, 1, 0]}>
          <boxGeometry args={[1.0, 2.2, 0.8]} />
          <meshBasicMaterial color="#44AAFF" wireframe />
        </mesh>
      )}
      <CharacterMesh config={REFERENCE_CHAR} castShadow={false} />
      <Suspense fallback={null}>
        <Text
          position={[0, 2.2, 0]}
          fontSize={0.18}
          color="#44AAFF"
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.02}
          outlineColor="#000000"
          font="/fonts/PressStart2P-Regular.ttf"
        >
          PLAYER REF
        </Text>
      </Suspense>
    </group>
  )
}

// ── Terrain mesh ──────────────────────────────────────────────────────────────

interface TerrainMeshProps {
  terrain: TerrainData
  terrainLiveRefs: React.MutableRefObject<TerrainLiveRefs>
  selected: boolean
  sculpting: 'raise' | 'drop' | null
  onClick: () => void
}

function TerrainMesh({ terrain, terrainLiveRefs, selected, sculpting, onClick }: TerrainMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null)

  // Build geometry once on terrain ID change; sculpt edits in-place via live ref
  const geometry = useMemo(() => {
    const geom = new THREE.PlaneGeometry(terrain.width, terrain.depth, terrain.segsX, terrain.segsZ)
    geom.rotateX(-Math.PI / 2)
    const pos = geom.attributes.position.array as Float32Array
    for (let i = 0; i < terrain.heights.length; i++) {
      pos[i * 3 + 1] = terrain.heights[i]
    }
    geom.computeVertexNormals()
    return geom
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terrain.id])

  useEffect(() => {
    if (meshRef.current) terrainLiveRefs.current.set(terrain.id, meshRef.current)
    return () => { terrainLiveRefs.current.delete(terrain.id) }
  }, [terrain.id, terrainLiveRefs])

  // Wireframe color: green when raising, orange when dropping, blue when just selected
  const wireframeColor = sculpting === 'raise' ? '#88FF44' : sculpting === 'drop' ? '#FF8840' : '#44AAFF'
  const showWireframe  = sculpting !== null || selected

  return (
    <mesh
      ref={meshRef}
      position={terrain.position}
      geometry={geometry}
      onClick={e => { e.stopPropagation(); onClick() }}
    >
      <meshStandardMaterial
        color={terrain.color}
        transparent={terrain.type === 'river'}
        opacity={terrain.type === 'river' ? 0.75 : 1}
        roughness={0.85}
        metalness={0.0}
        side={THREE.DoubleSide}
      />
      {/* Wireframe overlay — always on while sculpting so topology is visible;
          color codes the current brush direction (green = raise, orange = drop). */}
      {showWireframe && (
        <mesh geometry={geometry}>
          <meshBasicMaterial
            color={wireframeColor}
            wireframe
            transparent
            opacity={sculpting !== null ? 0.45 : 0.25}
            depthWrite={false}
          />
        </mesh>
      )}
      {selected && (
        <mesh>
          <boxGeometry args={[terrain.width + 0.2, 0.05, terrain.depth + 0.2]} />
          <meshBasicMaterial color="#44AAFF" wireframe />
        </mesh>
      )}
    </mesh>
  )
}


// ── Dolly controller — scroll moves camera+target together ───────────────────
// Replaces OrbitControls' built-in zoom. By translating both camera and target
// forward/backward, the orbit radius stays constant so pan speed never degrades.

interface DollyControllerProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  orbitRef: React.RefObject<any>
}

function DollyController({ orbitRef }: DollyControllerProps) {
  const { camera, gl } = useThree()

  useEffect(() => {
    const canvas = gl.domElement

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const orbit = orbitRef.current
      if (!orbit) return

      const target = orbit.target as THREE.Vector3
      const dir = new THREE.Vector3().subVectors(target, camera.position).normalize()
      const dist = camera.position.distanceTo(target)

      // Speed scales with distance (feels snappy far away, precise up close)
      // but has a floor so it never crawls to zero.
      const speed = Math.max(0.5, dist * 0.12)
      // Negate: two-fingers-down (positive deltaY) = zoom in (move toward target)
      const delta = -Math.sign(e.deltaY) * speed

      camera.position.addScaledVector(dir, delta)
      target.addScaledVector(dir, delta)
      orbit.update()
    }

    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [camera, gl, orbitRef])

  return null
}

// ── Drop-at-cursor controller — single click places a regular scene object ────

function DropPlacementController({
  pendingAsset,
  terrainLiveRefs,
  onDropPlace,
}: {
  pendingAsset: AssetEntry | null
  terrainLiveRefs: React.MutableRefObject<TerrainLiveRefs>
  onDropPlace: (pos: [number, number, number]) => void
}) {
  const { camera, gl } = useThree()
  const raycaster   = useMemo(() => new THREE.Raycaster(), [])
  const groundPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])

  const getHitPoint = useCallback((e: PointerEvent) => {
    const rect = gl.domElement.getBoundingClientRect()
    const ndc  = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width)  * 2 - 1,
      -((e.clientY - rect.top)  / rect.height) * 2 + 1,
    )
    raycaster.setFromCamera(ndc, camera)
    const meshes = [...terrainLiveRefs.current.values()]
    if (meshes.length > 0) {
      const hits = raycaster.intersectObjects(meshes, false)
      if (hits.length > 0) return hits[0].point
    }
    const hit = new THREE.Vector3()
    return raycaster.ray.intersectPlane(groundPlane, hit) ? hit : null
  }, [camera, gl, raycaster, groundPlane, terrainLiveRefs])

  useEffect(() => {
    if (!pendingAsset) return
    const canvas = gl.domElement

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      const p = getHitPoint(e)
      if (p) onDropPlace([+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3)])
    }

    canvas.addEventListener('pointerdown', onDown)
    return () => canvas.removeEventListener('pointerdown', onDown)
  }, [pendingAsset, gl, getHitPoint, onDropPlace])

  return null
}

// ── Paint / sculpt controller (inside Canvas, uses useThree) ─────────────────

interface PaintSculptControllerProps {
  paintMode: boolean
  paintAsset: AssetEntry | null
  paintErase: boolean
  sculpting: 'raise' | 'drop' | null
  brushRadius: number
  cameraLock: boolean
  terrains: TerrainData[]
  terrainLiveRefs: React.MutableRefObject<TerrainLiveRefs>
  onPaintPlace: (pos: [number, number, number]) => void
  onPaintErase: (pos: [number, number, number], radius: number) => void
  onSculptEnd: (id: string, heights: number[]) => void
  onPaintStart?: () => void
  onSculptStart?: () => void
}

function PaintSculptController({
  paintMode, paintAsset, paintErase, sculpting, brushRadius, cameraLock,
  terrains, terrainLiveRefs, onPaintPlace, onPaintErase, onSculptEnd,
  onPaintStart, onSculptStart,
}: PaintSculptControllerProps) {
  const { camera, gl } = useThree()
  const raycaster   = useMemo(() => new THREE.Raycaster(), [])
  const groundPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])
  const isPainting  = useRef(false)
  const lastPos     = useRef<THREE.Vector3 | null>(null)
  const sculptingRef = useRef(sculpting)
  sculptingRef.current = sculpting
  const paintAssetRef = useRef(paintAsset)
  paintAssetRef.current = paintAsset
  const paintEraseRef = useRef(paintErase)
  paintEraseRef.current = paintErase

  const rafRef       = useRef(0)
  const sculptHitRef = useRef<{ terrainId: string; point: THREE.Vector3 } | null>(null)
  // Track which terrain IDs were actually modified in this stroke
  const modifiedTerrains = useRef<Set<string>>(new Set())
  // Accumulated hold time — drives sculpt speed acceleration
  const holdTimeRef = useRef(0)

  const applyBrush = useCallback((dt: number) => {
    const hit = sculptHitRef.current
    if (!hit || !sculptingRef.current) return
    const mesh = terrainLiveRefs.current.get(hit.terrainId)
    if (!mesh) return

    // Don't sculpt rivers
    const terrain = terrains.find(t => t.id === hit.terrainId)
    if (terrain?.type === 'river') return

    modifiedTerrains.current.add(hit.terrainId)
    const geom = mesh.geometry as THREE.BufferGeometry
    const pos  = geom.attributes.position.array as Float32Array
    const dir  = sculptingRef.current === 'raise' ? 1 : -1
    const r2   = brushRadius * brushRadius

    // Speed ramps linearly from 1× to 5× over 2 seconds of continuous hold
    holdTimeRef.current += dt
    const accel = 1 + Math.min(holdTimeRef.current * 2, 4)

    for (let i = 0; i < pos.length; i += 3) {
      const wx = pos[i]   + mesh.position.x
      const wz = pos[i + 2] + mesh.position.z
      const dx = wx - hit.point.x
      const dz = wz - hit.point.z
      const d2 = dx * dx + dz * dz
      if (d2 > r2) continue
      const falloff = Math.exp(-d2 / (0.5 * r2))
      pos[i + 1] += dir * falloff * dt * 2.5 * accel
    }
    geom.attributes.position.needsUpdate = true
    geom.computeVertexNormals()
  }, [brushRadius, terrainLiveRefs, terrains])

  const getHitPoint = useCallback((e: PointerEvent): THREE.Vector3 | null => {
    const rect = gl.domElement.getBoundingClientRect()
    const ndc  = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width)  * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    )
    raycaster.setFromCamera(ndc, camera)
    // Prefer the actual terrain surface so stamps land on sculpted ground
    const meshes = [...terrainLiveRefs.current.values()]
    if (meshes.length > 0) {
      const hits = raycaster.intersectObjects(meshes, false)
      if (hits.length > 0) return hits[0].point.clone()
    }
    // Fall back to flat y=0 plane
    const hit = new THREE.Vector3()
    if (!raycaster.ray.intersectPlane(groundPlane, hit)) return null
    return hit
  }, [camera, gl, raycaster, groundPlane, terrainLiveRefs])

  const getTerrainHit = useCallback((e: PointerEvent) => {
    const rect = gl.domElement.getBoundingClientRect()
    const ndc  = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width)  * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    )
    raycaster.setFromCamera(ndc, camera)
    const meshes = [...terrainLiveRefs.current.values()]
    const hits = raycaster.intersectObjects(meshes, false)
    if (!hits.length) return null
    const hit = hits[0]
    const id  = [...terrainLiveRefs.current.entries()].find(([, m]) => m === hit.object)?.[0]
    return id ? { terrainId: id, point: hit.point } : null
  }, [camera, gl, raycaster, terrainLiveRefs])

  useEffect(() => {
    if (!paintMode) return
    const canvas = gl.domElement

    let prevT = performance.now()

    const loop = () => {
      if (!isPainting.current) return
      const now = performance.now()
      applyBrush((now - prevT) / 1000)
      prevT = now
      rafRef.current = requestAnimationFrame(loop)
    }

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      if (cameraLock) return   // camera mode — let OrbitControls handle it
      isPainting.current = true

      if (sculptingRef.current) {
        onSculptStart?.()       // push history before first stroke
        modifiedTerrains.current.clear()
        holdTimeRef.current = 0
        sculptHitRef.current = getTerrainHit(e)
        prevT = performance.now()
        rafRef.current = requestAnimationFrame(loop)
      } else if (paintEraseRef.current) {
        onPaintStart?.()        // push history before first erase
        const p = getHitPoint(e)
        if (p) {
          lastPos.current = p.clone()
          onPaintErase([+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3)], brushRadius)
        }
      } else if (paintAssetRef.current) {
        onPaintStart?.()        // push history before first stamp
        const p = getHitPoint(e)
        if (p) {
          lastPos.current = p.clone()
          onPaintPlace([+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3)])
        }
      }
    }

    const onMove = (e: PointerEvent) => {
      if (!isPainting.current || cameraLock) return
      if (sculptingRef.current) {
        sculptHitRef.current = getTerrainHit(e) ?? sculptHitRef.current
      } else if (paintEraseRef.current) {
        const p = getHitPoint(e)
        if (!p) return
        if (lastPos.current && lastPos.current.distanceTo(p) < 0.4) return
        lastPos.current = p.clone()
        onPaintErase([+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3)], brushRadius)
      } else if (paintAssetRef.current) {
        const p = getHitPoint(e)
        if (!p) return
        // Threshold scales with brush radius: larger brush needs more movement
        // before re-stamping, otherwise a single slow drag floods the scene.
        const moveThreshold = Math.max(0.8, brushRadius * 0.5)
        if (lastPos.current && lastPos.current.distanceTo(p) < moveThreshold) return
        lastPos.current = p.clone()
        onPaintPlace([+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3)])
      }
    }

    const onUp = () => {
      isPainting.current = false
      cancelAnimationFrame(rafRef.current)

      if (sculptingRef.current) {
        // Persist sculpted heights back to state for modified terrains only
        for (const id of modifiedTerrains.current) {
          const mesh = terrainLiveRefs.current.get(id)
          if (!mesh) continue
          const pos = mesh.geometry.attributes.position.array as Float32Array
          const heights: number[] = []
          for (let i = 0; i < pos.length; i += 3) heights.push(pos[i + 1])
          onSculptEnd(id, heights)
        }
        modifiedTerrains.current.clear()
        sculptHitRef.current = null
      }
    }

    canvas.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      cancelAnimationFrame(rafRef.current)
      canvas.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [paintMode, paintErase, sculpting, brushRadius, cameraLock, applyBrush, getHitPoint, getTerrainHit, onPaintPlace, onPaintErase, onSculptEnd, onPaintStart, onSculptStart, terrainLiveRefs])

  return null
}

// ── TransformControls wired to the selected item ─────────────────────────────

interface GizmoProps {
  selectedId: string | null
  mode: 'translate' | 'rotate' | 'scale'
  liveRefs: LiveRefs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  orbitRef: React.RefObject<any>
  onDragEnd: () => void
  onSelect: (id: string | null) => void
  previewMode: boolean
  paintMode: boolean
}

function Gizmo({ selectedId, mode, liveRefs, orbitRef, onDragEnd, onSelect, previewMode, paintMode }: GizmoProps) {
  const [target, setTarget] = useState<THREE.Group | null>(null)

  useEffect(() => {
    if (!selectedId || previewMode || paintMode) { setTarget(null); return }
    const immediate = liveRefs.get(selectedId)
    if (immediate) { setTarget(immediate); return }
    const raf = requestAnimationFrame(() => {
      setTarget(liveRefs.get(selectedId) ?? null)
    })
    return () => cancelAnimationFrame(raf)
  }, [selectedId, liveRefs, previewMode, paintMode])

  if (!target) return null

  return (
    <TransformControls
      object={target}
      mode={mode}
      onMouseDown={() => {
        if (orbitRef.current) orbitRef.current.enabled = false
        // R3F's onPointerMissed fires before this (gizmo handles are raw THREE.js meshes,
        // invisible to R3F's raycaster) and may have already cleared selectedId.
        // Re-asserting here keeps the item selected through the whole drag.
        if (selectedId) onSelect(selectedId)
      }}
      onMouseUp={() => {
        if (orbitRef.current) orbitRef.current.enabled = true
        onDragEnd()
      }}
    />
  )
}

// ── Paint cursor indicator — snaps to terrain surface, zero React state ──────

function PaintCursorIndicator({
  enabled,
  eraseMode,
  dropMode,
  brushRadius,
  terrainLiveRefs,
}: {
  enabled: boolean
  eraseMode?: boolean
  dropMode?: boolean
  brushRadius?: number
  terrainLiveRefs: React.MutableRefObject<TerrainLiveRefs>
}) {
  const { camera, gl } = useThree()
  const groupRef    = useRef<THREE.Group>(null)
  const raycaster   = useMemo(() => new THREE.Raycaster(), [])
  const groundPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])

  useEffect(() => {
    const group = groupRef.current
    if (group) group.visible = false
    if (!enabled) return

    const canvas = gl.domElement
    const onMove = (e: PointerEvent) => {
      const g = groupRef.current; if (!g) return
      const rect = canvas.getBoundingClientRect()
      const ndc  = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width)  * 2 - 1,
        -((e.clientY - rect.top)  / rect.height) * 2 + 1,
      )
      raycaster.setFromCamera(ndc, camera)
      // Terrain surface first
      const meshes = [...terrainLiveRefs.current.values()]
      if (meshes.length > 0) {
        const hits = raycaster.intersectObjects(meshes, false)
        if (hits.length > 0) { g.position.copy(hits[0].point); g.visible = true; return }
      }
      // Fall back to y=0
      const hit = new THREE.Vector3()
      if (raycaster.ray.intersectPlane(groundPlane, hit)) { g.position.copy(hit); g.visible = true }
      else g.visible = false
    }
    canvas.addEventListener('pointermove', onMove)
    return () => {
      canvas.removeEventListener('pointermove', onMove)
      if (groupRef.current) groupRef.current.visible = false
    }
  }, [enabled, camera, gl, raycaster, groundPlane, terrainLiveRefs])

  const cursorColor = eraseMode ? '#FF4444' : dropMode ? '#FFDD44' : '#44FF88'
  // Ring radius: for drop/single-place use a small fixed indicator; for brush
  // painting/erasing scale the ring to reflect the real brush coverage area.
  const ringRadius = (dropMode || !brushRadius || brushRadius < 0.8)
    ? 0.45
    : brushRadius

  return (
    <group ref={groupRef} visible={false}>
      {/* Ring on surface — radius matches the actual brush area */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[ringRadius, Math.max(0.04, ringRadius * 0.04), 8, 48]} />
        <meshBasicMaterial color={cursorColor} transparent opacity={0.85} depthWrite={false} />
      </mesh>
      {/* Downward spike for erase, upward for place */}
      <mesh position={[0, eraseMode ? -0.28 : 0.28, 0]} rotation={eraseMode ? [Math.PI, 0, 0] : [0, 0, 0]}>
        <coneGeometry args={[0.07, 0.5, 8]} />
        <meshBasicMaterial color={cursorColor} transparent opacity={0.7} />
      </mesh>
    </group>
  )
}

// ── Camera state reader — exposes orbit controls state to parent ─────────────

interface CameraStateReaderProps {
  readerRef: React.RefObject<CameraStateHandle | null>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  orbitRef: React.RefObject<any>
}

export interface CameraStateHandle {
  getState: () => { position: THREE.Vector3; target: THREE.Vector3 }
}

function CameraStateReader({ readerRef, orbitRef }: CameraStateReaderProps) {
  const { camera } = useThree()

  useEffect(() => {
    readerRef.current = {
      getState: () => ({
        position: camera.position.clone(),
        target: orbitRef.current?.target
          ? (orbitRef.current.target as THREE.Vector3).clone()
          : new THREE.Vector3(),
      }),
    }
  })

  return null
}

// ── Preview camera (static, matches in-game KitchenCamera params) ────────────

function camPosFromConfig(c: CameraConfig): [number, number, number] {
  return [
    c.lookAt[0] + Math.sin(c.azimuth) * c.radius * Math.cos(c.elevation),
    c.lookAt[1] + c.radius * Math.sin(c.elevation),
    c.lookAt[2] - Math.cos(c.azimuth) * c.radius * Math.cos(c.elevation),
  ]
}

// ── Canvas root ───────────────────────────────────────────────────────────────

export interface BuilderCanvasProps {
  objects: PlacedObject[]
  markers: MarkerPositions
  markerScales: MarkerScales
  zones: SceneZone[]
  lights: SceneLight[]
  terrains: TerrainData[]
  terrainLiveRefs: React.MutableRefObject<TerrainLiveRefs>
  ambient: SceneAmbient
  camera: CameraConfig
  previewMode: boolean
  paintMode: boolean
  paintAsset: AssetEntry | null
  paintErase: boolean
  brushRadius: number
  sculpting: 'raise' | 'drop' | null
  cameraLock: boolean
  selectedId: string | null
  transformMode: 'translate' | 'rotate' | 'scale'
  showGrid: boolean
  liveRefs: LiveRefs
  hiddenIds: Set<string>
  playerRefPos: [number, number, number]
  cameraReaderRef: React.RefObject<CameraStateHandle | null>
  onSelect: (id: string | null) => void
  onDragEnd: () => void
  onSelectTerrain: (id: string) => void
  onPaintPlace: (pos: [number, number, number]) => void
  onPaintErase: (pos: [number, number, number], radius: number) => void
  onSculptEnd: (id: string, heights: number[]) => void
  onPaintStart?: () => void
  onSculptStart?: () => void
  dropPendingAsset: AssetEntry | null
  onDropPlace: (pos: [number, number, number]) => void
}

export default function BuilderCanvas({
  objects, markers, markerScales, zones, lights, terrains, terrainLiveRefs,
  ambient, camera, previewMode, paintMode, paintAsset, paintErase, brushRadius, sculpting, cameraLock,
  selectedId, transformMode, showGrid, liveRefs,
  hiddenIds, playerRefPos, cameraReaderRef, onSelect, onDragEnd,
  onSelectTerrain, onPaintPlace, onPaintErase, onSculptEnd, onPaintStart, onSculptStart,
  dropPendingAsset, onDropPlace,
}: BuilderCanvasProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orbitRef = useRef<any>(null)

  const previewPos = camPosFromConfig(camera)

  return (
    <Canvas
      camera={{ fov: 50, near: 0.1, far: 500, position: [0, 8, 12] }}
      style={{ width: '100%', height: '100%' }}
      onPointerMissed={() => { if (!previewMode && !paintMode) onSelect(null) }}
    >
      <color attach="background" args={[ambient.bgColor ?? '#87CEEB']} />

      {previewMode ? (
        <>
          <ambientLight color={ambient.ambientColor} intensity={ambient.ambientIntensity} />
          {ambient.hemisphereEnabled && (
            <hemisphereLight args={[ambient.skyColor, ambient.groundColor, ambient.hemisphereIntensity]} />
          )}
          {ambient.directionalEnabled && (
            <directionalLight
              position={ambient.directionalPosition}
              color={ambient.directionalColor}
              intensity={ambient.directionalIntensity}
            />
          )}
        </>
      ) : (
        <>
          {/* Builder-only lighting — tuned so sculpted terrain has clear depth.
              Low ambient + strong hemisphere reveals height via shading.
              The scene's sun (if enabled) is also rendered for accuracy. */}
          <ambientLight intensity={0.15} />
          <hemisphereLight args={['#B8E4FF', '#5C3A1E', 1.8]} />
          {/* Primary dev light: high-angle, slightly warm */}
          <directionalLight position={[12, 18, 8]} color="#FFF5E0" intensity={2.4} />
          {/* Soft fill from the opposite side, prevents totally black shadows */}
          <directionalLight position={[-8, 6, -10]} color="#C8D8FF" intensity={0.6} />
          {/* Scene sun (if enabled) so light placement in inspector is accurate */}
          {ambient.directionalEnabled && (
            <directionalLight
              position={ambient.directionalPosition}
              color={ambient.directionalColor}
              intensity={ambient.directionalIntensity * 0.5}
            />
          )}
        </>
      )}

      {showGrid && !previewMode && <gridHelper args={[40, 40, '#444444', '#2A2A2A']} />}

      {objects.map(obj => (
        <PlacedObjectMesh
          key={obj.id}
          obj={obj}
          selected={!previewMode && selectedId === obj.id}
          visible={!hiddenIds.has(obj.id)}
          previewMode={previewMode}
          liveRefs={liveRefs}
          onClick={() => { if (!previewMode && !paintMode) onSelect(obj.id) }}
        />
      ))}

      {!previewMode && MARKERS.map(m => (
        <MarkerMesh
          key={m.id}
          id={m.id}
          label={m.label}
          color={m.color}
          position={markers[m.id]}
          scale={markerScales[m.id] ?? [1, 1, 1]}
          selected={selectedId === `marker:${m.id}`}
          liveRefs={liveRefs}
          onClick={() => onSelect(`marker:${m.id}`)}
        />
      ))}

      {lights.map(light => (
        <LightMesh
          key={light.id}
          light={light}
          selected={!previewMode && selectedId === `light:${light.id}`}
          liveRefs={liveRefs}
          onClick={() => { if (!previewMode && !paintMode) onSelect(`light:${light.id}`) }}
        />
      ))}

      {zones.map(zone => (
        <ZoneMesh
          key={zone.id}
          zone={zone}
          selected={!previewMode && selectedId === `zone:${zone.id}`}
          liveRefs={liveRefs}
          onClick={() => { if (!previewMode && !paintMode) onSelect(`zone:${zone.id}`) }}
        />
      ))}

      {terrains.map(terrain => (
        <TerrainMesh
          key={terrain.id}
          terrain={terrain}
          terrainLiveRefs={terrainLiveRefs}
          selected={!previewMode && selectedId === `terrain:${terrain.id}`}
          sculpting={!previewMode ? sculpting : null}
          onClick={() => { if (!previewMode && !paintMode) onSelectTerrain(terrain.id) }}
        />
      ))}

      {!previewMode && (
        <CharacterRef
          position={playerRefPos}
          selected={selectedId === 'player_ref'}
          liveRefs={liveRefs}
          onClick={() => onSelect('player_ref')}
        />
      )}

      {!previewMode && ambient.directionalEnabled && (
        <SunMesh
          position={ambient.directionalPosition}
          color={ambient.directionalColor}
          selected={selectedId === 'sun'}
          liveRefs={liveRefs}
          onClick={() => onSelect('sun')}
        />
      )}

      {!previewMode && (
        <Gizmo
          selectedId={selectedId}
          mode={transformMode}
          liveRefs={liveRefs}
          orbitRef={orbitRef}
          onDragEnd={onDragEnd}
          onSelect={onSelect}
          previewMode={previewMode}
          paintMode={paintMode}
        />
      )}

      {paintMode && !previewMode && (
        <PaintSculptController
          paintMode={paintMode}
          paintAsset={paintAsset}
          paintErase={paintErase}
          sculpting={sculpting}
          brushRadius={brushRadius}
          cameraLock={cameraLock}
          terrains={terrains}
          terrainLiveRefs={terrainLiveRefs}
          onPaintPlace={onPaintPlace}
          onPaintErase={onPaintErase}
          onSculptEnd={onSculptEnd}
          onPaintStart={onPaintStart}
          onSculptStart={onSculptStart}
        />
      )}

      {/* Paint cursor — ring that snaps to terrain surface while stamping/erasing */}
      {paintMode && !previewMode && (paintAsset || paintErase) && !sculpting && !cameraLock && (
        <PaintCursorIndicator enabled eraseMode={paintErase} brushRadius={brushRadius} terrainLiveRefs={terrainLiveRefs} />
      )}

      {/* Drop placement — cursor + single-click place for regular scene objects */}
      {dropPendingAsset && !previewMode && (
        <>
          <DropPlacementController
            pendingAsset={dropPendingAsset}
            terrainLiveRefs={terrainLiveRefs}
            onDropPlace={onDropPlace}
          />
          <PaintCursorIndicator enabled eraseMode={false} dropMode terrainLiveRefs={terrainLiveRefs} />
        </>
      )}

      {previewMode
        ? (
          <PerspectiveCamera
            makeDefault
            fov={50}
            near={0.1}
            far={500}
            position={previewPos}
            onUpdate={self => self.lookAt(...camera.lookAt)}
          />
        )
        : (
          <>
            <OrbitControls
              ref={orbitRef}
              makeDefault
              screenSpacePanning
              enableZoom={false}
              enabled={(!paintMode || cameraLock) && !dropPendingAsset}
              mouseButtons={
                paintMode && cameraLock
                  ? { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }
                  : { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }
              }
            />
            {/* Custom scroll dolly: keeps orbit radius fixed → pan speed stays constant */}
            <DollyController orbitRef={orbitRef} />
          </>
        )
      }

      <CameraStateReader readerRef={cameraReaderRef} orbitRef={orbitRef} />
    </Canvas>
  )
}
