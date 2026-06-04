# Implementation Plan: InstaSetka MVP

## Overview
Build a local Windows `.exe` image-planning editor with two connected workspaces: a PureRef-style Source Canvas for candidate images and a Grid Organizer for final Instagram layout. The MVP should prove the full core loop: import JPEG/PNG images, arrange them on canvas, drag into grid, crop, create carousel, split long image, check quality, export Instagram-ready JPEG/PNG files, save/recover project state.

## Planning Approach
This plan adapts the planning skill pragmatically. Tasks are vertical where possible, but the first phase creates enough foundation for the editor to stay coherent: app shell, data model, state operations, and test scaffolding.

## Architecture Decisions
- Use Tauri + React + Vite so the app can become a Windows `.exe` while keeping browser-grade UI iteration speed.
- Keep source assets, canvas items, posts, slides, and grid versions as separate entities.
- Use original source files for export; use generated thumbnails for canvas/grid display.
- Start with local app-managed project storage, then add portable `.instasetka` package import/export.
- Use a custom state layer with pure reducers before adding persistence and UI complexity.
- Build image export with browser canvas first; add Rust helpers only if export quality or file access becomes limiting.
- Treat `4:5` as default, with `3:4` and `1:1` available from the start.
- Use a monochrome UI accent.
- Embed copied source assets in the project package or app-managed storage for MVP.
- Optimize for 50 images comfortably and keep 100 images usable.

## Dependency Graph
```text
Tauri/Vite scaffold
  -> shared types and reducers
    -> project persistence and autosave
      -> source asset import and thumbnails
        -> Source Canvas UI
          -> canvas-to-grid drag/drop
            -> Grid Organizer UI
              -> crop state and preview
                -> export renderer and quality checks
                  -> carousel editor
                    -> long-image splitter
                      -> project package and desktop build
```

## Phase 1: App Foundation

### Task 1: Scaffold Tauri React App
**Description:** Create the base Tauri + React + TypeScript project, scripts, test setup, and initial app shell.

**Acceptance criteria:**
- [ ] App runs with `npm run tauri dev`.
- [ ] Web build runs with `npm run build`.
- [ ] Desktop build command exists for `npm run tauri build`.

**Verification:**
- [ ] Run `npm run build`.
- [ ] Run `npm run tauri dev` and confirm the editor shell opens.

**Dependencies:** None.

**Files likely touched:**
- `package.json`
- `src/`
- `src-tauri/`
- `index.html`

**Estimated scope:** Medium.

### Task 2: Define Core Types And Reducers
**Description:** Implement typed project state, source assets, canvas items, posts, slides, grid versions, crop state, and pure operations.

**Acceptance criteria:**
- [ ] Types match the spec.
- [ ] Reducers cover add asset, add canvas item, insert into grid, reorder grid, set crop, create carousel, and duplicate grid version.
- [ ] State updates are pure and unit-tested.

**Verification:**
- [ ] Run unit tests for state reducers.
- [ ] Run `npm run build`.

**Dependencies:** Task 1.

**Files likely touched:**
- `src/lib/types.ts`
- `src/features/project/projectReducer.ts`
- `tests/projectReducer.test.ts`

**Estimated scope:** Medium.

### Task 3: Implement Design Tokens And Two-Pane Shell
**Description:** Build the app frame from the design spec: app bar, Source Canvas area, Grid Organizer area, divider, status bar, and empty states.

**Acceptance criteria:**
- [ ] First screen is the editor, not a landing page.
- [ ] Left Source Canvas and right Grid Organizer are visible.
- [ ] Aspect switcher is present with `4:5`, `3:4`, and `1:1`.
- [ ] Divider between Source Canvas and Grid Organizer is draggable.
- [ ] Layout remains stable at desktop size.

**Verification:**
- [ ] Run `npm run build`.
- [ ] Capture desktop screenshot at 1440 x 900.

**Dependencies:** Task 1.

**Files likely touched:**
- `src/App.tsx`
- `src/styles/tokens.css`
- `src/features/shell/`

**Estimated scope:** Medium.

### Checkpoint: Foundation
- [ ] App builds.
- [ ] Empty editor shell matches design direction.
- [ ] Reducers have passing tests.

## Phase 2: Source Canvas And Grid Core

### Task 4: Import Images And Generate Thumbnails
**Description:** Allow users to drag/drop image files into the app and create source asset records with preview thumbnails.

**Acceptance criteria:**
- [ ] User can drop multiple images onto the Source Canvas.
- [ ] Each image appears as a movable canvas item.
- [ ] Original asset metadata is stored separately from thumbnail display data.

