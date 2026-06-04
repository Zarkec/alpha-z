type ExportButtonProps = {
  getCanvas: () => HTMLCanvasElement | null
  disabled?: boolean
}

export function ExportButton({ getCanvas, disabled = false }: ExportButtonProps) {
  const exportPng = () => {
    const canvas = getCanvas()
    if (!canvas) {
      return
    }

    const link = document.createElement('a')
    link.download = 'alpha-z-output.png'
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  return (
    <button className="primary-button" type="button" disabled={disabled} onClick={exportPng}>
      <span className="codicon codicon-export" aria-hidden="true" />
      导出 PNG
    </button>
  )
}
