import { useEffect, useMemo, useRef, useState } from 'react'
import type { CubeLUT } from '../core/cubeParser'
import { WebGLLutRenderer } from '../core/webglLutRenderer'

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

type WorkerResultMessage = {
  type: 'result'
  jobId: number
  exportImageData: ImageData
  previewImageData?: ImageData
}

type WorkerErrorMessage = {
  type: 'error'
  jobId?: number
  message: string
}

type WorkerMessage = WorkerResultMessage | WorkerErrorMessage | { type: 'ready' }

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

function drawImageDataToCanvas(canvas: HTMLCanvasElement, imageData: ImageData): void {
  canvas.width = imageData.width
  canvas.height = imageData.height

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('无法初始化 Canvas 2D 上下文。')
  }

  context.putImageData(imageData, 0, 0)
}

export function PreviewCanvas({ image, lut, intensity, compareMode, onCanvasReady }: PreviewCanvasProps) {
  const shellRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const exportCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const rendererRef = useRef<WebGLLutRenderer | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const latestJobIdRef = useRef(0)
  const [preparedImage, setPreparedImage] = useState<PreparedImage | null>(null)
  const [displaySize, setDisplaySize] = useState<DisplaySize | null>(null)
  const [webglEnabled, setWebglEnabled] = useState(false)

  useEffect(() => {
    exportCanvasRef.current = document.createElement('canvas')
    onCanvasReady(exportCanvasRef.current)
    return () => onCanvasReady(null)
  }, [onCanvasReady])

  useEffect(() => {
    if (!image) {
      setPreparedImage(null)
      setDisplaySize(null)
      setWebglEnabled(false)
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

  useEffect(() => {
    const canvas = canvasRef.current
    const exportCanvas = exportCanvasRef.current
    if (!canvas || !exportCanvas || !preparedImage) {
      return
    }

    rendererRef.current?.dispose()
    rendererRef.current = null
    workerRef.current?.terminate()
    workerRef.current = null
    setWebglEnabled(false)

    drawImageDataToCanvas(exportCanvas, preparedImage.imageData)

    try {
      const renderer = new WebGLLutRenderer(canvas)
      renderer.setImage(preparedImage.imageData)
      renderer.setLut(lut)
      renderer.render(Math.min(1, Math.max(0, intensity / 100)), compareMode)
      rendererRef.current = renderer
      setWebglEnabled(true)
    } catch {
      drawImageDataToCanvas(canvas, preparedImage.imageData)
      setWebglEnabled(false)
    }

    const worker = new Worker(new URL('../workers/lutWorker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker
    worker.postMessage({ type: 'init', imageData: preparedImage.imageData })

    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data

      if (message.type === 'result') {
        if (message.jobId !== latestJobIdRef.current) {
          return
        }

        drawImageDataToCanvas(exportCanvas, message.exportImageData)

        if (!rendererRef.current && message.previewImageData) {
          drawImageDataToCanvas(canvas, message.previewImageData)
        }
      }
    }

    return () => {
      worker.terminate()
      if (workerRef.current === worker) {
        workerRef.current = null
      }
      rendererRef.current?.dispose()
      rendererRef.current = null
    }
  }, [preparedImage])

  const safeIntensity = useMemo(() => Math.min(1, Math.max(0, intensity / 100)), [intensity])

  useEffect(() => {
    if (!preparedImage) {
      return
    }

    const renderer = rendererRef.current
    if (renderer) {
      renderer.setLut(lut)
      renderer.render(safeIntensity, compareMode)
    }

    const worker = workerRef.current
    if (!worker) {
      return
    }

    latestJobIdRef.current += 1
    worker.postMessage({
      type: 'process',
      jobId: latestJobIdRef.current,
      lut,
      intensity: safeIntensity,
      compareMode,
      includePreview: !renderer,
    })
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
        <canvas ref={canvasRef} aria-label="图片预览画布" />
        <div className="render-badge">{webglEnabled ? 'WebGL2' : 'Worker'}</div>
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
