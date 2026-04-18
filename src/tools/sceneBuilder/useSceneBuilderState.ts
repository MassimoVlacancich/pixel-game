import { useState, useRef, useCallback, useEffect } from 'react'
import * as THREE from 'three'
import { ASSET_GROUPS } from './allAssets'

// Build a flat path → { url, mtlUrl } map for re-resolving URLs after restore
const _urlByPath: Record<string, { url: string; mtlUrl?: string }> = {}
for (const entries of Object.values(ASSET_GROUPS)) {
  for (const e of entries) {
    _urlByPath[e.path] = { url: e.url, mtlUrl: e.mtlUrl }
  }
}

export interface PlacedObject {
  id: string
  assetPath: string     // stable key (glob path)
  assetUrl: string      // resolved URL for loader (runtime, excluded from saves)
  assetMtlUrl?: string  // companion MTL URL (runtime, excluded from saves)
  assetLabel: string    // human name
  name: string          // user-editable
  position: [number, number, number]
  rotation: [number, number, number]  // Euler in degrees (X, Y, Z)
  scale: [number, number, number]
  autoCollider?: boolean  // if true, export includes a paired __collider:box
  painted?: boolean       // placed via paint brush — hidden from scene list
}

// ── Camera config (saved into scene JSON) ────────────────────────────────────

export interface CameraConfig {
  lookAt:    [number, number, number]
  radius:    number
  elevation: number   // radians
  azimuth:   number   // radians
}

export const DEFAULT_CAMERA_CONFIG: CameraConfig = {
  lookAt:    [0, 0.5, 0],
  radius:    12,
  elevation: 0.6,
  azimuth:   0,
}

// ── Scene ambient lighting ────────────────────────────────────────────────────

export interface SceneAmbient {
  ambientColor:          string   // hex e.g. "#FFFFFF"
  ambientIntensity:      number   // 0–3
  hemisphereEnabled:     boolean
  skyColor:              string
  groundColor:           string
  hemisphereIntensity:   number   // 0–2
  directionalEnabled:    boolean
  directionalColor:      string
  directionalIntensity:  number   // 0–3
  directionalPosition:   [number, number, number]
  bgColor:               string   // scene background / sky color
}

export const DEFAULT_AMBIENT: SceneAmbient = {
  ambientColor:          '#FFFFFF',
  ambientIntensity:      1.0,
  hemisphereEnabled:     false,
  skyColor:              '#AACCFF',
  groundColor:           '#88AA88',
  hemisphereIntensity:   0.5,
  directionalEnabled:    true,
  directionalColor:      '#FFFFFF',
  directionalIntensity:  1.2,
  directionalPosition:   [6, 10, 4],
  bgColor:               '#87CEEB',
}

// ── Scene lights ─────────────────────────────────────────────────────────────

export interface SceneLight {
  id:        string
  name:      string
  position:  [number, number, number]
  color:     string    // hex e.g. "#FFD9A0"
  intensity: number    // 0–20
  distance:  number    // 0 = infinite falloff, >0 = cutoff radius
}

// ── Dynamic interaction zones ─────────────────────────────────────────────────

const ZONE_COLORS = ['#FFAA00', '#FF44AA', '#44FFAA', '#AA44FF', '#FF4444', '#44AAFF', '#FFFF00']

let zoneColorIdx = 0

export interface SceneZone {
  id:       string                          // e.g. "zone_1"
  name:     string                          // user-editable label
  position: [number, number, number]
  scale:    [number, number, number]        // half-extents (matches PickupZone convention)
  color:    string                          // auto-assigned
}

// ── Terrain system ────────────────────────────────────────────────────────────

export interface TerrainData {
  id:       string
  name:     string
  type:     'ground' | 'river'
  position: [number, number, number]
  width:    number           // world units
  depth:    number           // world units
  segsX:    number           // subdivisions
  segsZ:    number           // subdivisions
  heights:  number[]         // (segsX+1)*(segsZ+1) Y-offsets; flat for rivers
  color:    string           // hex e.g. "#6B8F4A"
}

// Separate live ref map — keys are terrain IDs, values are THREE.Mesh (not Group)
export type TerrainLiveRefs = Map<string, THREE.Mesh>

// ── Predefined markers (kitchen-specific, kept for backwards compat) ──────────

export const MARKERS = [
  { id: 'player1_start', label: 'P1 Start', color: '#00FF88' },
  { id: 'player2_start', label: 'P2 Start', color: '#FF88CC' },
] as const

