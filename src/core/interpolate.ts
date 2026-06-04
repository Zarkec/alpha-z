import type { CubeLUT, RGBTuple } from './cubeParser'

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function normalizeChannel(value: number, domainMin: number, domainMax: number): number {
  const normalizedInput = value / 255
  return clamp((normalizedInput - domainMin) / (domainMax - domainMin), 0, 1)
}

function lutIndex(size: number, r: number, g: number, b: number): number {
  // Common .cube files list red as the fastest-changing axis, then green, then blue.
  return ((b * size + g) * size + r) * 3
}

function readLutColor(lut: CubeLUT, r: number, g: number, b: number): RGBTuple {
  const index = lutIndex(lut.size, r, g, b)
  return [
    lut.data[index] * 255,
    lut.data[index + 1] * 255,
    lut.data[index + 2] * 255,
  ]
}

function mix(a: number, b: number, amount: number): number {
  return a + (b - a) * amount
}

export function interpolateLUTColor(r: number, g: number, b: number, lut: CubeLUT): RGBTuple {
  const scaledR = normalizeChannel(r, lut.domainMin[0], lut.domainMax[0]) * (lut.size - 1)
  const scaledG = normalizeChannel(g, lut.domainMin[1], lut.domainMax[1]) * (lut.size - 1)
  const scaledB = normalizeChannel(b, lut.domainMin[2], lut.domainMax[2]) * (lut.size - 1)

  const r0 = Math.floor(scaledR)
  const g0 = Math.floor(scaledG)
  const b0 = Math.floor(scaledB)
  const r1 = Math.min(r0 + 1, lut.size - 1)
  const g1 = Math.min(g0 + 1, lut.size - 1)
  const b1 = Math.min(b0 + 1, lut.size - 1)

  const fr = scaledR - r0
  const fg = scaledG - g0
  const fb = scaledB - b0

  const c000 = readLutColor(lut, r0, g0, b0)
  const c001 = readLutColor(lut, r0, g0, b1)
  const c010 = readLutColor(lut, r0, g1, b0)
  const c011 = readLutColor(lut, r0, g1, b1)
  const c100 = readLutColor(lut, r1, g0, b0)
  const c101 = readLutColor(lut, r1, g0, b1)
  const c110 = readLutColor(lut, r1, g1, b0)
  const c111 = readLutColor(lut, r1, g1, b1)

  const result: RGBTuple = [0, 0, 0]

  // Trilinear interpolation blends the eight nearest LUT lattice colors by RGB-axis distance.
  for (let channel = 0; channel < 3; channel += 1) {
    const c00 = mix(c000[channel], c100[channel], fr)
    const c01 = mix(c001[channel], c101[channel], fr)
    const c10 = mix(c010[channel], c110[channel], fr)
    const c11 = mix(c011[channel], c111[channel], fr)
    const c0 = mix(c00, c10, fg)
    const c1 = mix(c01, c11, fg)
    result[channel] = clamp(mix(c0, c1, fb), 0, 255)
  }

  return result
}
