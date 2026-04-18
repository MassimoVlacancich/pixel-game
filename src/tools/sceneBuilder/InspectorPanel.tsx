import { useRef } from 'react'
import * as THREE from 'three'
import type { PlacedObject, MarkerPositions, MarkerScales, CameraConfig, SceneZone, SceneLight, SceneAmbient, TerrainData } from './useSceneBuilderState'
import { MARKERS } from './useSceneBuilderState'

const FONT = "'Press Start 2P', monospace"

// ── Shared number input ───────────────────────────────────────────────────────

function NumInput({ value, onChange, step = 0.1 }: { value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <input
      type="number"
      value={value}
      step={step}
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
      style={{
        fontFamily: FONT, fontSize: 8,
        width: 64, padding: '4px 4px',
        background: '#0D0D1A', color: '#EEE',
        border: '1px solid #444', outline: 'none',
      }}
    />
  )
}

function Vec3Row({
  label, values, step = 0.1, onChange
}: {
  label: string
  values: [number, number, number]
  step?: number
  onChange: (v: [number, number, number]) => void
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 7, color: '#888', letterSpacing: 1, marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', gap: 4 }}>
        {(['X', 'Y', 'Z'] as const).map((axis, i) => (
          <div key={axis} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <span style={{ fontSize: 6, color: '#666' }}>{axis}</span>
            <NumInput value={values[i]} step={step} onChange={v => {
              const next = [...values] as [number, number, number]
              next[i] = v
              onChange(next)
            }} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Rotation dial (SVG knob, drag horizontally to change angle) ───────────────

function RotationDial({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const dragRef = useRef<{ startX: number; startVal: number } | null>(null)
  const norm = ((value % 360) + 360) % 360
  const rad  = norm * Math.PI / 180
  const nx   = Math.sin(rad) * 18
  const ny   = -Math.cos(rad) * 18

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span style={{ fontSize: 6, color: '#888' }}>{label}</span>
      <svg
        width={48} height={48} viewBox="-24 -24 48 48"
        style={{ cursor: 'ew-resize', userSelect: 'none' }}
        onMouseDown={e => {
          e.preventDefault()
          dragRef.current = { startX: e.clientX, startVal: value }
          const onMove = (me: MouseEvent) => {
            if (!dragRef.current) return
            onChange(dragRef.current.startVal + (me.clientX - dragRef.current.startX))
          }
          const onUp = () => {
            dragRef.current = null
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
          }
          window.addEventListener('mousemove', onMove)
          window.addEventListener('mouseup', onUp)
        }}
      >
        <circle r={22} fill="#1A1A2E" stroke="#444" strokeWidth={1.5} />
        {[0, 90, 180, 270].map(a => {
          const ar = a * Math.PI / 180
          return (
            <line key={a}
              x1={Math.sin(ar) * 16} y1={-Math.cos(ar) * 16}
              x2={Math.sin(ar) * 22} y2={-Math.cos(ar) * 22}
              stroke="#333" strokeWidth={1}
            />
          )
        })}
        <line x1={0} y1={0} x2={nx} y2={ny} stroke="#00CCFF" strokeWidth={2} strokeLinecap="round" />
        <circle r={2} fill="#00CCFF" />
        <text textAnchor="middle" y={8} fill="#AAA" fontSize={6} fontFamily="monospace">
          {Math.round(norm)}°
        </text>
      </svg>
    </div>
  )
}

// ── Scale slider (uniform, 0.05→20) ──────────────────────────────────────────

function ScaleSlider({ values, onChange }: { values: [number, number, number]; onChange: (v: [number, number, number]) => void }) {
  const s = values[0]
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 7, color: '#888', letterSpacing: 1 }}>SCALE</span>
        <span style={{ fontSize: 7, color: '#CCC' }}>{s.toFixed(2)}×</span>
      </div>
      <input
        type="range" min={0.05} max={20} step={0.05} value={s}
        style={{ width: '100%', accentColor: '#00CCFF' }}
        onChange={e => { const v = parseFloat(e.target.value); onChange([v, v, v]) }}
      />
    </div>
  )
}

// ── Object inspector ──────────────────────────────────────────────────────────

interface ObjectInspectorProps {
  obj: PlacedObject
  onUpdate: (patch: Partial<PlacedObject>) => void
  onApplyToRef: (patch: Partial<PlacedObject>) => void
  onRemove: () => void
}

function ObjectInspector({ obj, onUpdate, onApplyToRef, onRemove }: ObjectInspectorProps) {
  const apply = (patch: Partial<PlacedObject>) => {
    onUpdate(patch)
    onApplyToRef(patch)
  }

  return (
    <>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 7, color: '#888', letterSpacing: 1, marginBottom: 4 }}>NAME</div>
        <input
          value={obj.name}
          onChange={e => onUpdate({ name: e.target.value })}
          style={{
            fontFamily: FONT, fontSize: 7,
            width: '100%', padding: '5px 6px',
            background: '#0D0D1A', color: '#EEE',
            border: '1px solid #444', outline: 'none',
          }}
        />
      </div>

      <Vec3Row
        label="POSITION"
        values={obj.position}
        step={0.1}
        onChange={v => apply({ position: v })}
      />

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 7, color: '#888', letterSpacing: 1, marginBottom: 6 }}>ROTATION</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          {(['X', 'Y', 'Z'] as const).map((ax, i) => (
            <RotationDial key={ax} label={ax} value={obj.rotation[i]} onChange={v => {
              const next = [...obj.rotation] as [number, number, number]
              next[i] = v
              apply({ rotation: next })
            }} />
          ))}
        </div>
      </div>

      <ScaleSlider
        values={obj.scale}
        onChange={v => apply({ scale: v })}
      />

      <label style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 7, color: '#AAA', cursor: 'pointer', marginBottom: 12,
        letterSpacing: 1,
      }}>
        <input
          type="checkbox"
          checked={!!obj.autoCollider}
          onChange={e => onUpdate({ autoCollider: e.target.checked })}
        />
        AUTO-COLLIDER
      </label>

      <button onClick={onRemove} style={{
        fontFamily: FONT, fontSize: 7, letterSpacing: 1,
        padding: '8px 12px', cursor: 'pointer',
        background: '#3A0000', color: '#FF6666',
        border: '1px solid #FF4444', outline: 'none', width: '100%',
      }}>
        DELETE
      </button>
    </>
  )
}

