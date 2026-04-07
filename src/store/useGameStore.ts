import { create } from 'zustand'
import { readSave, writeSave } from '../save/saveManager'

export type Screen =
  | 'MAIN_MENU'
  | 'LEVEL_SELECT'
  | 'CHARACTER_SELECT'
  | 'LOADING'
  | 'PLAYING'
  | 'PAUSED'
  | 'LEVEL_COMPLETE'
  | 'GAME_OVER'

interface GameStore {
  screen: Screen
  levelIndex: number
  /** Incremented on retry to force scene remount without changing levelIndex */
  levelKey: number
  score: number
  bestScores: Record<string, number>
  unlockedLevels: number[]
  player1CharacterId: string
  player2CharacterId: string | null  // null = single player
  buddyCharacterId: string | null    // null = no buddy
  isTwoPlayer: boolean
  batteryPct: number
  hitEffect: { text: string; color: string; id: number } | null

  // Actions
  setScreen: (s: Screen) => void
  setLevelIndex: (i: number) => void
  startLevel: (index: number) => void
  retryLevel: () => void
  completeLevel: (levelId: string) => void
  addScore: (delta: number) => void
  setBattery: (n: number) => void
  setHitEffect: (text: string, color: string) => void
  clearHitEffect: () => void
  setPlayer1Character: (id: string) => void
  setPlayer2Character: (id: string | null) => void
  setBuddyCharacter: (id: string | null) => void
  setTwoPlayer: (v: boolean) => void
  loadSave: () => void
  persistSave: () => void
}

export const useGameStore = create<GameStore>((set, get) => ({
  screen: 'MAIN_MENU',
  levelIndex: 0,
  levelKey: 0,
  score: 0,
  bestScores: {},
  unlockedLevels: [0],
  player1CharacterId: 'aoi',
  player2CharacterId: null,
  buddyCharacterId: 'hana',
  isTwoPlayer: false,
  batteryPct: 100,
  hitEffect: null,

  setScreen: (screen) => set({ screen }),
  setLevelIndex: (levelIndex) => set({ levelIndex }),
  setBattery: (batteryPct) => set({ batteryPct }),

  startLevel: (levelIndex) => {
    set({ screen: 'LOADING', levelIndex, score: 0 })
    // Transition to PLAYING after a brief tick (lets Suspense show loading screen)
    setTimeout(() => set({ screen: 'PLAYING' }), 50)
  },

  retryLevel: () => {
    set((s) => ({ screen: 'PLAYING', score: 0, levelKey: s.levelKey + 1 }))
  },

  completeLevel: (levelId) => {
    set((s) => {
      const nextIndex = s.levelIndex + 1
      const bestScores = { ...s.bestScores }
      if ((bestScores[levelId] ?? 0) < s.score) bestScores[levelId] = s.score

      const unlockedLevels = s.unlockedLevels.includes(nextIndex)
        ? s.unlockedLevels
        : [...s.unlockedLevels, nextIndex]

      return { screen: 'LEVEL_COMPLETE', bestScores, unlockedLevels }
    })
    get().persistSave()
  },

  addScore: (delta) => set((s) => ({ score: s.score + delta })),

  setHitEffect: (text, color) =>
    set((s) => ({ hitEffect: { text, color, id: (s.hitEffect?.id ?? 0) + 1 } })),
  clearHitEffect: () => set({ hitEffect: null }),

  setPlayer1Character: (id) => set({ player1CharacterId: id }),
  setPlayer2Character: (id) => set({ player2CharacterId: id }),
  setBuddyCharacter: (id) => set({ buddyCharacterId: id }),
  setTwoPlayer: (v) => set({ isTwoPlayer: v, player2CharacterId: v ? 'hana' : null }),

  loadSave: () => {
    const data = readSave()
    set({
      unlockedLevels: data.unlockedLevels,
      bestScores: data.bestScores,
      player1CharacterId: data.player1CharacterId,
      levelIndex: data.lastPlayedLevelIndex,
    })
  },

  persistSave: () => {
    const s = get()
    writeSave({
      version: 1,
      unlockedLevels: s.unlockedLevels,
      bestScores: s.bestScores,
      player1CharacterId: s.player1CharacterId,
      lastPlayedLevelIndex: s.levelIndex,
    })
  },
}))
