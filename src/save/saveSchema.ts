export interface SaveData {
  version: 1
  unlockedLevels: number[]
  bestScores: Record<string, number>  // levelId → score
  player1CharacterId: string
  selectedCarId: string
  lastPlayedLevelIndex: number
}

export const DEFAULT_SAVE: SaveData = {
  version: 1,
  unlockedLevels: [0],
  bestScores: {},
  player1CharacterId: 'aoi',
  selectedCarId: 'cybertruck',
  lastPlayedLevelIndex: 0,
}