export type MarkerId = typeof MARKERS[number]['id']
export type MarkerPositions = Record<MarkerId, [number, number, number]>
export type MarkerScales    = Record<MarkerId, [number, number, number]>

const DEFAULT_MARKER_POSITIONS: MarkerPositions = {
  player1_start: [-1, 0, -4],
  player2_start: [1, 0, -4],
}

const DEFAULT_MARKER_SCALES: MarkerScales = {
  player1_start: [1, 1, 1],
  player2_start: [1, 1, 1],
}

export interface SceneData {
  sceneName:    string
  objects:      Omit<PlacedObject, 'assetUrl' | 'assetMtlUrl'>[]
  markers:      MarkerPositions
  markerScales?: MarkerScales
  camera?:      CameraConfig
  zones?:       SceneZone[]
  lights?:      SceneLight[]
  ambient?:     SceneAmbient
  terrains?:    TerrainData[]
}

// Refs to the live Three.js groups — NOT serializable, kept outside state
export type LiveRefs = Map<string, THREE.Group>

// ── Undo history ──────────────────────────────────────────────────────────────

interface SceneSnapshot {
  objects:      Omit<PlacedObject, 'assetUrl' | 'assetMtlUrl'>[]
  zones:        SceneZone[]
  lights:       SceneLight[]
  terrains:     TerrainData[]
  markers:      MarkerPositions
  markerScales: MarkerScales
}

const MAX_HISTORY = 50

let nextId = 1

