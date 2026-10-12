import { describe, expect, it } from 'vitest'
import { interpolateLUTColor } from '../src/core/interpolate'
import type { CubeLUT } from '../src/core/cubeParser'

/** 构造一个恒等 LUT：输入什么就输出什么。 */
function identityLut(size: number, domainMin: [number, number, number] = [0, 0, 0], domainMax: [number, number, number] = [1, 1, 1]): CubeLUT {
  const data = new Float32Array(size * size * size * 3)

  for (let b = 0; b < size; b += 1) {
    for (let g = 0; g < size; g += 1) {
      for (let r = 0; r < size; r += 1) {
        const index = ((b * size + g) * size + r) * 3
        data[index] = r / (size - 1)
        data[index + 1] = g / (size - 1)
        data[index + 2] = b / (size - 1)
      }
    }
  }

  return { size, domainMin, domainMax, data }
}

/** 构造一个把每个通道都压到固定值的 LUT，用于检查端点行为。 */
function flattenLut(size: number, value: number): CubeLUT {
  return {
    size,
    domainMin: [0, 0, 0],
    domainMax: [1, 1, 1],
    data: new Float32Array(size * size * size * 3).fill(value),
  }
}

describe('interpolateLUTColor', () => {
  it('恒等 LUT 在格点上返回原值', () => {
    const lut = identityLut(3)
    expect(interpolateLUTColor(0, 0, 0, lut)).toEqual([0, 0, 0])
    expect(interpolateLUTColor(255, 255, 255, lut)).toEqual([255, 255, 255])
    expect(interpolateLUTColor(255, 0, 0, lut)).toEqual([255, 0, 0])
  })

  it('恒等 LUT 在格点之间线性插值', () => {
    const lut = identityLut(3)
    const [r, g, b] = interpolateLUTColor(128, 0, 0, lut)

    // size=3 时相邻格点间距是 127.5，128 落在第一个和第二个格点之间约 0.4% 处。
    expect(r).toBeGreaterThanOrEqual(127)
    expect(r).toBeLessThanOrEqual(130)
    expect(g).toBe(0)
    expect(b).toBe(0)
  })

  it('输出被限制在 0..255', () => {
    const lut = flattenLut(2, 2)
    const result = interpolateLUTColor(10, 10, 10, lut)

    expect(result[0]).toBe(255)
    expect(result[1]).toBe(255)
    expect(result[2]).toBe(255)
  })

  it('按 DOMAIN 归一化输入', () => {
    // domain 为 0.25..0.75：64/255 落在下界之下，应夹紧到 0；191/255 落在上界之上，应夹紧到 255。
    const lut = identityLut(2, [0.25, 0.25, 0.25], [0.75, 0.75, 0.75])

    const low = interpolateLUTColor(64, 64, 64, lut)
    expect(low[0]).toBeLessThan(1)
    expect(low[1]).toBeLessThan(1)
    expect(low[2]).toBeLessThan(1)

    const high = interpolateLUTColor(191, 191, 191, lut)
    expect(high[0]).toBeGreaterThan(254)
    expect(high[1]).toBeGreaterThan(254)
    expect(high[2]).toBeGreaterThan(254)
  })

  it('domain 内精确落点被正确映射', () => {
    // 128/255 ≈ 0.502，正好接近 domain 中点，恒等 LUT 下应输出约 128。
    const lut = identityLut(3, [0.25, 0.25, 0.25], [0.75, 0.75, 0.75])
    const result = interpolateLUTColor(128, 128, 128, lut)

    expect(result[0]).toBeGreaterThanOrEqual(127)
    expect(result[0]).toBeLessThanOrEqual(130)
    expect(result[1]).toBe(result[0])
    expect(result[2]).toBe(result[0])
  })

  it('DOMAIN 之外的输入被夹紧到边界', () => {
    const lut = identityLut(2, [0.25, 0.25, 0.25], [0.75, 0.75, 0.75])

    // 低于 domain 下界 -> 0
    expect(interpolateLUTColor(0, 0, 0, lut)).toEqual([0, 0, 0])
    // 高于 domain 上界 -> 255
    expect(interpolateLUTColor(255, 255, 255, lut)).toEqual([255, 255, 255])
  })

  it('size=2 时在两个节点间线性插值', () => {
    const lut: CubeLUT = {
      size: 2,
      domainMin: [0, 0, 0],
      domainMax: [1, 1, 1],
      data: new Float32Array([
        0, 0, 0,
        1, 0, 0,
        0, 1, 0,
        1, 1, 0,
        0, 0, 1,
        1, 0, 1,
        0, 1, 1,
        1, 1, 1,
      ]),
    }

    expect(interpolateLUTColor(0, 0, 0, lut)).toEqual([0, 0, 0])
    expect(interpolateLUTColor(255, 255, 255, lut)).toEqual([255, 255, 255])

    const mid = interpolateLUTColor(128, 128, 128, lut)
    expect(mid[0]).toBeGreaterThanOrEqual(126)
    expect(mid[0]).toBeLessThanOrEqual(130)
  })
})