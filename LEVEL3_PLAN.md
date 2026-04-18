# Plan: Level 3 — The Pub

## Context
Adding "The Pub" as Level 3 (index 3) of the pixel game. Inside-room pub scene with bar counter, stools, beer taps, and a dartboard. The primary mechanic is a 2-player (or player + AI buddy) darts mini-game following proper 301 rules. Players alternate turns; the AI/buddy plays visibly through the same aiming animation with random coordinates.

This level also drives two improvements to the scene builder tool:
1. **Camera positioning + preview mode** — camera params saved into scene JSON, preview button shows the in-game view from the builder.
2. **Interaction zone markers** — placeable boxes that define where mini-game triggers go; F key logs a complete JSON snapshot of camera + markers + objects to the console for copy-paste back.

---

## Part 1 — Scene Builder Enhancements

### 1a. Camera saved in SceneData

**File: `src/tools/sceneBuilder/useSceneBuilderState.ts`**

Add `camera` field to `SceneData`:
```typescript
export interface CameraConfig {
  lookAt:    [number, number, number]
  radius:    number
  elevation: number   // radians
  azimuth:   number   // radians
}

export interface SceneData {
  sceneName:    string
  objects:      Omit<PlacedObject, 'assetUrl'>[]
  markers:      MarkerPositions
  markerScales?: MarkerScales
  camera?:      CameraConfig    // ← new
}
```

Add `camera` state and `updateCamera` action to the hook. Default value (free orbit, no stored camera):
```typescript
const DEFAULT_CAMERA: CameraConfig = { lookAt: [0, 0.5, 0], radius: 10, elevation: 0.6, azimuth: 0 }
```

On `save` / `exportJSON`: include `camera` in the serialised data.
On load from localStorage: restore `camera` field if present.

### 1b. F key — log full scene snapshot

**File: `src/tools/sceneBuilder/SceneBuilder.tsx`**

When `F` is pressed (not in an input), compute the current OrbitControls camera state → update stored `camera` → log the full JSON snapshot to the console.

The computation (given Three.js camera position and orbit target):
```typescript
const target = orbitRef.current.target        // THREE.Vector3 = lookAt
const pos    = cameraRef.current.position     // THREE.PerspectiveCamera
const dx = pos.x - target.x
const dy = pos.y - target.y
const dz = pos.z - target.z
const radius    = Math.sqrt(dx*dx + dy*dy + dz*dz)
const elevation = Math.asin(dy / radius)
const azimuth   = Math.atan2(dx, -dz)
const cam: CameraConfig = {
  lookAt:    [+target.x.toFixed(3), +target.y.toFixed(3), +target.z.toFixed(3)],
  radius:    +radius.toFixed(3),
  elevation: +elevation.toFixed(4),
  azimuth:   +azimuth.toFixed(4),
}
updateCamera(cam)       // persist into state
console.log('=== SCENE SNAPSHOT ===')
console.log(JSON.stringify({ camera: cam, markers, objects: exportObjects() }, null, 2))
```

> The user can orbit to the desired in-game view, press F, then copy the logged JSON straight into a prompt to get exact hardcoded values.

Pass `cameraRef` down to `BuilderCanvas`. In `BuilderCanvas`:
```tsx
const cameraRef = useRef<THREE.PerspectiveCamera>(null)
// ...
<Canvas ... >
  <PerspectiveCamera ref={cameraRef} makeDefault ... />
```

### 1c. Preview mode

**File: `src/tools/sceneBuilder/SceneBuilder.tsx`**

Add `previewMode` boolean state + toolbar button ("PREVIEW / P key").

Pass `previewMode` and stored `camera` into `BuilderCanvas`. In `BuilderCanvas`:

```tsx
{previewMode
  ? <PerspectiveCamera
      makeDefault
      position={camPosFromConfig(camera)}   // spherical → cartesian
      fov={50}
      onUpdate={self => self.lookAt(...camera.lookAt)}
    />
  : <OrbitControls ref={orbitRef} makeDefault />
}
```

