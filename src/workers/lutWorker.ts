import type { CubeLUT } from '../core/cubeParser'
import { applyLUTToImageData } from '../core/lut3d'

type InitMessage = {
  type: 'init'
  imageData: ImageData
}

type PreviewMessage = {
  type: 'preview'
  jobId: number
  lut: CubeLUT | null
  intensity: number
  compareMode: boolean
  comparePosition: number
}

type ExportMessage = {
  type: 'export'
  jobId: number
  lut: CubeLUT | null
  intensity: number
}

type WorkerRequest = InitMessage | PreviewMessage | ExportMessage

type WorkerResponse =
  | {
      type: 'ready'
    }
  | {
      type: 'preview'
      jobId: number
      previewImageData: ImageData
    }
  | {
      type: 'export'
      jobId: number
      exportImageData: ImageData
    }
  | {
      type: 'error'
      jobId?: number
      message: string
    }

let sourceImageData: ImageData | null = null

function cloneImageData(imageData: ImageData): ImageData {
  return new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height)
}

function createComparePreview(source: ImageData, filtered: ImageData, comparePosition: number): ImageData {
  const preview = cloneImageData(filtered)
  const splitX = Math.min(preview.width - 1, Math.floor(preview.width * Math.min(1, Math.max(0, comparePosition))))
  const sourceData = source.data
  const previewData = preview.data

  for (let y = 0; y < preview.height; y += 1) {
    const rowOffset = y * preview.width * 4

    for (let x = 0; x < splitX; x += 1) {
      const index = rowOffset + x * 4
      previewData[index] = sourceData[index]
      previewData[index + 1] = sourceData[index + 1]
      previewData[index + 2] = sourceData[index + 2]
      previewData[index + 3] = sourceData[index + 3]
    }

    const separatorIndex = rowOffset + splitX * 4
    previewData[separatorIndex] = 255
    previewData[separatorIndex + 1] = 255
    previewData[separatorIndex + 2] = 255
    previewData[separatorIndex + 3] = 230
  }

  return preview
}

function postResponse(response: WorkerResponse): void {
  self.postMessage(response)
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data

  try {
    if (message.type === 'init') {
      sourceImageData = message.imageData
      postResponse({ type: 'ready' })
      return
    }

    if (!sourceImageData) {
      postResponse({ type: 'error', jobId: message.jobId, message: 'Worker 尚未初始化图片数据。' })
      return
    }

    // 预览和导出拆成两种任务：滑块拖动只需要预览，全图导出只在用户点击时发生。
    if (message.type === 'export') {
      const exportImageData = message.lut
        ? applyLUTToImageData(sourceImageData, message.lut, message.intensity)
        : cloneImageData(sourceImageData)

      postResponse({ type: 'export', jobId: message.jobId, exportImageData })
      return
    }

    const filtered = message.lut
      ? applyLUTToImageData(sourceImageData, message.lut, message.intensity)
      : cloneImageData(sourceImageData)

    const previewImageData =
      message.compareMode && message.lut
        ? createComparePreview(sourceImageData, filtered, message.comparePosition)
        : filtered

    postResponse({ type: 'preview', jobId: message.jobId, previewImageData })
  } catch (error) {
    postResponse({
      type: 'error',
      jobId: 'jobId' in message ? message.jobId : undefined,
      message: error instanceof Error ? error.message : 'Worker 处理图片失败。',
    })
  }
}