import type { SaveData } from './saveSchema'
import { DEFAULT_SAVE } from './saveSchema'

const SAVE_KEY = 'pixel-game-save-v1'

export function readSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return { ...DEFAULT_SAVE }
    const parsed = JSON.parse(raw) as SaveData
    if (parsed.version !== 1) return { ...DEFAULT_SAVE }
    return parsed
  } catch {
    return { ...DEFAULT_SAVE }
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data))
  } catch {
    // quota exceeded or private mode — silently ignore
  }
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY)
}
