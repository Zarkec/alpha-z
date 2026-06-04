import { useCallback, useRef, useState } from 'react'
import { ExportButton } from './components/ExportButton'
import { ImageUploader } from './components/ImageUploader'
import { IntensitySlider } from './components/IntensitySlider'
import { LutUploader } from './components/LutUploader'
import { PreviewCanvas } from './components/PreviewCanvas'
import type { CubeLUT } from './core/cubeParser'

function App() {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [imageName, setImageName] = useState<string>('')
  const [lut, setLut] = useState<CubeLUT | null>(null)
  const [lutName, setLutName] = useState<string>('')
  const [intensity, setIntensity] = useState(100)
  const [compareMode, setCompareMode] = useState(false)
  const [error, setError] = useState<string>('')
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement | null) => {
    canvasRef.current = canvas
  }, [])

  return (
    <main className="app">
      <header className="app-header">
        <div>
          <h1>
            <span className="codicon codicon-symbol-color" aria-hidden="true" />
            alpha-z
          </h1>
          <p>浏览器端 LUT 滤镜编辑器</p>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <ImageUploader
            onImageLoaded={(loadedImage, fileName) => {
              setImage(loadedImage)
              setImageName(fileName)
              setError('')
            }}
            onError={setError}
          />

          <LutUploader
            onLutLoaded={(loadedLut, fileName) => {
              setLut(loadedLut)
              setLutName(fileName)
              setError('')
            }}
            onError={setError}
          />

          {error ? <div className="error-message">{error}</div> : null}

          <div className="file-info">
            <div>
              <span>
                <span className="codicon codicon-file-media" aria-hidden="true" />
                图片
              </span>
              <strong title={imageName || undefined}>{imageName || '未加载'}</strong>
            </div>
            <div>
              <span>
                <span className="codicon codicon-symbol-color" aria-hidden="true" />
                LUT
              </span>
              <strong title={lutName || undefined}>{lutName || '仅显示原图'}</strong>
            </div>
            {lut ? (
              <div>
                <span>
                  <span className="codicon codicon-settings-gear" aria-hidden="true" />
                  LUT 尺寸
                </span>
                <strong>
                  {lut.size} x {lut.size} x {lut.size}
                </strong>
              </div>
            ) : null}
          </div>

          <IntensitySlider value={intensity} onChange={setIntensity} disabled={!image || !lut} />

          <label className="toggle-row">
            <input
              type="checkbox"
              checked={compareMode}
              disabled={!image || !lut}
              onChange={(event) => setCompareMode(event.currentTarget.checked)}
            />
            <span className="toggle-label">
              <span className="codicon codicon-compare-changes" aria-hidden="true" />
              对比原图 / 滤镜效果
            </span>
          </label>

          <ExportButton getCanvas={() => canvasRef.current} disabled={!image} />
        </aside>

        <section className="preview-panel">
          <PreviewCanvas
            image={image}
            lut={lut}
            intensity={intensity}
            compareMode={compareMode}
            onCanvasReady={handleCanvasReady}
          />
        </section>
      </div>
    </main>
  )
}

export default App
