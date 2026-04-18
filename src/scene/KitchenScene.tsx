import { Suspense, useRef, useState, useEffect, useMemo, memo, useLayoutEffect } from 'react'
import { Sky, Text, Billboard, Html } from '@react-three/drei'
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier'
import { useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js'
import Character from '../character/Character'
import type { CharacterRef } from '../character/Character'
import type { JoystickDir } from '../controls/VirtualJoystick'
import KitchenCamera from '../camera/KitchenCamera'
import PixelPostProcessing from '../effects/PixelPostProcessing'
import type { LevelConfig } from '../levels/levelRegistry'
import { useGameStore } from '../store/useGameStore'
import { getCharacter } from '../character/characterRegistry'

// ── Vite asset URL imports ────────────────────────────────────────────────────
import kitchenObjUrl from '../assets/low-poly/kitchen/kitchen/model.obj?url'
import kitchenMtlUrl from '../assets/low-poly/kitchen/kitchen/materials.mtl?url'
import chocolateObjUrl from '../assets/low-poly/kitchen/chocolate/model.obj?url'
import chocolateMtlUrl from '../assets/low-poly/kitchen/chocolate/materials.mtl?url'
import strawberriesObjUrl from '../assets/low-poly/kitchen/strawberries/model.obj?url'
import strawberriesMtlUrl from '../assets/low-poly/kitchen/strawberries/materials.mtl?url'
import flourObjUrl from '../assets/low-poly/kitchen/flour/model.obj?url'
import flourMtlUrl from '../assets/low-poly/kitchen/flour/materials.mtl?url'
import candlesObjUrl from '../assets/low-poly/kitchen/candles/model.obj?url'
import candlesMtlUrl from '../assets/low-poly/kitchen/candles/materials.mtl?url'
import trashcanObjUrl from '../assets/low-poly/kitchen/trashcan/model.obj?url'
import trashcanMtlUrl from '../assets/low-poly/kitchen/trashcan/materials.mtl?url'

// ── Camera config ─────────────────────────────────────────────────────────────
// Camera is STATIC — it does not follow the player.
//
// Adjust live:
//   backtick (`)        — enter / exit adjustment mode
//   drag left/right     — rotate around look-at point (azimuth)
//   drag up/down        — pan camera up / down (moves the look-at point)
//   scroll wheel        — zoom in / out (radius)
//   L                   — log current values to the browser console
//
// Paste the logged numbers back into the constants below.
const CAM_RADIUS    = 11.26                        // zoom / distance from look-at point
const CAM_ELEVATION = 0.719                        // vertical angle: 0 = horizon, 1.57 = top-down (~41°)
const CAM_AZIMUTH   = -0.428                       // horizontal rotation in radians
const CAM_LOOK_AT: [number, number, number] = [0, 0.26, 0]  // world point the camera orbits around

// ── Ingredient types ──────────────────────────────────────────────────────────
type IngredientId = 'strawberry_pickup' | 'chocolate_pickup' | 'flour_pickup' | 'candles'

// OBJ/MTL urls + scene-builder scale for each ingredient —
// used both for the counter decoration and the held-item visual.
const INGREDIENT_ASSET: Record<IngredientId, {
  objUrl: string; mtlUrl: string; scale: [number, number, number]
}> = {
  strawberry_pickup: { objUrl: strawberriesObjUrl, mtlUrl: strawberriesMtlUrl, scale: [0.3, 0.3, 0.3] },
  chocolate_pickup:  { objUrl: chocolateObjUrl,    mtlUrl: chocolateMtlUrl,    scale: [0.5, 0.5, 0.5] },
  flour_pickup:      { objUrl: flourObjUrl,         mtlUrl: flourMtlUrl,        scale: [0.3, 0.3, 0.3] },
  candles:           { objUrl: candlesObjUrl,       mtlUrl: candlesMtlUrl,      scale: [0.3, 0.3, 0.3] },
}

// World positions of each pickup zone (player must be within PICKUP_RADIUS).
// These match the rotated marker positions from the scene builder.
const PICKUP_ZONE_POS: Record<IngredientId, [number, number, number]> = {
  strawberry_pickup: [ 1.951, 1.176, -0.513],
  chocolate_pickup:  [ 2.026, 1.104, -2.350],  // moved closer to fridge so it doesn't overlap strawberries
  flour_pickup:      [-2.320, 0.885,  0.547],
  candles:           [ 0.520, 1.350,  0.382],
}
const PICKUP_RADIUS = 1.0  // tighter radius — prevents adjacent zones overlapping

// Trash bin world position (kitchen.json position with 180° Y flip applied)
const TRASH_BIN_POS: [number, number, number] = [-2.411, 0.319, -3.684]
const TRASH_RADIUS = 1.6   // drop within this distance → item disposed, not spawned

// Center counter — two independent cake zones (left / right)
// Counter spans x: -1.422 → 0.478; split into two halves.
const COUNTER_ZONE_POS: [number, number, number][] = [
  [-0.92, 0.537, -1.893],  // left zone
  [ 0.00, 0.537, -1.893],  // right zone
]
const COUNTER_ZONE_RADIUS = 1.4  // XZ proximity per zone (nearest zone wins)
const CAKE_TOP_Y      = 1.137   // counter top = pos.y (0.537) + half-extent (0.6)
const LAYER_THICKNESS = 0.12               // height of one disk layer
const LAYER_RADIUS    = 0.36               // disk radius (half the counter half-extent)

const CAKE_LAYER_COLOR: Partial<Record<IngredientId, string>> = {
  flour_pickup:      '#E8D5B7',  // beige
  chocolate_pickup:  '#5C3317',  // brown
  strawberry_pickup: '#CC2B2B',  // red
  // candles → no color disk; uses 3D model placed on top
}

// Oven — cake baking zone
const OVEN_POS: [number, number, number] = [-0.84, 0.665, 0.459]
const OVEN_PICKUP_RADIUS = 1.3
const BAKE_SECONDS  = 15   // green bar duration
const BURN_SECONDS  = 7   // red bar + fire duration before burned

// Fridge — cake delivery zone
const FRIDGE_POS: [number, number, number] = [2.041, 1.591, -3.243]
const FRIDGE_RADIUS = 1.4

// ── Level 2 timer ─────────────────────────────────────────────────────────────
const LEVEL2_DURATION_SECONDS = 180  // 3 minutes — change here to tune
// Score target lives in levelRegistry.ts as KITCHEN_SCORE_TARGET (shared with LevelComplete)

// Recipe system
const RECIPE_COUNT = 3
type LayerSpec = Exclude<IngredientId, 'candles'>

const RECIPE_TEMPLATES: LayerSpec[][] = [
  ['flour_pickup', 'chocolate_pickup'],
  ['flour_pickup', 'strawberry_pickup'],
  ['flour_pickup', 'chocolate_pickup', 'strawberry_pickup'],
  ['flour_pickup', 'strawberry_pickup', 'chocolate_pickup'],
  ['flour_pickup', 'chocolate_pickup', 'flour_pickup', 'strawberry_pickup'],
  ['flour_pickup', 'strawberry_pickup', 'flour_pickup', 'chocolate_pickup'],
]

interface Recipe {
  id:           string
  layers:       LayerSpec[]   // bottom → top
  needsCandles: boolean
  points:       number        // layers.length + (needsCandles ? 1 : 0)
}

function generateRecipe(): Recipe {
  const layers = RECIPE_TEMPLATES[Math.floor(Math.random() * RECIPE_TEMPLATES.length)]
  const needsCandles = Math.random() < 0.5
  return {
    id: `r-${Date.now()}-${Math.random()}`,
    layers,
    needsCandles,
    points: layers.length + (needsCandles ? 1 : 0),
  }
}

function cakeMatchesRecipe(cakeLayers: CakeLayer[], isBaked: boolean, recipe: Recipe): boolean {
  if (!isBaked) return false
  if (cakeLayers.some(l => l.burned)) return false
  const foodLayers = cakeLayers.filter(l => l.ingredientId !== 'candles')
  const hasCandles = cakeLayers.some(l => l.ingredientId === 'candles')
  if (foodLayers.length !== recipe.layers.length) return false
  if (!foodLayers.every((l, i) => l.ingredientId === recipe.layers[i])) return false
  return hasCandles === recipe.needsCandles
}

// World position for the "A" prompt — sits just above each ingredient model.
// x/z = model position; y = model_y + 0.7 so the label clears the model.
const INGREDIENT_PROMPT_POS: Record<IngredientId, [number, number, number]> = {
  strawberry_pickup: [ 2.032, 2.15, -0.485],
  chocolate_pickup:  [ 2.018, 2.05, -1.704],
  flour_pickup:      [-2.325, 1.83,  0.590],
  candles:           [ 0.502, 2.14,  0.244],
}

// ── OBJ + MTL model loader ────────────────────────────────────────────────────
// Loads OBJ and MTL independently to avoid the shared-loader-instance problem.
// Normalises the model to 2 world units (matching the scene builder), then
// applies the scene-builder position / rotation / scale on top.

interface SceneObjModelProps {
  objUrl: string
  mtlUrl: string
  position: [number, number, number]
  rotation: [number, number, number]  // degrees
  scale: [number, number, number]
}

function SceneObjModelInner({ objUrl, mtlUrl, position, rotation, scale }: SceneObjModelProps) {
  const mtl = useLoader(MTLLoader, mtlUrl)
  const raw = useLoader(OBJLoader, objUrl)

  const model = useMemo(() => {
    mtl.preload()
    const clone = (raw as unknown as THREE.Group).clone()

    // Normalise to 2 units max dim — matches scene builder's normaliseGroup()
    const box = new THREE.Box3().setFromObject(clone)
    const size = new THREE.Vector3()
    box.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z)
    if (maxDim > 0 && isFinite(maxDim)) clone.scale.setScalar(2 / maxDim)

    // Apply materials by name (independent MTL approach)
    clone.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      // Disable frustum culling so dynamically-positioned models (e.g. candles on a
      // tall cake stack) are never incorrectly hidden by a stale bounding sphere.
      child.frustumCulled = false
      if (Array.isArray(child.material)) {
        child.material = child.material.map((m: THREE.Material) => {
          if (!m?.name) return m
          try { return mtl.create(m.name) ?? m } catch { return m }
        })
      } else {
        const name = child.material?.name
        if (name) {
          try {
            const mat = mtl.create(name)
            if (mat) child.material = mat
          } catch { /* name not in MTL — keep default */ }
        }
      }
    })

    return clone
  }, [raw, mtl])

  const [rx, ry, rz] = rotation
  const DEG = THREE.MathUtils.DEG2RAD
  return (
    <group
      position={position}
      rotation={[rx * DEG, ry * DEG, rz * DEG]}
      scale={scale}
    >
      <primitive object={model} />
    </group>
  )
}

