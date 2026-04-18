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
  winSubtitle?: string  // first line shown on the level-complete overlay
  winTitle?: string     // second line shown on the level-complete overlay
  hideScoreDisplay?: boolean
}

// ── Kitchen level tuning ─────────────────────────────────────────────────────
export const KITCHEN_SCORE_TARGET = 8   // 3 🍍 threshold — change here to tune

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
    winSubtitle: 'You are now ready to pick up your EV!',
    winTitle: 'Time to hit the road...',
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
    winSubtitle: 'You drove the EV all the way to the Lakes!',
    winTitle: 'Time for some cake...',
  },
  {
    id: 'kitchen_cake',
    index: 2,
    name: 'Kitchen',
    sceneKey: 'KitchenScene',
    player1Start: [-2.571, 1.005, -1.255],
    player2Start: [-2.554, 0.983, -2.519],
    buddyStart:   [-2.571, 1.005, -1.255],
    gravity: [0, -35, 0],
    completion: { type: 'score_target', target: 999 },
    fail: { type: 'none' },
    hideScoreDisplay: true,
  },
  {
    id: 'bar_pub',
    index: 3,
    name: 'The Pub',
    sceneKey: 'BarScene',
    player1Start: [4.76, 1.17, 0],
    player2Start: [-3.612, 1.164, -1.68],
    buddyStart:   [-3.612, 1.164, -1.68],
    gravity: [0, -35, 0],
    completion: { type: 'score_target', target: 999 },
    fail: { type: 'none' },
    hideScoreDisplay: true,
    winSubtitle: 'What a pub crawl!',
    winTitle: 'Cheers!',
  },
  {
    id: 'mountain_hike',
    index: 4,
    name: 'The Hike',
    sceneKey: 'HikeScene',
    player1Start: [-5, 8, 55],
    player2Start: [5, 8, 55],
    buddyStart:   [0, 8, 50],
    gravity: [0, -35, 0],
    completion: { type: 'score_target', target: 999 }, // manual — triggered by sit interaction in HikeScene
    fail: { type: 'fall_off', threshold: -30 },
    winSubtitle: 'What a view.',
    winTitle: 'THE HIKE',
    hideScoreDisplay: true,
  },
]
