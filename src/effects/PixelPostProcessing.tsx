import { EffectComposer, Pixelation } from '@react-three/postprocessing'

interface PixelPostProcessingProps {
  granularity?: number
}

export default function PixelPostProcessing({ granularity = 6 }: PixelPostProcessingProps) {
  return (
    <EffectComposer>
      <Pixelation granularity={granularity} />
    </EffectComposer>
  )
}
