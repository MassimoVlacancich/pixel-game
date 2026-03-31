import { useEffect, useRef } from 'react'

export type KeyMap = {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
}

const KEY_BINDINGS: Record<string, keyof KeyMap> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'backward',
  ArrowDown: 'backward',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
}

export function useKeyboard(): React.MutableRefObject<KeyMap> {
  const keys = useRef<KeyMap>({
    forward: false,
    backward: false,
    left: false,
    right: false,
  })

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      const key = KEY_BINDINGS[e.code]
      if (key) keys.current[key] = true
    }
    const onUp = (e: KeyboardEvent) => {
      const key = KEY_BINDINGS[e.code]
      if (key) keys.current[key] = false
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [])

  return keys
}
