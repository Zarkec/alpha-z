import { useRef, useState } from 'react'

type ImageUploaderProps = {
  onImageLoaded: (image: HTMLImageElement, fileName: string) => void
  onError: (message: string) => void
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function isAcceptedImage(file: File): boolean {
  return ACCEPTED_TYPES.includes(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name)
}

export function ImageUploader({ onImageLoaded, onError }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const loadFile = (file: File) => {
    if (!isAcceptedImage(file)) {
      onError('请选择 jpg、jpeg、png 或 webp 格式的图片。')
      return
    }

    const url = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(url)
      onImageLoaded(image, file.name)
    }

    image.onerror = () => {
      URL.revokeObjectURL(url)
      onError('无法加载这张图片，请换一张图片重试。')
    }

    image.src = url
  }

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0]
    if (file) {
      loadFile(file)
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
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        onChange={(event) => handleFiles(event.currentTarget.files)}
      />
      <span className="upload-label">
        <span className="codicon codicon-file-media" aria-hidden="true" />
        图片
      </span>
      <strong>拖入或选择图片</strong>
      <small>jpg, jpeg, png, webp</small>
    </section>
  )
}
