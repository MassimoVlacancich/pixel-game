export type CompletionCondition =
  | { type: 'reach_point';    position: [number, number, number]; radius: number }
  | { type: 'collect_items';  required: number; itemTag: string }
  | { type: 'score_target';   target: number }
  | { type: 'tutorial_steps'; steps: string[] }

export type FailCondition =
  | { type: 'fall_off';  threshold: number }   // y < threshold
  | { type: 'timer';     seconds: number }
  | { type: 'none' }

export interface LevelConfig {
  id: string
  index: number
  name: string
  sceneKey: string
  player1Start: [number, number, number]
  player2Start: [number, number, number]
  buddyStart: [number, number, number]
  gravity: [number, number, number]
  completion: CompletionCondition
  fail: FailCondition
  tutorialMessages?: string[]
  bgmTrack?: string
}

export const LEVELS: LevelConfig[] = [
  {
    id: 'japan_tutorial',
    index: 0,
    name: 'Sakura Path',
    sceneKey: 'JapanScene',
    player1Start: [0, 0.95, -5],
    player2Start: [1.2, 0.95, -5],
    buddyStart: [-1.2, 0.95, -5],
    gravity: [0, -35, 0],
    completion: {
      type: 'tutorial_steps',
      steps: ['move', 'jump', 'reach_shrine'],
    },
    fail: { type: 'fall_off', threshold: -5 },
    tutorialMessages: [
      'Use WASD / Left stick to move',
      'Press Space / A to jump',
      'Walk to the shrine to complete the level',
    ],
    bgmTrack: 'japan',
  },
]
