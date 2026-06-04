# alpha-z

alpha-z 是一个浏览器端 LUT 滤镜编辑器。用户可以在本地加载图片和 `.cube` 3D LUT 文件，预览滤镜效果，调节强度，对比原图和滤镜图，并导出 PNG。

所有图片处理都在浏览器本地通过 Canvas 2D 完成。项目不需要后端、不上传图片、不包含数据库或用户系统。

## 功能

- 上传 jpg、jpeg、png、webp 图片。
- 上传并解析 `.cube` LUT 文件。
- 支持 `.cube` 中的 `TITLE`、`LUT_3D_SIZE`、`DOMAIN_MIN`、`DOMAIN_MAX`、注释、空行和 RGB 数据行。
- 使用三线性插值应用 3D LUT。
- 支持 0% 到 100% 的滤镜强度调节。
- 支持原图 / 滤镜效果对比。
- 支持从当前处理结果导出 PNG。
- 支持上传“原图 + 滤镜效果图”，反推并生成近似 `.cube` 文件。
- 预览优先使用 WebGL2 进行 GPU 加速，WebGL2 不可用时回退到 Web Worker 后台处理。
- 导出图像由 Web Worker 后台生成，避免拖动强度滑块时阻塞主线程。
- 大图预览会按最大边 2048px 缩放，生成 LUT 时会按最大边 1024px 采样。

## 从图片生成 CUBE

侧栏的“从效果图生成 CUBE”面板用于根据两张图片生成 LUT：

- 第一张图是原图。
- 第二张图是已经处理过的滤镜效果图。
- 两张图必须是同一画面，构图和宽高比需要一致。
- 生成结果是近似 3D LUT，不适合从内容不同的两张图片中推断滤镜。
- 生成后会自动下载 `alpha-z-generated.cube`，并把生成的 LUT 应用到当前预览中。

## 运行

```bash
npm install
npm run dev
```

然后打开终端中显示的本地 Vite 地址。

## 构建

```bash
npm run build
```

## 项目结构

```text
src/core/cubeParser.ts       .cube 解析器和 CubeLUT 类型
src/core/cubeSerializer.ts   .cube 序列化输出
src/core/interpolate.ts      3D LUT 三线性插值
src/core/lut3d.ts            ImageData LUT 应用
src/core/lutGenerator.ts     根据原图和效果图生成近似 LUT
src/core/webglLutRenderer.ts WebGL2 LUT 预览渲染
src/workers/lutWorker.ts     后台 LUT 像素处理和导出图生成
src/components/              React UI 组件
src/App.tsx                  应用组合
src/styles.css               基础界面样式
```

## 后续计划

- 增加更高精度的 3D LUT 纹理采样。
- 评估 WebGPU 渲染路径。
- 增加可拖动的对比分割线。
- 增加 JPEG/WebP 导出选项。
- 增加 LUT 元数据展示和更详细的校验信息。
