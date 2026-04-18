import { Suspense, useMemo, useEffect, useRef } from 'react'
import { useGLTF, useAnimations } from '@react-three/drei'
import * as THREE from 'three'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'

// URLs with >= this many instances use InstancedMesh instead of individual <primitive> objects.
// Keeps low-count objects (including all animals ≤ 6 instances) on the simple path.
const INSTANCE_THRESHOLD = 3

interface SceneJsonObject {
  id: string
  assetPath: string
  position: [number, number, number]
  rotation: [number, number, number]   // Euler degrees X Y Z
  scale:    [number, number, number]
}

interface SceneGlbObjectsProps {
  objects: SceneJsonObject[]
  urlMap: Record<string, string>
  /** Keep at most this many instances per unique asset URL (undefined = keep all).
   *  Uses every-Nth deterministic sampling so the distribution stays even. */
  maxPerAsset?: number
}

// ── Shared helpers ────────────────────────────────────────────────────────────

/** Returns the normalization scale so the tallest axis of the model = 2 units. */
function computeNormFactor(scene: THREE.Group): number {
  // Clone just to call updateWorldMatrix without mutating the cached useGLTF scene
  const tmp = scene.clone(true) as THREE.Group
  tmp.updateWorldMatrix(true, true)

  const box = new THREE.Box3()
  tmp.traverse(child => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return
    const geo = mesh.geometry
    if (!geo.attributes.position) return
    if (!geo.boundingBox) geo.computeBoundingBox()
    if (geo.boundingBox && !geo.boundingBox.isEmpty()) {
      box.union(geo.boundingBox.clone().applyMatrix4(mesh.matrixWorld))
    }
  })
  if (box.isEmpty()) box.setFromObject(tmp)

  const size = new THREE.Vector3()
  box.getSize(size)
  const maxDim = Math.max(size.x, size.y, size.z)
  return maxDim > 0 && isFinite(maxDim) ? 2 / maxDim : 1
}

/** True if any node in the hierarchy is a SkinnedMesh (animation rigging). */
function isSkinnedScene(scene: THREE.Group): boolean {
  let found = false
  scene.traverse(c => { if ((c as THREE.SkinnedMesh).isSkinnedMesh) found = true })
  return found
}

// ── Instanced path (static high-count objects) ────────────────────────────────

interface MeshInfo {
  geometry: THREE.BufferGeometry
  material: THREE.Material | THREE.Material[]
  /** Transform from mesh geometry-local space → normalized-model space (normFactor baked in) */
  localToNormRoot: THREE.Matrix4
}

function InstancedBatch({
  geometry, material, matrices,
}: {
  geometry: THREE.BufferGeometry
  material: THREE.Material | THREE.Material[]
  matrices: THREE.Matrix4[]
}) {
  const ref = useRef<THREE.InstancedMesh>(null)

  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    for (let i = 0; i < matrices.length; i++) mesh.setMatrixAt(i, matrices[i])
    mesh.instanceMatrix.needsUpdate = true
    // Recompute bounding sphere from actual instance positions so frustum culling
    // works correctly. Without this, Three.js uses the geometry's local bounding
    // sphere (a tiny unit bbox) and culls the whole batch whenever the origin is
    // off-screen.
    mesh.computeBoundingSphere()
  }, [matrices])

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material as THREE.Material, matrices.length]}
      // No castShadow — 1809+ grass/tree instances in the shadow pass would
      // double the draw call count. receiveShadow is also skipped for the same
      // reason; the terrain already receives the directional light shadow.
    />
  )
}

function InstancedGlbGroup({ scene, instances }: { scene: THREE.Group; instances: SceneJsonObject[] }) {
  // Extract per-mesh info from a temp clone (preserves useGLTF scene untouched)
  const meshInfos = useMemo<MeshInfo[]>(() => {
    const tmp = scene.clone(true) as THREE.Group
    tmp.updateWorldMatrix(true, true)

    const box = new THREE.Box3()
    tmp.traverse(child => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh || !mesh.geometry.attributes.position) return
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
      if (mesh.geometry.boundingBox && !mesh.geometry.boundingBox.isEmpty()) {
        box.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld))
      }
    })
    if (box.isEmpty()) box.setFromObject(tmp)

    const size = new THREE.Vector3()
    box.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z)
    const normFactor = maxDim > 0 && isFinite(maxDim) ? 2 / maxDim : 1
    const normMatrix = new THREE.Matrix4().makeScale(normFactor, normFactor, normFactor)

    const infos: MeshInfo[] = []
    tmp.traverse(child => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh || !mesh.geometry.attributes.position) return
      infos.push({
        geometry: mesh.geometry,         // shared ref (clone(true) shares geometry)
        material: mesh.material,
        localToNormRoot: normMatrix.clone().multiply(mesh.matrixWorld),
      })
    })
    return infos
  }, [scene])

  // Build one array of matrices per mesh-slot, for all instances
  const matricesPerMesh = useMemo<THREE.Matrix4[][]>(() => {
    return meshInfos.map(info =>
      instances.map(obj => {
        const rot = obj.rotation.map(d => d * THREE.MathUtils.DEG2RAD)
        const groupMat = new THREE.Matrix4().compose(
          new THREE.Vector3(...obj.position),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2])),
          new THREE.Vector3(...obj.scale),
        )
        // Full transform = group TRS × (normFactor × meshMatrixWorld)
        return groupMat.multiply(info.localToNormRoot)
      })
    )
  }, [meshInfos, instances])

  return (
    <>
      {meshInfos.map((info, mi) => (
        <InstancedBatch
          key={mi}
          geometry={info.geometry}
          material={info.material}
          matrices={matricesPerMesh[mi]}
        />
      ))}
    </>
  )
}

