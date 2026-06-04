# Spec: InstaSetka Local Instagram Grid Editor

## Status
Draft for review.

Related design specification: [docs/design-spec.md](design-spec.md).
Related implementation plan: [docs/plan.md](plan.md).

## Assumptions
1. The app is a packaged local Windows desktop application distributed as an `.exe`.
2. All images stay on the user's machine; no cloud upload, account, or remote storage is required.
3. The first version targets one creator working on one machine.
4. The main output target is Instagram feed posts and carousel slides, primarily portrait 4:5, with taller 3:4 and square 1:1 available through a visible aspect-ratio switcher.
5. Export must preserve source quality as much as possible, but the output still has to match Instagram-ready dimensions and crop choices.
6. Version 1 supports JPEG and PNG input/output. HEIC and WebP can wait until later.

## Objective
Build a local Windows desktop visual editor for planning and exporting an Instagram grid.

The user should be able to import personal images, arrange them in a feed grid, crop each image inside its grid cell, rank or reorder posts, create carousel posts, and export each final image or carousel slide exactly as configured.

Success means the editor feels closer to a focused production tool than a moodboard: fast image intake, precise crop controls, predictable ordering, reversible edits, and reliable high-quality exports.

## Primary User Stories
- As a creator, I can add a batch of images to a local workspace and see them in an Instagram-like grid.
- As a creator, I can drop many candidate images onto a PureRef-style freeform canvas before deciding what belongs in the grid.
- As a creator, I can drag images from the freeform canvas into the final grid.
- As a creator, I can drag posts around to reorder the grid and immediately understand how the feed will look.
- As a creator, I can crop, pan, zoom, rotate, and reset each image inside its grid slot without damaging the original file.
- As a creator, I can mark priority or rank items so I can sort or plan publishing order.
- As a creator, I can create an Instagram carousel post with multiple image slides, edit each slide crop, reorder slides, and export them as a numbered set.
- As a creator, I can import one long image and split it into carousel slides directly in the app.
- As a creator, I can export every configured post image in the exact crop and aspect ratio I set, without unnecessary quality loss.
- As a creator, I can save the project locally and reopen it later with all ordering, crops, carousel structure, and metadata intact.

## Recommended Product Scope

### Version 1
- Windows `.exe` desktop app.
- Import images via file picker and drag-and-drop.
- PureRef-style source canvas for candidate images: pan, zoom, arrange, group, select, and drag into the grid.
- Feed grid planner with 3-column Instagram layout.
- Aspect-ratio switcher between 4:5, 3:4, and 1:1, with 4:5 as the primary/default mode.
- Adjustable workspace divider so the user can resize the Source Canvas and Grid Organizer with the mouse.
- Light/dark theme switcher, with dark theme fully supported for long editing sessions.
- Drag-and-drop reorder for posts.
- Non-destructive crop state per image: position, scale, rotation, aspect ratio.
- Detail editor for selected post.
- Ranking or status fields: draft, ready, scheduled, posted, plus numeric priority.
- Carousel support: a post can contain 1-20 image slides.
- Long-image-to-carousel splitter for panoramic, tall, or wide source images.
- Slide-level crop controls and drag reorder.
- Carousel editor appears in the left workspace when a carousel grid post is selected.
- Export selected post, selected carousel, or entire grid.
- Export JPEG and PNG in MVP.
- Project save/load as a local project file.
- Local persistence in browser storage for recent work.
- Autosave and crash recovery.
- Grid versions/snapshots for trying alternate layouts.
- Locked published slots so existing posts can remain fixed while planning future posts.
- Quality map for the whole grid and all carousel slides.
- Safe-zone guides for profile/grid preview and feed framing.

### Later Versions
- Caption, hashtag, and notes fields.
- Calendar planning.
- Reel cover and Story formats.
- Side-by-side before/after crop comparison.
- Templates for carousel layouts with text overlays.
- Batch export presets for Instagram, archive quality, and web preview.
- Color labels, collections, and filtering.
- Duplicate detection and missing-file recovery.
- Text/design slide editor for carousels.

