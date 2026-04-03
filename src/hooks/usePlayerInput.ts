import { useEffect, useRef } from 'react'
import type { KeyMap } from './useKeyboard'

const BINDINGS: Record<0 | 1, Record<string, keyof KeyMap>> = {
  0: {
    KeyW: 'forward', ArrowUp: 'forward',
    KeyS: 'backward', ArrowDown: 'backward',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    Space: 'jump',
  },
  1: {
    KeyI: 'forward', Numpad8: 'forward',
    KeyK: 'backward', Numpad5: 'backward',
    KeyJ: 'left', Numpad4: 'left',
    KeyL: 'right', Numpad6: 'right',
    KeyN: 'jump',
  },
}

export function usePlayerInput(playerIndex: 0 | 1 = 0): React.MutableRefObject<KeyMap> {
  const keys = useRef<KeyMap>({
    forward: false, backward: false, left: false, right: false, jump: false,
  })

  useEffect(() => {
    const map = BINDINGS[playerIndex]
    const onDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      const key = map[e.code]
      if (key) keys.current[key] = true
    }
    const onUp = (e: KeyboardEvent) => {
      const key = map[e.code]
      if (key) keys.current[key] = false
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [playerIndex])

  return keys
}
