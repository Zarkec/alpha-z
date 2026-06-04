export type RGBTuple = [number, number, number]

export type CubeLUT = {
  title?: string
  size: number
  domainMin: RGBTuple
  domainMax: RGBTuple
  data: Float32Array
}

const FLOAT_PATTERN = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i

function parseFloatToken(token: string, lineNumber: number): number {
  if (!FLOAT_PATTERN.test(token)) {
    throw new Error(`第 ${lineNumber} 行：需要浮点数，但读取到 "${token}"。`)
  }

  const value = Number(token)
  if (!Number.isFinite(value)) {
    throw new Error(`第 ${lineNumber} 行：数值不是有效有限数："${token}"。`)
  }

  return value
}

function parseTriple(parts: string[], lineNumber: number, keyword: string): RGBTuple {
  if (parts.length !== 4) {
    throw new Error(`第 ${lineNumber} 行：${keyword} 需要 3 个数值。`)
  }

  return [
    parseFloatToken(parts[1], lineNumber),
    parseFloatToken(parts[2], lineNumber),
    parseFloatToken(parts[3], lineNumber),
  ]
}

function parseTitle(line: string): string {
  const rawTitle = line.slice('TITLE'.length).trim()
  if (!rawTitle) {
    return ''
  }

  if (rawTitle.startsWith('"') && rawTitle.endsWith('"') && rawTitle.length >= 2) {
    return rawTitle.slice(1, -1)
  }

  return rawTitle
}

export function parseCube(text: string): CubeLUT {
  let title: string | undefined
  let size: number | undefined
  let domainMin: RGBTuple = [0, 0, 0]
  let domainMax: RGBTuple = [1, 1, 1]
  const values: number[] = []

  const lines = text.split(/\r?\n/)

  for (let i = 0; i < lines.length; i += 1) {
    const lineNumber = i + 1
    const line = lines[i].trim()

    if (!line || line.startsWith('#')) {
      continue
    }

    const parts = line.split(/\s+/)
    const keyword = parts[0].toUpperCase()

    if (keyword === 'TITLE') {
      title = parseTitle(line)
      continue
    }

    if (keyword === 'LUT_3D_SIZE') {
      if (parts.length !== 2) {
        throw new Error(`第 ${lineNumber} 行：LUT_3D_SIZE 需要 1 个整数值。`)
      }

      const parsedSize = Number(parts[1])
      if (!Number.isInteger(parsedSize) || parsedSize < 2) {
        throw new Error(`第 ${lineNumber} 行：LUT_3D_SIZE 必须是大于 1 的整数。`)
      }

      size = parsedSize
      continue
    }

    if (keyword === 'DOMAIN_MIN') {
      domainMin = parseTriple(parts, lineNumber, 'DOMAIN_MIN')
      continue
    }

    if (keyword === 'DOMAIN_MAX') {
      domainMax = parseTriple(parts, lineNumber, 'DOMAIN_MAX')
      continue
    }

    if (parts.length === 3) {
      values.push(
        parseFloatToken(parts[0], lineNumber),
        parseFloatToken(parts[1], lineNumber),
        parseFloatToken(parts[2], lineNumber),
      )
      continue
    }

    throw new Error(`第 ${lineNumber} 行：不支持或格式错误的 .cube 内容："${line}"。`)
  }

  if (size === undefined) {
    throw new Error('缺少必需的 LUT_3D_SIZE 声明。')
  }

  for (let channel = 0; channel < 3; channel += 1) {
    if (domainMax[channel] <= domainMin[channel]) {
      throw new Error('每个颜色通道的 DOMAIN_MAX 都必须大于 DOMAIN_MIN。')
    }
  }

  const expectedValueCount = size * size * size * 3
  if (values.length !== expectedValueCount) {
    throw new Error(
      `LUT 数据数量不正确：尺寸 ${size} 需要 ${expectedValueCount} 个浮点数，实际读取到 ${values.length} 个。`,
    )
  }

  return {
    title,
    size,
    domainMin,
    domainMax,
    data: new Float32Array(values),
  }
}
