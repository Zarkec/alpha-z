import { useEffect, useMemo, useRef, useState } from 'react'
import type { CubeLUT } from '../core/cubeParser'
import { applyLUTToImageData } from '../core/lut3d'

const MAX_PREVIEW_EDGE = 2048

type PreviewCanvasProps = {
  image: HTMLImageElement | null
  lut: CubeLUT | null
  intensity: number
  compareMode: boolean
  onCanvasReady: (canvas: HTMLCanvasElement | null) => void
}

type PreparedImage = {
  width: number
  height: number
  imageData: ImageData
}

type DisplaySize = {
  width: number
  height: number
}

function getScaledSize(width: number, height: number): { width: number; height: number } {
  const maxEdge = Math.max(width, height)
  if (maxEdge <= MAX_PREVIEW_EDGE) {
    return { width, height }
  }

  const scale = MAX_PREVIEW_EDGE / maxEdge
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  }
}

function prepareImageData(image: HTMLImageElement): PreparedImage {
  const { width, height } = getScaledSize(image.naturalWidth, image.naturalHeight)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('无法初始化 Canvas 2D 上下文。')
  }

  context.drawImage(image, 0, 0, width, height)
  return {
    width,
    height,
    imageData: context.getImageData(0, 0, width, height),
  }
}

export function PreviewCanvas({ image, lut, intensity, compareMode, onCanvasReady }: PreviewCanvasProps) {
  const shellRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const exportCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [preparedImage, setPreparedImage] = useState<PreparedImage | null>(null)
  const [displaySize, setDisplaySize] = useState<DisplaySize | null>(null)

  useEffect(() => {
    exportCanvasRef.current = document.createElement('canvas')
    onCanvasReady(exportCanvasRef.current)
    return () => onCanvasReady(null)
  }, [onCanvasReady])

  useEffect(() => {
    if (!image) {
      setPreparedImage(null)
      setDisplaySize(null)
      return
    }

    setPreparedImage(prepareImageData(image))
  }, [image])

  useEffect(() => {
    const shell = shellRef.current
    if (!shell || !preparedImage) {
      setDisplaySize(null)
      return
    }

    const updateDisplaySize = () => {
      const bounds = shell.getBoundingClientRect()
      const availableWidth = Math.max(0, bounds.width)
      const availableHeight = Math.max(0, bounds.height)

      if (availableWidth === 0 || availableHeight === 0) {
        setDisplaySize(null)
        return
      }

      const imageAspect = preparedImage.width / preparedImage.height
      const availableAspect = availableWidth / availableHeight

      const nextSize =
        availableAspect > imageAspect
          ? {
              width: Math.floor(availableHeight * imageAspect),
              height: Math.floor(availableHeight),
            }
          : {
              width: Math.floor(availableWidth),
              height: Math.floor(availableWidth / imageAspect),
            }

      setDisplaySize(nextSize)
    }

    updateDisplaySize()

    const observer = new ResizeObserver(updateDisplaySize)
    observer.observe(shell)

    return () => observer.disconnect()
  }, [preparedImage])

  const safeIntensity = useMemo(() => Math.min(1, Math.max(0, intensity / 100)), [intensity])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !preparedImage) {
      return
    }

    let frameId = 0

    frameId = requestAnimationFrame(() => {
      const context = canvas.getContext('2d')
      const exportCanvas = exportCanvasRef.current
      const exportContext = exportCanvas?.getContext('2d')
      if (!context || !exportCanvas || !exportContext) {
        return
      }

      canvas.width = preparedImage.width
      canvas.height = preparedImage.height
      exportCanvas.width = preparedImage.width
      exportCanvas.height = preparedImage.height

      const filteredImage = lut
        ? applyLUTToImageData(preparedImage.imageData, lut, safeIntensity)
        : preparedImage.imageData

      exportContext.putImageData(filteredImage, 0, 0)

      if (!compareMode || !lut) {
        context.putImageData(filteredImage, 0, 0)
        return
      }

      context.putImageData(filteredImage, 0, 0)

      const splitX = Math.floor(preparedImage.width / 2)
      const originalLeft = context.createImageData(splitX, preparedImage.height)
      const source = preparedImage.imageData.data
      const target = originalLeft.data

      for (let y = 0; y < preparedImage.height; y += 1) {
        const sourceOffset = y * preparedImage.width * 4
        const targetOffset = y * splitX * 4
        target.set(source.subarray(sourceOffset, sourceOffset + splitX * 4), targetOffset)
      }

      context.putImageData(originalLeft, 0, 0)
      context.fillStyle = 'rgba(255, 255, 255, 0.9)'
      context.fillRect(splitX - 1, 0, 2, preparedImage.height)
    })

    return () => cancelAnimationFrame(frameId)
  }, [preparedImage, lut, safeIntensity, compareMode])

  if (!image) {
    return (
      <div className="empty-preview">
        <span className="empty-icon codicon codicon-empty-window" aria-hidden="true" />
        <strong>尚未加载图片</strong>
        <span>上传图片后即可预览 LUT 滤镜效果。</span>
      </div>
    )
  }

  return (
    <div ref={shellRef} className="canvas-shell">
      <div
        className="canvas-frame"
        style={{
          width: displaySize?.width ?? 0,
          height: displaySize?.height ?? 0,
        }}
      >
        <canvas ref={canvasRef} aria-label="Image preview canvas" />
        {compareMode && lut ? (
          <div className="compare-labels">
            <span>原图</span>
            <span>滤镜</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