Where:
```typescript
function camPosFromConfig(c: CameraConfig): [number, number, number] {
  return [
    c.lookAt[0] + Math.sin(c.azimuth) * c.radius * Math.cos(c.elevation),
    c.lookAt[1] + c.radius * Math.sin(c.elevation),
    c.lookAt[2] - Math.cos(c.azimuth) * c.radius * Math.cos(c.elevation),
  ]
}
```

When `previewMode` is on: TransformControls and grid are hidden (builder is view-only). Toolbar shows a highlighted "PREVIEW" badge. P key or button toggles back to edit mode.

### 1d. Dynamic interaction zones

Zones are free-form, user-named boxes. The user creates them on demand with any label (e.g. "Dartboard", "Shuffleboard", "Exit"), positions and scales them to cover the desired area, and they are stored in the scene JSON. Scenes can read them by name to configure `PickupZone` sensors — or ignore them entirely. No predefined zone IDs.

**`useSceneBuilderState.ts`** — add:
```typescript
export interface SceneZone {
  id:       string                          // auto-generated e.g. "zone_1"
  name:     string                          // user-editable label
  position: [number, number, number]
  scale:    [number, number, number]        // half-extents (same convention as PickupZone)
  color:    string                          // auto-assigned from a fixed palette
}

// In SceneData:
zones?: SceneZone[]

// New actions:
addZone():    string            // returns new zone id
removeZone(id: string): void
updateZone(id: string, patch: Partial<SceneZone>): void
```

**`BuilderCanvas.tsx`** — render zones the same way as existing markers: translucent coloured wireframe box + `Text` label floating above. Zones are selectable / moveable / scaleable via TransformControls just like objects.

**`SceneBuilder.tsx`** — add an "ADD ZONE" button (or `Z` key shortcut) in the toolbar. Spawns a new zone at origin with a default name ("Zone N"). The user then selects it, renames it in the inspector, and moves/scales it into position.

**`InspectorPanel.tsx`** — when a zone is selected, show a name text input (editable) and numeric fields for position/scale.

**Scene reading in PubScene** — look up zones by name:
```typescript
const dartboardZone = pubData.zones?.find(z => z.name === 'Dartboard')
// dartboardZone.position + dartboardZone.scale → passed to PickupZone
// If the user named their zone differently in the builder, update this string.
// No fallback — if no zone is found, the interaction simply doesn't activate.
```

This is fully decoupled: the builder doesn't know what the scene will do with zones; the scene doesn't rely on hardcoded IDs.

### 1e. Modified files (scene builder)

| File | Change |
|---|---|
| `src/tools/sceneBuilder/useSceneBuilderState.ts` | Add `CameraConfig` type; `camera` field to `SceneData`; `updateCamera` action; `SceneZone` type; `zones` array; `addZone`/`removeZone`/`updateZone` actions |
| `src/tools/sceneBuilder/SceneBuilder.tsx` | F key → compute + save camera + console log; P key / preview button; Z key → add zone; pass `cameraRef`, `previewMode`, `camera` to BuilderCanvas |
| `src/tools/sceneBuilder/BuilderCanvas.tsx` | Accept `previewMode: boolean` + `camera: CameraConfig`; conditional camera/orbit; `cameraRef` for F-key reads; render zones with wireframe boxes |
| `src/tools/sceneBuilder/ExportPanel.tsx` | No changes needed — exportJSON already serialises full SceneData |
| `src/tools/sceneBuilder/InspectorPanel.tsx` | Camera params display; zone name text input + position/scale fields when zone selected |

---

## Part 2 — PubScene

### 2a. Level registry entry

**File: `src/levels/levelRegistry.ts`**

```typescript
export const PUB_SCORE_TARGET = 301   // standard 301 game: score from 301 down to 0

LEVELS[3] = {
  id:            'pub_darts',
  index:          3,
  name:          'The Pub',
  sceneKey:      'PubScene',
  player1Start:  [0, 0.95, 0],      // overridden at runtime from pub.json markers
  player2Start:  [1.2, 0.95, 0],
  buddyStart:    [-1.2, 0.95, 0],
  gravity:       [0, -35, 0],
  completion:    { type: 'score_target', target: PUB_SCORE_TARGET },
  fail:          { type: 'none' },
  winTitle:      'Last Orders!',
  winSubtitle:   'Bullseye!',
}
```

