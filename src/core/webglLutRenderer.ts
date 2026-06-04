import type { CubeLUT } from './cubeParser'

const VERTEX_SHADER_SOURCE = `#version 300 es
in vec2 a_position;
out vec2 v_texCoord;

void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;

uniform sampler2D u_image;
uniform sampler2D u_lut;
uniform float u_lutSize;
uniform float u_intensity;
uniform bool u_hasLut;
uniform bool u_compareMode;
uniform float u_comparePosition;
uniform vec2 u_resolution;

in vec2 v_texCoord;
out vec4 outColor;

vec3 readLutNode(float r, float g, float b) {
  float size = u_lutSize;
  float textureWidth = size * size;
  vec2 coord = vec2((g * size + r + 0.5) / textureWidth, (b + 0.5) / size);
  return texture(u_lut, coord).rgb;
}

vec3 sampleLut(vec3 color) {
  float size = u_lutSize;
  vec3 scaled = clamp(color, 0.0, 1.0) * (size - 1.0);
  vec3 base = floor(scaled);
  vec3 nextNode = min(base + 1.0, vec3(size - 1.0));
  vec3 fraction = scaled - base;

  vec3 c000 = readLutNode(base.r, base.g, base.b);
  vec3 c100 = readLutNode(nextNode.r, base.g, base.b);
  vec3 c010 = readLutNode(base.r, nextNode.g, base.b);
  vec3 c110 = readLutNode(nextNode.r, nextNode.g, base.b);
  vec3 c001 = readLutNode(base.r, base.g, nextNode.b);
  vec3 c101 = readLutNode(nextNode.r, base.g, nextNode.b);
  vec3 c011 = readLutNode(base.r, nextNode.g, nextNode.b);
  vec3 c111 = readLutNode(nextNode.r, nextNode.g, nextNode.b);

  vec3 c00 = mix(c000, c100, fraction.r);
  vec3 c10 = mix(c010, c110, fraction.r);
  vec3 c01 = mix(c001, c101, fraction.r);
  vec3 c11 = mix(c011, c111, fraction.r);
  vec3 c0 = mix(c00, c10, fraction.g);
  vec3 c1 = mix(c01, c11, fraction.g);
  return mix(c0, c1, fraction.b);
}

void main() {
  vec2 imageCoord = vec2(v_texCoord.x, 1.0 - v_texCoord.y);
  vec4 original = texture(u_image, imageCoord);
  vec3 mapped = u_hasLut ? sampleLut(original.rgb) : original.rgb;
  vec3 filtered = mix(original.rgb, mapped, u_intensity);

  if (u_compareMode && v_texCoord.x < u_comparePosition) {
    filtered = original.rgb;
  }

  if (u_compareMode && abs(v_texCoord.x - u_comparePosition) < 1.0 / u_resolution.x) {
    outColor = vec4(1.0, 1.0, 1.0, original.a);
    return;
  }

  outColor = vec4(filtered, original.a);
}
`

function createShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) {
    throw new Error('无法创建 WebGL shader。')
  }

  gl.shaderSource(shader, source)
  gl.compileShader(shader)

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) ?? '未知 shader 编译错误'
    gl.deleteShader(shader)
    throw new Error(info)
  }

  return shader
}

function createProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE)
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE)
  const program = gl.createProgram()

  if (!program) {
    throw new Error('无法创建 WebGL program。')
  }

  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)
  gl.deleteShader(vertexShader)
  gl.deleteShader(fragmentShader)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) ?? '未知 WebGL program 链接错误'
    gl.deleteProgram(program)
    throw new Error(info)
  }

  return program
}

function createTexture(gl: WebGL2RenderingContext): WebGLTexture {
  const texture = gl.createTexture()
  if (!texture) {
    throw new Error('无法创建 WebGL texture。')
  }

  return texture
}

