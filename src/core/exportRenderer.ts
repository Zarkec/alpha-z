import type { CubeLUT } from './cubeParser'
import { applyLUTToImageData } from './lut3d'

export type ExportFormat = 'png' | 'jpeg' | 'webp'

export type ExportOptions = {
  format: ExportFormat
  quality: number
}

export const EXPORT_MIME_TYPES: Record<ExportFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

export const EXPORT_FILE_EXTENSIONS: Record<ExportFormat, string> = {
  png: 'png',
  jpeg: 'jpg',
  webp: 'webp',
}

export function getExportFileName(format: ExportFormat, baseName: string): string {
  const extension = EXPORT_FILE_EXTENSIONS[format]
  const trimmed = baseName.trim()

  if (!trimmed) {
    return `alpha-z-output.${extension}`
  }

  const withoutExtension = trimmed.replace(/\.[^./\\]+$/, '')
  return `${withoutExtension || 'alpha-z-output'}-filtered.${extension}`
}

export function isExportFormatSupported(format: ExportFormat): boolean {
  const mimeType = EXPORT_MIME_TYPES[format]

  if (typeof document === 'undefined') {
    return false
  }

  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1

  return canvas.toDataURL(mimeType).startsWith(`data:${mimeType}`)
}

/**
 * 渲染一张缩放后的预览副本。导出尺寸远大于预览尺寸，所以按需生成，
 * 避免图片加载时就分配全尺寸的 ImageData。
 */
function drawScaledImageData(image: HTMLImageElement, width: number, height: number): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('无法初始化 Canvas 2D 上下文。')
  }

  context.drawImage(image, 0, 0, width, height)
  return context.getImageData(0, 0, width, height)
}

/**
 * 按导出尺寸重新取样原图，必要时套用 LUT 和强度。
 * 预览为了性能限制在 2048px，导出则始终基于图片的原始分辨率。
 */
export function renderExportImageData(
  image: HTMLImageElement,
  lut: CubeLUT | null,
  intensity: number,
  maxEdge?: number,
): ImageData {
  const sourceWidth = image.naturalWidth
  const sourceHeight = image.naturalHeight

  if (sourceWidth === 0 || sourceHeight === 0) {
    throw new Error('图片尚未加载完成，无法导出。')
  }

  let width = sourceWidth
  let height = sourceHeight

  if (maxEdge && Math.max(sourceWidth, sourceHeight) > maxEdge) {
    const scale = maxEdge / Math.max(sourceWidth, sourceHeight)
    width = Math.round(sourceWidth * scale)
    height = Math.round(sourceHeight * scale)
  }

  const sourceData = drawScaledImageData(image, width, height)

  if (!lut) {
    return sourceData
  }

  return applyLUTToImageData(sourceData, lut, intensity)
}

export function imageDataToBlob(imageData: ImageData, options: ExportOptions): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = imageData.width
  canvas.height = imageData.height

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('无法初始化 Canvas 2D 上下文。')
  }

  context.putImageData(imageData, 0, 0)

  if (options.format === 'jpeg') {
    // JPEG 不支持透明通道，先铺一层白底避免透明区域被渲染成黑色。
    context.globalCompositeOperation = 'destination-over'
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
  }

  const mimeType = EXPORT_MIME_TYPES[options.format]

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('导出失败：浏览器无法生成该格式的图片。'))
          return
        }
        resolve(blob)
      },
      mimeType,
      options.format === 'png' ? undefined : Math.min(1, Math.max(0.01, options.quality)),
    )
  })
}