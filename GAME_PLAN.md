# Plan: Full Game Architecture

## Context
Expand from a single-scene physics demo into a complete multi-level pixel-art 3D game. Covers: screen flow, character selection, buddy AI, save system, level infrastructure, HUD, audio, 2-player input, transitions, and a dev-side asset creation tool.

---

## Screen Flow

```
MAIN_MENU → CHARACTER_SELECT → LOADING → PLAYING → LEVEL_COMPLETE → LOADING → PLAYING
                                                  ↘ GAME_OVER → (restart same level, no menu)
                                          ← PAUSE (overlay, any time during PLAYING)
```

Enum-based router in Zustand store — no external router library.  
Canvas only mounts during PLAYING/LEVEL_COMPLETE (avoids loading Rapier WASM on menus).

---

## Global State — Zustand

**Add:** `zustand ^4.5`

```typescript
// src/store/useGameStore.ts
type Screen = 'MAIN_MENU' | 'CHARACTER_SELECT' | 'LOADING' | 'PLAYING' | 'PAUSED' | 'LEVEL_COMPLETE' | 'GAME_OVER'

interface GameStore {
  screen: Screen
  levelIndex: number
  score: number
  bestScores: Record<string, number>   // levelId → score (persisted)
  unlockedLevels: number[]             // (persisted)
  player1CharacterId: string
  player2CharacterId: string | null    // null = single player
  buddyEnabled: boolean
  isTwoPlayer: boolean
  // Actions
  setScreen / startLevel / addScore / completeLevel / setCharacter / loadSave / writeSave
}
```

Physics loop uses `useGameStore.getState()` (non-reactive) — never `useGameStore(selector)` inside `useFrame`.

---

## Level System

```typescript
// src/levels/levelRegistry.ts
type CompletionCondition =
  | { type: 'reach_point';    position: [n,n,n]; radius: number }
  | { type: 'collect_items';  required: number; itemTag: string }
  | { type: 'score_target';   target: number }
  | { type: 'tutorial_steps'; steps: string[] }

interface LevelConfig {
  id: string; index: number; name: string; sceneKey: string
  player1Start / player2Start / buddyStart: [n,n,n]
  gravity: [n,n,n]; completion: CompletionCondition
  tutorialMessages?: string[]
  bgmTrack?: string
}
```

```typescript
// src/levels/sceneMap.ts  — stable top-level lazy refs only (not inline in JSX)
export const SCENE_MAP = {
  JapanScene: lazy(() => import('../scene/JapanScene')),
}
```

```typescript
// src/game/LevelRunner.tsx
// key={levelIndex} forces Physics remount between levels
// Suspense fallback = null (Canvas); LoadingScreen shown via HTML overlay
<Suspense fallback={null}>
  <SceneComponent key={levelIndex} config={currentConfig} ... />
</Suspense>
```

JapanScene Level 1 = current scene + `completion: { type: 'tutorial_steps', steps: ['move','jump','reach_shrine'] }` + a `useFrame` check that calls `completeLevel()` when each step is satisfied.

---

## Character System

```typescript
// src/character/characterRegistry.ts
interface CharacterConfig {
  id: string; name: string
  bodyColor: string; skinColor: string; hairColor: string
}
export const CHARACTERS: CharacterConfig[] = [
  { id: 'aoi',  name: 'Aoi',  bodyColor: '#4A7AC8', ... },
  { id: 'hana', name: 'Hana', bodyColor: '#C84A7A', ... },
  // more added as game grows
]
```

`Character.tsx` accepts `config: CharacterConfig` prop — removes PALETTE hardcoding.

**Buddy AI** (`src/character/useBuddyAI.ts`):
- Same Rapier KCC pattern as `useCharacterControls`
- Each frame: if `dist(buddy, player) > FOLLOW_DIST` → move toward player at 80% speed
- If `dist > 15` → teleport to player (unstuck fallback)
- Drives same walk animation via `movingRef`
- No pathfinding; direct chase is sufficient for open levels

---

## Save System

```typescript
// src/save/saveSchema.ts
interface SaveData {
  version: 1
  unlockedLevels: number[]
  bestScores: Record<string, number>
  player1CharacterId: string
  lastPlayedLevelIndex: number
}
// Audio volume stored separately under 'pixel-game-audio'
```

`src/save/saveManager.ts` — thin localStorage wrapper.  
`writeSave()` called on level complete and character select confirm.  
`loadSave()` called once on app mount.

---

## HUD Layer