## Important UX Decisions
- The first screen should be the actual grid editor, not a landing page.
- The first screen should show two connected workspaces: freeform source canvas on the left, final grid organizer on the right.
- The left workspace is for candidate images, visual sorting, grouping, carousel creation, and long-image splitting.
- The right workspace is the source of truth for final Instagram grid order.
- The grid should remain visible while editing crops so the user can judge the feed as a whole.
- Cropping should be non-destructive: original files are never overwritten.
- Aspect-ratio switching must never stretch or squash images; previews should preserve source proportions and crop overflow.
- Every exported file should have clear naming, for example `grid-001.jpg`, `grid-002.jpg`, `carousel-004-slide-01.jpg`.
- The app should warn before exporting if an image source is lower resolution than the target export size.
- The app should show export dimensions and estimated quality before export.
- The current grid aspect ratio should be obvious at all times, because the same image order can feel different in 4:5, 3:4, and 1:1.
- The current theme should be switchable from the app bar and persist with local project/app settings.
- The user should be able to undo/redo reorder and crop changes.
- Undo/redo should cover canvas moves, grid insertions, grid reorder, crop edits, carousel creation, slide reorder, long-image splitting, and deletion.
- The app should autosave often and clearly show whether the project is saved.
- The app should support multiple saved layout versions inside one project.
- Already-published or locked grid slots should be visually distinct and protected from accidental reorder.
- The app should make canvas-to-grid relationships visible: selecting a source image shows where it is used; selecting a grid post shows its source image.
- Keyboard shortcuts are useful, but all core actions must be available through visible controls.

## Tech Stack
- Desktop shell: Tauri.
- Framework: React with Vite.
- Language: TypeScript.
- Styling: CSS modules or plain scoped CSS, depending on final project preference.
- Drag and drop: `@dnd-kit`.
- Crop interaction: custom canvas-based cropper or a maintained crop library after evaluation.
- Image processing/export: browser Canvas API with `createImageBitmap`, `OffscreenCanvas` where available, and high-quality downscaling; Rust-side helpers only if browser export quality or file access becomes limiting.
- Local persistence: app data folder for project metadata and imported image copies, plus portable project export/import.
- Testing: Vitest for logic, Playwright for browser flows.

## Commands
- Install: `npm install`
- Dev: `npm run tauri dev`
- Web build: `npm run build`
- Desktop build: `npm run tauri build`
- Preview: `npm run preview -- --host 127.0.0.1 --port 4321`
- Unit tests: `npm run test`
- Browser tests: `npx playwright test --reporter=line`

## Project Structure
- `docs/` - product and technical specs.
- `src/` - application source.
- `src/components/` - reusable React UI components.
- `src/features/grid/` - grid planning, ordering, post cards.
- `src/features/crop/` - crop state, crop UI, export rendering.
- `src/features/carousel/` - carousel model and slide editor.
- `src/features/splitter/` - long-image-to-carousel slicing workflow.
- `src/features/project/` - save, load, persistence, file references.
- `src/lib/` - shared utilities.
- `src/styles/` - global design tokens and layout styles.
- `tests/` - unit and integration tests.
- `e2e/` - Playwright tests.
- `public/` - static assets.

## Data Model

```ts
type Project = {
  id: string;
  name: string;
  assets: SourceAsset[];
  canvasItems: CanvasItem[];
  posts: Post[];
  versions: GridVersion[];
  createdAt: string;
  updatedAt: string;
};

type SourceAsset = {
  id: string;
  name: string;
  originalPath?: string;
  width: number;
  height: number;
  mimeType: string;
};

type CanvasItem = {
  id: string;
  sourceImageId: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  groupId?: string;
};

type Post = {
  id: string;
  kind: "single" | "carousel";
  priority: number;
  status: "draft" | "ready" | "scheduled" | "posted";
  locked: boolean;
  slides: Slide[];
};

type GridVersion = {
  id: string;
  name: string;
  postOrder: string[];
  createdAt: string;
};

type Slide = {
  id: string;
  sourceImageId: string;
  crop: CropState;
};

type CropState = {
  aspectRatio: "4:5" | "3:4" | "1:1";
  x: number;
  y: number;
  scale: number;
  rotation: number;
};
```

## Code Style
Prefer small, typed pure functions for image math and project state transitions.

```ts
export function movePost(posts: Post[], fromIndex: number, toIndex: number): Post[] {
  const nextPosts = [...posts];
  const [movedPost] = nextPosts.splice(fromIndex, 1);
  nextPosts.splice(toIndex, 0, movedPost);
  return nextPosts;
}
```

