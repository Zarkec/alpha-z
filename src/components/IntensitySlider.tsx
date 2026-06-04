type IntensitySliderProps = {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
}

export function IntensitySlider({ value, onChange, disabled = false }: IntensitySliderProps) {
  return (
    <label className="control-panel">
      <span className="control-row">
        <span>
          <span className="codicon codicon-settings-gear" aria-hidden="true" />
          滤镜强度
        </span>
        <strong>{value}%</strong>
      </span>
      <input
        type="range"
        min="0"
        max="100"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </label>
  )
}
