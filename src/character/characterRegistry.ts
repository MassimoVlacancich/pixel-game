export type MeshType = 'sheep' | 'rugby' | 'plant' | 'book'
export type HairStyle = 'short' | 'bob' | 'long'

export interface CharacterConfig {
  id: string
  name: string
  // Human characters
  bodyColor?: string
  pantsColor?: string
  skinColor?: string
  hairColor?: string
  hairStyle?: HairStyle
  // Object buddies
  meshType?: MeshType
}

/** Playable human characters — used for all player slots */
export const CHARACTERS: CharacterConfig[] = [
  {
    id: 'nick', name: 'Nick',
    bodyColor: '#1A1A1A', pantsColor: '#E86820', skinColor: '#F5CBA7',
    hairColor: '#5C3010', hairStyle: 'short',
  },
  {
    id: 'phoebe', name: 'Phoebe',
    bodyColor: '#7B4FA6', pantsColor: '#1A1A1A', skinColor: '#F5CBA7',
    hairColor: '#6B3A1F', hairStyle: 'bob',
  },
  {
    id: 'silvia', name: 'Silvia',
    bodyColor: '#E85890', pantsColor: '#1A2A5A', skinColor: '#F5CBA7',
    hairColor: '#5A3010', hairStyle: 'long',
  },
  {
    id: 'max', name: 'Max',
    bodyColor: '#88CC66', pantsColor: '#1A1A1A', skinColor: '#F5CBA7',
    hairColor: '#5C3010', hairStyle: 'short',
  },
]

/** Buddy-only object characters — shown in solo+buddy mode for the companion slot */
export const BUDDIES: CharacterConfig[] = [
  { id: 'woolly', name: 'Woolly', meshType: 'sheep' },
  { id: 'rugger', name: 'Rugger', meshType: 'rugby' },
  { id: 'sprout', name: 'Sprout', meshType: 'plant' },
  { id: 'paige',  name: 'Paige',  meshType: 'book'  },
]

export function getCharacter(id: string): CharacterConfig {
  return [...CHARACTERS, ...BUDDIES].find((c) => c.id === id) ?? CHARACTERS[0]
}