Key conventions:
- Components use PascalCase.
- Hooks use `useThingName`.
- Pure state utilities live outside React components.
- Image export code is isolated from UI components.
- Original image blobs are never mutated.

## Testing Strategy
- Unit test project-state utilities: reorder, ranking, carousel slide management, crop calculations.
- Unit test source canvas utilities: placement, grouping, asset reuse, and grid insertion.
- Unit test export math: aspect ratio, target dimensions, scale, rotation, filename generation.
- Browser test core flows:
  - import images;
  - reorder posts;
  - edit crop;
  - create carousel;
  - export selected item.
- Visual QA with Playwright screenshots for desktop and mobile-width layouts.
- Manual test with at least one high-resolution JPEG and one PNG before considering export complete.

## Export Requirements
- Exports must render from original image data, not from the visible preview thumbnail.
- Default feed export: 1080 x 1350 JPEG for 4:5, quality configurable.
- Tall feed export: 1080 x 1440 JPEG for 3:4, quality configurable.
- Secondary square export: 1080 x 1080 JPEG for 1:1, quality configurable.
- PNG export should be available for images needing transparency.
- Export should preserve EXIF orientation visually, even if metadata is not preserved.
- The app should warn when the source crop area is below export resolution.
- Batch export should produce a ZIP file with stable numbered filenames.
- Long-image carousel export should split from the original image into per-slide crops, not from preview-sized intermediates.
- Long-image split mode should support choosing slide count first, then fine-tuning each resulting slide crop.
- Long-image split direction should be inferred automatically from image proportions, with a manual horizontal/vertical switcher.

## Instagram Quality Rules
- Export feed and carousel images at exactly 1080 px wide for Instagram-ready presets.
- Keep feed and carousel aspect ratios inside Instagram's supported photo range: 1.91:1 to 3:4.
- Use these first-class presets:
  - `4:5`: 1080 x 1350.
  - `3:4`: 1080 x 1440.
  - `1:1`: 1080 x 1080.
- Do not upscale silently. If the selected crop has fewer pixels than the target export size, show a quality warning and let the user choose whether to continue.
- Downscale from the original image with high-quality resampling, not from a preview or thumbnail.
- Export in sRGB color for predictable Instagram display.
- Strip or normalize problematic metadata that can cause orientation or color surprises, while preserving the visible orientation.
- JPEG should be the default for photos, with a high-quality default setting and an advanced quality slider.
- PNG should be available for transparency, graphics, screenshots, or images where JPEG artifacts are obvious.
- Avoid repeated recompression: if the user exports, reopens, and exports again, use the original imported asset plus crop metadata, not the previous export.
- For carousels, enforce one aspect ratio across all slides in a carousel because Instagram uses a shared post frame.
- Include an export preflight panel showing target size, aspect ratio, source crop size, estimated quality status, file type, and warnings.
- Include an in-app reminder that Instagram may still recompress uploads and that the Instagram mobile app's high-quality upload setting should be enabled when posting.

## Export Presets
- `Instagram Portrait`: 4:5, 1080 x 1350, JPEG, default.
- `Instagram Tall Portrait`: 3:4, 1080 x 1440, JPEG, for newer taller feed/grid support.
- `Instagram Square`: 1:1, 1080 x 1080, JPEG.
- `Transparent/Graphic`: current aspect ratio, PNG.
- `Archive Copy`: same crop at source-supported higher resolution, optional, not the default Instagram upload file.

## Project Files And Recovery
- Project files should use a portable app-specific package format, for example `.instasetka`.
- A project package should contain metadata, canvas layout, grid versions, crop settings, carousel settings, generated thumbnails, and imported source assets or managed asset references.
- Version 1 should embed copied imported source assets in the project package or app-managed storage so projects do not break when external folders move.
- The app should autosave local project state after meaningful changes.
- The app should recover unsaved work after crash or accidental close.
- The app should show a clear saved, saving, or unsaved indicator.
- The user should be able to duplicate the current grid into a new version before making risky reorder changes.

## Quality Map And Safe Zones
- Provide a whole-project quality map that lists posts and carousel slides by readiness.
- Quality map should flag:
  - source crop below target export size;
  - heavy crop that may look soft after Instagram compression;
  - missing source asset;
  - mixed aspect ratios inside one carousel;
  - locked/published slots;
  - duplicate candidate images.
