import { Howl, Howler } from 'howler'

// ---------------------------------------------------------------------------
// SFX — single Howl with sprite map
// Audio files go in public/audio/. Stub paths for now — replace with real files.
// ---------------------------------------------------------------------------
let sfx: Howl | null = null

function getSFX(): Howl {
  if (!sfx) {
    sfx = new Howl({
      src: ['/audio/sfx.webm', '/audio/sfx.mp3'],
      sprite: {
        jump:     [0,   300],
        land:     [400, 200],
        collect:  [700, 350],
        complete: [1100, 800],
        step:     [2000, 120],
      },
      volume: 0.6,
      // Gracefully fail if file not found
      onloaderror: () => { sfx = null },
    })
  }
  return sfx
}

// ---------------------------------------------------------------------------
// BGM — one Howl per track, lazy-loaded
// ---------------------------------------------------------------------------
const bgmMap: Record<string, Howl> = {}
let currentBgmTrack: string | null = null

function getBGM(track: string): Howl {
  if (!bgmMap[track]) {
    bgmMap[track] = new Howl({
      src: [`/audio/bgm-${track}.webm`, `/audio/bgm-${track}.mp3`],
      loop: true,
      volume: 0.4,
      onloaderror: () => { delete bgmMap[track] },
    })
  }
  return bgmMap[track]
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export function playBGM(track: string): void {
  if (currentBgmTrack === track) return
  if (currentBgmTrack && bgmMap[currentBgmTrack]) {
    const prev = bgmMap[currentBgmTrack]
    prev.fade(prev.volume(), 0, 800)
    prev.once('fade', () => prev.stop())
  }
  currentBgmTrack = track
  getBGM(track).play()
}

export function stopBGM(): void {
  if (currentBgmTrack && bgmMap[currentBgmTrack]) {
    bgmMap[currentBgmTrack].stop()
  }
  currentBgmTrack = null
}

export type SFXName = 'jump' | 'land' | 'collect' | 'complete' | 'step'

export function playSFX(name: SFXName): void {
  try { getSFX().play(name) } catch { /* audio not loaded yet */ }
}

export function setMasterVolume(v: number): void {
  Howler.volume(Math.max(0, Math.min(1, v)))
}

export function setBGMVolume(v: number): void {
  Object.values(bgmMap).forEach((h) => h.volume(Math.max(0, Math.min(1, v))))
}

export function setSFXVolume(v: number): void {
  sfx?.volume(Math.max(0, Math.min(1, v)))
}

/** Call this on the first user gesture to unlock audio on iOS */
export function unlockAudio(): void {
  if (Howler.ctx?.state === 'suspended') {
    Howler.ctx.resume()
  }
}

// ---------------------------------------------------------------------------
// Audio settings persistence
// ---------------------------------------------------------------------------
const AUDIO_KEY = 'pixel-game-audio'

interface AudioSettings { master: number; music: number; sfx: number }

export function loadAudioSettings(): AudioSettings {
  try {
    const raw = localStorage.getItem(AUDIO_KEY)
    if (raw) return JSON.parse(raw) as AudioSettings
  } catch { /* ignore */ }
  return { master: 1, music: 0.4, sfx: 0.6 }
}

export function saveAudioSettings(s: AudioSettings): void {
  try { localStorage.setItem(AUDIO_KEY, JSON.stringify(s)) } catch { /* ignore */ }
  setMasterVolume(s.master)
  setBGMVolume(s.music)
  setSFXVolume(s.sfx)
}