// ── Marker inspector ──────────────────────────────────────────────────────────

interface MarkerInspectorProps {
  markerId: string
  markers: MarkerPositions
  markerScales: MarkerScales
  liveRefs: Map<string, THREE.Group>
  onUpdatePos: (id: string, pos: [number, number, number]) => void
  onUpdateScale: (id: string, scale: [number, number, number]) => void
}

function MarkerInspector({ markerId, markers, markerScales, liveRefs, onUpdatePos, onUpdateScale }: MarkerInspectorProps) {
  const m = MARKERS.find(x => x.id === markerId)
  if (!m) return null
  const pos   = markers[markerId as keyof MarkerPositions]      ?? [0, 0, 0]
  const scale = markerScales[markerId as keyof MarkerScales]    ?? [1, 1, 1]

  const applyPos = (newPos: [number, number, number]) => {
    onUpdatePos(markerId, newPos)
    const ref = liveRefs.get(`marker:${markerId}`)
    if (ref) ref.position.set(...newPos)
  }

  const applyScale = (newScale: [number, number, number]) => {
    onUpdateScale(markerId, newScale)
    const ref = liveRefs.get(`marker:${markerId}`)
    if (ref) ref.scale.set(...newScale)
  }

  return (
    <>
      <div style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 7, color: m.color, letterSpacing: 1 }}>⬤ {m.label.toUpperCase()}</span>
      </div>
      <Vec3Row label="POSITION" values={pos} step={0.1} onChange={applyPos} />
      <Vec3Row label="SCALE" values={scale} step={0.1} onChange={applyScale} />
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 7, color: '#888', letterSpacing: 1, marginBottom: 4 }}>UNIFORM SCALE</div>
        <NumInput
          value={scale[0]}
          step={0.1}
          onChange={v => applyScale([v, v, v])}
        />
      </div>
    </>
  )
}

