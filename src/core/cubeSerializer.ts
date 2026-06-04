import type { CubeLUT } from './cubeParser'

function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toFixed(6) : '0.000000'
}

export function serializeCube(lut: CubeLUT): string {
  const lines: string[] = []

  if (lut.title) {
    lines.push(`TITLE "${lut.title.replaceAll('"', '\\"')}"`)
  }

  lines.push(`LUT_3D_SIZE ${lut.size}`)
  lines.push(`DOMAIN_MIN ${lut.domainMin.map(formatNumber).join(' ')}`)
  lines.push(`DOMAIN_MAX ${lut.domainMax.map(formatNumber).join(' ')}`)
  lines.push('')

  for (let index = 0; index < lut.data.length; index += 3) {
    lines.push(
      `${formatNumber(lut.data[index])} ${formatNumber(lut.data[index + 1])} ${formatNumber(lut.data[index + 2])}`,
    )
  }

  return `${lines.join('\n')}\n`
}
