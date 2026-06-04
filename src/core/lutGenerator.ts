import type { CubeLUT } from './cubeParser'

type LutGenerationOptions = {
  size?: number
  title?: string
}

function lutIndex(size: number, r: number, g: number, b: number): number {
  return ((b * size + g) * size + r) * 3
}

function addSample(
  sums: Float64Array,
  weights: Float64Array,
  size: number,
  r: number,
  g: number,
  b: number,
  weight: number,
  targetR: number,
  targetG: number,
  targetB: number,
): void {
  if (weight <= 0) {
    return
  }

  const colorIndex = lutIndex(size, r, g, b)
  const nodeIndex = colorIndex / 3

  sums[colorIndex] += targetR * weight
  sums[colorIndex + 1] += targetG * weight
  sums[colorIndex + 2] += targetB * weight
  weights[nodeIndex] += weight
}

function scatterPixelSample(
  sums: Float64Array,
  weights: Float64Array,
  size: number,
  sourceR: number,
  sourceG: number,
  sourceB: number,
  targetR: number,
  targetG: number,
  targetB: number,
): void {
  const scaledR = (sourceR / 255) * (size - 1)
  const scaledG = (sourceG / 255) * (size - 1)
  const scaledB = (sourceB / 255) * (size - 1)

  const r0 = Math.floor(scaledR)
  const g0 = Math.floor(scaledG)
  const b0 = Math.floor(scaledB)
  const r1 = Math.min(r0 + 1, size - 1)
  const g1 = Math.min(g0 + 1, size - 1)
  const b1 = Math.min(b0 + 1, size - 1)

  const fr = scaledR - r0
  const fg = scaledG - g0
  const fb = scaledB - b0

  addSample(sums, weights, size, r0, g0, b0, (1 - fr) * (1 - fg) * (1 - fb), targetR, targetG, targetB)
  addSample(sums, weights, size, r1, g0, b0, fr * (1 - fg) * (1 - fb), targetR, targetG, targetB)
  addSample(sums, weights, size, r0, g1, b0, (1 - fr) * fg * (1 - fb), targetR, targetG, targetB)
  addSample(sums, weights, size, r1, g1, b0, fr * fg * (1 - fb), targetR, targetG, targetB)
  addSample(sums, weights, size, r0, g0, b1, (1 - fr) * (1 - fg) * fb, targetR, targetG, targetB)
  addSample(sums, weights, size, r1, g0, b1, fr * (1 - fg) * fb, targetR, targetG, targetB)
  addSample(sums, weights, size, r0, g1, b1, (1 - fr) * fg * fb, targetR, targetG, targetB)
  addSample(sums, weights, size, r1, g1, b1, fr * fg * fb, targetR, targetG, targetB)
}

function fillMissingNodes(data: Float32Array, known: Uint8Array, size: number): void {
  const queue: number[] = []

  for (let node = 0; node < known.length; node += 1) {
    if (known[node]) {
      queue.push(node)
    }
  }

  if (queue.length === 0) {
    throw new Error('两张图片没有可用于生成 LUT 的有效像素。')
  }

  let cursor = 0
  const neighborOffsets = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ] as const

  while (cursor < queue.length) {
    const node = queue[cursor]
    cursor += 1

    const r = node % size
    const g = Math.floor(node / size) % size
    const b = Math.floor(node / (size * size))
    const sourceIndex = node * 3

    for (const [dr, dg, db] of neighborOffsets) {
      const nr = r + dr
      const ng = g + dg
      const nb = b + db

      if (nr < 0 || nr >= size || ng < 0 || ng >= size || nb < 0 || nb >= size) {
        continue
      }

      const neighborNode = (nb * size + ng) * size + nr
      if (known[neighborNode]) {
        continue
      }

      const targetIndex = neighborNode * 3
      data[targetIndex] = data[sourceIndex]
      data[targetIndex + 1] = data[sourceIndex + 1]
      data[targetIndex + 2] = data[sourceIndex + 2]
      known[neighborNode] = 1
      queue.push(neighborNode)
    }
  }
}

export function generateLUTFromImagePair(
  sourceImageData: ImageData,
  targetImageData: ImageData,
  options: LutGenerationOptions = {},
): CubeLUT {
  if (sourceImageData.width !== targetImageData.width || sourceImageData.height !== targetImageData.height) {
    throw new Error('原图和效果图的采样尺寸必须一致。')
  }

  const size = options.size ?? 16
  if (!Number.isInteger(size) || size < 2 || size > 64) {
    throw new Error('LUT 尺寸必须是 2 到 64 之间的整数。')
  }

  const nodeCount = size * size * size
  const sums = new Float64Array(nodeCount * 3)
  const weights = new Float64Array(nodeCount)
  const source = sourceImageData.data
  const target = targetImageData.data

  for (let index = 0; index < source.length; index += 4) {
    if (source[index + 3] < 8 || target[index + 3] < 8) {
      continue
    }

    scatterPixelSample(
      sums,
      weights,
      size,
      source[index],
      source[index + 1],
      source[index + 2],
      target[index] / 255,
      target[index + 1] / 255,
      target[index + 2] / 255,
    )
  }

  const data = new Float32Array(nodeCount * 3)
  const known = new Uint8Array(nodeCount)

  for (let node = 0; node < nodeCount; node += 1) {
    const colorIndex = node * 3

    if (weights[node] > 0) {
      data[colorIndex] = sums[colorIndex] / weights[node]
      data[colorIndex + 1] = sums[colorIndex + 1] / weights[node]
      data[colorIndex + 2] = sums[colorIndex + 2] / weights[node]
      known[node] = 1
      continue
    }

    const r = node % size
    const g = Math.floor(node / size) % size
    const b = Math.floor(node / (size * size))
    data[colorIndex] = r / (size - 1)
    data[colorIndex + 1] = g / (size - 1)
    data[colorIndex + 2] = b / (size - 1)
  }

  fillMissingNodes(data, known, size)

  return {
    title: options.title ?? 'Generated by alpha-z',
    size,
    domainMin: [0, 0, 0],
    domainMax: [1, 1, 1],
    data,
  }
}