// ── Zone inspector ────────────────────────────────────────────────────────────

interface ZoneInspectorProps {
  zone: SceneZone
  liveRefs: Map<string, THREE.Group>
  onUpdate: (patch: Partial<SceneZone>) => void
  onRemove: () => void
}

function ZoneInspector({ zone, liveRefs, onUpdate, onRemove }: ZoneInspectorProps) {
  const applyPos = (pos: [number, number, number]) => {
    onUpdate({ position: pos })
    const ref = liveRefs.get(`zone:${zone.id}`)
    if (ref) ref.position.set(...pos)
  }

  const applyScale = (scale: [number, number, number]) => {
    onUpdate({ scale })
    const ref = liveRefs.get(`zone:${zone.id}`)
    if (ref) ref.scale.set(...scale)
  }

  return (
    <>
      <div style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 7, color: zone.color, letterSpacing: 1 }}>◈ ZONE</span>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 7, color: '#888', letterSpacing: 1, marginBottom: 4 }}>NAME</div>
        <input
          value={zone.name}
          onChange={e => onUpdate({ name: e.target.value })}
          style={{
            fontFamily: FONT, fontSize: 7,
            width: '100%', padding: '5px 6px',
            background: '#0D0D1A', color: '#EEE',
            border: `1px solid ${zone.color}`, outline: 'none',
          }}
        />
      </div>

      <Vec3Row label="POSITION" values={zone.position} step={0.1} onChange={applyPos} />
      <Vec3Row label="HALF-EXTENTS" values={zone.scale} step={0.1} onChange={applyScale} />
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 7, color: '#888', letterSpacing: 1, marginBottom: 4 }}>UNIFORM SIZE</div>
        <NumInput
          value={zone.scale[0]}
          step={0.1}
          onChange={v => applyScale([v, v, v])}
        />
      </div>

      <p style={{ fontSize: 6, color: '#555', margin: '0 0 12px' }}>
        Scene reads this zone by name.<br />
        Scale = PickupZone half-extents.
      </p>

      <button onClick={onRemove} style={{
        fontFamily: FONT, fontSize: 7, letterSpacing: 1,
        padding: '8px 12px', cursor: 'pointer',
        background: '#3A0000', color: '#FF6666',
        border: '1px solid #FF4444', outline: 'none', width: '100%',
      }}>
        DELETE ZONE
      </button>
    </>
  )
}

// ── Light inspector ───────────────────────────────────────────────────────────

interface LightInspectorProps {
  light: SceneLight
  liveRefs: Map<string, THREE.Group>
  onUpdate: (patch: Partial<SceneLight>) => void
  onRemove: () => void
}

