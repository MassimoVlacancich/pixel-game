import { useEffect, useRef, useCallback } from 'react'

export interface MenuInput {
  left: boolean
  right: boolean
  up: boolean
  down: boolean
  confirm: boolean
  back: boolean
  toggle: boolean
}

type InputCallback = (input: MenuInput) => void

// Keyboard bindings per player
const KB: Record<0 | 1, Record<string, keyof MenuInput>> = {
  0: {
    ArrowLeft: 'left', ArrowRight: 'right',
    ArrowUp: 'up', ArrowDown: 'down',
    Enter: 'confirm', Space: 'confirm',
    Escape: 'back',
    Tab: 'toggle',
  },
  1: {
    KeyJ: 'left', KeyL: 'right',
    KeyI: 'up', KeyK: 'down',
    KeyN: 'confirm',
    Escape: 'back',
  },
}

// Gamepad axis/button thresholds
const AXIS_THRESHOLD = 0.5

export function useMenuInput(playerIndex: 0 | 1, onInput: InputCallback) {
  const onInputRef = useRef(onInput)
  onInputRef.current = onInput

  // Track previous gamepad button states for edge detection
  const prevGp = useRef<Record<string, boolean>>({})
  const prevKb = useRef<Record<string, boolean>>({})
  const rafRef = useRef<number>(0)

  // Guard: require confirm to be released before it can fire.
  // Prevents input bleed when the confirm key that opened this screen is still held.
  const needsRelease = useRef(true)

  // Keyboard state
  const kbDown = useRef<Set<string>>(new Set())

  useEffect(() => {
    const bindings = KB[playerIndex]

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (bindings[e.code]) {
        e.preventDefault()
        kbDown.current.add(e.code)
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      kbDown.current.delete(e.code)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    // RAF polling for gamepad + keyboard edge detection
    const poll = () => {
      const input: MenuInput = { left: false, right: false, up: false, down: false, confirm: false, back: false, toggle: false }

      // --- Keyboard edges ---
      for (const code of Object.keys(bindings)) {
        const action = bindings[code]
        const isDown = kbDown.current.has(code)
        const wasDown = prevKb.current[code] ?? false
        if (isDown && !wasDown) input[action] = true
        prevKb.current[code] = isDown
      }

      // --- Gamepad ---
      const gp = navigator.getGamepads()[playerIndex]
      if (gp) {
        // Buttons: 0=A/confirm, 1=B/back, 3=Y/toggle
        // D-pad: 12=up,13=down,14=left,15=right
        const gpMap: Array<[string, keyof MenuInput]> = [
          ['b0', 'confirm'],
          ['b1', 'back'],
          ['b3', 'toggle'],
          ['b12', 'up'],
          ['b13', 'down'],
          ['b14', 'left'],
          ['b15', 'right'],
        ]
        for (const [key, action] of gpMap) {
          const idx = parseInt(key.slice(1))
          const isDown = gp.buttons[idx]?.pressed ?? false
          const wasDown = prevGp.current[key] ?? false
          if (isDown && !wasDown) input[action] = true
          prevGp.current[key] = isDown
        }

        // Left stick axes
        const axisX = gp.axes[0] ?? 0
        const axisY = gp.axes[1] ?? 0
        const leftDown  = axisX < -AXIS_THRESHOLD
        const rightDown = axisX >  AXIS_THRESHOLD
        const upDown    = axisY < -AXIS_THRESHOLD
        const downDown  = axisY >  AXIS_THRESHOLD
        if (leftDown  && !(prevGp.current['axisL'] ?? false)) input.left  = true
        if (rightDown && !(prevGp.current['axisR'] ?? false)) input.right = true
        if (upDown    && !(prevGp.current['axisU'] ?? false)) input.up    = true
        if (downDown  && !(prevGp.current['axisD'] ?? false)) input.down  = true
        prevGp.current['axisL'] = leftDown
        prevGp.current['axisR'] = rightDown
        prevGp.current['axisU'] = upDown
        prevGp.current['axisD'] = downDown
      }

      // Require confirm to be released once before it can fire (prevents input bleed
      // from the keypress that opened this screen still being held on mount).
      if (needsRelease.current) {
        const confirmHeld =
          kbDown.current.has('Enter') || kbDown.current.has('Space') ||
          kbDown.current.has('KeyN') ||
          (gp?.buttons[0]?.pressed ?? false)
        if (!confirmHeld) needsRelease.current = false
        input.confirm = false
      }

      // Fire callback if any input fired
      if (input.up || input.down || input.left || input.right || input.confirm || input.back || input.toggle) {
        onInputRef.current(input)
      }

      rafRef.current = requestAnimationFrame(poll)
    }

    rafRef.current = requestAnimationFrame(poll)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [playerIndex])
}

// Convenience: same hook but returns a stable "trigger" ref you can read reactively
// Not needed for our usage — we use the callback form above.
export type { InputCallback }
