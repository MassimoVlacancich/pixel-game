import { EffectComposer, Vignette } from '@react-three/postprocessing'

export default function PixelPostProcessing() {
  return (
    <EffectComposer>
      <Vignette eskil={false} offset={0.2} darkness={0.5} />
    </EffectComposer>
  )
}