HTML overlay (`position: absolute; inset: 0; pointer-events: none`) sibling to Canvas.  
All data from Zustand store — no prop drilling from 3D scene.  
Score increments on discrete events only → direct store subscription is fine (no throttle needed).

```
src/hud/
  HUD.tsx               ← container; renders all sub-components
  ScoreDisplay.tsx
  LevelNameBanner.tsx   ← fade-in on level start
  TutorialPrompt.tsx    ← sequential tutorial step text
  ControlsHint.tsx      ← existing hint text moved here
  PauseMenu.tsx         ← overlay; resume / settings / quit to menu
```

Mobile joystick + jump button move into HUD.  
Input refs (`joystickDir`, `jumpRef`) kept as mutable refs passed via a non-reactive ref-context.

---

## Audio — Howler.js

**Add:** `howler ^2.2`, `@types/howler`

```typescript
// src/audio/AudioManager.ts  — plain module singleton, not a React component
// BGM: one Howl per level, lazy-loaded by levelId
// SFX: single Howl with sprite map { jump, land, collect, complete, step }
// Called from: store actions, useCharacterControls, LevelRunner
// iOS unlock: call Howler.ctx.resume() on the "Start" button click
```

`src/audio/useAudioSettings.ts` — small hook for settings UI (master/music/sfx volume sliders).  
Volume persisted to `localStorage['pixel-game-audio']`, separate from save data.

---

## Two-Player Input

```typescript
// src/hooks/usePlayerInput.ts  — replaces useKeyboard.ts
// Player 0: WASD + Arrows + Space  (keyboard fallback)
// Player 1: IJKL + Numpad + N      (keyboard fallback)
// Primary 2P input: two gamepads — player N reads navigator.getGamepads()[N]
// useKeyboard.ts becomes: export const useKeyboard = () => usePlayerInput(0)
```

`useCharacterControls` gains `playerIndex: 0 | 1` param.  
Gamepad: player N reads `navigator.getGamepads()[N]` — two controllers are the primary 2P experience; keyboard bindings are the fallback when only one controller is available.

2P camera: `ThirdPersonCamera` gains optional `target2` prop.  
In 2P mode, tracks midpoint of both characters; zoom widens with player separation.

---

## Transitions & Loading Screen

`src/screens/LoadingScreen.tsx`:
- Shows while Suspense resolves next scene chunk
- Fake progress bar: animates 0→90% over 1.5s, snaps to 100% on scene mount
- CSS fade-in/out (300ms) driven by `screen === 'LOADING'` store value
- Displays target level name from store's pending `levelIndex`

---

## Pause Menu

**Missing from user's original list — needs to be added.**

`screen: 'PAUSED'` in store. Triggered by Escape key or gamepad Start button.  
`PauseMenu.tsx` rendered inside HUD when paused:
- Resume / Settings / Quit to Main Menu
- Physics continues ticking but character input is gated (check `screen !== 'PAUSED'` at top of `useCharacterControls`)

---

## Settings Screen

**Missing from user's original list — needs to be added.**

Accessible from Pause Menu and Main Menu.  
Contains: Master volume / Music volume / SFX volume sliders; control hints display.  
No control remapping in v1 (add later).

---

## Asset Creation Dev Tool (CLI, not in-game)

```
scripts/gen-asset/
  index.mjs          — CLI: --image ./ref.png --description "..."
  imageAnalysis.mjs  — sharp: extract dominant colors + bounding dims
  promptToConfig.mjs — Anthropic SDK: image+desc → JSON part list
  exportComponent.mjs — writes .tsx component (box/cylinder/sphere + toon + StaticBody)
```

Output matches existing scene object pattern exactly (same as Shrine.tsx / CherryTree.tsx).  
**Dev deps only** (not in game bundle): `sharp`, `@anthropic-ai/sdk`.

---

## Implementation Order

1. Zustand store (screen + levelIndex skeleton)
2. Screen router in App.tsx + placeholder screens
3. Level system (registry, sceneMap, LevelRunner) + JapanScene as Level 1
4. Save system
5. Character registry + CharacterSelect screen + Character config prop
6. HUD layer (move existing hint; add score; wire store)
7. Audio (Howler + AudioManager)
8. Buddy AI
9. 2-player input refactor
10. Pause menu + Settings
11. Loading screen polish + transitions
12. Asset creation CLI script

---

## New Files