function LightInspector({ light, liveRefs, onUpdate, onRemove }: LightInspectorProps) {
  const applyPos = (pos: [number, number, number]) => {
    onUpdate({ position: pos })
    const ref = liveRefs.get(`light:${light.id}`)
    if (ref) ref.position.set(...pos)
  }

  return (
    <>
      <div style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 7, color: light.color, letterSpacing: 1 }}>💡 POINT LIGHT</span>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 7, color: '#888', letterSpacing: 1, marginBottom: 4 }}>NAME</div>
        <input
          value={light.name}
          onChange={e => onUpdate({ name: e.target.value })}
          style={{
            fontFamily: FONT, fontSize: 7,
            width: '100%', padding: '5px 6px',
            background: '#0D0D1A', color: '#EEE',
            border: `1px solid ${light.color}`, outline: 'none',
          }}
        />
      </div>

      <Vec3Row label="POSITION" values={light.position} step={0.1} onChange={applyPos} />

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 7, color: '#888', letterSpacing: 1, marginBottom: 4 }}>COLOR</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="color"
            value={light.color}
            onChange={e => onUpdate({ color: e.target.value })}
            style={{ width: 36, height: 28, padding: 2, background: '#0D0D1A', border: '1px solid #444', cursor: 'pointer' }}
          />
          <span style={{ fontSize: 7, color: '#666' }}>{light.color}</span>
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 7, color: '#888', letterSpacing: 1, marginBottom: 4 }}>INTENSITY</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="range" min={0} max={500} step={1}
            value={light.intensity}
            onChange={e => onUpdate({ intensity: parseFloat(e.target.value) })}
            style={{ flex: 1 }}
          />
          <NumInput value={light.intensity} step={1} onChange={v => onUpdate({ intensity: v })} />
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 7, color: '#888', letterSpacing: 1, marginBottom: 4 }}>DISTANCE <span style={{ color: '#555' }}>(0 = ∞)</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="range" min={0} max={30} step={0.5}
            value={light.distance}
            onChange={e => onUpdate({ distance: parseFloat(e.target.value) })}
            style={{ flex: 1 }}
          />
          <NumInput value={light.distance} step={0.5} onChange={v => onUpdate({ distance: v })} />
        </div>
      </div>

      <button onClick={onRemove} style={{
        fontFamily: FONT, fontSize: 7, letterSpacing: 1,
        padding: '8px 12px', cursor: 'pointer',
        background: '#3A0000', color: '#FF6666',
        border: '1px solid #FF4444', outline: 'none', width: '100%',
      }}>
        DELETE LIGHT
      </button>
    </>
  )
}

// ── Player ref inspector ──────────────────────────────────────────────────────

interface PlayerRefInspectorProps {
  pos: [number, number, number]
  onUpdate: (pos: [number, number, number]) => void
}

function PlayerRefInspector({ pos, onUpdate }: PlayerRefInspectorProps) {
  return (
    <>
      <div style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 7, color: '#44AAFF', letterSpacing: 1 }}>⬤ PLAYER REF</span>
        <p style={{ fontSize: 6, color: '#555', marginTop: 6, marginBottom: 0 }}>
          Reference only.<br />Not exported.
        </p>
      </div>
      <Vec3Row label="POSITION" values={pos} step={0.1} onChange={onUpdate} />
    </>
  )
}

// ── Terrain inspector ─────────────────────────────────────────────────────────

interface TerrainInspectorProps {
  terrain: TerrainData
  onUpdate: (patch: Partial<TerrainData>) => void
  onRemove: () => void
}

function TerrainInspector({ terrain, onUpdate, onRemove }: TerrainInspectorProps) {
  return (
    <>
      <div style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 7, color: terrain.type === 'ground' ? '#6B8F4A' : '#3A7BD5', letterSpacing: 1 }}>
          {terrain.type === 'ground' ? '⬛ GROUND' : '〜 RIVER'}
        </span>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 7, color: '#888', letterSpacing: 1, marginBottom: 4 }}>NAME</div>
        <input
          value={terrain.name}
          onChange={e => onUpdate({ name: e.target.value })}
          style={{
            fontFamily: FONT, fontSize: 7,
            width: '100%', padding: '5px 6px',
            background: '#0D0D1A', color: '#EEE',
            border: '1px solid #444', outline: 'none',
          }}
        />
      </div>

      <Vec3Row
        label="POSITION"
        values={terrain.position}
        step={0.1}
        onChange={v => onUpdate({ position: v })}
      />

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 7, color: '#888', letterSpacing: 1, marginBottom: 4 }}>COLOR</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="color"
            value={terrain.color}
            onChange={e => onUpdate({ color: e.target.value })}
            style={{ width: 80, height: 28, padding: 2, background: '#0D0D1A', border: '1px solid #444', cursor: 'pointer' }}
          />
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 7, color: '#888', letterSpacing: 1, marginBottom: 4 }}>SIZE</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <label style={{ fontSize: 7, color: '#AAA' }}>
            W&nbsp;
            <NumInput value={terrain.width} onChange={v => onUpdate({ width: v })} />
          </label>
          <label style={{ fontSize: 7, color: '#AAA' }}>
            D&nbsp;
            <NumInput value={terrain.depth} onChange={v => onUpdate({ depth: v })} />
          </label>
        </div>
      </div>

      <button onClick={onRemove} style={{
        fontFamily: FONT, fontSize: 7, letterSpacing: 1,
        padding: '8px 12px', cursor: 'pointer',
        background: '#3A0000', color: '#FF6666',
        border: '1px solid #FF4444', outline: 'none', width: '100%',
      }}>
        DELETE TERRAIN
      </button>
    </>
  )
}

