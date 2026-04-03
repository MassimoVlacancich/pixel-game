// useKeyboard is a thin wrapper around usePlayerInput for player 0.
// Kept for backward compatibility.
import { usePlayerInput } from './usePlayerInput'

export type KeyMap = {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
  jump: boolean
}

export function useKeyboard(): React.MutableRefObject<KeyMap> {
  return usePlayerInput(0)
}