**File: `src/levels/sceneMap.ts`**

```typescript
PubScene: lazy(() => import('../scene/PubScene')),
```

### 2b. PubScene.tsx structure

**NOT a copy of KitchenScene.** The pub scene is substantially simpler initially. Key differences:

- **Static camera**: read `camera` params from `pub.json` (set via scene builder + F key), not hardcoded. If `pub.json` has no camera field yet, fall back to reasonable defaults.
- **No item pickup system**: the only interaction is approaching the dartboard.
- **No per-frame recipe logic**: completion happens via the darts score tracked in the store.
- **Player start positions**: read from `pub.json` markers `player1_start` / `player2_start`.

```typescript
// pub.json shape (output from scene builder)
interface PubSceneData {
  sceneName: string
  objects:   PlacedObject[]
  markers:   Record<PubMarkerId, [number,number,number]>
  markerScales: Record<PubMarkerId, [number,number,number]>
  camera?:   CameraConfig
}
```

**PubScene internals:**
```typescript
// Proximity state
const nearDartboardRef = useRef(false)
const [nearDartboard, setNearDartboard] = useState(false)
const dartsOpenRef = useRef(false)
const gameEndedRef = useRef(false)

// Y-key / gamepad button 3 — opens darts game
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    if (e.code === 'KeyY' && nearDartboardRef.current && !dartsOpenRef.current) {
      dartsOpenRef.current = true
      window.__openDartsGame?.()
    }
  }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}, [])

// Gamepad button 3 (Y) — polled in useFrame with edge detection
useFrame(() => {
  const gp = navigator.getGamepads()[0]
  const yPressed = gp?.buttons[3]?.pressed ?? false
  if (yPressed && !yWasPressed.current && nearDartboardRef.current && !dartsOpenRef.current) {
    dartsOpenRef.current = true
    window.__openDartsGame?.()
  }
  yWasPressed.current = yPressed

  // Completion check
  if (!gameEndedRef.current && useGameStore.getState().score >= PUB_SCORE_TARGET) {
    gameEndedRef.current = true
    completeLevel('pub_darts')
  }
})
```

**JSX:**
```tsx
<Physics gravity={config.gravity}>
  {/* Floor */}
  <RigidBody type="fixed"><CuboidCollider args={[30, 0.05, 30]} /></RigidBody>
  <mesh rotation={[-Math.PI/2, 0, 0]}>
    <planeGeometry args={[16, 16]} />
    <meshToonMaterial color="#6B4A1A" gradientMap={toonGradient} />
  </mesh>

  {/* Visual assets from scene builder */}
  {pubData.objects
    .filter(o => !o.assetPath.startsWith('__collider:'))
    .map(o => <SceneObjModel key={o.id} {...resolveUrls(o)} />)
  }

  {/* Physics colliders from scene builder */}
  <SceneColliders objects={pubData.objects} />

  {/* Dartboard interaction zone — position + size from named zone in pub.json */}
  {dartboardZone && (
    <PickupZone
      id="dartboard"
      position={dartboardZone.position}
      halfExtents={dartboardZone.scale}
      onEnter={() => { nearDartboardRef.current = true; setNearDartboard(true) }}
      onExit={()  => { nearDartboardRef.current = false; setNearDartboard(false) }}
    />
  )}

  {/* Characters */}
  <Character ref={char1Ref} config={p1Config} startPosition={pubData.markers.player1_start} playerIndex={0} ... />
  {/* buddy or player 2 */}
</Physics>

<KitchenCamera
  lookAt={pubData.camera?.lookAt ?? [0, 0.5, 0]}
  radius={pubData.camera?.radius ?? 10}
  elevation={pubData.camera?.elevation ?? 0.6}
  azimuth={pubData.camera?.azimuth ?? 0}
/>
<PixelPostProcessing />
```

**Asset URL resolution** — `pub.json` has stable glob paths. At build time, import each pub asset with `?url`:
```typescript
import barObjUrl  from '../assets/low-poly/pub/bar/model.obj?url'
import barMtlUrl  from '../assets/low-poly/pub/bar/materials.mtl?url'
// etc.

const PUB_ASSET_URLS: Record<string, { objUrl: string; mtlUrl?: string }> = {
  '../../assets/low-poly/pub/bar/model.obj': { objUrl: barObjUrl, mtlUrl: barMtlUrl },
  // ... one entry per pub asset added during scene builder session
}
```