// ── Ambient lighting inspector ────────────────────────────────────────────────

interface AmbientInspectorProps {
  ambient: SceneAmbient
  onUpdate: (patch: Partial<SceneAmbient>) => void
}

function AmbientInspector({ ambient, onUpdate }: AmbientInspectorProps) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 8, color: '#FFD9A0', letterSpacing: 2, marginBottom: 10 }}>SCENE AMBIENT</div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 7, color: '#888', letterSpacing: 1, marginBottom: 4 }}>SKY / BG COLOR</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="color"
            value={ambient.bgColor ?? '#87CEEB'}
            onChange={e => onUpdate({ bgColor: e.target.value })}
            style={{ width: 36, height: 28, padding: 2, background: '#0D0D1A', border: '1px solid #444', cursor: 'pointer' }}
          />
          <span style={{ fontSize: 7, color: '#666' }}>{ambient.bgColor ?? '#87CEEB'}</span>
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 7, color: '#888', letterSpacing: 1, marginBottom: 4 }}>AMBIENT COLOR</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="color"
            value={ambient.ambientColor}
            onChange={e => onUpdate({ ambientColor: e.target.value })}
            style={{ width: 36, height: 28, padding: 2, background: '#0D0D1A', border: '1px solid #444', cursor: 'pointer' }}
          />
          <span style={{ fontSize: 7, color: '#666' }}>{ambient.ambientColor}</span>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 7, color: '#888', letterSpacing: 1, marginBottom: 4 }}>INTENSITY</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="range" min={0} max={3} step={0.05}
            value={ambient.ambientIntensity}
            onChange={e => onUpdate({ ambientIntensity: parseFloat(e.target.value) })}
            style={{ flex: 1 }}
          />
          <NumInput value={ambient.ambientIntensity} step={0.05} onChange={v => onUpdate({ ambientIntensity: v })} />
        </div>
      </div>

      <div style={{ marginBottom: ambient.hemisphereEnabled ? 8 : 0 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={ambient.hemisphereEnabled}
            onChange={e => onUpdate({ hemisphereEnabled: e.target.checked })}
          />
          <span style={{ fontSize: 7, color: '#888', letterSpacing: 1 }}>HEMISPHERE LIGHT</span>
        </label>
      </div>

      {ambient.hemisphereEnabled && (
        <>
          <div style={{ marginBottom: 8, marginTop: 8 }}>
            <div style={{ fontSize: 7, color: '#888', letterSpacing: 1, marginBottom: 4 }}>SKY COLOR</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="color"
                value={ambient.skyColor}
                onChange={e => onUpdate({ skyColor: e.target.value })}
                style={{ width: 36, height: 28, padding: 2, background: '#0D0D1A', border: '1px solid #444', cursor: 'pointer' }}
              />
              <span style={{ fontSize: 7, color: '#666' }}>{ambient.skyColor}</span>
            </div>
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 7, color: '#888', letterSpacing: 1, marginBottom: 4 }}>GROUND COLOR</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="color"
                value={ambient.groundColor}
                onChange={e => onUpdate({ groundColor: e.target.value })}
                style={{ width: 36, height: 28, padding: 2, background: '#0D0D1A', border: '1px solid #444', cursor: 'pointer' }}
              />
              <span style={{ fontSize: 7, color: '#666' }}>{ambient.groundColor}</span>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 7, color: '#888', letterSpacing: 1, marginBottom: 4 }}>HEMI INTENSITY</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="range" min={0} max={2} step={0.05}
                value={ambient.hemisphereIntensity}
                onChange={e => onUpdate({ hemisphereIntensity: parseFloat(e.target.value) })}
                style={{ flex: 1 }}
              />
              <NumInput value={ambient.hemisphereIntensity} step={0.05} onChange={v => onUpdate({ hemisphereIntensity: v })} />
            </div>
          </div>
        </>
      )}

      <div style={{ borderTop: '1px solid #222', paddingTop: 10, marginTop: 4 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={ambient.directionalEnabled}
            onChange={e => onUpdate({ directionalEnabled: e.target.checked })}
          />
          <span style={{ fontSize: 7, color: '#888', letterSpacing: 1 }}>DIRECTIONAL LIGHT</span>
        </label>

        {ambient.directionalEnabled && (
          <>
            <p style={{ fontSize: 6, color: '#555', margin: '0 0 8px' }}>
              Drag the SUN ball in the viewport to reposition.
            </p>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 7, color: '#888', letterSpacing: 1, marginBottom: 4 }}>COLOR</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="color"
                  value={ambient.directionalColor}
                  onChange={e => onUpdate({ directionalColor: e.target.value })}
                  style={{ width: 36, height: 28, padding: 2, background: '#0D0D1A', border: '1px solid #444', cursor: 'pointer' }}
                />
                <span style={{ fontSize: 7, color: '#666' }}>{ambient.directionalColor}</span>
              </div>
            </div>
            <div style={{ marginBottom: 0 }}>
              <div style={{ fontSize: 7, color: '#888', letterSpacing: 1, marginBottom: 4 }}>INTENSITY</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="range" min={0} max={3} step={0.05}
                  value={ambient.directionalIntensity}
                  onChange={e => onUpdate({ directionalIntensity: parseFloat(e.target.value) })}
                  style={{ flex: 1 }}
                />
                <NumInput value={ambient.directionalIntensity} step={0.05} onChange={v => onUpdate({ directionalIntensity: v })} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Sun inspector (shown when sun is selected) ────────────────────────────────

interface SunInspectorProps {
  ambient: SceneAmbient
  onUpdate: (patch: Partial<SceneAmbient>) => void
}

function SunInspector({ ambient, onUpdate }: SunInspectorProps) {
  return (
    <>
      <div style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 7, color: '#FFDD44', letterSpacing: 1 }}>☀ DIRECTIONAL LIGHT</span>
        <p style={{ fontSize: 6, color: '#555', marginTop: 6, marginBottom: 0 }}>
          Drag to reposition.<br />Direction = toward origin.
        </p>
      </div>

      <Vec3Row
        label="POSITION"
        values={ambient.directionalPosition}
        step={0.5}
        onChange={v => onUpdate({ directionalPosition: v })}
      />

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 7, color: '#888', letterSpacing: 1, marginBottom: 4 }}>COLOR</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="color"
            value={ambient.directionalColor}
            onChange={e => onUpdate({ directionalColor: e.target.value })}
            style={{ width: 36, height: 28, padding: 2, background: '#0D0D1A', border: '1px solid #444', cursor: 'pointer' }}
          />
          <span style={{ fontSize: 7, color: '#666' }}>{ambient.directionalColor}</span>
        </div>
      </div>

      <div style={{ marginBottom: 0 }}>
        <div style={{ fontSize: 7, color: '#888', letterSpacing: 1, marginBottom: 4 }}>INTENSITY</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="range" min={0} max={3} step={0.05}
            value={ambient.directionalIntensity}
            onChange={e => onUpdate({ directionalIntensity: parseFloat(e.target.value) })}
            style={{ flex: 1 }}
          />
          <NumInput value={ambient.directionalIntensity} step={0.05} onChange={v => onUpdate({ directionalIntensity: v })} />
        </div>
      </div>
    </>
  )
}

