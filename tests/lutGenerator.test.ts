import { describe, expect, it } from 'vitest'
import { serializeCube } from '../src/core/cubeSerializer'
import { parseCube } from '../src/core/cubeParser'
import { generateLUTFromImagePair } from '../src/core/lutGenerator'
import { applyLUTToImageData } from '../src/core/lut3d'

function makeImageData(width: number, height: number, fill: (r: number, g: number, b: number) => [number, number, number]): ImageData {
  const data = new Uint8ClampedArray(width * height * 4)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      const [r, g, b] = fill(x, y)
      data[index] = r
      data[index + 1] = g
      data[index + 2] = b
      data[index + 3] = 255
    }
  }

  return new ImageData(data, width, height)
}

describe('serializeCube', () => {
  it('输出可被重新解析', () => {
    const lut = generateLUTFromImagePair(
      makeImageData(8, 8, (x, y) => [x * 8, y * 8, 128]),
      makeImageData(8, 8, (x, y) => [x * 8, y * 8, 128]),
      { size: 4, title: 'Round Trip' },
    )

    const reparsed = parseCube(serializeCube(lut))
    expect(reparsed.size).toBe(lut.size)
    expect(reparsed.title).toBe('Round Trip')
    expect(reparsed.data.length).toBe(lut.data.length)
  })

  it('保留 domain', () => {
    const lut = generateLUTFromImagePair(
      makeImageData(4, 4, () => [10, 20, 30]),
      makeImageData(4, 4, () => [10, 20, 30]),
      { size: 2 },
    )

    const text = serializeCube(lut)
    expect(text).toContain('DOMAIN_MIN 0.000000 0.000000 0.000000')
    expect(text).toContain('DOMAIN_MAX 1.000000 1.000000 1.000000')
  })

  it('转义 TITLE 中的引号', () => {
    const lut = generateLUTFromImagePair(
      makeImageData(2, 2, () => [0, 0, 0]),
      makeImageData(2, 2, () => [0, 0, 0]),
      { size: 2, title: 'Say "hi"' },
    )

    const text = serializeCube(lut)
    expect(text).toContain('TITLE "Say \\"hi\\""')
  })
})

describe('generateLUTFromImagePair', () => {
  it('尺寸不匹配时报错', () => {
    expect(() =>
      generateLUTFromImagePair(makeImageData(4, 4, () => [0, 0, 0]), makeImageData(4, 5, () => [0, 0, 0])),
    ).toThrow(/尺寸必须一致/)
  })

  it('非法尺寸时报错', () => {
    const image = makeImageData(4, 4, () => [0, 0, 0])

    expect(() => generateLUTFromImagePair(image, image, { size: 1 })).toThrow(/2 到 64/)
    expect(() => generateLUTFromImagePair(image, image, { size: 65 })).toThrow(/2 到 64/)
  })

  it('原图与效果图相同时生成近似恒等 LUT', () => {
    const image = makeImageData(64, 64, (x, y) => [x * 4, y * 4, (x + y) * 2])
    const lut = generateLUTFromImagePair(image, image, { size: 16 })

    const applied = applyLUTToImageData(image, lut, 1)
    let totalError = 0

    for (let i = 0; i < image.data.length; i += 4) {
      totalError += Math.abs(image.data[i] - applied.data[i])
      totalError += Math.abs(image.data[i + 1] - applied.data[i + 1])
      totalError += Math.abs(image.data[i + 2] - applied.data[i + 2])
    }

    const meanError = totalError / (image.data.length / 4 * 3)
    expect(meanError).toBeLessThan(4)
  })

  it('学到通道反转这类强烈映射', () => {
    const source = makeImageData(32, 32, (x, y) => [x * 8, y * 8, 100])
    const target = makeImageData(32, 32, (x, y) => [255 - x * 8, 255 - y * 8, 100])
    const lut = generateLUTFromImagePair(source, target, { size: 32 })

    const applied = applyLUTToImageData(source, lut, 1)
    let totalError = 0

    for (let i = 0; i < source.data.length; i += 4) {
      totalError += Math.abs(target.data[i] - applied.data[i])
      totalError += Math.abs(target.data[i + 1] - applied.data[i + 1])
    }

    const meanError = totalError / (source.data.length / 4 * 2)
    expect(meanError).toBeLessThan(12)
  })

  it('全透明图片报错', () => {
    const blank = new ImageData(new Uint8ClampedArray(16 * 16 * 4), 16, 16)
    expect(() => generateLUTFromImagePair(blank, blank, { size: 4 })).toThrow(/有效像素/)
  })

  it('忽略透明像素的贡献', () => {
    const width = 8
    const height = 8
    const source = new ImageData(new Uint8ClampedArray(width * height * 4), width, height)
    const target = new ImageData(new Uint8ClampedArray(width * height * 4), width, height)

    for (let i = 0; i < source.data.length; i += 4) {
      source.data[i] = 200
      source.data[i + 1] = 100
      source.data[i + 2] = 50
      source.data[i + 3] = 255

      target.data[i] = 10
      target.data[i + 1] = 220
      target.data[i + 2] = 50
      target.data[i + 3] = 255
    }

    // 让最后一个像素全透明，验证它不会污染结果。
    const lastPixel = source.data.length - 4
    source.data[lastPixel + 3] = 0
    target.data[lastPixel + 3] = 0

    const lut = generateLUTFromImagePair(source, target, { size: 8 })
    const applied = applyLUTToImageData(source, lut, 1)

    expect(Math.abs(applied.data[0] - 10)).toBeLessThan(12)
    expect(Math.abs(applied.data[1] - 220)).toBeLessThan(12)
  })
})

describe('applyLUTToImageData', () => {
  const lut = generateLUTFromImagePair(
    makeImageData(16, 16, (x, y) => [x * 16, y * 16, 128]),
    makeImageData(16, 16, (x, y) => [x * 4, y * 4, 128]),
    { size: 16 },
  )

  it('强度 0 时返回原图', () => {
    const image = makeImageData(4, 4, (x, y) => [x * 60, y * 60, 30])
    const applied = applyLUTToImageData(image, lut, 0)

    for (let i = 0; i < image.data.length; i += 4) {
      expect(applied.data[i]).toBe(image.data[i])
      expect(applied.data[i + 1]).toBe(image.data[i + 1])
      expect(applied.data[i + 2]).toBe(image.data[i + 2])
    }
  })

  it('保留 alpha 通道', () => {
    const image = new ImageData(new Uint8ClampedArray(16 * 4), 4, 4)
    for (let i = 3; i < image.data.length; i += 4) {
      image.data[i] = 128
    }

    const applied = applyLUTToImageData(image, lut, 1)
    for (let i = 3; i < applied.data.length; i += 4) {
      expect(applied.data[i]).toBe(128)
    }
  })

  it('强度被夹紧在 0..1', () => {
    const image = makeImageData(4, 4, () => [128, 128, 128])

    expect(Array.from(applyLUTToImageData(image, lut, -5).data)).toEqual(
      Array.from(applyLUTToImageData(image, lut, 0).data),
    )
    expect(Array.from(applyLUTToImageData(image, lut, 5).data)).toEqual(
      Array.from(applyLUTToImageData(image, lut, 1).data),
    )
  })
})