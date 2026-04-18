import { useState } from 'react'

const FONT = "'Press Start 2P', monospace"

interface Props {
  sceneName: string
  onSceneNameChange: (name: string) => void
  onSave: () => void
  onLoad: () => void
  onExportJSON: () => string
}

export default function ExportPanel({ sceneName, onSceneNameChange, onSave, onLoad, onExportJSON }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const json = onExportJSON()
    await navigator.clipboard.writeText(json)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleDownload = () => {
    const json = onExportJSON()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${sceneName || 'scene'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{
      height: 52, flexShrink: 0,
      background: '#111122', borderTop: '2px solid #333',
      display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px',
      fontFamily: FONT,
    }}>
      <span style={{ fontSize: 7, color: '#666', letterSpacing: 1 }}>SCENE:</span>
      <input
        value={sceneName}
        onChange={e => onSceneNameChange(e.target.value)}
        style={{
          fontFamily: FONT, fontSize: 8,
          width: 120, padding: '5px 6px',
          background: '#0D0D1A', color: '#EEE',
          border: '1px solid #444', outline: 'none',
        }}
        placeholder="scene name"
      />

      <button onClick={onLoad} style={btnStyle('#1A2A3A', '#44AAFF', '#2A4A6A')}>
        LOAD
      </button>

      <button onClick={onSave} style={btnStyle('#1A3A1A', '#44FF88', '#2A5A2A')}>
        SAVE
      </button>

      <button onClick={handleCopy} style={btnStyle('#1A2A3A', '#44AAFF', '#2A4A6A')}>
        {copied ? 'COPIED!' : 'COPY JSON'}
      </button>

      <button onClick={handleDownload} style={btnStyle('#2A1A3A', '#AA66FF', '#3A2A5A')}>
        DOWNLOAD JSON
      </button>

      <span style={{ marginLeft: 'auto', fontSize: 7, color: '#444' }}>
        T/R/S = mode · G = grid · Del = delete
      </span>
    </div>
  )
}

function btnStyle(bg: string, color: string, _hoverBg: string): React.CSSProperties {
  return {
    fontFamily: FONT, fontSize: 7, letterSpacing: 1,
    padding: '7px 10px', cursor: 'pointer',
    background: bg, color,
    border: `1px solid ${color}44`, outline: 'none',
    // hover handled inline via event — we keep this simple
  }
}