```
src/store/useGameStore.ts
src/levels/levelRegistry.ts
src/levels/sceneMap.ts
src/game/LevelRunner.tsx
src/screens/MainMenu.tsx
src/screens/CharacterSelect.tsx
src/screens/LevelComplete.tsx
src/screens/LoadingScreen.tsx
src/character/characterRegistry.ts
src/character/useBuddyAI.ts
src/hud/HUD.tsx + ScoreDisplay + LevelNameBanner + TutorialPrompt + ControlsHint + PauseMenu
src/hooks/usePlayerInput.ts
src/audio/AudioManager.ts + useAudioSettings.ts
src/save/saveSchema.ts + saveManager.ts
scripts/gen-asset/index.mjs + imageAnalysis.mjs + promptToConfig.mjs + exportComponent.mjs
```

## Modified Files

```
src/App.tsx                           — screen router + HUD mount + conditional Canvas
src/scene/JapanScene.tsx              — LevelConfig prop + tutorial completion check
src/character/Character.tsx           — CharacterConfig prop; remove PALETTE hardcoding
src/character/useCharacterControls.ts — playerIndex; gamepad scoping; pause gate
src/camera/ThirdPersonCamera.tsx      — optional target2 for 2P midpoint
src/hooks/useKeyboard.ts              — re-export of usePlayerInput(0)
```

## Libraries to Add

```
zustand ^4.5
howler ^2.2  +  @types/howler   (devDep)
```

---

## Upcoming Levels


### Level 3 — Overcooked (Birthday Cake Edition)
**Concept:** Top-down kitchen. Players pick up ingredients, chop at a chopping board, cook at an oven, then plate and deliver based on a scrolling queue of birthday cake orders.
- **Stations:** ingredient shelf → chopping board → oven/mixer → plating counter → delivery hatch.
- **Orders:** different cake types (chocolate, strawberry, rainbow) each need different ingredient combos. Queue fills over time; expired orders = penalty.
- **Win condition:** deliver at least X cakes before time runs out.
- **2P:** split the kitchen — one chops, one cooks, must coordinate. Each player can only carry one item at a time.
- **Fail:** too many expired orders OR time runs out with fewer than X deliveries.

### Level 4 — The Pub
**Concept:** A cosy pixel pub with two mini-games played back-to-back (or head-to-head in 2P).
1. **Beer tap:** rapid A-button tap challenge — tap in rhythm to fill a pint glass cleanly. Too slow = flat beer; too fast = overflow.
2. **Darts:** aim and throw with timed button presses. Score closest to 301 across 3 rounds (simplified).
- **2P:** head-to-head on both mini-games; winner of each earns a point. Best of 2 wins the level.
- **Solo:** beat a score threshold on each mini-game to pass.


### Level 5 — The Hidden Cave and walk
**Concept:** Hike up a mountain. Player has an energy bar that depletes while walking; must collect Chocopina snacks along the trail to replenish it.
- **Hidden cave challenge:** the cave entrance is not visible from the main path. Scattered environmental hints (footprints, a torn map piece, a peculiar rock formation) guide the player. Wrong paths waste energy.
- **Inside the cave:** dark interior; player must navigate to the far exit. Possible challenge: avoid bats/falling rocks, find a torch pickup to see further, or solve a simple block-pushing puzzle to open the exit.
- **Completion:** exit the cave from the far side.
- **Fail:** energy hits 0 on the mountain, or player is trapped in the cave too long.

### Level 6 — The Long Walk (Final Level)
**Concept:** A peaceful, emotional finale. Players simply walk together up a long hill. No fail state, no combat.
- The hill and sunset scenery directly reproduce the pixel-art background image used on the main menu (`background1.png`) — players feel they are walking *into* the title screen.
- The walk is long; ambient music swells gradually.
- At the hilltop, the camera pulls back to a wide shot of the sunset. A short end-card message appears.
- **Completion:** reach the top of the hill.
- **2P:** both players must arrive. The faster one can sit and wait, triggering a cute idle animation.

---

## Confirmed Design Decisions

- **Characters**: cosmetic only — same rig, different colors/names. `CharacterConfig` needs only color fields + name.
- **Buddy**: player actively chooses their buddy on the character select screen (pick main + pick buddy separately). Buddy is an AI follower with the chosen character's config.
- **Fail state**: levels can be failed. On GAME_OVER the player restarts the same level from the beginning (not back to main menu). Falling off map = `position.y < -5` triggers fail. Store action `retryLevel()` resets score and re-mounts the scene via a key increment.
- **2P vs buddy**: single-player = player + AI buddy. Two-player = two humans, no AI buddy. These are mutually exclusive modes selected before entering a level.