---

## Part 3 — HUD Additions

### 3a. InteractionPrompt.tsx (new, reusable)

```typescript
// src/hud/InteractionPrompt.tsx
interface Props { visible: boolean; message: string }
```

Pixel-art styled prompt: golden border, bottom-center, blinking, `pointerEvents: 'none'`.

### 3b. HUD.tsx changes

Add for pub level (`isPubLevel = level?.sceneKey === 'PubScene'`):

```typescript
const [dartsPromptVisible, setDartsPromptVisible] = useState(false)
const [dartsOpen, setDartsOpen] = useState(false)

useEffect(() => {
  if (!isPubLevel) return
  window.__showDartsPrompt = () => setDartsPromptVisible(true)
  window.__hideDartsPrompt = () => setDartsPromptVisible(false)
  window.__openDartsGame   = () => { dartsOpenRef.current = true; setDartsOpen(true) }
  return () => {
    delete window.__showDartsPrompt; delete window.__hideDartsPrompt; delete window.__openDartsGame
  }
}, [isPubLevel])
```

Mount in JSX (inside `isPlaying` block):
```tsx
{isPubLevel && <InteractionPrompt visible={dartsPromptVisible && !dartsOpen} message="Press Y to play darts" />}
{isPubLevel && dartsOpen && <DartsMinigame onClose={() => setDartsOpen(false)} />}
```

The `onEnter`/`onExit` in PubScene call `window.__showDartsPrompt` / `window.__hideDartsPrompt` directly (same `window.__` pattern as `TutorialPrompt`).

---

## Part 4 — DartsMinigame (301 rules, alternating turns)

### 4a. 301 rules

- Both players start at **301**
- Each **turn** = **3 throws**
- After each throw: score = dart score subtracted from running total
- **Win**: first player to reach exactly **0** (simplified: reach ≤ 0)
- **Bust**: if a throw would bring the score below 0, that throw scores 0 and turn ends (optional for v1)
- **Alternating turns**: Player → AI/P2 → Player → ...

### 4b. Component state

```typescript
type DartsPhase = 'aim-x' | 'aim-y' | 'thrown' | 'between-turns'

interface PlayerState { score: number; name: string; isAI: boolean }

const [phase, setPhase] = useState<DartsPhase>('aim-x')
const [currentPlayer, setCurrentPlayer] = useState(0)     // 0 = human, 1 = AI/P2
const [throwsThisTurn, setThrowsThisTurn] = useState(0)   // 0..2
const [players, setPlayers] = useState<PlayerState[]>([
  { score: 301, name: 'YOU',   isAI: false },
  { score: 301, name: 'BUDDY', isAI: true  },
])
const [cursorX, setCursorX] = useState(0.5)
const [cursorY, setCursorY] = useState(0.5)
const [lockedX, setLockedX] = useState<number | null>(null)
const [throwHistory, setThrowHistory] = useState<{x:number;y:number;score:number;player:number}[]>([])
const [throwCount, setThrowCount] = useState(0)  // global, for speed scaling
```

### 4c. AI turn

When `currentPlayer === 1` (AI) and phase becomes `aim-x`, start an AI throw sequence:

```typescript
useEffect(() => {
  if (!players[currentPlayer].isAI) return
  // Delay slightly so the player can see the cursor before it "locks"
  const targetX = 0.3 + Math.random() * 0.4   // random, biased toward centre
  const targetY = 0.3 + Math.random() * 0.4
  const aimDuration = 800 + Math.random() * 600   // ms before "locking"

  // Animate cursor toward targetX while sweeping, then lock
  // Use the same RAF animation loop as human — cursor moves at normal speed
  // After aimDuration, set lockedX = targetX, advance to aim-y
  // After another aimDuration, lock Y, throw
  // This makes the AI feel like it's "playing" rather than instant
}, [currentPlayer, phase])
```

The AI cursor shows a red sweep line (human = yellow). A "BUDDY THROWING…" label replaces the "A — LOCK" instruction.

