# alpha-z

alpha-z 是一个浏览器端 LUT 滤镜编辑器。用户可以在本地上传图片和 `.cube` 3D LUT 文件，通过 Canvas/WebGL 预览滤镜效果，调节强度，对比原图和滤镜图，并导出处理后的图片。

## 运行

```bash
npm install
npm run dev
```

局域网访问开发服务时使用：

```bash
npm run dev -- --host 0.0.0.0
```

## 构建

```bash
npm run build
```

## 技术栈约束

- 使用 Vite + React + TypeScript。
- 预览优先使用 WebGL2；WebGL2 不可用时回退到 Web Worker + Canvas 2D。
- 不引入后端服务、数据库、登录注册或用户系统。
- 不引入大型 UI 框架；样式使用普通 CSS。
- 图标使用 `@vscode/codicons`。
- 不引入 AI 功能。

## 功能边界

- 所有图片和 LUT 处理必须在浏览器本地完成。
- 不上传图片、LUT 或导出结果到服务器。
- 支持常见图片格式：jpg、jpeg、png、webp。
- `.cube` 解析需要支持 `TITLE`、`LUT_3D_SIZE`、`DOMAIN_MIN`、`DOMAIN_MAX`、注释、空行和 RGB 数据行。
- LUT 数据使用强类型 `CubeLUT` 表示。
- 导出优先支持 PNG。

## 代码约束

- TypeScript 不使用 `any`。
- 核心算法放在 `src/core/`，不要和 React UI 组件耦合。
- Worker 逻辑放在 `src/workers/`。
- React 组件放在 `src/components/`。
- 小函数优先，必要时添加简短注释说明复杂算法。
- 修改 LUT 解析、插值、WebGL shader 或 Worker 时必须运行 `npm run build`。

## UI 约束

- 页面保持深色工具软件风格。
- 文案使用中文。
- 不做营销型 landing page，首页直接是可用工具。
- 上传区、强度调节、对比预览、导出按钮要保持清晰。
- 对比模式使用可拖动竖向分割条。
- 移动端和窄屏不能出现文字溢出或控件互相遮挡。

## 性能约束

- 大图预览最大边限制为 2048px。
- 滤镜强度拖动时避免主线程明显卡顿。
- CPU 像素处理优先放到 Web Worker。
- WebGL 预览只更新必要 uniform，避免重复计算导出图。

## 提交约束

Commit 提交格式见 `docs/commit_convention.md`。

## Agent 约束

使用 Codex 或其他代码代理时遵循以下规则：

- 本项目是纯前端浏览器工具。
- 不添加后端、数据库、登录注册、账号体系或远程图片处理。
- 不上传用户图片、LUT 文件或处理结果。
- 不添加 AI 功能。
- 保持 Vite + React + TypeScript 技术栈。
- 核心算法必须和 React 组件解耦。
- 修改核心算法、WebGL shader、Worker 或导出逻辑后运行 `npm run build`。
- 新增 UI 文案使用中文。
- 不引入大型 UI 框架。
- 图标优先使用 `@vscode/codicons`。

当用户询问库、框架、SDK、API、CLI 工具或云服务的用法时，使用 `ctx7` CLI 获取当前文档：

```bash
npx ctx7@latest library <name> "<user's question>"
npx ctx7@latest docs <libraryId> "<user's question>"
```