function loadFromStorage(sceneName: string): SceneData | null {
  try {
    const raw = localStorage.getItem(`scene-builder:${sceneName}`)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveToStorage(data: SceneData) {
  try {
    localStorage.setItem(`scene-builder:${data.sceneName}`, JSON.stringify(data))
  } catch { /* quota */ }
}

export function useSceneBuilderState(initialSceneName: string) {
  const [sceneName, setSceneName] = useState(initialSceneName)
  const [objects, setObjects] = useState<PlacedObject[]>([])
  const [markers, setMarkers] = useState<MarkerPositions>({ ...DEFAULT_MARKER_POSITIONS })
  const [markerScales, setMarkerScales] = useState<MarkerScales>({ ...DEFAULT_MARKER_SCALES })
  const [camera, setCamera] = useState<CameraConfig>({ ...DEFAULT_CAMERA_CONFIG })
  const [zones, setZones] = useState<SceneZone[]>([])
  const [lights, setLights] = useState<SceneLight[]>([])
  const [ambient, setAmbient] = useState<SceneAmbient>({ ...DEFAULT_AMBIENT })
  const [terrains, setTerrains] = useState<TerrainData[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Guards auto-save: stays false until applyData has run at least once, so the
  // initial empty state is never written to localStorage before the scene loads.
  const [isSceneLoaded, setIsSceneLoaded] = useState(false)

  // Live Three.js group refs indexed by object id
  const liveRefs = useRef<LiveRefs>(new Map())

  // Live Three.js mesh refs indexed by terrain id
  const terrainLiveRefs = useRef<TerrainLiveRefs>(new Map())

  // Undo history — stack of snapshots taken BEFORE each user action
  const historyRef = useRef<SceneSnapshot[]>([])

  // Load scene data into state (shared between file-fetch and localStorage restore)
  const applyData = useCallback((data: SceneData) => {
    // Advance nextId past all IDs in the loaded scene to prevent collisions
    const allIds = [
      ...data.objects.map(o => o.id),
      ...(data.zones ?? []).map(z => z.id),
      ...(data.lights ?? []).map(l => l.id),
      ...(data.terrains ?? []).map(t => t.id),
    ]
    const maxNum = allIds.reduce((max, id) => {
      const n = parseInt(id.replace(/[^0-9]/g, ''), 10)
      return isNaN(n) ? max : Math.max(max, n)
    }, 0)
    if (maxNum >= nextId) nextId = maxNum + 1

    setObjects(data.objects.map(o => {
      const resolved = _urlByPath[o.assetPath]
      return {
        ...o,
        // Migrate older scenes: default autoCollider to true when it was never
        // explicitly set (undefined). Objects where it was deliberately turned
        // off (false) keep that value.
        autoCollider: o.autoCollider ?? true,
        assetUrl: resolved?.url ?? '',
        assetMtlUrl: resolved?.mtlUrl,
      }
    }))
    setMarkers({ ...DEFAULT_MARKER_POSITIONS, ...data.markers })
    setMarkerScales({ ...DEFAULT_MARKER_SCALES, ...(data.markerScales ?? {}) })
    setCamera(data.camera ?? { ...DEFAULT_CAMERA_CONFIG })
    setZones(data.zones ?? [])
    setLights(data.lights ?? [])
    setAmbient(data.ambient ?? { ...DEFAULT_AMBIENT })
    setTerrains(data.terrains ?? [])
    setSelectedId(null)
    setIsSceneLoaded(true)
  }, [setIsSceneLoaded])

  // Load on mount / scene name change.
  // Priority: localStorage (always current — written by every Ctrl+S) →
  //           /scenes/{name}.json (baseline for first load / fresh installs)
  useEffect(() => {
    let cancelled = false

    // localStorage first — it always reflects the latest manual save, including
    // painted objects and any other edits that may not have reached the JSON file
    // (e.g. cancelled picker, download fallback to wrong location).
    const savedLocally = loadFromStorage(sceneName)
    if (savedLocally) {
      applyData(savedLocally)
      return
    }

    // Nothing in localStorage yet — fall back to the static JSON file.
    fetch(`/scenes/${sceneName}.json`, { cache: 'no-store' })
      .then(r => r.ok ? (r.json() as Promise<SceneData>) : Promise.reject())
      .then(data => { if (!cancelled) applyData(data) })
      .catch(() => { if (!cancelled) setSelectedId(null) })

    return () => { cancelled = true }
  }, [sceneName, applyData])

  const save = useCallback(() => {
    const data: SceneData = {
      sceneName,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      objects: objects.map(({ assetUrl: _u, assetMtlUrl: _m, ...rest }) => rest),
      markers,
      markerScales,
      camera,
      zones,
      lights,
      ambient,
      terrains,
    }
    saveToStorage(data)
  }, [sceneName, objects, markers, markerScales, camera, zones, lights, ambient, terrains])

  // Auto-save to localStorage whenever the scene changes so that a page reload
  // always restores the full scene (including painted objects) without needing
  // a manual Ctrl+S first.
  // Guard: only runs after applyData has fired at least once so the initial
  // empty React state is never written to localStorage before the scene loads.
  useEffect(() => {
    if (!isSceneLoaded) return
    saveToStorage({
      sceneName,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      objects: objects.map(({ assetUrl: _u, assetMtlUrl: _m, ...rest }) => rest),
      markers,
      markerScales,
      camera,
      zones,
      lights,
      ambient,
      terrains,
    })
  }, [isSceneLoaded, sceneName, objects, markers, markerScales, camera, zones, lights, ambient, terrains])

  const spawnObject = useCallback((assetPath: string, assetUrl: string, assetLabel: string, assetMtlUrl?: string, overrides?: Partial<PlacedObject>) => {
    const id = `obj_${nextId++}`
    const newObj: PlacedObject = {
      id,
      assetPath,
      assetUrl,
      assetMtlUrl,
      assetLabel,
      name: assetLabel,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      autoCollider: true,   // on by default so every placed object gets a physics box
      ...overrides,
    }
    setObjects(prev => [...prev, newObj])
    setSelectedId(id)
    return id
  }, [])

  const removeObject = useCallback((id: string) => {
    liveRefs.current.delete(id)
    setObjects(prev => prev.filter(o => o.id !== id))
    setSelectedId(prev => prev === id ? null : prev)
  }, [])

  const updateObject = useCallback((id: string, patch: Partial<PlacedObject>) => {
    setObjects(prev => prev.map(o => o.id === id ? { ...o, ...patch } : o))
  }, [])

  const syncFromLiveRef = useCallback((id: string) => {
    const group = liveRefs.current.get(id)
    if (!group) return
    const r = group.rotation
    setObjects(prev => prev.map(o => o.id === id ? {
      ...o,
      position: [+group.position.x.toFixed(3), +group.position.y.toFixed(3), +group.position.z.toFixed(3)],
      rotation: [+(r.x * THREE.MathUtils.RAD2DEG).toFixed(1), +(r.y * THREE.MathUtils.RAD2DEG).toFixed(1), +(r.z * THREE.MathUtils.RAD2DEG).toFixed(1)],
      scale: [+group.scale.x.toFixed(3), +group.scale.y.toFixed(3), +group.scale.z.toFixed(3)],
    } : o))
  }, [])

  const updateMarker = useCallback((id: MarkerId, pos: [number, number, number]) => {
    setMarkers(prev => ({ ...prev, [id]: pos }))
  }, [])

  const updateMarkerScale = useCallback((id: MarkerId, scale: [number, number, number]) => {
    setMarkerScales(prev => ({ ...prev, [id]: scale }))
  }, [])

  // ── Camera ────────────────────────────────────────────────────────────────

  const updateCamera = useCallback((config: CameraConfig) => {
    setCamera(config)
  }, [])

  // ── Zones ─────────────────────────────────────────────────────────────────

  const addZone = useCallback((): string => {
    const id = `zone_${nextId++}`
    const color = ZONE_COLORS[zoneColorIdx % ZONE_COLORS.length]
    zoneColorIdx++
    const name = `Zone ${zoneColorIdx}`
    const newZone: SceneZone = {
      id,
      name,
      position: [0, 0.5, 0],
      scale:    [1, 1, 1],
      color,
    }
    setZones(prev => [...prev, newZone])
    setSelectedId(`zone:${id}`)
    return id
  }, [])

  const removeZone = useCallback((id: string) => {
    liveRefs.current.delete(`zone:${id}`)
    setZones(prev => prev.filter(z => z.id !== id))
    setSelectedId(prev => prev === `zone:${id}` ? null : prev)
  }, [])

  const updateZone = useCallback((id: string, patch: Partial<SceneZone>) => {
    setZones(prev => prev.map(z => z.id === id ? { ...z, ...patch } : z))
  }, [])

  const syncZoneFromLiveRef = useCallback((id: string) => {
    const group = liveRefs.current.get(`zone:${id}`)
    if (!group) return
    setZones(prev => prev.map(z => z.id === id ? {
      ...z,
      position: [+group.position.x.toFixed(3), +group.position.y.toFixed(3), +group.position.z.toFixed(3)],
      scale:    [+group.scale.x.toFixed(3), +group.scale.y.toFixed(3), +group.scale.z.toFixed(3)],
    } : z))
  }, [])

  // ── Lights ────────────────────────────────────────────────────────────────

  const addLight = useCallback((): string => {
    const id = `light_${nextId++}`
    const newLight: SceneLight = {
      id,
      name:      `Light ${id}`,
      position:  [0, 2, 0],
      color:     '#FFD9A0',
      intensity: 3,
      distance:  8,
    }
    setLights(prev => [...prev, newLight])
    setSelectedId(`light:${id}`)
    return id
  }, [])

  const removeLight = useCallback((id: string) => {
    liveRefs.current.delete(`light:${id}`)
    setLights(prev => prev.filter(l => l.id !== id))
    setSelectedId(prev => prev === `light:${id}` ? null : prev)
  }, [])

  const updateLight = useCallback((id: string, patch: Partial<SceneLight>) => {
    setLights(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l))
  }, [])

  const syncLightFromLiveRef = useCallback((id: string) => {
    const group = liveRefs.current.get(`light:${id}`)
    if (!group) return
    setLights(prev => prev.map(l => l.id === id ? {
      ...l,
      position: [+group.position.x.toFixed(3), +group.position.y.toFixed(3), +group.position.z.toFixed(3)],
    } : l))
  }, [])

  const updateAmbient = useCallback((patch: Partial<SceneAmbient>) => {
    setAmbient(prev => ({ ...prev, ...patch }))
  }, [])

  const syncSunFromLiveRef = useCallback(() => {
    const group = liveRefs.current.get('sun')
    if (!group) return
    setAmbient(prev => ({
      ...prev,
      directionalPosition: [+group.position.x.toFixed(3), +group.position.y.toFixed(3), +group.position.z.toFixed(3)],
    }))
  }, [])

  // ── Terrains ──────────────────────────────────────────────────────────────

  const addTerrain = useCallback((type: 'ground' | 'river'): string => {
    const id = `terrain_${nextId++}`
    const segsX = 60
    const segsZ = 60
    const vertCount = (segsX + 1) * (segsZ + 1)
    const newTerrain: TerrainData = {
      id,
      name:     type === 'ground' ? `Ground ${id}` : `River ${id}`,
      type,
      position: [0, 0, 0],
      width:    20,
      depth:    20,
      segsX,
      segsZ,
      heights:  new Array(vertCount).fill(0),
      color:    type === 'ground' ? '#6B8F4A' : '#3A7BD5',
    }
    setTerrains(prev => [...prev, newTerrain])
    setSelectedId(`terrain:${id}`)
    return id
  }, [])

  const removeTerrain = useCallback((id: string) => {
    terrainLiveRefs.current.delete(id)
    setTerrains(prev => prev.filter(t => t.id !== id))
    setSelectedId(prev => prev === `terrain:${id}` ? null : prev)
  }, [])

  const updateTerrain = useCallback((id: string, patch: Partial<TerrainData>) => {
    setTerrains(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
  }, [])

  const updateTerrainHeights = useCallback((id: string, heights: number[]) => {
    setTerrains(prev => prev.map(t => t.id === id ? { ...t, heights } : t))
  }, [])

  // ── Clear ─────────────────────────────────────────────────────────────────

  const clearScene = useCallback(() => {
    liveRefs.current.clear()
    terrainLiveRefs.current.clear()
    setObjects([])
    setZones([])
    setLights([])
    setTerrains([])
    setAmbient({ ...DEFAULT_AMBIENT })
    setMarkers({ ...DEFAULT_MARKER_POSITIONS })
    setMarkerScales({ ...DEFAULT_MARKER_SCALES })
    setCamera({ ...DEFAULT_CAMERA_CONFIG })
    setSelectedId(null)
    zoneColorIdx = 0
  }, [])

  // ── Undo ──────────────────────────────────────────────────────────────────

  /** Call this BEFORE a user action to save a restore point. */
  const pushHistory = useCallback(() => {
    const snapshot: SceneSnapshot = {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      objects:      objects.map(({ assetUrl: _u, assetMtlUrl: _m, ...rest }) => ({ ...rest })),
      zones:        zones.map(z => ({ ...z })),
      lights:       lights.map(l => ({ ...l })),
      terrains:     terrains.map(t => ({ ...t, heights: [...t.heights] })),
      markers:      { ...markers },
      markerScales: { ...markerScales },
    }
    historyRef.current.push(snapshot)
    if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift()
  }, [objects, zones, lights, terrains, markers, markerScales])

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return
    const snap = historyRef.current.pop()!

    setObjects(snap.objects.map(o => {
      const resolved = _urlByPath[o.assetPath]
      return { ...o, autoCollider: o.autoCollider ?? true, assetUrl: resolved?.url ?? '', assetMtlUrl: resolved?.mtlUrl }
    }))
    setZones(snap.zones)
    setLights(snap.lights)
    setTerrains(snap.terrains.map(t => ({ ...t, heights: [...t.heights] })))
    setMarkers(snap.markers)
    setMarkerScales(snap.markerScales)
    setSelectedId(null)

    // Imperatively restore terrain geometry in live refs (sculpt bypass React)
    for (const t of snap.terrains) {
      const mesh = terrainLiveRefs.current.get(t.id)
      if (!mesh) continue
      const pos = mesh.geometry.attributes.position.array as Float32Array
      for (let i = 0; i < t.heights.length; i++) pos[i * 3 + 1] = t.heights[i]
      mesh.geometry.attributes.position.needsUpdate = true
      mesh.geometry.computeVertexNormals()
    }
  }, [terrainLiveRefs])

  // ── Export ────────────────────────────────────────────────────────────────

  const exportJSON = useCallback((): string => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const baseObjects = objects.map(({ assetUrl: _u, assetMtlUrl: _m, ...rest }) => rest)

    // Append auto-collider entries for objects that have autoCollider=true
    const autoColliders = objects
      .filter(o => o.autoCollider)
      .map(o => ({
        id:         `collider_auto_${o.id}`,
        assetPath:  '__collider:box',
        assetLabel: 'auto-collider',
        name:       `collider_${o.name}`,
        position:   o.position,
        rotation:   o.rotation,
        scale:      o.scale,
      }))

    const data: SceneData = {
      sceneName,
      objects: [...baseObjects, ...autoColliders],
      markers,
      markerScales,
      camera,
      zones,
      lights,
      ambient,
      terrains,
    }
    return JSON.stringify(data, null, 2)
  }, [sceneName, objects, markers, markerScales, camera, zones, lights, ambient, terrains])

  return {
    sceneName, setSceneName,
    objects, markers, markerScales, camera, zones, lights, ambient, terrains,
    selectedId, setSelectedId,
    liveRefs,
    terrainLiveRefs,
    spawnObject, removeObject, updateObject, syncFromLiveRef,
    updateMarker, updateMarkerScale,
    updateCamera,
    addZone, removeZone, updateZone, syncZoneFromLiveRef,
    addLight, removeLight, updateLight, syncLightFromLiveRef,
    updateAmbient, syncSunFromLiveRef,
    addTerrain, removeTerrain, updateTerrain, updateTerrainHeights,
    clearScene,
    pushHistory, undo,
    save, exportJSON, applyData,
  }
}
