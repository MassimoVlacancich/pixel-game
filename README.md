# Pixel Game

A cozy Japan-themed pixel-art 3D game built with React, Three.js, and React Three Fiber. Features a cherry blossom forest, shrine, toon shading with outlines, and mobile joystick controls.

## Getting Started

**Prerequisites:** Node.js 18+

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with HMR |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |

## Tech Stack

- [React 19](https://react.dev) + [TypeScript](https://www.typescriptlang.org)
- [Three.js](https://threejs.org) via [React Three Fiber](https://docs.pmnd.rs/react-three-fiber)
- [@react-three/drei](https://github.com/pmndrs/drei) — helpers and abstractions
- [@react-three/postprocessing](https://github.com/pmndrs/react-postprocessing) — pixel/outline effects
- [Vite](https://vite.dev) — build tooling

## Controls

- **Desktop:** WASD or arrow keys to move
- **Mobile:** On-screen joystick (landscape orientation recommended)