// ── Individual path (animated / low-count objects) ────────────────────────────

function GlbSceneObject({
  obj, scene, animations,
}: {
  obj: SceneJsonObject
  scene: THREE.Group
  animations: THREE.AnimationClip[]
}) {
  const groupRef = useRef<THREE.Group>(null)

  const model = useMemo(() => {
    const clone = SkeletonUtils.clone(scene) as THREE.Group
    const normFactor = computeNormFactor(clone)
    clone.scale.setScalar(normFactor)
    return clone
  }, [scene])

  // Wire up the animation mixer and auto-play the idle clip (same logic as scene builder)
  const { actions } = useAnimations(animations, groupRef)
  useEffect(() => {
    if (!actions) return
    const keys = Object.keys(actions)
    if (keys.length === 0) return
    const idleKey =
      keys.find(k => k === 'Idle') ??
      keys.find(k => /\|Idle$/i.test(k)) ??
      keys.find(k => /idle/i.test(k) && !/headlow|hitreact|_2/i.test(k)) ??
      keys[0]
    actions[idleKey!]?.reset().fadeIn(0.3).play()
  }, [actions])

  const rotRad = obj.rotation.map(d => d * THREE.MathUtils.DEG2RAD) as [number, number, number]
  return (
    <group ref={groupRef} position={obj.position} rotation={rotRad} scale={obj.scale}>
      <primitive object={model} />
    </group>
  )
}

// ── Per-URL loader (one Suspense boundary per unique asset) ───────────────────

function UrlGroup({ url, instances }: { url: string; instances: SceneJsonObject[] }) {
  const { scene, animations } = useGLTF(url)

  // Detect skinned meshes once; skinned = keep individual (SkinnedMesh + SkeletonUtils.clone)
  const skinned = useMemo(() => isSkinnedScene(scene), [scene])

  if (skinned || instances.length < INSTANCE_THRESHOLD) {
    // Individual primitive per object (animated animals, rare objects)
    return (
      <>
        {instances.map(obj => (
          <GlbSceneObject key={obj.id} obj={obj} scene={scene} animations={animations} />
        ))}
      </>
    )
  }

  // Single InstancedMesh set for all instances of this URL
  return <InstancedGlbGroup scene={scene} instances={instances} />
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function SceneGlbObjects({ objects, urlMap, maxPerAsset }: SceneGlbObjectsProps) {
  // Filter out physics-only collider placeholders
  const visible = useMemo(
    () => objects.filter(o => !o.assetPath.startsWith('__collider:')),
    [objects],
  )

  // Group objects by resolved URL — one React subtree per unique asset.
  // When maxPerAsset is set, downsample every-Nth to keep the spatial distribution even.
  const groups = useMemo(() => {
    const map = new Map<string, SceneJsonObject[]>()
    for (const obj of visible) {
      const url = urlMap[obj.assetPath]
      if (!url) continue
      if (!map.has(url)) map.set(url, [])
      map.get(url)!.push(obj)
    }

    if (maxPerAsset !== undefined) {
      for (const [url, objs] of map.entries()) {
        if (objs.length > maxPerAsset) {
          const step = objs.length / maxPerAsset
          const kept: SceneJsonObject[] = []
          for (let i = 0; i < maxPerAsset; i++) kept.push(objs[Math.floor(i * step)])
          map.set(url, kept)
        }
      }
    }

    return map
  }, [visible, urlMap, maxPerAsset])

  return (
    <>
      {Array.from(groups.entries()).map(([url, objs]) => (
        // One Suspense per unique URL (not per object) — vastly fewer React nodes
        <Suspense key={url} fallback={null}>
          <UrlGroup url={url} instances={objs} />
        </Suspense>
      ))}
    </>
  )
}
