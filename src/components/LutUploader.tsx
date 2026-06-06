import { useRef, useState } from 'react'
import { parseCube, type CubeLUT } from '../core/cubeParser'

type LutUploaderProps = {
  onLutLoaded: (lut: CubeLUT, fileName: string) => void
  onError: (message: string) => void
  fileName?: string
  lutSize?: number
}

export function LutUploader({ onLutLoaded, onError, fileName, lutSize }: LutUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const loadFile = async (file: File) => {
    if (!/\.cube$/i.test(file.name)) {
      onError('请选择 .cube 格式的 LUT 文件。')
      return
    }

    try {
      const text = await file.text()
      const lut = parseCube(text)
      onLutLoaded(lut, file.name)
    } catch (error) {
      const message = error instanceof Error ? error.message : '无法解析这个 .cube 文件。'
      onError(message)
    }
  }

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0]
    if (file) {
      void loadFile(file)
    }
  }

  return (
    <section
      className={`upload-zone ${isDragging ? 'is-dragging' : ''}`}
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
        accept=".cube"
        onChange={(event) => handleFiles(event.currentTarget.files)}
      />
      <span className="upload-label">
        <span className="codicon codicon-symbol-color" aria-hidden="true" />
        LUT
      </span>
      {fileName ? (
        <>
          <strong className="upload-filename" title={fileName}>{fileName}</strong>
          <small>
            {lutSize ? `${lutSize} x ${lutSize} x ${lutSize}` : ''}
            {lutSize ? ' · ' : ''}
            点击重新选择
          </small>
        </>
      ) : (
        <>
          <strong>拖入或选择 .cube 文件</strong>
          <small>3D LUT，本地处理</small>
        </>
      )}
    </section>
  )
}
