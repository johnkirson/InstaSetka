# InstaSetka

Local Windows app for planning an Instagram grid, cropping posts, building carousels, splitting images across multiple slots, and exporting high-quality JPEG/PNG output.

## Features

- Source canvas for importing, arranging, comparing, and lasso-selecting images.
- Final grid organizer with exact slot placement and drag-and-drop reordering.
- Crop controls with aspect presets: 4:5, 3:4, and 1:1.
- Ctrl-click mosaic splitting for placing one image across multiple selected grid slots.
- Carousel editor with slide ordering, duplication, removal, and long-image splitting.
- Quality map, single export, batch render, and feed snapshot export.
- Local project packages, autosave, undo/redo, dark/light themes, and guided tours.

## Development

```bash
npm install
npm run dev
```

The local app runs at `http://127.0.0.1:1420/`.

## Checks

```bash
npm run test
npm run build
```

## Windows app build

```bash
npm run tauri build
```

Build artifacts are generated under `src-tauri/target/release/` and are intentionally ignored by Git.

## License

InstaSetka is source-available for personal and non-commercial use under the PolyForm Noncommercial License 1.0.0.

Commercial use, resale, redistribution as part of a paid product or service, or use by companies requires a separate commercial license from the author.
