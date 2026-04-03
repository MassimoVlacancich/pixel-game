import { useEffect, useState } from 'react'
import { useGameStore } from '../store/useGameStore'

interface TutorialPromptProps {
  messages: string[]
}

export default function TutorialPrompt({ messages }: TutorialPromptProps) {
  const levelKey = useGameStore((s) => s.levelKey)
  const [index, setIndex] = useState(0)

  // Reset on level restart
  useEffect(() => { setIndex(0) }, [levelKey])

  // Expose advance function globally so the scene can call it
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__advanceTutorial = () => {
      setIndex((i) => Math.min(i + 1, messages.length - 1))
    }
    return () => { delete (window as unknown as Record<string, unknown>).__advanceTutorial }
  }, [messages.length])

  if (index >= messages.length) return null

  return (
    <div style={{
      position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(26,8,0,0.88)',
      border: '4px solid #8B5A3C',
      boxShadow: '4px 4px 0 #000',
      padding: '20px 40px',
      pointerEvents: 'none',
      display: 'flex', alignItems: 'center', gap: 24,
      whiteSpace: 'nowrap',
    }}>
      <span style={{
        fontFamily: "'Press Start 2P', monospace",
        fontSize: 14,
        color: '#FFD9C0',
        letterSpacing: 1,
        lineHeight: 1.8,
        textShadow: '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000',
      }}>
        {messages[index]}
      </span>
      {messages.length > 1 && (
        <span style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 9, color: '#8B5A3C', letterSpacing: 1,
          flexShrink: 0,
        }}>
          {index + 1}/{messages.length}
        </span>
      )}
    </div>
  )
}
