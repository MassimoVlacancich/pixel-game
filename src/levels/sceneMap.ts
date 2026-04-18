import { lazy } from 'react'
import type { LevelSceneProps } from '../game/LevelRunner'

// Stable top-level lazy refs — never inline in JSX (would re-suspend on every render)
export const SCENE_MAP: Record<string, React.LazyExoticComponent<React.ComponentType<LevelSceneProps>>> = {
  JapanScene:   lazy(() => import('../scene/JapanScene')),
  DriveScene:   lazy(() => import('../scene/DriveScene')),
  KitchenScene: lazy(() => import('../scene/KitchenScene')),
  BarScene:     lazy(() => import('../scene/BarScene')),
  HikeScene:    lazy(() => import('../scene/HikeScene')),
}