**Verification:**
- [ ] Manual check with JPEG and PNG.
- [ ] Unit test asset creation metadata.
- [ ] Run `npm run build`.

**Dependencies:** Tasks 2, 3.

**Files likely touched:**
- `src/features/assets/`
- `src/features/canvas/`
- `src/lib/imageMetadata.ts`

**Estimated scope:** Medium.

### Task 5: Build PureRef-Style Canvas Interactions
**Description:** Implement pan, zoom, select, move, multi-select, fit all, and auto-arrange for Source Canvas.

**Acceptance criteria:**
- [ ] Canvas pans and zooms smoothly.
- [ ] Images can be selected and moved.
- [ ] Multi-select moves selected images together.
- [ ] Fit all and auto-arrange work.

**Verification:**
- [ ] Browser manual test for pan/zoom/move.
- [ ] Unit test auto-arrange geometry.
- [ ] Run `npm run build`.

**Dependencies:** Task 4.

**Files likely touched:**
- `src/features/canvas/SourceCanvas.tsx`
- `src/features/canvas/canvasMath.ts`
- `tests/canvasMath.test.ts`

**Estimated scope:** Medium.

### Task 6: Build Grid Organizer And Canvas-To-Grid Flow
**Description:** Render final 3-column grid and support dragging images from Source Canvas into grid slots plus grid reorder.

**Acceptance criteria:**
- [ ] Dropping canvas image into grid creates a post.
- [ ] Grid supports reorder.
- [ ] Aspect switcher changes cell aspect without losing order.
- [ ] Selecting a grid post highlights the source canvas item.

**Verification:**
- [ ] Manual drag/drop test.
- [ ] Unit test grid insertion and reorder.
- [ ] Run `npm run build`.

**Dependencies:** Tasks 4, 5.

**Files likely touched:**
- `src/features/grid/`
- `src/features/canvas/`
- `src/features/project/projectReducer.ts`

**Estimated scope:** Medium.

### Checkpoint: Workspace Loop
- [ ] User can import images, arrange them on canvas, drag into grid, and reorder posts.
- [ ] App remains comfortable with 50 images and usable with 100 images.
- [ ] Build passes.

## Phase 2.5: Workspace Ergonomics

### Task 6A: Draggable Workspace Divider
**Description:** Make the divider between Source Canvas and Grid Organizer actually resize the two panes and persist the chosen split.

**Acceptance criteria:**
- [x] User can drag the vertical divider to resize left and right workspaces.
- [x] Pane widths have sensible min/max limits so neither workspace can collapse into an unusable state.
- [x] The chosen split is restored after refresh/restart.
- [x] Dragging the divider does not interfere with image drag/drop.

**Verification:**
- [ ] Manual resize check at wide and smaller desktop window sizes.
- [x] Playwright test verifies the divider changes pane widths.
- [x] Run `npm run build`.

**Dependencies:** Task 3.

**Files likely touched:**
- `src/App.tsx`
- `src/styles.css`
- `e2e/shell.spec.ts`

**Estimated scope:** Small.

### Task 6B: Grid Organizer Zoom And Overview Mode
**Description:** Turn the right Grid Organizer into a zoomable grid workspace so users can switch between detailed crop/edit scale and full-feed composition overview.

**Acceptance criteria:**
- [x] Grid Organizer supports zooming the grid with mouse wheel or a compact zoom control.
- [x] Zoom affects the grid preview only, not the crop/export math.
- [x] User can quickly return to `Fit grid` / overview mode.
- [x] User can keep using drag/drop, reorder, selection, and crop while zoomed.
- [x] Empty slots and images remain visually aligned at all zoom levels.
- [x] The current zoom level is persisted per project/session.

**Recommended interaction model:**
- Default mode stays comfortable for editing/crop.
- `Ctrl + wheel` or a dedicated zoom control scales the grid canvas.
- A `Fit` control shows enough rows to judge the overall Instagram feed composition.
- Crop mode still uses double-click; zooming the grid should not accidentally change image crop.

**Verification:**
- [ ] Manual check with at least 12 filled slots.
- [x] Playwright test verifies zoom changes grid cell size without changing post order.
- [x] Playwright test verifies crop/export still works after grid zoom.
- [x] Run `npm run build`.

**Dependencies:** Task 6, Task 7.

**Files likely touched:**
- `src/features/grid/`
- `src/App.tsx`
- `src/styles.css`
- `e2e/shell.spec.ts`