// ── Camera info (shown when nothing is selected) ──────────────────────────────

function CameraInfo({ camera }: { camera: CameraConfig }) {
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ fontSize: 7, color: '#44FFAA', letterSpacing: 1, marginBottom: 8 }}>CAMERA</div>
      <div style={{ fontSize: 6, color: '#555', lineHeight: 1.8 }}>
        <div>lookAt: [{camera.lookAt.map(v => v.toFixed(2)).join(', ')}]</div>
        <div>radius: {camera.radius.toFixed(2)}</div>
        <div>elevation: {camera.elevation.toFixed(3)} rad</div>
        <div>azimuth: {camera.azimuth.toFixed(3)} rad</div>
      </div>
      <p style={{ fontSize: 6, color: '#444', marginTop: 8 }}>
        Orbit to desired view,<br />press F to save camera.
      </p>
    </div>
  )
}

// ── Paint brush inspector (shown in right panel while paint mode is active) ───

interface PaintBrushInspectorProps {
  paintScale: number
  paintRotationRandom: boolean
  paintBaseY: number
  onPaintScaleChange: (v: number) => void
  onPaintRotationRandomChange: (v: boolean) => void
  onPaintBaseYChange: (v: number) => void
}

function PaintBrushInspector({
  paintScale: _paintScale, paintRotationRandom, paintBaseY,
  onPaintScaleChange: _onPaintScaleChange, onPaintRotationRandomChange, onPaintBaseYChange,
}: PaintBrushInspectorProps) {
  return (
    <>
      <div style={{ fontSize: 8, color: '#22AA44', letterSpacing: 2, marginBottom: 12 }}>PAINT BRUSH</div>

      <label style={{
        display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
        fontSize: 7, color: '#888', letterSpacing: 1, marginBottom: 12,
      }}>
        <input
          type="checkbox"
          checked={paintRotationRandom}
          onChange={e => onPaintRotationRandomChange(e.target.checked)}
        />
        RANDOM Y ROTATION
      </label>

      {!paintRotationRandom && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 7, color: '#888', letterSpacing: 1, marginBottom: 6 }}>ROTATION Y</div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <RotationDial label="Y" value={paintBaseY} onChange={onPaintBaseYChange} />
          </div>
        </div>
      )}
    </>
  )
}