export class WebGLLutRenderer {
  private gl: WebGL2RenderingContext
  private program: WebGLProgram
  private imageTexture: WebGLTexture
  private lutTexture: WebGLTexture
  private vao: WebGLVertexArrayObject
  private lutSize = 2
  private hasLut = false
  private uniformLocations: {
    image: WebGLUniformLocation
    lut: WebGLUniformLocation
    lutSize: WebGLUniformLocation
    intensity: WebGLUniformLocation
    hasLut: WebGLUniformLocation
    compareMode: WebGLUniformLocation
    comparePosition: WebGLUniformLocation
    resolution: WebGLUniformLocation
  }

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      depth: false,
      preserveDrawingBuffer: true,
    })

    if (!gl) {
      throw new Error('当前浏览器不支持 WebGL2。')
    }

    this.gl = gl
    this.program = createProgram(gl)
    this.imageTexture = createTexture(gl)
    this.lutTexture = createTexture(gl)

    const vao = gl.createVertexArray()
    if (!vao) {
      throw new Error('无法创建 WebGL vertex array。')
    }
    this.vao = vao

    const positionLocation = gl.getAttribLocation(this.program, 'a_position')
    const buffer = gl.createBuffer()
    if (!buffer) {
      throw new Error('无法创建 WebGL buffer。')
    }

    gl.bindVertexArray(this.vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(positionLocation)
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)
    gl.bindVertexArray(null)

    this.uniformLocations = {
      image: this.getUniformLocation('u_image'),
      lut: this.getUniformLocation('u_lut'),
      lutSize: this.getUniformLocation('u_lutSize'),
      intensity: this.getUniformLocation('u_intensity'),
      hasLut: this.getUniformLocation('u_hasLut'),
      compareMode: this.getUniformLocation('u_compareMode'),
      comparePosition: this.getUniformLocation('u_comparePosition'),
      resolution: this.getUniformLocation('u_resolution'),
    }
  }

  setImage(imageData: ImageData): void {
    const gl = this.gl
    this.canvas.width = imageData.width
    this.canvas.height = imageData.height

    gl.bindTexture(gl.TEXTURE_2D, this.imageTexture)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, imageData.width, imageData.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, imageData.data)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  }

  setLut(lut: CubeLUT | null): void {
    const gl = this.gl

    if (!lut) {
      this.hasLut = false
      return
    }

    this.hasLut = true
    this.lutSize = lut.size

    const rgba = new Uint8Array(lut.size * lut.size * lut.size * 4)
    for (let sourceIndex = 0, targetIndex = 0; sourceIndex < lut.data.length; sourceIndex += 3, targetIndex += 4) {
      rgba[targetIndex] = Math.round(Math.min(1, Math.max(0, lut.data[sourceIndex])) * 255)
      rgba[targetIndex + 1] = Math.round(Math.min(1, Math.max(0, lut.data[sourceIndex + 1])) * 255)
      rgba[targetIndex + 2] = Math.round(Math.min(1, Math.max(0, lut.data[sourceIndex + 2])) * 255)
      rgba[targetIndex + 3] = 255
    }

    gl.bindTexture(gl.TEXTURE_2D, this.lutTexture)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, lut.size * lut.size, lut.size, 0, gl.RGBA, gl.UNSIGNED_BYTE, rgba)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  }

  render(intensity: number, compareMode: boolean, comparePosition: number): void {
    const gl = this.gl
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.useProgram(this.program)
    gl.bindVertexArray(this.vao)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.imageTexture)
    gl.uniform1i(this.uniformLocations.image, 0)

    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.lutTexture)
    gl.uniform1i(this.uniformLocations.lut, 1)

    gl.uniform1f(this.uniformLocations.lutSize, this.lutSize)
    gl.uniform1f(this.uniformLocations.intensity, intensity)
    gl.uniform1i(this.uniformLocations.hasLut, this.hasLut ? 1 : 0)
    gl.uniform1i(this.uniformLocations.compareMode, compareMode && this.hasLut ? 1 : 0)
    gl.uniform1f(this.uniformLocations.comparePosition, Math.min(1, Math.max(0, comparePosition)))
    gl.uniform2f(this.uniformLocations.resolution, this.canvas.width, this.canvas.height)

    gl.drawArrays(gl.TRIANGLES, 0, 6)
    gl.bindVertexArray(null)
  }

  dispose(): void {
    const gl = this.gl
    gl.deleteTexture(this.imageTexture)
    gl.deleteTexture(this.lutTexture)
    gl.deleteProgram(this.program)
    gl.deleteVertexArray(this.vao)
  }

  private getUniformLocation(name: string): WebGLUniformLocation {
    const location = this.gl.getUniformLocation(this.program, name)
    if (!location) {
      throw new Error(`缺少 WebGL uniform：${name}`)
    }

    return location
  }
}
