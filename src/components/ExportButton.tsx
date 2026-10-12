import { useState } from 'react'
import {
  getExportFileName,
  imageDataToBlob,
  isExportFormatSupported,
  renderExportImageData,
  type ExportFormat,
} from '../core/exportRenderer'
import type { CubeLUT } from '../core/cubeParser'

const FORMAT_LABELS: Record<ExportFormat, string> = {
  png: 'PNG',
  jpeg: 'JPEG',
  webp: 'WebP',
}

const FORMAT_ORDER: ExportFormat[] = ['png', 'jpeg', 'webp']

type ExportButtonProps = {
  image: HTMLImageElement | null
  imageName: string
  lut: CubeLUT | null
  intensity: number
  disabled?: boolean
  onError: (message: string) => void
}

export function ExportButton({ image, imageName, lut, intensity, disabled = false, onError }: ExportButtonProps) {
  const [format, setFormat] = useState<ExportFormat>('png')
  const [quality, setQuality] = useState(92)
  const [isExporting, setIsExporting] = useState(false)

  const exportImage = async () => {
    if (!image) {
      return
    }

    setIsExporting(true)

    try {
      // 让浏览器先把按钮的禁用态渲染出来，再开始全尺寸渲染。
      // 用 setTimeout 而不是 requestAnimationFrame：页面不可见时 rAF 不会触发，
      // 会让导出永久挂起。
      await new Promise((resolve) => setTimeout(resolve, 0))

      const imageData = renderExportImageData(image, lut, Math.min(1, Math.max(0, intensity / 100)))
      const blob = await imageDataToBlob(imageData, { format, quality })
      const url = URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.download = getExportFileName(format, imageName)
      link.href = url
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      onError(error instanceof Error ? error.message : '导出图片失败。')
    } finally {
      setIsExporting(false)
    }
  }

  const showQuality = format !== 'png'

  return (
    <section className="export-panel">
      <div className="control-row">
        <span>
          <span className="codicon codicon-file-media" aria-hidden="true" />
          导出格式
        </span>
      </div>

      <div className="format-options" role="radiogroup" aria-label="导出格式">
        {FORMAT_ORDER.map((candidate) => {
          const supported = isExportFormatSupported(candidate)
          return (
            <button
              key={candidate}
              type="button"
              role="radio"
              aria-checked={format === candidate}
              className={`format-option${format === candidate ? ' active' : ''}`}
              disabled={!supported}
              title={supported ? undefined : `当前浏览器不支持导出 ${FORMAT_LABELS[candidate]}`}
              onClick={() => setFormat(candidate)}
            >
              {FORMAT_LABELS[candidate]}
            </button>
          )
        })}
      </div>

      {showQuality ? (
        <label className="control-panel">
          <span className="control-row">
            <span>
              <span className="codicon codicon-settings-gear" aria-hidden="true" />
              导出品质
            </span>
            <strong>{quality}%</strong>
          </span>
          <input
            type="range"
            min="10"
            max="100"
            value={quality}
            onChange={(event) => setQuality(Number(event.currentTarget.value))}
          />
        </label>
      ) : null}

      <button
        className="primary-button"
        type="button"
        disabled={disabled || isExporting}
        onClick={() => {
          void exportImage()
        }}
      >
        <span className="codicon codicon-export" aria-hidden="true" />
        {isExporting ? '正在导出…' : '导出图片'}
      </button>

      <small className="export-hint">
        {isExporting
          ? '正在按原始分辨率渲染…'
          : `按原图分辨率导出 ${FORMAT_LABELS[format]} 格式`}
      </small>
    </section>
  )
}