// ── Root inspector panel ──────────────────────────────────────────────────────

interface Props {
  selectedId: string | null
  objects: PlacedObject[]
  markers: MarkerPositions
  markerScales: MarkerScales
  zones: SceneZone[]
  lights: SceneLight[]
  terrains: TerrainData[]
  ambient: SceneAmbient
  camera: CameraConfig
  liveRefs: Map<string, THREE.Group>
  playerRefPos: [number, number, number]
  paintMode?: boolean
  paintScale?: number
  paintRotationRandom?: boolean
  paintBaseY?: number
  onPaintScaleChange?: (v: number) => void
  onPaintRotationRandomChange?: (v: boolean) => void
  onPaintBaseYChange?: (v: number) => void
  onUpdateObject: (id: string, patch: Partial<PlacedObject>) => void
  onApplyToRef: (id: string, patch: Partial<PlacedObject>) => void
  onRemoveObject: (id: string) => void
  onUpdateMarker: (id: string, pos: [number, number, number]) => void
  onUpdateMarkerScale: (id: string, scale: [number, number, number]) => void
  onUpdatePlayerRefPos: (pos: [number, number, number]) => void
  onUpdateZone: (id: string, patch: Partial<SceneZone>) => void
  onRemoveZone: (id: string) => void
  onUpdateLight: (id: string, patch: Partial<SceneLight>) => void
  onRemoveLight: (id: string) => void
  onUpdateAmbient: (patch: Partial<SceneAmbient>) => void
  onUpdateTerrain: (id: string, patch: Partial<TerrainData>) => void
  onRemoveTerrain: (id: string) => void
}