**Estimated scope:** Medium.

## Phase 3: Crop, Quality, And Export

### Task 7: Crop State And Preview
**Description:** Add crop preview and controls for selected grid posts: pan, zoom, rotate, fit, fill, center, reset.

**Acceptance criteria:**
- [ ] Selected grid post can be cropped non-destructively.
- [ ] Crop preview matches grid framing.
- [ ] Crop state persists in project state.

**Verification:**
- [ ] Unit test crop math.
- [ ] Manual crop preview check.
- [ ] Run `npm run build`.

**Dependencies:** Task 6.

**Files likely touched:**
- `src/features/crop/`
- `src/features/grid/`
- `tests/cropMath.test.ts`

**Estimated scope:** Medium.

### Task 8: Export Renderer And Instagram Presets
**Description:** Export selected post from original source pixels using `4:5`, `3:4`, and `1:1` presets as JPEG or PNG.

**Acceptance criteria:**
- [ ] 4:5 export outputs 1080 x 1350.
- [ ] 3:4 export outputs 1080 x 1440.
- [ ] 1:1 export outputs 1080 x 1080.
- [ ] Exported crop matches visible crop.
- [ ] User can choose JPEG or PNG.

**Verification:**
- [ ] Unit test target dimensions and filename generation.
- [ ] Manual export check with real high-resolution image.
- [ ] Run `npm run build`.

**Dependencies:** Task 7.

**Files likely touched:**
- `src/features/export/`
- `src/features/crop/`
- `tests/exportPreset.test.ts`

**Estimated scope:** Medium.

### Task 9: Quality Preflight And Quality Map
**Description:** Implement export warnings and whole-grid Quality Map for low resolution, missing source, mixed carousel ratio, duplicates, and locked posts.

**Acceptance criteria:**
- [x] Export preflight shows target dimensions and source crop dimensions.
- [x] Low source resolution is flagged before export.
- [x] Quality Map lists project-wide issues and selects affected post/slide.

**Verification:**
- [x] Unit test quality checks.
- [ ] Manual check with intentionally small image.
- [x] Run `npm run build`.

**Dependencies:** Task 8.

**Files likely touched:**
- `src/features/quality/`
- `src/features/export/`
- `tests/quality.test.ts`

**Estimated scope:** Medium.

### Checkpoint: Exportable Single Posts
- [ ] User can crop and export a single post in all three aspect ratios.
- [ ] Quality warnings work.
- [ ] Export uses original pixels.

## Phase 4: Carousel And Splitter

### Task 10: Carousel Workspace
**Description:** Allow a grid post to become a carousel and switch the left workspace into carousel-editing mode for that selected post.

**Acceptance criteria:**
- [ ] User can convert a grid post to carousel.
- [ ] Left workspace switches to Carousel mode.
- [ ] User can add, remove, duplicate, and reorder slides.
- [ ] First slide acts as grid cover by default.

**Verification:**
- [ ] Unit test carousel reducer operations.
- [ ] Manual carousel creation flow.
- [ ] Run `npm run build`.

**Dependencies:** Task 6.

**Files likely touched:**
- `src/features/carousel/`
- `src/features/shell/`
- `src/features/project/projectReducer.ts`

**Estimated scope:** Medium.

### Task 11: Carousel Crop And Export
**Description:** Extend crop/export to carousel slides and enforce one aspect ratio across all slides.

**Acceptance criteria:**
- [x] Each slide can have independent crop state.
- [x] All slides export with numbered filenames.
- [ ] Mixed aspect ratio is prevented or flagged.

**Verification:**
- [x] Unit test carousel export filenames and dimensions.
- [ ] Manual export of 10-slide carousel.
- [ ] Run `npm run build`.

**Dependencies:** Tasks 8, 10.

**Files likely touched:**
- `src/features/carousel/`
- `src/features/export/`
- `src/features/quality/`

**Estimated scope:** Medium.

### Task 12: Long Image Splitter
**Description:** Add Splitter mode that turns one long image into a carousel by choosing slide count, previewing slice guides, and generating editable slides.

**Acceptance criteria:**
- [x] App infers horizontal or vertical split from image proportions.
- [x] User can manually switch split direction.
- [x] User can choose slide count.
- [x] Generated slides are editable carousel slides.
- [x] Split quality warnings appear if slices are too small.

**Verification:**
- [x] Unit test split geometry.
- [ ] Manual test with long horizontal and tall vertical image.
- [x] Run `npm run build`.

**Dependencies:** Tasks 10, 11.

