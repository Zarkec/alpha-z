import type { CubeLUT } from '../core/cubeParser'
import { applyLUTToImageData } from '../core/lut3d'

type InitMessage = {
  type: 'init'
  imageData: ImageData
}

type ProcessMessage = {
  type: 'process'
  jobId: number
  lut: CubeLUT | null
  intensity: number
  compareMode: boolean
  comparePosition: number
  includePreview: boolean
}

type WorkerRequest = InitMessage | ProcessMessage

type WorkerResponse =
  | {
      type: 'ready'
    }
  | {
      type: 'result'
      jobId: number
      exportImageData: ImageData
      previewImageData?: ImageData
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
  try {
    const message = event.data

    if (message.type === 'init') {
      sourceImageData = message.imageData
      postResponse({ type: 'ready' })
      return
    }

    if (!sourceImageData) {
      postResponse({ type: 'error', jobId: message.jobId, message: 'Worker 尚未初始化图片数据。' })
      return
    }

    const exportImageData = message.lut
      ? applyLUTToImageData(sourceImageData, message.lut, message.intensity)
      : cloneImageData(sourceImageData)

    const previewImageData =
      message.includePreview && message.compareMode && message.lut
        ? createComparePreview(sourceImageData, exportImageData, message.comparePosition)
        : message.includePreview
          ? cloneImageData(exportImageData)
          : undefined

    postResponse({
      type: 'result',
      jobId: message.jobId,
      exportImageData,
      previewImageData,
    })
  } catch (error) {
    postResponse({
      type: 'error',
      message: error instanceof Error ? error.message : 'Worker 处理图片失败。',
    })
  }
}