export default function InspectorPanel({
  selectedId, objects, markers, markerScales, zones, lights, terrains, ambient, camera, liveRefs, playerRefPos,
  paintMode, paintScale, paintRotationRandom, paintBaseY,
  onPaintScaleChange, onPaintRotationRandomChange, onPaintBaseYChange,
  onUpdateObject, onApplyToRef, onRemoveObject, onUpdateMarker, onUpdateMarkerScale,
  onUpdatePlayerRefPos, onUpdateZone, onRemoveZone, onUpdateLight, onRemoveLight, onUpdateAmbient,
  onUpdateTerrain, onRemoveTerrain,
}: Props) {
  const isMarker    = selectedId?.startsWith('marker:')
  const isZone      = selectedId?.startsWith('zone:')
  const isLight     = selectedId?.startsWith('light:')
  const isTerrain   = selectedId?.startsWith('terrain:')
  const isPlayerRef = selectedId === 'player_ref'
  const isSun       = selectedId === 'sun'
  const markerId    = isMarker  ? selectedId!.replace('marker:', '')  : null
  const zoneId      = isZone   ? selectedId!.replace('zone:', '')     : null
  const lightId     = isLight  ? selectedId!.replace('light:', '')    : null
  const terrainId   = isTerrain ? selectedId!.replace('terrain:', '') : null
  const obj         = !isMarker && !isZone && !isLight && !isPlayerRef && !isSun && !isTerrain ? objects.find(o => o.id === selectedId) : null
  const zone        = zoneId    ? zones.find(z => z.id === zoneId)       : null
  const light       = lightId   ? lights.find(l => l.id === lightId)     : null
  const terrain     = terrainId ? terrains.find(t => t.id === terrainId) : null

  return (
    <div style={{
      width: 240, flexShrink: 0,
      background: '#1A1A2A', borderLeft: '2px solid #333',
      display: 'flex', flexDirection: 'column',
      fontFamily: FONT, overflow: 'hidden',
    }}>
      <div style={{ padding: '10px 8px 6px', borderBottom: '1px solid #333' }}>
        <span style={{ fontSize: 8, color: '#888', letterSpacing: 2 }}>INSPECTOR</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
        {/* Paint mode: show brush settings instead of ambient/camera defaults */}
        {paintMode && onPaintScaleChange && (
          <PaintBrushInspector
            paintScale={paintScale ?? 1}
            paintRotationRandom={paintRotationRandom ?? true}
            paintBaseY={paintBaseY ?? 0}
            onPaintScaleChange={onPaintScaleChange}
            onPaintRotationRandomChange={onPaintRotationRandomChange!}
            onPaintBaseYChange={onPaintBaseYChange!}
          />
        )}

        {!selectedId && !paintMode && (
          <>
            <AmbientInspector ambient={ambient} onUpdate={onUpdateAmbient} />
            <div style={{ borderTop: '1px solid #222', paddingTop: 12 }}>
              <CameraInfo camera={camera} />
            </div>
          </>
        )}

        {obj && (
          <ObjectInspector
            obj={obj}
            onUpdate={patch => onUpdateObject(obj.id, patch)}
            onApplyToRef={patch => onApplyToRef(obj.id, patch)}
            onRemove={() => onRemoveObject(obj.id)}
          />
        )}

        {markerId && (
          <MarkerInspector
            markerId={markerId}
            markers={markers}
            markerScales={markerScales}
            liveRefs={liveRefs}
            onUpdatePos={onUpdateMarker}
            onUpdateScale={onUpdateMarkerScale}
          />
        )}

        {zone && (
          <ZoneInspector
            zone={zone}
            liveRefs={liveRefs}
            onUpdate={patch => onUpdateZone(zone.id, patch)}
            onRemove={() => onRemoveZone(zone.id)}
          />
        )}

        {light && (
          <LightInspector
            light={light}
            liveRefs={liveRefs}
            onUpdate={patch => onUpdateLight(light.id, patch)}
            onRemove={() => onRemoveLight(light.id)}
          />
        )}

        {terrain && (
          <TerrainInspector
            terrain={terrain}
            onUpdate={patch => onUpdateTerrain(terrain.id, patch)}
            onRemove={() => onRemoveTerrain(terrain.id)}
          />
        )}

        {isPlayerRef && (
          <PlayerRefInspector
            pos={playerRefPos}
            onUpdate={onUpdatePlayerRefPos}
          />
        )}

        {isSun && (
          <SunInspector
            ambient={ambient}
            onUpdate={onUpdateAmbient}
          />
        )}
      </div>
    </div>
  )
}