### 4d. Animation loop

`requestAnimationFrame` (not `useFrame` — this is DOM):
- `aim-x`: `cursorX = 0.5 + 0.5 * Math.sin(t * speed)`
- `aim-y`: `cursorY = 0.5 + 0.5 * Math.sin(t * speed)`
- Speed: `1.0 + throwCount * 0.2` (escalates over the game)

For AI: same sweep animation runs, then an `endAIThrow()` fires after the delay (the cursor appears to autonomously lock).

### 4e. Scoring

Standard dartboard layout (single ring only for v1):

```typescript
const SEGMENTS = [20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5]

function calcScore(x: number, y: number): number {
  const dx = x - 0.5, dy = y - 0.5
  const dist = Math.sqrt(dx*dx + dy*dy)
  if (dist < 0.04) return 50          // bullseye
  if (dist < 0.09) return 25          // inner bull
  if (dist < 0.22) {
    const angle = (Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2)
    return SEGMENTS[Math.floor((angle / (Math.PI * 2)) * 20)]
  }
  return 0                            // miss
}
```

After each throw: update player's score, append to `throwHistory`.

### 4f. Turn progression

```
throw 1 of 3 → throw 2 of 3 → throw 3 of 3
  → if player wins: trigger completeLevel(), call onClose()
  → else: show "between-turns" phase ("BUDDY'S TURN" / "YOUR TURN" for 2s)
    → switch currentPlayer, reset throwsThisTurn, advance to aim-x for next player
```

### 4g. SVG rendering

Full-screen overlay (`zIndex: 60`, dark background + scanlines).

SVG board (`viewBox="0 0 100 100"`, `imageRendering: pixelated`):
- Outer miss ring
- 20-sector scoring ring (alternating dark/light tones, sector numbers as SVG text)
- Inner bull (green circle, r=9)
- Bullseye (red circle, r=4)
- Cursor lines: yellow (human), red (AI)
- Dart marks: current player's darts as coloured dots; previous darts as grey dots
- Shaft line above each dart mark (decorative)

Scoreboard panel beside the board:
```
YOU      BUDDY
 241      289
[throw 1] [---]
[throw 2]
```

Phase instruction:
- `aim-x` + human: `"A — LOCK X"`
- `aim-x` + AI: `"BUDDY THROWING..."`
- `between-turns`: countdown / player name flash

Input: Space/Enter/gamepad-A → confirm. Escape/B → exit at any time.

### 4h. Global score

`addScore(dart)` is called after each throw so the HUD `ScoreDisplay` shows the running total. Completion check is in PubScene's `useFrame` (not in DartsMinigame) to keep mini-game decoupled from the store.

---

## New Files

```
src/scene/PubScene.tsx
src/hud/InteractionPrompt.tsx
src/hud/DartsMinigame.tsx
src/assets/scenes/pub.json          (generated via scene builder)
src/assets/low-poly/pub/            (new assets — created by user in 3D tool)
```

## Modified Files

```
src/tools/sceneBuilder/useSceneBuilderState.ts   — CameraConfig type, camera state, PUB_MARKERS, markerSet param
src/tools/sceneBuilder/SceneBuilder.tsx          — F key, P key preview, Z key add-zone, pass camera/previewMode to canvas
src/tools/sceneBuilder/BuilderCanvas.tsx         — cameraRef, conditional preview camera vs OrbitControls
src/tools/sceneBuilder/InspectorPanel.tsx        — camera params read-only display when nothing selected
src/levels/levelRegistry.ts                      — add pub entry index 3
src/levels/sceneMap.ts                           — add PubScene lazy import
src/hud/HUD.tsx                                  — InteractionPrompt + DartsMinigame mounts for pub level
```

---

## Implementation Order

### Step 1 — Scene builder camera + preview (standalone, no pub scene needed)
1. Add `CameraConfig` to `SceneData` in `useSceneBuilderState.ts`
2. Add `updateCamera` action
3. Add `cameraRef` to `BuilderCanvas`, `PUB_MARKERS`, `previewMode` prop
4. Add F key (compute + log + save camera) and P key (toggle preview) to `SceneBuilder.tsx`
5. Test: orbit to a good view, press F, check console log contains camera JSON