function SceneObjModel(props: SceneObjModelProps) {
  return (
    <Suspense fallback={null}>
      <SceneObjModelInner {...props} />
    </Suspense>
  )
}

// ── Held-item visual ──────────────────────────────────────────────────────────
// Rendered as a child of the Character group so it automatically follows the
// character in local space. Position [0, 1.1, 0.55] = arm-height, 0.55 forward.

interface HeldItemProps {
  ingredient: IngredientId
}

function HeldItem({ ingredient }: HeldItemProps) {
  const { objUrl, mtlUrl, scale } = INGREDIENT_ASSET[ingredient]
  return (
    <Suspense fallback={null}>
      <SceneObjModelInner
        objUrl={objUrl}
        mtlUrl={mtlUrl}
        position={[0, 1.1, 0.55]}
        rotation={[0, 0, 0]}
        scale={scale}
      />
    </Suspense>
  )
}

// ── DroppedItem / CakeLayer types ─────────────────────────────────────────────
type DroppedItem = { key: string; ingredientId: IngredientId; spawnPos: [number, number, number] }
type CakeLayer   = { key: string; ingredientId: IngredientId; burned?: boolean }
type OvenPhase   = 'empty' | 'baking' | 'burning' | 'burned'

// ── DroppedItemBody ────────────────────────────────────────────────────────────
// A physics-simulated dropped item that tracks its own world position into a
// shared Map so the parent can do proximity checks each frame.

interface DroppedItemBodyProps {
  item: DroppedItem
  positionTracker: React.MutableRefObject<Map<string, THREE.Vector3>>
}

function DroppedItemBody({ item, positionTracker }: DroppedItemBodyProps) {
  const groupRef = useRef<THREE.Group>(null)
  // Reuse a single Vector3 per item to avoid GC pressure every frame.
  const wp = useMemo(() => new THREE.Vector3(), [])

  // Update the position in the shared tracker every physics frame.
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.getWorldPosition(wp)
      positionTracker.current.set(item.key, wp)
    }
  })

  // Remove from tracker when this item is unmounted (picked up / disposed).
  useEffect(() => {
    return () => { positionTracker.current.delete(item.key) }
  }, [item.key, positionTracker])

  return (
    <RigidBody
      type="dynamic"
      position={item.spawnPos}
      colliders={false}
      linearDamping={0.6}
      angularDamping={0.85}
    >
      <CuboidCollider args={[0.25, 0.25, 0.25]} />
      {/* group ref lets us read the world position as synced by rapier */}
      <group ref={groupRef}>
        <SceneObjModel
          objUrl={INGREDIENT_ASSET[item.ingredientId].objUrl}
          mtlUrl={INGREDIENT_ASSET[item.ingredientId].mtlUrl}
          position={[0, 0, 0]}
          rotation={[0, 0, 0]}
          scale={INGREDIENT_ASSET[item.ingredientId].scale}
        />
      </group>
    </RigidBody>
  )
}

// ── HeldCake — mini cake stack rendered in the player's hands ────────────────

function HeldCake({ layers }: { layers: CakeLayer[] }) {
  const MINI_H = LAYER_THICKNESS
  const MINI_R = LAYER_RADIUS
  return (
    <group position={[0, 1.1, 0.55]}>
      {layers.map((layer, i) => {
        const y = i * MINI_H
        if (layer.ingredientId === 'candles') {
          return (
            <SceneObjModel
              key={layer.key}
              objUrl={candlesObjUrl}
              mtlUrl={candlesMtlUrl}
              position={[0, y, 0]}
              rotation={[0, 0, 0]}
              scale={[0.07, 0.07, 0.07]}
            />
          )
        }
        const color = layer.burned ? '#111111' : (CAKE_LAYER_COLOR[layer.ingredientId] ?? '#888888')
        return (
          <mesh key={layer.key} position={[0, y, 0]}>
            <cylinderGeometry args={[MINI_R, MINI_R, MINI_H, 16]} />
            <meshStandardMaterial color={color} />
          </mesh>
        )
      })}
    </group>
  )
}

// ── FireEffect — flickering flame above the oven ─────────────────────────────

function FireEffect() {
  const outerRef = useRef<THREE.Mesh>(null)
  const innerRef = useRef<THREE.Mesh>(null)
  const t = useRef(0)
  useFrame((_, delta) => {
    t.current += delta
    if (outerRef.current) {
      const s = 0.85 + Math.sin(t.current * 7.3) * 0.15 + Math.cos(t.current * 4.1) * 0.08
      outerRef.current.scale.set(s, 0.9 + Math.sin(t.current * 5.9) * 0.1, s)
    }
    if (innerRef.current) {
      const s2 = 0.9 + Math.cos(t.current * 9.1) * 0.1
      innerRef.current.scale.set(s2, s2, s2)
    }
  })
  return (
    <group>
      <mesh ref={outerRef} position={[0, 0.35, 0]}>
        <coneGeometry args={[0.22, 0.5, 7]} />
        <meshBasicMaterial color="#FF5500" transparent opacity={0.85} />
      </mesh>
      <mesh ref={innerRef} position={[0, 0.22, 0]}>
        <coneGeometry args={[0.12, 0.3, 7]} />
        <meshBasicMaterial color="#FFCC00" transparent opacity={0.9} />
      </mesh>
    </group>
  )
}

// ── FridgeFlashEffect — fading colored overlay + pixel-font score text ───────
// key={flash.id} in JSX guarantees a fresh mount (and fresh timer) for every flash.

