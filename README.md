# alpha-z

alpha-z is a browser-based LUT filter editor. It lets users load an image and a `.cube` 3D LUT file, preview the filtered result, adjust filter strength, compare before/after, and export a PNG.

All image processing runs locally in the browser with Canvas 2D. There is no backend, upload service, database, or user account system.

## Features

- Upload jpg, jpeg, png, and webp images.
- Upload and parse `.cube` LUT files.
- Supports `TITLE`, `LUT_3D_SIZE`, `DOMAIN_MIN`, `DOMAIN_MAX`, comments, empty lines, and RGB LUT data rows.
- Applies 3D LUTs with trilinear interpolation.
- Filter intensity slider from 0% to 100%.
- Original/filtered comparison mode.
- PNG export from the current canvas.
- Large image previews are scaled to a maximum edge of 2048px for the first CPU-based MVP.

## Run

```bash
npm install
npm run dev
```

Then open the local Vite URL shown in the terminal.

## Build

```bash
npm run build
```

## Project Structure

```text
src/core/cubeParser.ts      .cube parser and CubeLUT type
src/core/interpolate.ts     3D LUT trilinear interpolation
src/core/lut3d.ts           ImageData LUT application
src/components/             React UI components
src/App.tsx                 App composition
src/styles.css              Base UI styling
```

## Future Plans

- Move CPU pixel processing into a Web Worker.
- Add WebGL or WebGPU processing for faster previews.
- Add split-handle comparison interaction.
- Add JPEG/WebP export options.
- Add LUT metadata display and validation details.