### Step 2 — Build pub assets + scene layout
6. Create pub 3D assets and drop into `src/assets/low-poly/pub/`
7. Open `?tool=scene-builder&scene=pub` — place furniture, add `__collider:box` entries
8. Position the `dartboard_zone` marker over the dartboard
9. Orbit to desired in-game view, press F → note the camera JSON
10. Ctrl+S to save, Download JSON → save as `src/assets/scenes/pub.json`

### Step 3 — PubScene routing
11. Add pub config to `levelRegistry.ts` (update `player1Start` from JSON once step 9 done)
12. Add `PubScene` to `sceneMap.ts`
13. Stub `PubScene.tsx` — floor + camera from JSON + character — just enough to load

### Step 4 — Full pub scene
14. Import `pub.json`, load `SceneObjModel` + `SceneColliders`
15. Add coded room geometry (walls/ceiling toon boxes) if not covered by OBJ assets
16. Tune camera by opening builder → tweaking → F → pasting into JSON

### Step 5 — Interaction zone
17. Wire `PickupZone` at `pubData.markers.dartboard_zone` with `pubData.markerScales.dartboard_zone`
18. Create `InteractionPrompt.tsx`
19. Add `window.__` bridges to `HUD.tsx`, mount `InteractionPrompt`
20. Test: walk near dartboard → prompt shows → walk away → prompt hides

### Step 6 — Darts mini-game
21. Create `DartsMinigame.tsx` — human turn first (single player, 3 throws, SVG board)
22. Add scoreboard and throw history display
23. Add AI turn logic (random coordinates, animated sweep, visual labelling)
24. Wire `window.__openDartsGame` bridge in `HUD.tsx`
25. Add Y-key + gamepad handler in `PubScene.tsx`
26. Test full alternating-turns loop, score countdown, win condition

### Step 7 — Polish
27. Accumulate all thrown dart marks on the board (per player, different colours)
28. Speed escalation with each global throw
29. `between-turns` phase with player name flash and 2s delay
30. Bust rule: throw that would go below 0 scores 0, ends turn
31. Optional: double-out (must finish on a double) — v2

---

## Key Reference Files

- [src/tools/sceneBuilder/useSceneBuilderState.ts](src/tools/sceneBuilder/useSceneBuilderState.ts) — primary file for scene builder state changes
- [src/tools/sceneBuilder/BuilderCanvas.tsx](src/tools/sceneBuilder/BuilderCanvas.tsx) — add cameraRef + preview mode camera
- [src/tools/sceneBuilder/SceneBuilder.tsx](src/tools/sceneBuilder/SceneBuilder.tsx) — F/P key handlers
- [src/scene/KitchenScene.tsx](src/scene/KitchenScene.tsx) — reference only for OBJ asset loading + useFrame patterns
- [src/camera/KitchenCamera.tsx](src/camera/KitchenCamera.tsx) — reused directly in PubScene (no new camera file)
- [src/scene/PickupZone.tsx](src/scene/PickupZone.tsx) — used as-is for dartboard sensor zone
- [src/hud/HUD.tsx](src/hud/HUD.tsx) — add pub-specific overlay mounts + window.__ bridge setup
- [src/levels/levelRegistry.ts](src/levels/levelRegistry.ts) — `score_target` completion type already exists

---

## Verification

1. Scene builder → orbit to a view → press F → console shows camera JSON with correct spherical params
2. Press P → preview mode locks camera to stored params, orbit is disabled
3. Open `?scene=pub` → pub furniture placed via builder → Ctrl+S → Download JSON
4. Level 4 selectable from level select → pub scene loads correctly
5. Camera matches the JSON-stored params (inside-room perspective)
6. Character walks around, collides with bar/furniture
7. Walk to dartboard → "Press Y to play darts" prompt appears
8. Press Y → DartsMinigame overlay opens
9. Human aim-x sweep → press A → aim-y sweep → press A → dart mark on SVG board
10. After 3 throws → "BUDDY'S TURN" → AI cursor sweeps and locks automatically
11. Score counts down from 301 for both players
12. First to reach 0 → level complete screen appears
13. Press Escape at any point → exits mini-game, back to walking
