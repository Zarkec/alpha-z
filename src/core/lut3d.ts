import type { CubeLUT } from './cubeParser'
import { interpolateLUTColor } from './interpolate'

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function blendChannel(original: number, mapped: number, intensity: number): number {
  return Math.round(original + (mapped - original) * intensity)
}

export function applyLUTToImageData(imageData: ImageData, lut: CubeLUT, intensity: number): ImageData {
  const safeIntensity = clamp01(intensity)
  const source = imageData.data
  const output = new Uint8ClampedArray(source.length)

  for (let i = 0; i < source.length; i += 4) {
    const r = source[i]
    const g = source[i + 1]
    const b = source[i + 2]
    const [mappedR, mappedG, mappedB] = interpolateLUTColor(r, g, b, lut)

    output[i] = blendChannel(r, mappedR, safeIntensity)
    output[i + 1] = blendChannel(g, mappedG, safeIntensity)
    output[i + 2] = blendChannel(b, mappedB, safeIntensity)
    output[i + 3] = source[i + 3]
  }

  return new ImageData(output, imageData.width, imageData.height)
}