- Safe-zone guides should help the user understand how content may appear in feed, profile grid, and carousel cover contexts.
- Safe-zone guides should be toggleable and should never appear in exported files.

## Performance Requirements
- The Source Canvas should use thumbnails for normal viewing and decode full-resolution images only when needed for crop/export.
- Canvas rendering should feel comfortable with 50 candidate images and remain usable with 100 candidate images.
- Large images should be lazy-decoded and cached carefully.
- Export must always use original source pixels, even when the canvas uses thumbnails.
- The app should warn before memory-heavy batch exports.
- The app should avoid layout shifts while thumbnails load.

## Boundaries
- Always:
  - Keep original images untouched.
  - Store crop settings separately from image files.
  - Keep source assets separate from canvas items, posts, slides, and grid versions.
  - Export Instagram presets from original source pixels at Instagram-ready dimensions.
  - Show quality warnings before exporting weak crops.
  - Autosave user work and provide recovery after unexpected close.
  - Run build and relevant tests before calling implementation done.
  - Verify export quality with real browser behavior.
  - Keep the UI usable offline after the app loads.
  - Support both light and dark themes without reducing image visibility or control contrast.
- Ask first:
  - Switching from Tauri to Electron.
  - Adding AI features, cloud sync, authentication, or external APIs.
  - Adding heavy image-processing dependencies.
  - Adding caption, hashtag, calendar, posting, or cloud features.
  - Changing the primary export dimensions or default aspect ratio.
- Never:
  - Upload user images without explicit approval.
  - Overwrite imported source files.
- Rely on low-resolution thumbnails for final export.
- Stretch, squash, or distort source images to fit a grid cell.
- Hide export warnings when quality may be insufficient.

## Best-Practice Notes
- Treat every edit as metadata until export.
- Use a single canonical coordinate system for crop state to avoid preview/export mismatches.
- Decode images once and cache responsibly; large images can consume a lot of memory.
- Prefer virtualized or lazy thumbnails if the grid may contain many posts.
- Make export deterministic: the same project state should produce the same output.
- Make missing files recoverable if the project file references external image paths later.
- Keep destructive actions reversible or confirmed.
- Provide clear empty, loading, error, and export-progress states.

## Success Criteria
- User can import at least 30 images and arrange them in a 3-column grid.
- User can drop at least 30 images onto the source canvas, pan/zoom the canvas, and drag selected images into the grid.
- User can switch the grid between 4:5, 3:4, and 1:1.
- User can switch between light and dark theme.
- User can crop an image in the grid and export the final crop at 1080 x 1350 in 4:5 mode.
- User can crop an image in the grid and export the final crop at 1080 x 1440 in 3:4 mode.
- User can export the same post at 1080 x 1080 in 1:1 mode.
- Exported image matches the visible crop framing.
- User can create a carousel with at least 10 slides and export all slides with numbered filenames.
- Selecting a carousel post in the grid switches the left workspace to carousel editing without losing the grid context.
- User can turn one long image into a carousel, choose the slide count, adjust the generated crops, and export all slides.
- Export preflight correctly warns when a crop cannot supply enough pixels for the selected Instagram preset.
- Exported photo presets use 1080 px width and the selected ratio's exact target height.
- User can lock published grid slots and reorder future posts without moving locked slots accidentally.
- User can duplicate the current grid into a second version and switch between versions.
- User can open a quality map and see all export readiness warnings across the project.
- User can recover recent work after closing and reopening the app.
- User can save and reload a project with order, crop, carousel, rank, and status intact.
- Build succeeds with `npm run build`.
- Core state and crop/export utilities have tests.
- Playwright verifies the main import, reorder, crop, carousel, and export flows.

## Open Questions
None before initial implementation.

## References Checked
- Instagram Help Centre: photo uploads are kept at best available resolution up to 1080 px wide when the aspect ratio is between 1.91:1 and 3:4.
- Instagram Help Centre: high-quality upload can be enabled in media quality settings for reels; the app should still remind users that Instagram may recompress uploads.
- Buffer Instagram image size guide: current vertical feed recommendations include 4:5 at 1080 x 1350 and 3:4 at 1080 x 1440.
