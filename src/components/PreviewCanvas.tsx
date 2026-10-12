import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { CubeLUT } from '../core/cubeParser'
import { WebGLLutRenderer } from '../core/webglLutRenderer'

const MAX_PREVIEW_EDGE = 2048
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function isAcceptedImage(file: File): boolean {
  return ACCEPTED_TYPES.includes(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name)
}

type PreviewCanvasProps = {
  image: HTMLImageElement | null
  lut: CubeLUT | null
  intensity: number
  compareMode: boolean
  onImageLoaded: (image: HTMLImageElement, fileName: string) => void
  onImageClear: () => void
  onError: (message: string) => void
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

type WorkerPreviewMessage = {
  type: 'preview'
  jobId: number
  previewImageData: ImageData
}

type WorkerMessage = WorkerPreviewMessage | { type: 'error'; jobId?: number; message: string } | { type: 'ready' }

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

export function PreviewCanvas({ image, lut, intensity, compareMode, onImageLoaded, onImageClear, onError }: PreviewCanvasProps) {
  const shellRef = useRef<HTMLDivElement | null>(null)
  const frameRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rendererRef = useRef<WebGLLutRenderer | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const latestJobIdRef = useRef(0)
  const lastPreviewRequestRef = useRef<{
    preparedImage: PreparedImage
    lut: CubeLUT | null
    intensity: number
    compareMode: boolean
    comparePosition: number
  } | null>(null)
  const [preparedImage, setPreparedImage] = useState<PreparedImage | null>(null)
  const [displaySize, setDisplaySize] = useState<DisplaySize | null>(null)
  const [webglEnabled, setWebglEnabled] = useState(false)
  const [comparePosition, setComparePosition] = useState(0.5)
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!image) {
      setPreparedImage(null)
      setDisplaySize(null)
      setWebglEnabled(false)
      return
    }

    try {
      setPreparedImage(prepareImageData(image))
    } catch (error) {
      onError(error instanceof Error ? error.message : '无法读取这张图片。')
      setPreparedImage(null)
    }
  }, [image, onError])

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
    if (!canvas || !preparedImage) {
      return
    }

    rendererRef.current?.dispose()
    rendererRef.current = null
    workerRef.current?.terminate()
    workerRef.current = null
    lastPreviewRequestRef.current = null
    setWebglEnabled(false)

    let renderer: WebGLLutRenderer | null = null
    try {
      renderer = new WebGLLutRenderer(canvas)
      renderer.setImage(preparedImage.imageData)
      renderer.setLut(lut)
      renderer.render(Math.min(1, Math.max(0, intensity / 100)), compareMode, comparePosition)
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

      if (message.type === 'preview') {
        if (message.jobId !== latestJobIdRef.current) {
          return
        }

        if (!rendererRef.current) {
          drawImageDataToCanvas(canvas, message.previewImageData)
        }
      }

      if (message.type === 'error') {
        onError(message.message)
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
    // 仅在图片本身变化时重建渲染上下文；LUT 与强度变化走下面的增量更新。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preparedImage])

  const safeIntensity = useMemo(() => Math.min(1, Math.max(0, intensity / 100)), [intensity])

  const updateComparePosition = (event: PointerEvent | ReactPointerEvent<HTMLButtonElement>) => {
    const frame = frameRef.current
    if (!frame) {
      return
    }

    const bounds = frame.getBoundingClientRect()
    const nextPosition = (event.clientX - bounds.left) / bounds.width
    setComparePosition(Math.min(0.98, Math.max(0.02, nextPosition)))
  }

  const startCompareDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    updateComparePosition(event)

    const handlePointerMove = (moveEvent: PointerEvent) => updateComparePosition(moveEvent)
    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }

  useEffect(() => {
    if (!preparedImage) {
      return
    }

    const renderer = rendererRef.current
    if (renderer) {
      renderer.setLut(lut)
      renderer.render(safeIntensity, compareMode, comparePosition)
    }

    // WebGL 可用时预览已经在 GPU 上完成，Worker 只在回退路径上需要参与。
    const worker = workerRef.current
    if (!worker || renderer) {
      return
    }

    const lastRequest = lastPreviewRequestRef.current
    const unchanged =
      lastRequest?.preparedImage === preparedImage &&
      lastRequest.lut === lut &&
      lastRequest.intensity === safeIntensity &&
      lastRequest.compareMode === compareMode &&
      lastRequest.comparePosition === comparePosition

    if (unchanged) {
      return
    }

    latestJobIdRef.current += 1
    lastPreviewRequestRef.current = {
      preparedImage,
      lut,
      intensity: safeIntensity,
      compareMode,
      comparePosition,
    }
    worker.postMessage({
      type: 'preview',
      jobId: latestJobIdRef.current,
      lut,
      intensity: safeIntensity,
      compareMode,
      comparePosition,
    })
  }, [preparedImage, lut, safeIntensity, compareMode, comparePosition])

  const loadFile = useCallback((file: File) => {
    if (!isAcceptedImage(file)) {
      onError('请选择 jpg、jpeg、png 或 webp 格式的图片。')
      return
    }

    const url = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(url)
      onImageLoaded(img, file.name)
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      onError('无法加载这张图片，请换一张图片重试。')
    }

    img.src = url
  }, [onImageLoaded, onError])

  const handleFiles = useCallback((files: FileList | null) => {
    const file = files?.[0]
    if (file) {
      loadFile(file)
    }
  }, [loadFile])

  if (!image) {
    return (
      <div
        className={`preview-drop-zone ${isDragging ? 'is-dragging' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setIsDragging(false)
          handleFiles(event.dataTransfer.files)
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          onChange={(event) => handleFiles(event.currentTarget.files)}
        />
        <span className="empty-icon codicon codicon-empty-window" aria-hidden="true" />
        <strong>拖入或选择图片</strong>
        <span>上传图片后即可预览 LUT 滤镜效果</span>
      </div>
    )
  }

  return (
    <div ref={shellRef} className="canvas-shell">
      <div
        ref={frameRef}
        className="canvas-frame"
        style={{
          width: displaySize?.width ?? 0,
          height: displaySize?.height ?? 0,
        }}
      >
        <canvas ref={canvasRef} aria-label="图片预览画布" />
        <button
          type="button"
          className="preview-close-btn"
          title="关闭图片"
          onClick={onImageClear}
        >
          <span className="codicon codicon-chrome-close" aria-hidden="true" />
        </button>
        <div className="render-badge">{webglEnabled ? 'WebGL2' : 'Worker'}</div>
        {compareMode && lut ? (
          <>
            <div className="compare-labels">
              <span>原图</span>
              <span>滤镜</span>
            </div>
            <button
              type="button"
              className="compare-handle"
              style={{ left: `${comparePosition * 100}%` }}
              aria-label="拖动调整原图和滤镜效果的对比位置"
              onPointerDown={startCompareDrag}
            >
              <span className="compare-handle-knob" aria-hidden="true">
                <span className="codicon codicon-triangle-left" />
                <span className="codicon codicon-triangle-right" />
              </span>
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}