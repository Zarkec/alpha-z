import { describe, expect, it } from 'vitest'
import { EXPORT_MIME_TYPES, getExportFileName } from '../src/core/exportRenderer'

describe('getExportFileName', () => {
  it('按格式给出正确扩展名', () => {
    expect(getExportFileName('png', 'photo.jpg')).toBe('photo-filtered.png')
    expect(getExportFileName('jpeg', 'photo.jpg')).toBe('photo-filtered.jpg')
    expect(getExportFileName('webp', 'photo.png')).toBe('photo-filtered.webp')
  })

  it('原名没有扩展名时直接追加', () => {
    expect(getExportFileName('png', 'photo')).toBe('photo-filtered.png')
  })

  it('空文件名回退到默认名', () => {
    expect(getExportFileName('png', '')).toBe('alpha-z-output.png')
    expect(getExportFileName('webp', '   ')).toBe('alpha-z-output.webp')
  })

  it('扩展名被替换而不是叠加', () => {
    expect(getExportFileName('jpeg', 'a.b.c.webp')).toBe('a.b.c-filtered.jpg')
  })
})

describe('EXPORT_MIME_TYPES', () => {
  it('每种格式都有对应的 MIME 类型', () => {
    expect(EXPORT_MIME_TYPES.png).toBe('image/png')
    expect(EXPORT_MIME_TYPES.jpeg).toBe('image/jpeg')
    expect(EXPORT_MIME_TYPES.webp).toBe('image/webp')
  })
})