interface FridgeFlashEffectProps {
  type:   'hit' | 'miss'
  points: number
}

function FridgeFlashEffect({ type, points }: FridgeFlashEffectProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const t = useRef(0)
  useFrame((_, delta) => {
    t.current += delta
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = Math.max(0, 0.55 * (1 - t.current / 1.5))
    }
  })
  const boxColor  = type === 'hit' ? '#00FF66' : '#FF2222'
  const textColor = type === 'hit' ? '#FFD700' : '#FF4444'
  const label     = type === 'hit' ? `+${points}` : 'X'
  return (
    <>
      {/* Fridge box flash */}
      <mesh ref={meshRef} position={FRIDGE_POS}>
        <boxGeometry args={[1.0, 2.9, 1.3]} />
        <meshBasicMaterial color={boxColor} transparent opacity={0.55} depthWrite={false} />
      </mesh>
      {/* Score text above fridge */}
      <Suspense fallback={null}>
        <Billboard
          position={[FRIDGE_POS[0], FRIDGE_POS[1] + 1.8, FRIDGE_POS[2]]}
          follow lockX={false} lockY={false} lockZ={false}
        >
          <Text
            fontSize={0.45}
            font="/fonts/PressStart2P-Regular.ttf"
            color={textColor}
            anchorX="center"
            anchorY="bottom"
            outlineWidth={0.07}
            outlineColor="#111111"
          >
            {label}
          </Text>
        </Billboard>
      </Suspense>
    </>
  )
}

// ── BakingProgressBar ─────────────────────────────────────────────────────────
// Wrapped in memo so it never re-renders when the parent state changes.
// This stops r3f from re-applying the JSX scale={[0.001,1,1]} prop every frame,
// which was resetting the imperatively driven scale.x back to 0.001.

interface BakingProgressBarProps {
  bakingTimeRef: React.MutableRefObject<number>
  ovenPhaseRef:  React.MutableRefObject<OvenPhase>
}

const BakingProgressBar = memo(function BakingProgressBar({
  bakingTimeRef,
  ovenPhaseRef,
}: BakingProgressBarProps) {
  const fillRef = useRef<THREE.Mesh>(null)

  // Initialise scale before first paint so the bar doesn't flash at full width.
  useLayoutEffect(() => {
    if (!fillRef.current) return
    const total = BAKE_SECONDS + BURN_SECONDS
    const fill  = Math.min(Math.max(bakingTimeRef.current / total, 0), 1)
    fillRef.current.scale.x    = Math.max(fill, 0.0001)
    fillRef.current.position.x = -0.5 + fill * 0.5
  }, [bakingTimeRef])

  useFrame(() => {
    if (!fillRef.current) return
    const total   = BAKE_SECONDS + BURN_SECONDS
    const fill    = Math.min(Math.max(bakingTimeRef.current / total, 0), 1)
    const burning = ovenPhaseRef.current === 'burning'
    fillRef.current.scale.x    = Math.max(fill, 0.0001)
    fillRef.current.position.x = -0.5 + fill * 0.5
    const mat = fillRef.current.material as THREE.MeshBasicMaterial
    mat.color.setHex(burning ? 0xFF3333 : 0x33CC55)
    mat.opacity = burning
      ? 0.35 + 0.65 * Math.abs(Math.sin(bakingTimeRef.current * 4.5))
      : 1.0
  })

  return (
    <>
      <mesh>
        <boxGeometry args={[1.0, 0.14, 0.01]} />
        <meshBasicMaterial color="#222222" />
      </mesh>
      <mesh ref={fillRef} position={[-0.5, 0, 0.005]}>
        <boxGeometry args={[1.0, 0.10, 0.01]} />
        <meshBasicMaterial color="#33CC55" transparent />
      </mesh>
    </>
  )
})

// ── KitchenScene ──────────────────────────────────────────────────────────────

interface KitchenSceneProps {
  config: LevelConfig
  characterRef: React.RefObject<CharacterRef | null>
  joystickDir: React.MutableRefObject<JoystickDir>
  jumpRef: React.MutableRefObject<boolean>
}

