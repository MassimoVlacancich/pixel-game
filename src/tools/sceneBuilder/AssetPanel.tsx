import { useState } from 'react'
import { ASSET_GROUPS, GROUP_NAMES, type AssetEntry } from './allAssets'
import { MARKERS } from './useSceneBuilderState'
import type { PlacedObject, SceneLight, SceneZone } from './useSceneBuilderState'

const FONT = "'Press Start 2P', monospace"

type PanelTab = 'assets' | 'scene'

interface Props {
  onSpawn: (entry: AssetEntry) => void
  objects: PlacedObject[]
  lights: SceneLight[]
  zones: SceneZone[]
  selectedId: string | null
  hiddenIds: Set<string>
  onSelectObject: (id: string) => void
  onToggleHidden: (id: string) => void
  onToggleAllHidden: (hide: boolean) => void
  onAddTerrain: (type: 'ground' | 'river') => void
  paintMode?: boolean
  paintAsset?: AssetEntry | null
}

// ── Assets tab ────────────────────────────────────────────────────────────────

interface AssetsTabProps {
  onSpawn: (entry: AssetEntry) => void
  onAddTerrain: (type: 'ground' | 'river') => void
  paintMode?: boolean
  paintAsset?: AssetEntry | null
}

function AssetsTab({ onSpawn, onAddTerrain, paintMode, paintAsset }: AssetsTabProps) {
  const [activeGroup, setActiveGroup] = useState(GROUP_NAMES[0] ?? '')
  const assets = ASSET_GROUPS[activeGroup] ?? []

  return (
    <>
      {/* Group tabs */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 4, padding: 6,
        borderBottom: '1px solid #333',
      }}>
        {GROUP_NAMES.map(g => (
          <button key={g} onClick={() => setActiveGroup(g)} style={{
            fontFamily: FONT, fontSize: 6, letterSpacing: 1,
            padding: '4px 6px', cursor: 'pointer',
            background: g === activeGroup ? '#44AAFF' : 'transparent',
            color: g === activeGroup ? '#000' : '#888',
            border: `1px solid ${g === activeGroup ? '#44AAFF' : '#444'}`,
            outline: 'none',
          }}>
            {g.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Paint mode hint */}
      {paintMode && (
        <div style={{
          padding: '5px 8px',
          background: '#0D1A0D',
          borderBottom: '1px solid #1A3A1A',
          fontSize: 6, color: '#22AA44', letterSpacing: 1,
        }}>
          {paintAsset ? `STAMP: ${paintAsset.label}` : 'CLICK ASSET TO SELECT STAMP'}
        </div>
      )}

      {/* Asset list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {assets.length === 0 && (
          <p style={{ fontSize: 7, color: '#555', textAlign: 'center', marginTop: 20 }}>
            No assets found.<br />Drop .glb or .obj files<br />into assets/low-poly/{activeGroup}/
          </p>
        )}
        {assets.map(entry => {
          const isActive = paintMode && paintAsset?.path === entry.path
          return (
            <button key={entry.path} onClick={() => onSpawn(entry)} style={{
              fontFamily: FONT, fontSize: 7, letterSpacing: 1,
              padding: '7px 8px', cursor: 'pointer', textAlign: 'left',
              background: isActive ? '#1A3A1A' : '#252535',
              color: isActive ? '#44FF88' : '#CCC',
              border: `1px solid ${isActive ? '#44FF88' : '#3A3A4A'}`,
              outline: 'none',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#2E2E4E' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = '#252535' }}
              title={entry.path}
            >
              {paintMode ? '✦ ' : '+ '}{entry.label}
            </button>
          )
        })}

        {/* Terrain section */}
        <div style={{ borderTop: '1px solid #333', marginTop: 8, paddingTop: 8 }}>
          <div style={{ fontSize: 6, color: '#666', letterSpacing: 2, marginBottom: 6 }}>TERRAIN</div>
          <button
            onClick={() => onAddTerrain('ground')}
            style={{
              fontFamily: FONT, fontSize: 7, letterSpacing: 1,
              padding: '7px 8px', cursor: 'pointer', textAlign: 'left',
              width: '100%', marginBottom: 4,
              background: '#1A2A0A', color: '#88BB44',
              border: '1px solid #3A4A1A', outline: 'none',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#243010')}
            onMouseLeave={e => (e.currentTarget.style.background = '#1A2A0A')}
          >
            + GROUND
          </button>
          <button
            onClick={() => onAddTerrain('river')}
            style={{
              fontFamily: FONT, fontSize: 7, letterSpacing: 1,
              padding: '7px 8px', cursor: 'pointer', textAlign: 'left',
              width: '100%',
              background: '#0A1A2A', color: '#4488BB',
              border: '1px solid #1A3A4A', outline: 'none',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#102030')}
            onMouseLeave={e => (e.currentTarget.style.background = '#0A1A2A')}
          >
            + RIVER
          </button>
        </div>
      </div>
    </>
  )
}

// ── Scene tab ─────────────────────────────────────────────────────────────────

interface SceneTabProps {
  objects: PlacedObject[]
  lights: SceneLight[]
  zones: SceneZone[]
  selectedId: string | null
  hiddenIds: Set<string>
  onSelectObject: (id: string) => void
  onToggleHidden: (id: string) => void
  onToggleAllHidden: (hide: boolean) => void
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{
      fontSize: 6, color: '#555', letterSpacing: 2,
      padding: '8px 2px 4px', userSelect: 'none',
    }}>
      {label}
    </div>
  )
}

function SceneRow({
  id, label, color, isSelected, onSelect,
  isHidden, onToggleHidden,
}: {
  id: string; label: string; color: string; isSelected: boolean; onSelect: () => void
  isHidden?: boolean; onToggleHidden?: () => void
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      background: isSelected ? '#1E2E4E' : '#1A1A2A',
      border: `1px solid ${isSelected ? color : '#333'}`,
      borderRadius: 2,
    }}>
      {/* Colour dot / visibility toggle */}
      {onToggleHidden ? (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleHidden() }}
          title={isHidden ? 'Show' : 'Hide'}
          style={{
            fontFamily: FONT, fontSize: 10,
            width: 28, flexShrink: 0, padding: '5px 0',
            background: 'transparent',
            color: isHidden ? '#444' : '#AAA',
            border: 'none', cursor: 'pointer', outline: 'none', lineHeight: 1,
          }}
        >
          {isHidden ? '○' : '●'}
        </button>
      ) : (
        <div style={{
          width: 28, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: color, flexShrink: 0,
          }} />
        </div>
      )}

      <button
        onClick={onSelect}
        style={{
          fontFamily: FONT, fontSize: 6, letterSpacing: 1,
          flex: 1, padding: '6px 4px 6px 0',
          background: 'transparent',
          color: isHidden ? '#555' : (isSelected ? color : '#AAA'),
          border: 'none', cursor: 'pointer', outline: 'none',
          textAlign: 'left',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}
        title={label}
      >
        {label}
      </button>
    </div>
  )
}

function SceneTab({ objects, lights, zones, selectedId, hiddenIds, onSelectObject, onToggleHidden, onToggleAllHidden }: SceneTabProps) {
  const listedObjects = objects.filter(o => !o.painted)
  const allHidden = listedObjects.length > 0 && listedObjects.every(o => hiddenIds.has(o.id))

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>

      {/* ── Reference items (always visible) ── */}
      <SectionHeader label="REFERENCE" />

      <SceneRow
        id="player_ref"
        label="Player Ref"
        color="#44AAFF"
        isSelected={selectedId === 'player_ref'}
        onSelect={() => onSelectObject('player_ref')}
      />

      {MARKERS.map(m => (
        <SceneRow
          key={m.id}
          id={`marker:${m.id}`}
          label={m.label}
          color={m.color}
          isSelected={selectedId === `marker:${m.id}`}
          onSelect={() => onSelectObject(`marker:${m.id}`)}
        />
      ))}

      {/* ── Lights ── */}
      <SectionHeader label={`LIGHTS (${lights.length})`} />

      <SceneRow
        id="sun"
        label="Sun (Directional)"
        color="#FFDD44"
        isSelected={selectedId === 'sun'}
        onSelect={() => onSelectObject('sun')}
      />

      {lights.map(light => (
        <SceneRow
          key={light.id}
          id={`light:${light.id}`}
          label={light.name}
          color={light.color}
          isSelected={selectedId === `light:${light.id}`}
          onSelect={() => onSelectObject(`light:${light.id}`)}
        />
      ))}

      {lights.length === 0 && (
        <p style={{ fontSize: 6, color: '#555', marginLeft: 4, marginTop: 2 }}>
          Press L to add a point light.
        </p>
      )}

      {/* ── Zones ── */}
      {zones.length > 0 && (
        <>
          <SectionHeader label={`ZONES (${zones.length})`} />
          {zones.map(zone => (
            <SceneRow
              key={zone.id}
              id={`zone:${zone.id}`}
              label={zone.name}
              color={zone.color}
              isSelected={selectedId === `zone:${zone.id}`}
              onSelect={() => onSelectObject(`zone:${zone.id}`)}
            />
          ))}
        </>
      )}

      {/* ── Placed objects ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        marginTop: 6,
      }}>
        <SectionHeader label={`OBJECTS (${listedObjects.length})`} />
        {listedObjects.length > 0 && (
          <button
            onClick={() => onToggleAllHidden(!allHidden)}
            title={allHidden ? 'Show all' : 'Hide all'}
            style={{
              fontFamily: FONT, fontSize: 6, letterSpacing: 1,
              padding: '2px 5px', cursor: 'pointer', marginBottom: 2,
              background: 'transparent',
              color: allHidden ? '#666' : '#44FF88',
              border: `1px solid ${allHidden ? '#444' : '#44FF88'}`,
              outline: 'none', flexShrink: 0,
            }}
          >
            {allHidden ? 'SHOW' : 'HIDE'}
          </button>
        )}
      </div>

      {listedObjects.length === 0 && (
        <p style={{ fontSize: 7, color: '#555', textAlign: 'center', marginTop: 8 }}>
          No objects yet.<br />Add from ASSETS.
        </p>
      )}

      {listedObjects.map(obj => (
        <SceneRow
          key={obj.id}
          id={obj.id}
          label={obj.name}
          color="#44AAFF"
          isSelected={selectedId === obj.id}
          onSelect={() => onSelectObject(obj.id)}
          isHidden={hiddenIds.has(obj.id)}
          onToggleHidden={() => onToggleHidden(obj.id)}
        />
      ))}
    </div>
  )
}

// ── Root panel ────────────────────────────────────────────────────────────────

export default function AssetPanel({
  onSpawn, objects, lights, zones, selectedId, hiddenIds, onSelectObject,
  onToggleHidden, onToggleAllHidden, onAddTerrain, paintMode, paintAsset,
}: Props) {
  const [activeTab, setActiveTab] = useState<PanelTab>('assets')

  return (
    <div style={{
      width: 220, flexShrink: 0,
      background: '#1A1A2A', borderRight: '2px solid #333',
      display: 'flex', flexDirection: 'column',
      fontFamily: FONT, overflow: 'hidden',
    }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid #333' }}>
        {(['assets', 'scene'] as PanelTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              fontFamily: FONT, fontSize: 7, letterSpacing: 1,
              padding: '9px 4px',
              background: activeTab === tab ? '#111122' : 'transparent',
              color: activeTab === tab ? '#44AAFF' : '#555',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid #44AAFF' : '2px solid transparent',
              cursor: 'pointer', outline: 'none',
            }}
          >
            {tab === 'assets' ? 'ASSETS' : `SCENE (${objects.filter(o => !o.painted).length + lights.length + zones.length + MARKERS.length + 2})`}
          </button>
        ))}
      </div>

      {activeTab === 'assets' && (
        <AssetsTab
          onSpawn={onSpawn}
          onAddTerrain={onAddTerrain}
          paintMode={paintMode}
          paintAsset={paintAsset}
        />
      )}
      {activeTab === 'scene' && (
        <SceneTab
          objects={objects}
          lights={lights}
          zones={zones}
          selectedId={selectedId}
          hiddenIds={hiddenIds}
          onSelectObject={onSelectObject}
          onToggleHidden={onToggleHidden}
          onToggleAllHidden={onToggleAllHidden}
        />
      )}
    </div>
  )
}