**Files likely touched:**
- `src/features/splitter/`
- `src/features/carousel/`
- `tests/splitter.test.ts`

**Estimated scope:** Medium.

### Checkpoint: Carousel Complete
- [ ] User can create, edit, split, crop, and export carousels.
- [ ] Grid context remains visible while editing carousel.
- [ ] Build passes.

## Phase 5: Persistence, Versions, Locks, And Desktop Packaging

### Task 13: Autosave And Recovery
**Description:** Persist project state locally after meaningful changes and offer recovery after app restart.

**Acceptance criteria:**
- [x] Autosave indicator reflects saved/saving/unsaved state.
- [x] Closing and reopening restores recent work from local project JSON and IndexedDB image blobs.
- [x] Recovery status appears when layout is restored but original image blobs are missing.

**Verification:**
- [ ] Manual close/reopen recovery test.
- [x] Unit test serialization roundtrip.
- [x] Run `npm run build`.

**Dependencies:** Tasks 2, 6.

**Files likely touched:**
- `src/features/project/`
- `src/features/shell/`
- `tests/projectSerialization.test.ts`

**Estimated scope:** Medium.

### Task 14: Grid Versions And Locked Slots
**Description:** Add duplicate/switch grid versions and lock published/fixed grid posts.

**Acceptance criteria:**
- [x] User can duplicate current grid version.
- [x] User can switch versions.
- [x] Locked posts are visually marked.
- [x] Reorder does not accidentally move locked posts.

**Verification:**
- [x] Unit test version switching and locked reorder.
- [ ] Manual UI test.
- [x] Run `npm run build`.

**Dependencies:** Tasks 6, 13.

**Files likely touched:**
- `src/features/grid/`
- `src/features/project/`
- `tests/gridVersions.test.ts`

**Estimated scope:** Medium.

### Task 15: Project Package Save/Load
**Description:** Add portable `.instasetka` project package export/import with metadata, source assets, thumbnails, crop settings, carousel settings, and versions.

**Acceptance criteria:**
- [x] User can save a project package.
- [x] User can reopen a project package.
- [x] Imported project restores canvas, grid, crops, carousel, versions, and assets.

**Verification:**
- [ ] Manual save/load with several images and one carousel.
- [x] Unit test package manifest validation.
- [x] Run `npm run build`.

**Dependencies:** Task 13.

**Files likely touched:**
- `src/features/project/`
- `src/features/assets/`
- `src-tauri/`

**Estimated scope:** Medium.

### Task 16: Desktop Build And Smoke QA
**Description:** Produce the Windows `.exe`, run desktop smoke checks, and verify primary flows in the packaged app.

**Acceptance criteria:**
- [x] `npm run tauri build` produces a Windows installer or executable artifact.
- [ ] Packaged app can import images, save/recover project, export posts, and export carousel.
- [x] Packaged executable starts without immediately exiting.

**Verification:**
- [x] Run `npm run tauri build`.
- [ ] Manual smoke test packaged app.

**Dependencies:** Tasks 1-15.

**Files likely touched:**
- `src-tauri/tauri.conf.json`
- `package.json`
- release notes or docs

**Estimated scope:** Medium.

### Checkpoint: MVP Release Candidate
- [ ] App builds as Windows `.exe`.
- [ ] Core single-post and carousel flows work.
- [ ] Project save/load and recovery work.
- [ ] Quality checks and Instagram exports work.

## Risks And Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Canvas performance degrades with many images | High | Use thumbnails, lazy decoding, stable layout, optimize for 50 images, and test with 100 images early. |
| Crop preview and export do not match | High | Centralize crop math and test it independently before UI polish. |
| Browser canvas export quality is insufficient | Medium | Keep export implementation isolated so Rust-side helpers can replace it later. |
| Tauri file permissions slow development | Medium | Build a narrow file API early and test Windows paths with real images. |
| Drag/drop between free canvas and grid becomes brittle | High | Keep drag intent explicit in reducer actions and cover insertion/reorder with tests. |
| `.instasetka` packaging becomes too large | Medium | Generate thumbnails, store originals once, and warn on huge project packages. |
| Scope expands into captions/calendar/posting | Medium | Keep social publishing features out of MVP per spec boundaries. |

## Parallelization Opportunities
- UI shell and reducer tests can start after scaffold.
- Export math and quality checks can be built in parallel once crop types are stable.
- Carousel reducer work can start while single-post export UI is being polished.
- Desktop packaging should stay mostly sequential because it depends on storage and file APIs.

## Open Questions Before Coding
None.