export default function KitchenScene({ config, characterRef, joystickDir, jumpRef }: KitchenSceneProps) {
  const { player1CharacterId } = useGameStore()
  const p1Config = getCharacter(player1CharacterId)

  // ── Pickup / drop state ─────────────────────────────────────────────────────
  // nearZoneRef   — proximity zone; ref avoids stale closure in key handler
  // heldItemRef   — mirrors heldItem state; ref so the empty-dep key handler
  //                 can read the current value without a stale closure
  // droppedItems  — list of physics-simulated items on the floor
  const nearZoneRef  = useRef<IngredientId | null>(null)
  const heldItemRef  = useRef<IngredientId | null>(null)
  const [nearZone,    setNearZone]    = useState<IngredientId | null>(null)
  const [heldItem,    setHeldItem]    = useState<IngredientId | null>(null)
  const holdingItemRef = useRef(false)

  const [droppedItems, setDroppedItems] = useState<DroppedItem[]>([])
  // Mirror of droppedItems in a ref so useFrame can read it without stale closures.
  const droppedItemsRef = useRef<DroppedItem[]>([])
  useEffect(() => { droppedItemsRef.current = droppedItems }, [droppedItems])

  // ── Cake layers (counter) — one array per zone [left, right] ──────────────
  const [cakeZoneLayers, setCakeZoneLayers] = useState<[CakeLayer[], CakeLayer[]]>([[], []])
  const cakeZoneLayersRef = useRef<[CakeLayer[], CakeLayer[]]>([[], []])
  useEffect(() => { cakeZoneLayersRef.current = cakeZoneLayers }, [cakeZoneLayers])

  // ── Held cake ───────────────────────────────────────────────────────────────
  const heldCakeRef        = useRef(false)
  const heldCakeLayersRef  = useRef<CakeLayer[]>([])
  const [heldCake,       setHeldCake]       = useState(false)
  const [heldCakeLayers, setHeldCakeLayers] = useState<CakeLayer[]>([])

  // ── Floor cakes — cakes dropped away from the counter (visual-only, pickable) ─
  type FloorCake = { key: string; pos: [number, number, number]; layers: CakeLayer[]; cookedSeconds: number; isBaked: boolean }
  const [floorCakes, setFloorCakes] = useState<FloorCake[]>([])
  const floorCakesRef = useRef<FloorCake[]>([])
  useEffect(() => { floorCakesRef.current = floorCakes }, [floorCakes])

  // ── Oven state ───────────────────────────────────────────────────────────────
  const ovenPhaseRef    = useRef<OvenPhase>('empty')
  const [ovenPhase,  setOvenPhase]  = useState<OvenPhase>('empty')
  const bakingTimeRef   = useRef(0)
  const ovenCakeLayersRef = useRef<CakeLayer[]>([])
  // Per-zone accumulated baking seconds — each zone tracks its own cake's oven progress.
  // Index matches COUNTER_ZONE_POS. Reset when first ingredient is placed; saved when cake
  // returns from the oven to that zone.
  const zoneCookedSecondsRef = useRef<[number, number]>([0, 0])
  // Baking seconds carried by the cake currently in the player's hands.
  const heldCakeCookedSecondsRef = useRef(0)
  // Per-zone baked flag — true once a cake has been through the oven successfully.
  const zoneIsBakedRef = useRef<[boolean, boolean]>([false, false])
  // Baked flag carried by the held cake.
  const heldCakeIsBakedRef = useRef(false)

  // ── Recipe system ───────────────────────────────────────────────────────────
  const [recipes, setRecipes] = useState<Recipe[]>(() =>
    Array.from({ length: RECIPE_COUNT }, generateRecipe))
  // recipesRef mirrors recipes so the stale-closure key handler always reads the live list
  const recipesRef = useRef<Recipe[]>([])
  useEffect(() => { recipesRef.current = recipes }, [recipes])

  // Fridge flash feedback: 'hit' (green +pts) | 'miss' (red ✗)
  const [fridgeFlash, setFridgeFlash] = useState<{ type: 'hit' | 'miss'; points: number; id: number } | null>(null)
  const fridgeFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Control scheme selection ────────────────────────────────────────────────
  // null = not yet selected (timer frozen, overlay shown)
  type ControlScheme = 'keyboard' | 'controller'
  const [controlScheme, setControlScheme] = useState<ControlScheme | null>(null)
  const controlSchemeRef = useRef<ControlScheme | null>(null)
  useEffect(() => { controlSchemeRef.current = controlScheme }, [controlScheme])
  // Previous gamepad button state for edge detection (Y=button3, B=button1)
  const prevGpRef = useRef<[boolean, boolean]>([false, false])

  // Selection-screen cursor: 0 = Keyboard, 1 = Controller
  const [selectionCursor, setSelectionCursor] = useState(0)
  const selectionCursorRef = useRef(0)
  // Edge-detection refs for gamepad navigation on the selection screen
  const prevGpSelAxisRef    = useRef(false)   // was stick pushed left or right
  const prevGpSelConfirmRef = useRef(false)   // was any face button pressed

  // Keyboard navigation for the selection screen
  useEffect(() => {
    if (controlScheme !== null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft')  { selectionCursorRef.current = 0; setSelectionCursor(0) }
      if (e.code === 'ArrowRight') { selectionCursorRef.current = 1; setSelectionCursor(1) }
      if (e.code === 'Enter' || e.code === 'Space') {
        setControlScheme(selectionCursorRef.current === 0 ? 'keyboard' : 'controller')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [controlScheme])

  // Derived key labels — swap when controller is active
  const kP = controlScheme === 'controller' ? 'Y' : 'P'
  const kL = controlScheme === 'controller' ? 'B' : 'L'

  // ── Level 2 countdown timer ────────────────────────────────────────────────
  const timeLeftRef          = useRef(LEVEL2_DURATION_SECONDS)
  const lastDisplayedTimeRef = useRef(LEVEL2_DURATION_SECONDS)
  const [timeLeft,  setTimeLeft]  = useState(LEVEL2_DURATION_SECONDS)
  const gameEndedRef = useRef(false)  // prevents multiple completeLevel calls

  // Proximity prompts for oven and fridge
  const [nearOven,   setNearOven]   = useState(false)
  const [nearFridge, setNearFridge] = useState(false)
  const nearOvenRef   = useRef(false)
  const nearFridgeRef = useRef(false)

  // Clear timer on unmount
  useEffect(() => () => { if (fridgeFlashTimerRef.current) clearTimeout(fridgeFlashTimerRef.current) }, [])

  // Shared Map: dropped-item key → current world position (updated by DroppedItemBody).
  // useRef returns a stable object — safe to pass as a prop directly.
  const droppedItemPositions = useRef<Map<string, THREE.Vector3>>(new Map())

  // Nearest dropped item (for floor pickup).
  const nearDroppedItemRef = useRef<{ key: string; ingredientId: IngredientId } | null>(null)

  // ── Proximity detection + baking timer ─────────────────────────────────────
  useFrame((_, delta) => {
    const char = characterRef.current
    if (!char) return

    // ── Level 2 countdown (frozen until control scheme is chosen) ──
    if (!gameEndedRef.current && controlSchemeRef.current !== null) {
      timeLeftRef.current -= delta
      if (timeLeftRef.current <= 0) {
        timeLeftRef.current = 0
        gameEndedRef.current = true
        setTimeLeft(0)
        useGameStore.getState().completeLevel('kitchen_cake')
      } else {
        const s = Math.ceil(timeLeftRef.current)
        if (s !== lastDisplayedTimeRef.current) {
          lastDisplayedTimeRef.current = s
          setTimeLeft(s)
        }
      }
    }

    // ── Gamepad navigation on the selection screen ──
    if (controlSchemeRef.current === null) {
      const gp = navigator.getGamepads()[0]
      if (gp) {
        const axisX    = gp.axes[0] ?? 0
        const leftPush  = axisX < -0.5
        const rightPush = axisX > 0.5
        const axisPushed = leftPush || rightPush
        if (axisPushed && !prevGpSelAxisRef.current) {
          const next = leftPush ? 0 : 1
          selectionCursorRef.current = next
          setSelectionCursor(next)
        }
        prevGpSelAxisRef.current = axisPushed
        // Any face button confirms (A/B/X/Y = indices 0-3)
        const confirmDown = [0, 1, 2, 3].some(i => gp.buttons[i]?.pressed ?? false)
        if (confirmDown && !prevGpSelConfirmRef.current) {
          setControlScheme(selectionCursorRef.current === 0 ? 'keyboard' : 'controller')
        }
        prevGpSelConfirmRef.current = confirmDown
      }
    }

    // ── Gamepad action buttons (movement is handled natively in useCharacterControls) ──
    // A (button 0) = jump — already handled by useCharacterControls
    // Y (button 3) → P key (pick up)   |   B (button 1) → L key (drop / bake / deliver)
    if (controlSchemeRef.current === 'controller') {
      const gp = navigator.getGamepads()[0]
      if (gp) {
        const yDown = gp.buttons[3]?.pressed ?? false  // Y
        const bDown = gp.buttons[1]?.pressed ?? false  // B
        if (yDown && !prevGpRef.current[0])
          window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP', bubbles: true }))
        if (bDown && !prevGpRef.current[1])
          window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyL', bubbles: true }))
        prevGpRef.current = [yDown, bDown]
      }
    }

    // ── Baking timer ──
    if (ovenPhaseRef.current === 'baking' || ovenPhaseRef.current === 'burning') {
      bakingTimeRef.current += delta
      const total = BAKE_SECONDS + BURN_SECONDS
      if (ovenPhaseRef.current === 'baking' && bakingTimeRef.current >= BAKE_SECONDS) {
        ovenPhaseRef.current = 'burning'; setOvenPhase('burning')
      } else if (ovenPhaseRef.current === 'burning' && bakingTimeRef.current >= total) {
        ovenPhaseRef.current = 'burned';  setOvenPhase('burned')
      }
    }

    // ── Fixed pickup zones (counter ingredients) ──
    let found: IngredientId | null = null
    for (const [id, pos] of Object.entries(PICKUP_ZONE_POS) as [IngredientId, [number, number, number]][]) {
      const dx = char.position.x - pos[0]
      const dz = char.position.z - pos[2]
      if (Math.sqrt(dx * dx + dz * dz) < PICKUP_RADIUS) { found = id; break }
    }
    if (found !== nearZoneRef.current) {
      nearZoneRef.current = found
      setNearZone(found)
    }

    // ── Dropped items on the floor (only when not already holding something) ──
    let foundDropped: { key: string; ingredientId: IngredientId } | null = null
    if (!heldItemRef.current && !found) {
      for (const [key, pos] of droppedItemPositions.current) {
        const dx = char.position.x - pos.x
        const dz = char.position.z - pos.z
        if (Math.sqrt(dx * dx + dz * dz) < PICKUP_RADIUS) {
          const item = droppedItemsRef.current.find(i => i.key === key)
          if (item) { foundDropped = { key, ingredientId: item.ingredientId }; break }
        }
      }
    }
    if (foundDropped?.key !== nearDroppedItemRef.current?.key) {
      nearDroppedItemRef.current = foundDropped
    }

    // ── Oven proximity ──
    const odx2 = char.position.x - OVEN_POS[0]
    const odz2 = char.position.z - OVEN_POS[2]
    const isNearOven = Math.sqrt(odx2 * odx2 + odz2 * odz2) < OVEN_PICKUP_RADIUS
    if (isNearOven !== nearOvenRef.current) { nearOvenRef.current = isNearOven; setNearOven(isNearOven) }

    // ── Fridge proximity ──
    const fdx2 = char.position.x - FRIDGE_POS[0]
    const fdz2 = char.position.z - FRIDGE_POS[2]
    const isNearFridge = Math.sqrt(fdx2 * fdx2 + fdz2 * fdz2) < FRIDGE_RADIUS
    if (isNearFridge !== nearFridgeRef.current) { nearFridgeRef.current = isNearFridge; setNearFridge(isNearFridge) }
  })

  // P = pick up (counter or floor), L = drop.
  // holdingItemRef / heldItemRef are set immediately (not via useEffect) so
  // Character's useFrame sees the change on the very same frame.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyP') {
        if (heldItemRef.current || heldCakeRef.current) return  // already holding something

        const char = characterRef.current
        if (!char) return

        // ── Pick up from oven (highest priority) ──
        if (ovenPhaseRef.current !== 'empty') {
          const odx = char.position.x - OVEN_POS[0]
          const odz = char.position.z - OVEN_POS[2]
          if (Math.sqrt(odx * odx + odz * odz) < OVEN_PICKUP_RADIUS) {
            const burned = ovenPhaseRef.current === 'burned'
            const layers = ovenCakeLayersRef.current.map(l => burned ? { ...l, burned: true } : l)
            // Save elapsed bake time so it resumes if put back in oven; clear on burned cake
            heldCakeCookedSecondsRef.current = burned ? 0 : bakingTimeRef.current
            heldCakeIsBakedRef.current = !burned   // properly baked = went through oven without burning
            heldCakeLayersRef.current = layers
            heldCakeRef.current       = true
            holdingItemRef.current    = true
            setHeldCakeLayers(layers)
            setHeldCake(true)
            ovenPhaseRef.current      = 'empty'
            setOvenPhase('empty')
            bakingTimeRef.current     = 0
            ovenCakeLayersRef.current = []
            return
          }
        }

        // ── Pick up assembled cake from nearest counter zone ──
        {
          let pickZone = -1, pickDist = Infinity
          for (let z = 0; z < COUNTER_ZONE_POS.length; z++) {
            if (cakeZoneLayersRef.current[z].length === 0) continue
            const dx = char.position.x - COUNTER_ZONE_POS[z][0]
            const dz = char.position.z - COUNTER_ZONE_POS[z][2]
            const d  = Math.sqrt(dx * dx + dz * dz)
            if (d < COUNTER_ZONE_RADIUS && d < pickDist) { pickZone = z; pickDist = d }
          }
          if (pickZone >= 0) {
            const layers = [...cakeZoneLayersRef.current[pickZone]]
            heldCakeLayersRef.current        = layers
            heldCakeCookedSecondsRef.current = zoneCookedSecondsRef.current[pickZone]
            heldCakeIsBakedRef.current       = zoneIsBakedRef.current[pickZone]
            zoneIsBakedRef.current[pickZone] = false
            heldCakeRef.current              = true
            holdingItemRef.current           = true
            setHeldCakeLayers(layers)
            setHeldCake(true)
            setCakeZoneLayers(prev => {
              const next: [CakeLayer[], CakeLayer[]] = [prev[0], prev[1]]
              next[pickZone] = []
              return next
            })
            return
          }
        }

        // ── Pick up a cake from the floor ──
        {
          let pickIdx = -1, pickDist = Infinity
          for (let i = 0; i < floorCakesRef.current.length; i++) {
            const fc = floorCakesRef.current[i]
            const dx = char.position.x - fc.pos[0]
            const dz = char.position.z - fc.pos[2]
            const d  = Math.sqrt(dx * dx + dz * dz)
            if (d < PICKUP_RADIUS && d < pickDist) { pickIdx = i; pickDist = d }
          }
          if (pickIdx >= 0) {
            const fc = floorCakesRef.current[pickIdx]
            heldCakeLayersRef.current        = fc.layers
            heldCakeCookedSecondsRef.current = fc.cookedSeconds
            heldCakeIsBakedRef.current       = fc.isBaked
            heldCakeRef.current              = true
            holdingItemRef.current           = true
            setHeldCakeLayers(fc.layers)
            setHeldCake(true)
            setFloorCakes(prev => prev.filter((_, i) => i !== pickIdx))
            return
          }
        }

        const zone    = nearZoneRef.current
        const dropped = nearDroppedItemRef.current

        if (zone) {
          // Pick up a fresh ingredient from the counter.
          holdingItemRef.current = true
          heldItemRef.current    = zone
          setHeldItem(zone)
        } else if (dropped) {
          // Pick up a previously dropped item from the floor / counter.
          holdingItemRef.current = true
          heldItemRef.current    = dropped.ingredientId
          setHeldItem(dropped.ingredientId)
          setDroppedItems(prev => prev.filter(i => i.key !== dropped.key))
          nearDroppedItemRef.current = null
        }
      } else if (e.code === 'KeyL') {
        // ── Drop held cake ──
        if (heldCakeRef.current) {
          holdingItemRef.current = false
          heldCakeRef.current    = false
          setHeldCake(false)

          const char = characterRef.current
          if (!char) return

          // ── Fridge delivery (highest priority) ──
          const fdx = char.position.x - FRIDGE_POS[0]
          const fdz = char.position.z - FRIDGE_POS[2]
          if (Math.sqrt(fdx * fdx + fdz * fdz) < FRIDGE_RADIUS) {
            const layers  = heldCakeLayersRef.current
            const isBaked = heldCakeIsBakedRef.current
            heldCakeLayersRef.current        = []
            heldCakeIsBakedRef.current       = false
            heldCakeCookedSecondsRef.current = 0
            setHeldCakeLayers([])
            const matchIdx = recipesRef.current.findIndex(r => cakeMatchesRecipe(layers, isBaked, r))
            if (matchIdx >= 0) {
              const pts = recipesRef.current[matchIdx].points
              useGameStore.getState().addScore(pts)
              setRecipes(prev => [...prev.filter((_, i) => i !== matchIdx), generateRecipe()])
              setFridgeFlash(prev => ({ type: 'hit', points: pts, id: (prev?.id ?? 0) + 1 }))
            } else {
              setFridgeFlash(prev => ({ type: 'miss', points: 0, id: (prev?.id ?? 0) + 1 }))
            }
            if (fridgeFlashTimerRef.current) clearTimeout(fridgeFlashTimerRef.current)
            fridgeFlashTimerRef.current = setTimeout(() => setFridgeFlash(null), 1500)
            return
          }

          // Check trash — cake can be thrown away
          const tdx = char.position.x - TRASH_BIN_POS[0]
          const tdz = char.position.z - TRASH_BIN_POS[2]
          if (Math.sqrt(tdx * tdx + tdz * tdz) < TRASH_RADIUS) {
            heldCakeLayersRef.current        = []
            heldCakeCookedSecondsRef.current = 0
            heldCakeIsBakedRef.current       = false
            setHeldCakeLayers([])
            return
          }

          const odx = char.position.x - OVEN_POS[0]
          const odz = char.position.z - OVEN_POS[2]
          if (Math.sqrt(odx * odx + odz * odz) < OVEN_PICKUP_RADIUS && ovenPhaseRef.current === 'empty') {
            const isBurned = heldCakeLayersRef.current.some(l => l.burned)
            ovenCakeLayersRef.current  = [...heldCakeLayersRef.current]
            heldCakeLayersRef.current  = []
            heldCakeIsBakedRef.current = false
            setHeldCakeLayers([])
            if (isBurned) {
              // Already burned — skip timer, go straight to fire
              bakingTimeRef.current = BAKE_SECONDS + BURN_SECONDS
              ovenPhaseRef.current  = 'burned'
              setOvenPhase('burned')
            } else {
              // Resume from where baking left off
              bakingTimeRef.current = heldCakeCookedSecondsRef.current
              ovenPhaseRef.current  = bakingTimeRef.current >= BAKE_SECONDS ? 'burning' : 'baking'
              setOvenPhase(ovenPhaseRef.current)
            }
          } else {
            // Find nearest counter zone within range
            let dropZone = -1, dropDist = Infinity
            for (let z = 0; z < COUNTER_ZONE_POS.length; z++) {
              const dx = char.position.x - COUNTER_ZONE_POS[z][0]
              const dz = char.position.z - COUNTER_ZONE_POS[z][2]
              const d  = Math.sqrt(dx * dx + dz * dz)
              if (d < COUNTER_ZONE_RADIUS && d < dropDist) { dropZone = z; dropDist = d }
            }

            const layers = [...heldCakeLayersRef.current]
            heldCakeLayersRef.current = []
            setHeldCakeLayers([])

            if (dropZone >= 0) {
              // ── Place on counter zone ──
              const zoneWasEmpty = cakeZoneLayersRef.current[dropZone].length === 0
              if (zoneWasEmpty) {
                zoneCookedSecondsRef.current[dropZone] = heldCakeCookedSecondsRef.current
                zoneIsBakedRef.current[dropZone]        = heldCakeIsBakedRef.current
              }
              heldCakeCookedSecondsRef.current = 0
              heldCakeIsBakedRef.current       = false
              setCakeZoneLayers(prev => {
                const next: [CakeLayer[], CakeLayer[]] = [prev[0], prev[1]]
                next[dropZone] = [...prev[dropZone], ...layers]
                return next
              })
            } else {
              // ── Drop on the floor ──
              const angle = char.rotation.y
              const floorPos: [number, number, number] = [
                char.position.x + Math.sin(angle) * 0.4,
                0,
                char.position.z + Math.cos(angle) * 0.4,
              ]
              setFloorCakes(prev => [...prev, {
                key: `floor-cake-${Date.now()}`,
                pos: floorPos,
                layers,
                cookedSeconds: heldCakeCookedSecondsRef.current,
                isBaked:       heldCakeIsBakedRef.current,
              }])
              heldCakeCookedSecondsRef.current = 0
              heldCakeIsBakedRef.current       = false
            }
          }
          return
        }

        const item = heldItemRef.current
        if (!item) return

        holdingItemRef.current = false
        heldItemRef.current    = null
        setHeldItem(null)

        const char = characterRef.current
        if (!char) return

        // Check distance to trash bin (XZ only)
        const dx = char.position.x - TRASH_BIN_POS[0]
        const dz = char.position.z - TRASH_BIN_POS[2]
        if (Math.sqrt(dx * dx + dz * dz) < TRASH_RADIUS) {
          // Close enough to the bin — item is disposed, nothing spawned
          return
        }

        // Check distance to counter zones — deposit a cake layer into the nearest one
        {
          let depositZone = -1, depositDist = Infinity
          for (let z = 0; z < COUNTER_ZONE_POS.length; z++) {
            const dx = char.position.x - COUNTER_ZONE_POS[z][0]
            const dz = char.position.z - COUNTER_ZONE_POS[z][2]
            const d  = Math.sqrt(dx * dx + dz * dz)
            if (d < COUNTER_ZONE_RADIUS && d < depositDist) { depositZone = z; depositDist = d }
          }
          if (depositZone >= 0) {
            const zoneLayers = cakeZoneLayersRef.current[depositZone]
            // Burned cake can't accept any ingredients
            if (zoneLayers.some((l: CakeLayer) => l.burned)) return
            // Candles only allowed on a baked cake; non-candle ingredients blocked on baked cake
            if (item === 'candles' && !zoneIsBakedRef.current[depositZone]) return
            if (item !== 'candles' &&  zoneIsBakedRef.current[depositZone]) return
            // First ingredient in this zone → reset that zone's bake/baked state
            if (zoneLayers.length === 0) {
              zoneCookedSecondsRef.current[depositZone] = 0
              zoneIsBakedRef.current[depositZone]       = false
            }
            setCakeZoneLayers(prev => {
              const next: [CakeLayer[], CakeLayer[]] = [prev[0], prev[1]]
              next[depositZone] = [...prev[depositZone], { key: `cake-${item}-${Date.now()}`, ingredientId: item }]
              return next
            })
            return
          }
        }

        // Spawn a physics object at the character's hand position in world space
        const angle = char.rotation.y
        const spawnPos: [number, number, number] = [
          char.position.x + Math.sin(angle) * 0.55,
          char.position.y + 1.1,
          char.position.z + Math.cos(angle) * 0.55,
        ]
        setDroppedItems(prev => [...prev, { key: `${item}-${Date.now()}`, ingredientId: item, spawnPos }])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── Oven-text position debug ────────────────────────────────────────────────
  // Backtick  → toggle debug mode (text always visible, position editable)
  // ArrowLeft / ArrowRight → X ± 0.05
  // ArrowUp / ArrowDown   → Z ± 0.05 (forward / back)
  // Shift + ArrowUp / ArrowDown → Y ± 0.05
  // 0 → log position to console
  const [ovenTextDebug, setOvenTextDebug] = useState(false)
  const [ovenTextPos, setOvenTextPos] = useState<[number, number, number]>(
    [OVEN_POS[0], OVEN_POS[1] + 1.1, OVEN_POS[2]]
  )
  useEffect(() => {
    let active = false
    const STEP = 0.05
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Backquote') { active = !active; setOvenTextDebug(active); return }
      if (!active) return
      if (e.code === 'Digit0') {
        setOvenTextPos(p => { console.log('ovenTextPos:', JSON.stringify(p)); return p })
        return
      }
      e.preventDefault()
      setOvenTextPos(([x, y, z]) => {
        if (e.code === 'ArrowLeft')                       return [x - STEP, y, z]
        if (e.code === 'ArrowRight')                      return [x + STEP, y, z]
        if (e.code === 'ArrowUp'   && e.shiftKey)         return [x, y + STEP, z]
        if (e.code === 'ArrowDown' && e.shiftKey)         return [x, y - STEP, z]
        if (e.code === 'ArrowUp'   && !e.shiftKey)        return [x, y, z - STEP]
        if (e.code === 'ArrowDown' && !e.shiftKey)        return [x, y, z + STEP]
        return [x, y, z]
      })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      {/* ── Lighting ── */}
      <ambientLight intensity={1.0} color="#FFFFFF" />
      <directionalLight position={[5, 12, 8]} intensity={1.4} castShadow shadow-mapSize={[512, 512]} />

      {/* ── Sky ── */}
      <Sky
        distance={400}
        sunPosition={[0.3, 1, 0.5]}
        inclination={0.3}
        azimuth={0.25}
        rayleigh={0.3}
        turbidity={4}
        mieCoefficient={0.002}
        mieDirectionalG={0.8}
      />

      <Physics gravity={config.gravity}>
        {/* ── Physics floor at y = 0 ── */}
        <RigidBody type="fixed" position={[0, -0.05, 0]} colliders={false}>
          <CuboidCollider args={[30, 0.05, 30]} />
        </RigidBody>

        {/* ── White visual floor ── */}
        <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[60, 60]} />
          <meshStandardMaterial color="#F8F8F8" />
        </mesh>

        {/* ── Kitchen environment model (rotated 180° so front faces player) ── */}
        <SceneObjModel
          objUrl={kitchenObjUrl}
          mtlUrl={kitchenMtlUrl}
          position={[0.081, 1.486, -0.183]}
          rotation={[0, 180, 0]}
          scale={[3, 3, 3]}
        />

        {/* ── Ingredient models (decorative — stay on counter) ── */}
        <SceneObjModel
          objUrl={chocolateObjUrl}
          mtlUrl={chocolateMtlUrl}
          position={[2.018, 1.345, -1.704]}
          rotation={[0, 0, 0]}
          scale={[0.5, 0.5, 0.5]}
        />
        <SceneObjModel
          objUrl={strawberriesObjUrl}
          mtlUrl={strawberriesMtlUrl}
          position={[2.032, 1.441, -0.485]}
          rotation={[0, 0, 0]}
          scale={[0.3, 0.3, 0.3]}
        />
        <SceneObjModel
          objUrl={flourObjUrl}
          mtlUrl={flourMtlUrl}
          position={[-2.325, 1.13, 0.59]}
          rotation={[0, 0, 0]}
          scale={[0.3, 0.3, 0.3]}
        />
        <SceneObjModel
          objUrl={candlesObjUrl}
          mtlUrl={candlesMtlUrl}
          position={[0.502, 1.435, 0.244]}
          rotation={[0, 0, 0]}
          scale={[0.3, 0.3, 0.3]}
        />
        <SceneObjModel
          objUrl={trashcanObjUrl}
          mtlUrl={trashcanMtlUrl}
          position={[-2.411, 0.319, -3.684]}
          rotation={[0, 0, 0]}
          scale={[0.5, 0.5, 0.5]}
        />

        {/* ── Furniture colliders ───────────────────────────────────────────────
             Positions are the marker world-positions from kitchen.json with the
             scene-wide 180° Y flip applied (x→-x, z→-z).
             Half-extents match the marker scales set in the scene builder.    */}

        {/* Oven — original marker [0.84, 0.665, -0.459] scale [1.2,1.2,1.2] */}
        <RigidBody type="fixed" position={[-0.84, 0.665, 0.459]} colliders={false}>
          <CuboidCollider args={[0.6, 0.6, 0.6]} />
        </RigidBody>

        {/* Fridge — original marker [-2.041, 1.591, 3.243] scale [1,2.9,1.3] */}
        <RigidBody type="fixed" position={[2.041, 1.591, -3.243]} colliders={false}>
          <CuboidCollider args={[0.5, 1.45, 0.65]} />
        </RigidBody>

        {/* Center counter — original marker [0.472, 0.537, 1.893] scale [1.9,1.2,1.2] */}
        <RigidBody type="fixed" position={[-0.472, 0.537, -1.893]} colliders={false}>
          <CuboidCollider args={[0.95, 0.6, 0.6]} />
        </RigidBody>

        {/* Trashcan — object position [2.411, 0.319, 3.684] scale [0.5,0.5,0.5]
            Model is normalised to 2 units × 0.5 = 1 unit max dim → halfExtents ~0.5 */}
        <RigidBody type="fixed" position={[-2.411, 0.319, -3.684]} colliders={false}>
          <CuboidCollider args={[0.5, 0.5, 0.5]} />
        </RigidBody>

        {/* ── Ingredient colliders (block the player walking through models) ──
             Positioned at mid-height (y = half-extent) so they reach from the
             floor up through the counter surface.                              */}
        {/* Strawberries — on right counter */}
        <RigidBody type="fixed" position={[2.032, 0.72, -0.485]} colliders={false}>
          <CuboidCollider args={[0.3, 0.72, 0.3]} />
        </RigidBody>
        {/* Chocolate — on right counter, near fridge */}
        <RigidBody type="fixed" position={[2.32, 0.67, -1.704]} colliders={false}>
          <CuboidCollider args={[0.3, 0.67, 0.3]} />
        </RigidBody>
        {/* Flour — on left counter. Wider half-extents to fully block the player. */}
        <RigidBody type="fixed" position={[-2.325, 0.57, 0.59]} colliders={false}>
          <CuboidCollider args={[0.6, 0.57, 0.6]} />
        </RigidBody>
        {/* Candles — on small stand / center area */}
        <RigidBody type="fixed" position={[0.502, 0.72, 0.244]} colliders={false}>
          <CuboidCollider args={[0.3, 0.72, 0.3]} />
        </RigidBody>
        {/* Gap filler — between oven right edge and candles left edge (x: -0.24→0.20).
            Blocks the player from slipping through into the counter area from the front. */}
        <RigidBody type="fixed" position={[-0.02, 0.55, 0.05]} colliders={false}>
          <CuboidCollider args={[0.23, 0.55, 0.2]} />
        </RigidBody>
        {/* Gap filler — between candles right edge (x≈0.80) and strawberries left edge (x≈1.73).
            Thin wall (shallow z) so it only blocks counter penetration without eating the corner. */}
        <RigidBody type="fixed" position={[1.27, 0.65, 0.05]} colliders={false}>
          <CuboidCollider args={[0.47, 0.65, 0.15]} />
        </RigidBody>

        {/* ── Player character — held item rendered as child so it follows automatically ── */}
        <Character
          ref={characterRef}
          config={p1Config}
          startPosition={config.player1Start}
          joystickDir={joystickDir}
          jumpRef={jumpRef}
          playerIndex={0}
          holdingItemRef={holdingItemRef}
        >
          {heldItem && <HeldItem ingredient={heldItem} />}
          {heldCake && heldCakeLayers.length > 0 && <HeldCake layers={heldCakeLayers} />}
        </Character>

        {/* ── Dropped items — dynamic physics bodies that fall and collide ──
             linearDamping / angularDamping give natural sliding & rolling.
             The character's kinematic capsule will push them on contact.    */}
        {droppedItems.map(item => (
          <DroppedItemBody
            key={item.key}
            item={item}
            positionTracker={droppedItemPositions}
          />
        ))}
      </Physics>

      {/* ── Interaction prompt — shown above a counter ingredient when nearby ── */}
      {nearZone && INGREDIENT_PROMPT_POS[nearZone] && (
        <Suspense fallback={null}>
          <Billboard position={INGREDIENT_PROMPT_POS[nearZone]} follow lockX={false} lockY={false} lockZ={false}>
            <Text
              fontSize={0.38}
              font="/fonts/PressStart2P-Regular.ttf"
              color="#FFFFFF"
              anchorX="center"
              anchorY="bottom"
              outlineWidth={0.06}
              outlineColor="#111111"
            >
              {kP}
            </Text>
          </Billboard>
        </Suspense>
      )}


      {/* ── Oven prompt (` to toggle debug, arrows=XZ, shift+arrows=Y, 0=log) ── */}
      {(ovenTextDebug || (nearOven && heldCake && ovenPhase === 'empty')) && (
        <Suspense fallback={null}>
          <Billboard position={ovenTextPos} follow lockX={false} lockY={false} lockZ={false}>
            <Text fontSize={0.22} font="/fonts/PressStart2P-Regular.ttf" color={ovenTextDebug ? '#FF8800' : '#FFFFFF'} anchorX="center" anchorY="middle" outlineWidth={0.04} outlineColor="#111111">
              {ovenTextDebug ? `[${ovenTextPos.map(v => v.toFixed(2)).join(', ')}]` : `${kL} to Bake`}
            </Text>
          </Billboard>
        </Suspense>
      )}
      {!ovenTextDebug && nearOven && ovenPhase !== 'empty' && !heldCake && (
        <Suspense fallback={null}>
          <Billboard position={ovenTextPos} follow lockX={false} lockY={false} lockZ={false}>
            <Text fontSize={0.22} font="/fonts/PressStart2P-Regular.ttf" color="#FFFFFF" anchorX="center" anchorY="middle" outlineWidth={0.04} outlineColor="#111111">
              {`${kP} to Take`}
            </Text>
          </Billboard>
        </Suspense>
      )}

      {/* ── Fridge prompt — same position as score flash, above the fridge ── */}
      {nearFridge && heldCake && !fridgeFlash && (
        <Suspense fallback={null}>
          <Billboard position={[FRIDGE_POS[0], FRIDGE_POS[1] + 1.8, FRIDGE_POS[2]]} follow lockX={false} lockY={false} lockZ={false}>
            <Text fontSize={0.22} font="/fonts/PressStart2P-Regular.ttf" color="#FFFFFF" anchorX="center" anchorY="middle" outlineWidth={0.04} outlineColor="#111111" textAlign="center">
              {`${kL} to\ndeliver`}
            </Text>
          </Billboard>
        </Suspense>
      )}

      {/* ── Oven loading bar — billboard facing camera, driven imperatively ── */}
      {(ovenPhase === 'baking' || ovenPhase === 'burning') && (
        <Billboard
          position={[OVEN_POS[0], OVEN_POS[1] + 1.1, OVEN_POS[2]]}
          follow lockX={false} lockY={false} lockZ={false}
        >
          <BakingProgressBar bakingTimeRef={bakingTimeRef} ovenPhaseRef={ovenPhaseRef} />
        </Billboard>
      )}

      {/* ── Fire above oven — only once fully burned ── */}
      {ovenPhase === 'burned' && (
        <group position={[OVEN_POS[0], OVEN_POS[1] + 0.8, OVEN_POS[2]]} scale={[3, 3, 3]}>
          <FireEffect />
        </group>
      )}

      {/* ── Cake layers — flat disks (and candles model) stacked on each counter zone ── */}
      {cakeZoneLayers.map((zoneLayers, zoneIdx) =>
        zoneLayers.map((layer: CakeLayer, i: number) => {
          const zonePos = COUNTER_ZONE_POS[zoneIdx]
          const y = CAKE_TOP_Y + LAYER_THICKNESS / 2 + i * LAYER_THICKNESS
          if (layer.ingredientId === 'candles') {
            return (
              <SceneObjModel
                key={layer.key}
                objUrl={candlesObjUrl}
                mtlUrl={candlesMtlUrl}
                position={[zonePos[0], y, zonePos[2]]}
                rotation={[0, 0, 0]}
                scale={[0.15, 0.15, 0.15]}
              />
            )
          }
          return (
            <mesh key={layer.key} position={[zonePos[0], y, zonePos[2]]}>
              <cylinderGeometry args={[LAYER_RADIUS, LAYER_RADIUS, LAYER_THICKNESS, 32]} />
              <meshStandardMaterial
                color={layer.burned ? '#111111' : (CAKE_LAYER_COLOR[layer.ingredientId] ?? '#888888')}
              />
            </mesh>
          )
        })
      )}

      {/* ── Floor cakes — cakes dropped away from the counter ── */}
      {floorCakes.map(fc =>
        fc.layers.map((layer, i) => {
          const y = LAYER_THICKNESS / 2 + i * LAYER_THICKNESS
          if (layer.ingredientId === 'candles') {
            return (
              <SceneObjModel
                key={layer.key}
                objUrl={candlesObjUrl}
                mtlUrl={candlesMtlUrl}
                position={[fc.pos[0], y, fc.pos[2]]}
                rotation={[0, 0, 0]}
                scale={[0.15, 0.15, 0.15]}
              />
            )
          }
          return (
            <mesh key={layer.key} position={[fc.pos[0], y, fc.pos[2]]}>
              <cylinderGeometry args={[LAYER_RADIUS, LAYER_RADIUS, LAYER_THICKNESS, 32]} />
              <meshStandardMaterial
                color={layer.burned ? '#111111' : (CAKE_LAYER_COLOR[layer.ingredientId] ?? '#888888')}
              />
            </mesh>
          )
        })
      )}

      {/* ── Fridge flash — Three.js fading box + pixel-font score text ── */}
      {fridgeFlash && (
        <FridgeFlashEffect
          key={fridgeFlash.id}
          type={fridgeFlash.type}
          points={fridgeFlash.points}
        />
      )}

      {/* ── Control scheme selection — blocks until player chooses ── */}
      {controlScheme === null && (
        <Html fullscreen zIndexRange={[50, 50]}>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.88)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 40, fontFamily: "'Press Start 2P', monospace", pointerEvents: 'auto',
          }}>
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 4px)',
            }} />
            <p style={{ fontSize: 9, letterSpacing: 4, color: '#3AE880', margin: 0, position: 'relative' }}>
              KITCHEN · CHOOSE CONTROLS
            </p>
            <div style={{ display: 'flex', gap: 24, position: 'relative' }}>
              {/* Keyboard */}
              <button
                onMouseEnter={() => { selectionCursorRef.current = 0; setSelectionCursor(0) }}
                onClick={() => setControlScheme('keyboard')}
                style={{
                  fontFamily: "'Press Start 2P', monospace",
                  background: '#C8B89A', color: '#1A0800',
                  border: selectionCursor === 0 ? '4px solid #FFFFFF' : '4px solid #C8B89A',
                  borderRadius: 4,
                  padding: '24px 32px', cursor: 'pointer', outline: 'none',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
                  minWidth: 200,
                  boxShadow: selectionCursor === 0 ? '0 0 0 2px #fff, 4px 4px 0 #000' : 'none',
                  transform: selectionCursor === 0 ? 'scale(1.05)' : 'none',
                  transition: 'transform 0.08s',
                }}>
                <span style={{ fontSize: 32 }}>⌨</span>
                <span style={{ fontSize: 13, letterSpacing: 2 }}>KEYBOARD</span>
                <div style={{ fontSize: 9, color: '#5A4020', lineHeight: 2.2, textAlign: 'center' }}>
                  <div>P · pick up</div>
                  <div>L · place / bake / deliver</div>
                </div>
              </button>
              {/* Controller */}
              <button
                onMouseEnter={() => { selectionCursorRef.current = 1; setSelectionCursor(1) }}
                onClick={() => setControlScheme('controller')}
                style={{
                  fontFamily: "'Press Start 2P', monospace",
                  background: 'transparent', color: '#FFFFFF',
                  border: selectionCursor === 1 ? '4px solid #FFFFFF' : '4px solid #555555',
                  borderRadius: 4,
                  padding: '24px 32px', cursor: 'pointer', outline: 'none',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
                  minWidth: 200,
                  boxShadow: selectionCursor === 1 ? '0 0 0 2px #fff, 4px 4px 0 #000' : 'none',
                  transform: selectionCursor === 1 ? 'scale(1.05)' : 'none',
                  transition: 'transform 0.08s',
                }}>
                <span style={{ fontSize: 32 }}>🎮</span>
                <span style={{ fontSize: 13, letterSpacing: 2 }}>CONTROLLER</span>
                <div style={{ fontSize: 9, color: '#AAAAAA', lineHeight: 2.2, textAlign: 'center' }}>
                  <div>Y · pick up</div>
                  <div>B · place / bake / deliver</div>
                </div>
              </button>
            </div>
            <p style={{ fontSize: 7, color: 'rgba(255,255,255,0.28)', letterSpacing: 1, margin: 0, position: 'relative' }}>
              ◄ ► / STICK TO SELECT · ENTER TO CONFIRM
            </p>
          </div>
        </Html>
      )}

      {/* ── Recipe panel + timer bar — HTML overlay ── */}
      {timeLeft > 0 && controlScheme !== null && (
        <Html fullscreen zIndexRange={[10, 10]}>
          <style>{`
            @keyframes timerFlash {
              0%, 100% { background: #DD1111; }
              50%       { background: #881111; }
            }
          `}</style>

          {/* Countdown bar — full width, top of screen */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            height: 10, background: 'rgba(0,0,0,0.45)', pointerEvents: 'none',
          }}>
            <div style={{
              height: '100%',
              width: `${(timeLeft / LEVEL2_DURATION_SECONDS) * 100}%`,
              background: timeLeft > 20 ? '#22CC44' : undefined,
              animation: timeLeft <= 20 ? 'timerFlash 0.4s ease infinite' : 'none',
              transition: 'width 1s linear',
            }} />
          </div>

          {/* Countdown text — top centre, just below the bar */}
          <div style={{
            position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 18, fontWeight: 700,
            color: timeLeft <= 20 ? '#FF4444' : '#FFFFFF',
            textShadow: '2px 2px 0 #000000, -1px -1px 0 #000000',
            pointerEvents: 'none', letterSpacing: 2,
          }}>
            {`${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`}
          </div>

          {/* Recipe cards — right side, vertically centred */}
          <div style={{
            position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
            display: 'flex', flexDirection: 'column', gap: 18, pointerEvents: 'none',
          }}>
            {recipes.map(recipe => (
              <div key={recipe.id} style={{
                background: 'rgba(20,20,20,0.85)',
                border: '1.5px solid rgba(255,255,255,0.15)',
                borderRadius: 23, padding: '22px 31px', minWidth: 162,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9,
              }}>
                {recipe.needsCandles && <div style={{ fontSize: 32 }}>🕯️</div>}
                {/* Disk stack — column-reverse so bottom layer is at the bottom visually */}
                <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: 5 }}>
                  {recipe.layers.map((layer, i) => (
                    <div key={i} style={{
                      width: 108, height: 23, borderRadius: 11,
                      background: CAKE_LAYER_COLOR[layer] ?? '#888',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
                    }} />
                  ))}
                </div>
                <div style={{ color: '#FFD700', fontSize: 25, fontWeight: 700, marginTop: 5 }}>
                  {recipe.points} pts
                </div>
              </div>
            ))}
          </div>
        </Html>
      )}

      <KitchenCamera
        lookAt={CAM_LOOK_AT}
        radius={CAM_RADIUS}
        elevation={CAM_ELEVATION}
        azimuth={CAM_AZIMUTH}
      />
      <PixelPostProcessing />
    </>
  )
}
