export type CompletionCondition =
  | { type: 'reach_point';        position: [number, number, number]; radius: number }
  | { type: 'collect_items';      required: number; itemTag: string }
  | { type: 'score_target';       target: number }
  | { type: 'tutorial_steps';     steps: string[] }
  | { type: 'reach_destination';  distance: number }

export type FailCondition =
  | { type: 'fall_off';    threshold: number }   // y < threshold
  | { type: 'timer';       seconds: number }
  | { type: 'battery_dead' }
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

// ── Drive level tuning ────────────────────────────────────────────────────────
const DRIVE_LEVEL_DISTANCE = 1600  // distance units to travel before level completes (higher = longer)

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
  {
    id: 'drive_ev',
    index: 1,
    name: 'Drive the EV',
    sceneKey: 'DriveScene',
    player1Start: [0, 0.5, 0],
    player2Start: [0, 0.5, 0],
    buddyStart: [0, 0.5, 0],
    gravity: [0, -9.81, 0],
    completion: { type: 'reach_destination', distance: DRIVE_LEVEL_DISTANCE },
    fail: { type: 'battery_dead' },
  },
]
