import { describe, expect, it } from 'vitest'
import { parseCube } from '../src/core/cubeParser'

/** 生成一个 size³ 的恒等 LUT 文本。 */
function buildIdentityCube(size: number): string {
  const lines = [`LUT_3D_SIZE ${size}`, 'DOMAIN_MIN 0 0 0', 'DOMAIN_MAX 1 1 1']

  for (let b = 0; b < size; b += 1) {
    for (let g = 0; g < size; g += 1) {
      for (let r = 0; r < size; r += 1) {
        lines.push(`${r / (size - 1)} ${g / (size - 1)} ${b / (size - 1)}`)
      }
    }
  }

  return lines.join('\n')
}

describe('parseCube', () => {
  it('解析 TITLE、LUT_3D_SIZE 和 domain', () => {
    const text = ['TITLE "Test LUT"', 'LUT_3D_SIZE 2', 'DOMAIN_MIN 0 0 0', 'DOMAIN_MAX 1 1 1', '0 0 0', '1 0 0', '0 1 0', '1 1 0', '0 0 1', '1 0 1', '0 1 1', '1 1 1'].join('\n')
    const lut = parseCube(text)

    expect(lut.title).toBe('Test LUT')
    expect(lut.size).toBe(2)
    expect(lut.domainMin).toEqual([0, 0, 0])
    expect(lut.domainMax).toEqual([1, 1, 1])
    expect(lut.data.length).toBe(2 * 2 * 2 * 3)
  })

  it('保留非默认 DOMAIN', () => {
    const text = ['LUT_3D_SIZE 2', 'DOMAIN_MIN 0.1 0.2 0.3', 'DOMAIN_MAX 0.9 0.8 0.7'].concat(
      Array.from({ length: 8 }, () => '0 0 0'),
    ).join('\n')

    const lut = parseCube(text)
    expect(lut.domainMin).toEqual([0.1, 0.2, 0.3])
    expect(lut.domainMax).toEqual([0.9, 0.8, 0.7])
  })

  it('忽略注释和空行', () => {
    const text = ['# a comment', '', 'LUT_3D_SIZE 2', '  ', '# another', '0 0 0', '1 0 0', '0 1 0', '1 1 0', '0 0 1', '1 0 1', '0 1 1', '1 1 1'].join('\n')
    const lut = parseCube(text)

    expect(lut.size).toBe(2)
    expect(lut.data.length).toBe(24)
  })

  it('按红通道最快的顺序存储数据', () => {
    const text = ['LUT_3D_SIZE 2', '0 0 0', '1 0 0', '0 1 0', '1 1 0', '0 0 1', '1 0 1', '0 1 1', '1 1 1'].join('\n')
    const lut = parseCube(text)

    expect(Array.from(lut.data.slice(0, 6))).toEqual([0, 0, 0, 1, 0, 0])
  })

  it('支持科学计数法和空行结尾', () => {
    const text = ['LUT_3D_SIZE 2', '0e0 0 0', '1.0 0 0', '0 1 0', '1 1 0', '0 0 1', '1 0 1', '0 1 1', '1 1 1', ''].join('\r\n')
    const lut = parseCube(text)

    expect(lut.data.length).toBe(24)
  })

  it('缺少 LUT_3D_SIZE 时报错', () => {
    expect(() => parseCube('0 0 0')).toThrow(/LUT_3D_SIZE/)
  })

  it('数据行数量不足时报错', () => {
    const text = ['LUT_3D_SIZE 2', '0 0 0', '1 0 0'].join('\n')
    expect(() => parseCube(text)).toThrow(/数据数量不正确/)
  })

  it('数据行数量超出时明确报错', () => {
    const text = ['LUT_3D_SIZE 2', '0 0 0', '1 0 0', '0 1 0', '1 1 0', '0 0 1', '1 0 1', '0 1 1', '1 1 1', '1 1 1'].join('\n')
    expect(() => parseCube(text)).toThrow(/超出尺寸/)
  })

  it('DOMAIN_MAX 不大于 DOMAIN_MIN 时报错', () => {
    const text = ['LUT_3D_SIZE 2', 'DOMAIN_MIN 0.5 0 0', 'DOMAIN_MAX 0.5 1 1'].concat(
      Array.from({ length: 8 }, () => '0 0 0'),
    ).join('\n')

    expect(() => parseCube(text)).toThrow(/DOMAIN_MAX/)
  })

  it('非法数字带行号', () => {
    const text = ['LUT_3D_SIZE 2', '0 0 0', '1 0 0', '0 1 0', '1 1 0', '0 0 1', '1 0 1', '0 1 1', 'abc 1 1'].join('\n')
    expect(() => parseCube(text)).toThrow(/第 9 行/)
  })

  it('大尺寸 LUT 能正确解析且不越界', () => {
    const lut = parseCube(buildIdentityCube(17))
    expect(lut.size).toBe(17)
    expect(lut.data.length).toBe(17 * 17 * 17 * 3)
  })
})