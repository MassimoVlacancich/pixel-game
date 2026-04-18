import { useState, useCallback, useEffect, useRef } from 'react'
import * as THREE from 'three'
import BuilderCanvas from './BuilderCanvas'
import type { CameraStateHandle } from './BuilderCanvas'
import AssetPanel from './AssetPanel'
import InspectorPanel from './InspectorPanel'
import ExportPanel from './ExportPanel'
import { useSceneBuilderState } from './useSceneBuilderState'
import type { AssetEntry } from './allAssets'
import type { PlacedObject, CameraConfig } from './useSceneBuilderState'

const FONT = "'Press Start 2P', monospace"

type TransformMode = 'translate' | 'rotate' | 'scale'

function getSceneParam(): string {
  const params = new URLSearchParams(window.location.search)
  return params.get('scene') ?? 'mountain'
}

export default function SceneBuilder() {
  const [transformMode, setTransformMode] = useState<TransformMode>('translate')
  const [showGrid, setShowGrid] = useState(true)
  const [playerRefPos, setPlayerRefPos] = useState<[number, number, number]>([2, 0, 0])
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const [previewMode, setPreviewMode] = useState(false)

  // Paint mode state
  const [paintMode, setPaintMode] = useState(false)
  const [brushRadius, setBrushRadius] = useState(5)
  const [sculpting, setSculpting] = useState<'raise' | 'drop' | null>(null)
  const [paintAsset, setPaintAsset] = useState<AssetEntry | null>(null)
  const [paintErase, setPaintErase] = useState(false)
  const [cameraLock, setCameraLock] = useState(false)
  // Paint brush settings (shown in inspector while in paint mode)
  const [paintScale, setPaintScale] = useState(1.0)
  const [paintRotationRandom, setPaintRotationRandom] = useState(true)
  const [paintBaseY, setPaintBaseY] = useState(0)

  const cameraReaderRef = useRef<CameraStateHandle | null>(null)
  // File System Access API handle — acquired on first save, reused after that
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fileHandleRef = useRef<any>(null)

  const {
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
  } = useSceneBuilderState(getSceneParam())

  // Save to the source JSON file via File System Access API (Chrome/Edge).
  // First call opens a picker pre-named after the scene; the handle is reused
  // for all subsequent saves so no picker appears again.
  // Falls back to a plain browser download when the API is unavailable.
  // Also always writes to localStorage as a cache.
  const handleFileSave = useCallback(async () => {
    save() // localStorage cache
    const json = exportJSON()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (window as any).showSaveFilePicker === 'function') {
      try {
        if (!fileHandleRef.current) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          fileHandleRef.current = await (window as any).showSaveFilePicker({
            suggestedName: `${sceneName}.json`,
            types: [{ description: 'Scene JSON', accept: { 'application/json': ['.json'] } }],
          })
        }
        const writable = await fileHandleRef.current.createWritable()
        await writable.write(json)
        await writable.close()
      } catch {
        // User cancelled picker — localStorage save already done above
      }
    } else {
      // Fallback: trigger a download
      const blob = new Blob([json], { type: 'application/json' })
      const url  = URL.createObjectURL(blob)
      const a    = Object.assign(document.createElement('a'), { href: url, download: `${sceneName}.json` })
      a.click()
      URL.revokeObjectURL(url)
    }
  }, [save, exportJSON, sceneName])

  // Load a scene JSON file via the File System Access API (or a hidden <input>).
  const handleFileLoad = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (window as any).showOpenFilePicker === 'function') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const [handle] = await (window as any).showOpenFilePicker({
          types: [{ description: 'Scene JSON', accept: { 'application/json': ['.json'] } }],
          multiple: false,
        })
        const file = await handle.getFile()
        const text = await file.text()
        applyData(JSON.parse(text))
        // Also reset the save handle so next Ctrl+S re-prompts for this file
        fileHandleRef.current = handle
      } catch {
        // cancelled
      }
    } else {
      // Fallback: hidden file input
      const input = Object.assign(document.createElement('input'), {
        type: 'file', accept: '.json',
      })
      input.onchange = async () => {
        const file = input.files?.[0]
        if (!file) return
        const text = await file.text()
        applyData(JSON.parse(text))
      }
      input.click()
    }
  }, [applyData])

  // Stable ref so the keyboard handler always calls the latest version
  const handleFileSaveRef = useRef(handleFileSave)
  handleFileSaveRef.current = handleFileSave

  // Keep stable refs so keyboard/drag handlers always call the latest version
  // without needing them in every useCallback dependency array.
  const pushHistoryRef = useRef(pushHistory)
  pushHistoryRef.current = pushHistory
  const undoRef = useRef(undo)
  undoRef.current = undo

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return

      if (e.code === 'KeyT') { setTransformMode('translate'); return }
      if (e.code === 'KeyR') { setTransformMode('rotate'); return }
      if (e.code === 'KeyS') { setTransformMode('scale'); return }
      if (e.code === 'KeyG') { setShowGrid(v => !v); return }
      if (e.code === 'KeyP') { setPreviewMode(v => !v); return }
      if (e.code === 'KeyM') {
        setPaintMode(v => {
          if (v) { setSculpting(null); setPaintAsset(null); setCameraLock(false) }
          return !v
        })
        return
      }

      if (e.code === 'KeyC' && paintMode) { setCameraLock(v => !v); return }

      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); undoRef.current(); return }

      if (e.code === 'KeyZ' && !e.ctrlKey && !e.metaKey) { pushHistoryRef.current(); addZone(); return }
      if (e.code === 'KeyL' && !e.ctrlKey && !e.metaKey) { pushHistoryRef.current(); addLight(); return }

      // F key — snapshot camera state + log everything
      if (e.code === 'KeyF') {
        const state = cameraReaderRef.current?.getState()
        if (state) {
          const { position, target } = state
          const dx = position.x - target.x
          const dy = position.y - target.y
          const dz = position.z - target.z
          const radius    = Math.sqrt(dx * dx + dy * dy + dz * dz)
          const elevation = Math.asin(Math.min(1, Math.max(-1, dy / radius)))
          const azimuth   = Math.atan2(dx, -dz)
          const cam: CameraConfig = {
            lookAt:    [+target.x.toFixed(3), +target.y.toFixed(3), +target.z.toFixed(3)],
            radius:    +radius.toFixed(3),
            elevation: +elevation.toFixed(4),
            azimuth:   +azimuth.toFixed(4),
          }
          updateCamera(cam)
          const snapshot = {
            camera: cam,
            markers,
            zones,
            lights,
            objects: objects.map(({ assetUrl: _u, assetMtlUrl: _m, ...rest }) => rest),
          }
          console.log('=== SCENE SNAPSHOT (camera saved) ===')
          console.log(JSON.stringify(snapshot, null, 2))
        }
        return
      }

      if ((e.code === 'Delete' || e.code === 'Backspace') && selectedId) {
        pushHistoryRef.current()
        if (selectedId.startsWith('zone:'))    { removeZone(selectedId.replace('zone:', '')); return }
        if (selectedId.startsWith('light:'))   { removeLight(selectedId.replace('light:', '')); return }
        if (selectedId.startsWith('terrain:')) { removeTerrain(selectedId.replace('terrain:', '')); return }
        if (!selectedId.startsWith('marker:') && selectedId !== 'player_ref' && selectedId !== 'sun') removeObject(selectedId)
      }

      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') {
        e.preventDefault()
        handleFileSaveRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, removeObject, removeZone, addZone, addLight, removeLight, removeTerrain, save, updateCamera, markers, zones, lights, objects])

  const [dropPendingAsset, setDropPendingAsset] = useState<import('./allAssets').AssetEntry | null>(null)

  const handleSpawn = useCallback((entry: import('./allAssets').AssetEntry) => {
    if (paintMode) {
      // In paint mode, clicking an asset sets it as the stamp asset, doesn't spawn
      setPaintAsset(entry)
      setSculpting(null)
      setPaintErase(false)
      return
    }
    // Outside paint mode: enter drop-at-cursor mode instead of spawning at origin
    setDropPendingAsset(entry)
  }, [paintMode])

  const handleDropPlace = useCallback((pos: [number, number, number]) => {
    if (!dropPendingAsset) return
    pushHistoryRef.current()
    const id = spawnObject(dropPendingAsset.path, dropPendingAsset.url, dropPendingAsset.label, dropPendingAsset.mtlUrl, {
      position: pos,
    })
    setSelectedId(id ?? null)
    setDropPendingAsset(null)
  }, [dropPendingAsset, spawnObject, setSelectedId])

  // Called when TC drag ends — read final transform from live ref into state
  const handleDragEnd = useCallback(() => {
    if (!selectedId) return
    pushHistoryRef.current()
    if (selectedId === 'player_ref') {
      const ref = liveRefs.current.get('player_ref')
      if (ref) setPlayerRefPos([+ref.position.x.toFixed(3), +ref.position.y.toFixed(3), +ref.position.z.toFixed(3)])
    } else if (selectedId.startsWith('marker:')) {
      const markerId = selectedId.replace('marker:', '')
      const ref = liveRefs.current.get(selectedId)
      if (ref) {
        const p = ref.position
        const s = ref.scale
        updateMarker(markerId as keyof typeof markers, [+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3)])
        updateMarkerScale(markerId as keyof typeof markerScales, [+s.x.toFixed(3), +s.y.toFixed(3), +s.z.toFixed(3)])
      }
    } else if (selectedId.startsWith('zone:')) {
      syncZoneFromLiveRef(selectedId.replace('zone:', ''))
    } else if (selectedId.startsWith('light:')) {
      syncLightFromLiveRef(selectedId.replace('light:', ''))
    } else if (selectedId === 'sun') {
      syncSunFromLiveRef()
    } else {
      syncFromLiveRef(selectedId)
    }
  }, [selectedId, liveRefs, syncFromLiveRef, syncZoneFromLiveRef, syncLightFromLiveRef, updateMarker, updateMarkerScale, markers, markerScales])

  // Apply inspector edits imperatively to the live ref
  const handleApplyToRef = useCallback((id: string, patch: Partial<PlacedObject>) => {
    const ref = liveRefs.current.get(id)
    if (!ref) return
    if (patch.position) ref.position.set(...patch.position)
    if (patch.rotation) ref.rotation.set(
      patch.rotation[0] * THREE.MathUtils.DEG2RAD,
      patch.rotation[1] * THREE.MathUtils.DEG2RAD,
      patch.rotation[2] * THREE.MathUtils.DEG2RAD,
    )
    if (patch.scale) ref.scale.set(...patch.scale)
  }, [liveRefs])

  const handleUpdatePlayerRefPos = useCallback((pos: [number, number, number]) => {
    setPlayerRefPos(pos)
    const ref = liveRefs.current.get('player_ref')
    if (ref) ref.position.set(...pos)
  }, [liveRefs])

  const toggleHidden = useCallback((id: string) => {
    setHiddenIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  const toggleAllHidden = useCallback((hide: boolean) => {
    setHiddenIds(hide ? new Set(objects.map(o => o.id)) : new Set())
  }, [objects])

  // Push history once at the start of a paint stroke (not per-stamp)
  const handlePaintStart = useCallback(() => { pushHistoryRef.current() }, [])
  const handleSculptStart = useCallback(() => { pushHistoryRef.current() }, [])

  // Paint mode: stamp an asset at the given canvas position.
  // Uses a jittered grid that fills the entire brush circle so objects sit next to
  // each other without overlapping — ideal for dense grass / foliage painting.
  const handlePaintPlace = useCallback((pos: [number, number, number]) => {
    if (!paintAsset) return

    const [cx, cy, cz] = pos
    // Each model is normalised to ~2 world units then scaled by paintScale,
    // so the effective footprint diameter ≈ 2 × paintScale.
    const objDiam = paintScale * 2
    // Grid cell spacing = diameter + 10 % breathing room so objects don't clip.
    const spacing  = objDiam * 1.1
    const r2       = brushRadius * brushRadius
    const minDistSq = (objDiam * 0.9) ** 2  // hard-reject overlap within this stamp

    if (spacing >= brushRadius * 2) {
      // Brush smaller than one object — just place a single centred stamp.
      const rotY = paintRotationRandom ? Math.random() * 360 : paintBaseY
      spawnObject(paintAsset.path, paintAsset.url, paintAsset.label, paintAsset.mtlUrl, {
        position: pos,
        rotation: [0, rotY, 0],
        scale: [paintScale, paintScale, paintScale],
        painted: true,
      })
      setSelectedId(null)
      return
    }

    // Build a jittered rectangular grid over the brush disc.
    const placed: Array<[number, number]> = []
    const steps = Math.ceil(brushRadius / spacing)
    const jitter = spacing * 0.35   // max random offset per axis

    outer:
    for (let gx = -steps; gx <= steps; gx++) {
      for (let gz = -steps; gz <= steps; gz++) {
        if (placed.length >= 400) break outer   // safety cap

        const wx = cx + gx * spacing + (Math.random() * 2 - 1) * jitter
        const wz = cz + gz * spacing + (Math.random() * 2 - 1) * jitter
        const dx = wx - cx
        const dz = wz - cz
        // Discard if outside brush circle
        if (dx * dx + dz * dz > r2) continue
        // Discard if too close to another object placed in this stamp
        for (const [px, pz] of placed) {
          const ddx = wx - px, ddz = wz - pz
          if (ddx * ddx + ddz * ddz < minDistSq) continue outer
        }

        placed.push([wx, wz])
        const rotY = paintRotationRandom ? Math.random() * 360 : paintBaseY
        spawnObject(paintAsset.path, paintAsset.url, paintAsset.label, paintAsset.mtlUrl, {
          position: [+wx.toFixed(3), cy, +wz.toFixed(3)],
          rotation: [0, rotY, 0],
          scale: [paintScale, paintScale, paintScale],
          painted: true,
        })
      }
    }
    // Don't auto-select painted items — keep paint mode flowing
    setSelectedId(null)
  }, [paintAsset, paintScale, paintRotationRandom, paintBaseY, brushRadius, spawnObject, setSelectedId])

  // Paint erase: remove all objects within brush radius of the hit point
  const handlePaintErase = useCallback((pos: [number, number, number], radius: number) => {
    const [px, , pz] = pos
    const r2 = radius * radius
    const toRemove = objects
      .filter(o => {
        const dx = o.position[0] - px
        const dz = o.position[2] - pz
        return dx * dx + dz * dz <= r2
      })
      .map(o => o.id)
    toRemove.forEach(id => removeObject(id))
  }, [objects, removeObject])

  const isZoneSelected   = selectedId?.startsWith('zone:')
  const isLightSelected  = selectedId?.startsWith('light:')
  const isMarkerSelected = selectedId?.startsWith('marker:')
  const isSunSelected    = selectedId === 'sun'
  const selectedObj = !isMarkerSelected && !isZoneSelected && !isLightSelected && !isSunSelected && selectedId !== 'player_ref'
    ? objects.find(o => o.id === selectedId)
    : null
  const selectedZone  = isZoneSelected  ? zones.find(z => z.id === selectedId!.replace('zone:', ''))   : null
  const selectedLight = isLightSelected ? lights.find(l => l.id === selectedId!.replace('light:', '')) : null

  return (
    <div style={{
      width: '100vw', height: '100vh',
      display: 'flex', flexDirection: 'column',
      background: '#0D0D1A',
      fontFamily: FONT,
      userSelect: 'none',
    }}>
      {/* Toolbar */}
      <div style={{
        height: 44, flexShrink: 0,
        background: '#111122', borderBottom: '2px solid #333',
        display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px',
        flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 9, color: '#44AAFF', letterSpacing: 2, marginRight: 12 }}>
          SCENE BUILDER
        </span>

        {!previewMode && !paintMode && (['translate', 'rotate', 'scale'] as TransformMode[]).map(m => (
          <button key={m} onClick={() => setTransformMode(m)} style={{
            fontFamily: FONT, fontSize: 7, letterSpacing: 1,
            padding: '5px 8px', cursor: 'pointer',
            background: transformMode === m ? '#44AAFF' : 'transparent',
            color: transformMode === m ? '#000' : '#888',
            border: `1px solid ${transformMode === m ? '#44AAFF' : '#444'}`,
            outline: 'none',
          }}>
            {m[0].toUpperCase()} ({m === 'translate' ? 'T' : m === 'rotate' ? 'R' : 'S'})
          </button>
        ))}

        {!previewMode && !paintMode && <div style={{ width: 1, height: 24, background: '#333', margin: '0 4px' }} />}

        {!previewMode && !paintMode && (
          <button onClick={() => setShowGrid(v => !v)} style={{
            fontFamily: FONT, fontSize: 7, letterSpacing: 1,
            padding: '5px 8px', cursor: 'pointer',
            background: showGrid ? '#1A3A1A' : 'transparent',
            color: showGrid ? '#44FF88' : '#666',
            border: `1px solid ${showGrid ? '#44FF88' : '#444'}`,
            outline: 'none',
          }}>
            GRID (G)
          </button>
        )}

        {!previewMode && !paintMode && (
          <button onClick={addZone} style={{
            fontFamily: FONT, fontSize: 7, letterSpacing: 1,
            padding: '5px 8px', cursor: 'pointer',
            background: 'transparent', color: '#FFAA00',
            border: '1px solid #FFAA00', outline: 'none',
          }}>
            + ZONE (Z)
          </button>
        )}

        {!previewMode && !paintMode && (
          <button onClick={addLight} style={{
            fontFamily: FONT, fontSize: 7, letterSpacing: 1,
            padding: '5px 8px', cursor: 'pointer',
            background: 'transparent', color: '#FFD9A0',
            border: '1px solid #FFD9A0', outline: 'none',
          }}>
            + LIGHT (L)
          </button>
        )}

        {/* Paint mode controls */}
        {paintMode && !previewMode && (
          <>
            {/* Camera / paint sub-mode toggle */}
            <button
              onClick={() => setCameraLock(v => !v)}
              style={{
                fontFamily: FONT, fontSize: 7, letterSpacing: 1,
                padding: '5px 8px', cursor: 'pointer',
                background: cameraLock ? '#1A2A4A' : '#1A2A1A',
                color: cameraLock ? '#44AAFF' : '#44CC44',
                border: `1px solid ${cameraLock ? '#44AAFF' : '#44CC44'}`,
                outline: 'none',
              }}
              title="Toggle between camera orbit and paint mode (C)"
            >
              {cameraLock ? 'CAM (C)' : 'PAINT (C)'}
            </button>
            <div style={{ width: 1, height: 24, background: '#333' }} />
            <button
              onClick={() => { setSculpting(s => s === 'raise' ? null : 'raise'); setPaintErase(false) }}
              style={{
                fontFamily: FONT, fontSize: 7, letterSpacing: 1,
                padding: '5px 8px', cursor: 'pointer',
                background: sculpting === 'raise' ? '#1A4A1A' : 'transparent',
                color: sculpting === 'raise' ? '#44FF44' : '#888',
                border: `1px solid ${sculpting === 'raise' ? '#44FF44' : '#444'}`,
                outline: 'none',
              }}
            >
              RAISE
            </button>
            <button
              onClick={() => { setSculpting(s => s === 'drop' ? null : 'drop'); setPaintErase(false) }}
              style={{
                fontFamily: FONT, fontSize: 7, letterSpacing: 1,
                padding: '5px 8px', cursor: 'pointer',
                background: sculpting === 'drop' ? '#4A1A1A' : 'transparent',
                color: sculpting === 'drop' ? '#FF4444' : '#888',
                border: `1px solid ${sculpting === 'drop' ? '#FF4444' : '#444'}`,
                outline: 'none',
              }}
            >
              DROP
            </button>
            <button
              onClick={() => { setPaintErase(v => !v); setSculpting(null) }}
              style={{
                fontFamily: FONT, fontSize: 7, letterSpacing: 1,
                padding: '5px 8px', cursor: 'pointer',
                background: paintErase ? '#4A1A2A' : 'transparent',
                color: paintErase ? '#FF4488' : '#888',
                border: `1px solid ${paintErase ? '#FF4488' : '#444'}`,
                outline: 'none',
              }}
            >
              ERASE
            </button>
            {!sculpting && !paintErase && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 7, color: '#888', letterSpacing: 1 }}>
                SCALE {paintScale.toFixed(2)}×
                <input
                  type="range" min={0.05} max={10} step={0.05} value={paintScale}
                  onChange={e => setPaintScale(parseFloat(e.target.value))}
                  style={{ width: 80, marginLeft: 4, accentColor: '#FF8844' }}
                />
              </label>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 7, color: '#888', letterSpacing: 1 }}>
              BRUSH {brushRadius.toFixed(1)}
              <input
                type="range" min={0.5} max={20} step={0.5} value={brushRadius}
                onChange={e => setBrushRadius(parseFloat(e.target.value))}
                style={{ width: 80, marginLeft: 4, accentColor: '#00CCFF' }}
              />
            </label>
            {paintAsset && !sculpting && !paintErase && (
              <span style={{ fontSize: 7, color: '#0CF', letterSpacing: 1 }}>
                {paintAsset.label}
              </span>
            )}
            {paintErase && (
              <span style={{ fontSize: 7, color: '#FF4488', letterSpacing: 1 }}>
                ERASER ACTIVE
              </span>
            )}
          </>
        )}

        <div style={{ width: 1, height: 24, background: '#333', margin: '0 4px' }} />

        {/* Paint/Drop toggle */}
        {!previewMode && (
          <button
            onClick={() => {
              setPaintMode(v => {
                if (v) { setSculpting(null); setPaintAsset(null); setPaintErase(false) }
                return !v
              })
            }}
            style={{
              fontFamily: FONT, fontSize: 7, letterSpacing: 1,
              padding: '5px 8px', cursor: 'pointer',
              background: paintMode ? '#1A3A2A' : 'transparent',
              color: paintMode ? '#22AA44' : '#888',
              border: `1px solid ${paintMode ? '#22AA44' : '#444'}`,
              outline: 'none',
            }}
          >
            {paintMode ? 'PAINT (M)' : 'DROP (M)'}
          </button>
        )}

        {!previewMode && !paintMode && (
          <>
            <div style={{ width: 1, height: 24, background: '#333', margin: '0 4px' }} />
            <button onClick={() => {
              if (window.confirm('Clear all objects and zones? This cannot be undone.')) {
                pushHistoryRef.current()
                clearScene()
              }
            }} style={{
              fontFamily: FONT, fontSize: 7, letterSpacing: 1,
              padding: '5px 8px', cursor: 'pointer',
              background: 'transparent',
              color: '#FF6666',
              border: '1px solid #FF4444',
              outline: 'none',
            }}>
              CLEAR
            </button>
          </>
        )}

        <div style={{ width: 1, height: 24, background: '#333', margin: '0 4px' }} />

        {/* Preview toggle */}
        <button onClick={() => setPreviewMode(v => !v)} style={{
          fontFamily: FONT, fontSize: 7, letterSpacing: 1,
          padding: '5px 8px', cursor: 'pointer',
          background: previewMode ? '#44FFAA' : 'transparent',
          color: previewMode ? '#000' : '#44FFAA',
          border: `1px solid #44FFAA`,
          outline: 'none',
        }}>
          {previewMode ? '✓ PREVIEW (P)' : 'PREVIEW (P)'}
        </button>

        {selectedObj && !previewMode && !paintMode && (
          <>
            <div style={{ width: 1, height: 24, background: '#333', margin: '0 4px' }} />
            <span style={{ fontSize: 7, color: '#44AAFF' }}>
              ✦ {selectedObj.name}
            </span>
          </>
        )}

        {selectedZone && !previewMode && !paintMode && (
          <>
            <div style={{ width: 1, height: 24, background: '#333', margin: '0 4px' }} />
            <span style={{ fontSize: 7, color: selectedZone.color }}>◈ {selectedZone.name}</span>
          </>
        )}

        {selectedLight && !previewMode && !paintMode && (
          <>
            <div style={{ width: 1, height: 24, background: '#333', margin: '0 4px' }} />
            <span style={{ fontSize: 7, color: selectedLight.color }}>💡 {selectedLight.name}</span>
          </>
        )}

        {isSunSelected && !previewMode && !paintMode && (
          <>
            <div style={{ width: 1, height: 24, background: '#333', margin: '0 4px' }} />
            <span style={{ fontSize: 7, color: '#FFDD44' }}>☀ Sun (Directional)</span>
          </>
        )}

        {previewMode && (
          <span style={{ fontSize: 7, color: '#44FFAA', marginLeft: 8 }}>
            CAMERA PREVIEW — press P to return to edit
          </span>
        )}
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {!previewMode && (
          <AssetPanel
            onSpawn={handleSpawn}
            objects={objects}
            lights={lights}
            zones={zones}
            selectedId={selectedId}
            hiddenIds={hiddenIds}
            onSelectObject={setSelectedId}
            onToggleHidden={toggleHidden}
            onToggleAllHidden={toggleAllHidden}
            onAddTerrain={type => { pushHistoryRef.current(); addTerrain(type) }}
            paintMode={paintMode}
            paintAsset={paintAsset}
          />
        )}

        {/* Viewport */}
        <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
          <BuilderCanvas
            objects={objects}
            markers={markers}
            markerScales={markerScales}
            zones={zones}
            lights={lights}
            terrains={terrains}
            terrainLiveRefs={terrainLiveRefs}
            ambient={ambient}
            camera={camera}
            previewMode={previewMode}
            paintMode={paintMode}
            paintAsset={paintAsset}
            paintErase={paintErase}
            brushRadius={brushRadius}
            sculpting={sculpting}
            selectedId={selectedId}
            transformMode={transformMode}
            showGrid={showGrid}
            liveRefs={liveRefs.current}
            hiddenIds={hiddenIds}
            playerRefPos={playerRefPos}
            cameraReaderRef={cameraReaderRef}
            cameraLock={cameraLock}
            onSelect={setSelectedId}
            onDragEnd={handleDragEnd}
            onSelectTerrain={id => setSelectedId(`terrain:${id}`)}
            onPaintPlace={handlePaintPlace}
            onPaintErase={handlePaintErase}
            onSculptEnd={updateTerrainHeights}
            onPaintStart={handlePaintStart}
            onSculptStart={handleSculptStart}
            dropPendingAsset={dropPendingAsset}
            onDropPlace={handleDropPlace}
          />

          {/* Viewport hint overlay */}
          <div style={{
            position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
            fontSize: 6, color: 'rgba(255,255,255,0.25)', letterSpacing: 1,
            pointerEvents: 'none',
          }}>
            {previewMode
              ? 'P — EXIT PREVIEW'
              : paintMode
                ? 'CLICK/DRAG = STAMP ASSET · M = EXIT PAINT · SELECT ASSET IN PANEL TO STAMP'
                : 'LEFT CLICK = SELECT · RIGHT DRAG = ORBIT · SCROLL = ZOOM · F = SAVE CAMERA · CTRL+S = SAVE'
            }
          </div>
        </div>

        {!previewMode && (
          <InspectorPanel
            selectedId={selectedId}
            objects={objects}
            markers={markers}
            markerScales={markerScales}
            zones={zones}
            lights={lights}
            terrains={terrains}
            ambient={ambient}
            camera={camera}
            liveRefs={liveRefs.current}
            playerRefPos={playerRefPos}
            paintMode={paintMode}
            paintScale={paintScale}
            paintRotationRandom={paintRotationRandom}
            paintBaseY={paintBaseY}
            onPaintScaleChange={setPaintScale}
            onPaintRotationRandomChange={setPaintRotationRandom}
            onPaintBaseYChange={setPaintBaseY}
            onUpdateObject={(id, patch) => updateObject(id, patch)}
            onApplyToRef={handleApplyToRef}
            onRemoveObject={removeObject}
            onUpdateMarker={(id, pos) => updateMarker(id as never, pos)}
            onUpdateMarkerScale={(id, scale) => updateMarkerScale(id as never, scale)}
            onUpdatePlayerRefPos={handleUpdatePlayerRefPos}
            onUpdateZone={updateZone}
            onRemoveZone={removeZone}
            onUpdateLight={updateLight}
            onRemoveLight={removeLight}
            onUpdateAmbient={updateAmbient}
            onUpdateTerrain={updateTerrain}
            onRemoveTerrain={removeTerrain}
          />
        )}
      </div>

      {/* Bottom export bar */}
      <ExportPanel
        sceneName={sceneName}
        onSceneNameChange={setSceneName}
        onLoad={handleFileLoad}
        onSave={handleFileSave}
        onExportJSON={exportJSON}
      />
    </div>
  )
}
