# Design Spec: InstaSetka UI

## Design Read
Desktop creator tool for a solo visual workflow, with a calm minimalist product language, leaning toward native CSS tokens, React components, precise spacing, and restrained motion.

This is not a landing page. The interface should feel like a focused visual production tool: quiet, sharp, fast, and supportive of long editing sessions.

## Design Dials
- Design variance: 4.
- Motion intensity: 2.
- Visual density: 6.

Rationale:
- The user's images are the primary visual material.
- The UI should not compete with the grid.
- The editor needs enough density for real work, but it should not feel like a spreadsheet.
- Motion should clarify state changes, not perform.

## Core Principles
- Images first. Controls should recede until needed.
- No decorative gradients, blobs, glass panels, or marketing-style hero areas.
- The app opens directly into the editor.
- The grid is the main canvas, not a preview inside a card.
- Every control must answer a real production need: import, arrange, crop, split, inspect quality, export.
- Use typography, spacing, borders, and subtle contrast rather than heavy shadows.
- Keep all dimensions stable so images do not jump while loading, selecting, dragging, or changing aspect ratio.
- Prefer icons for tools, with clear tooltips.

## Visual Language

### Theme
Primary themes: light neutral workspace and dark neutral workspace.

The photos supply color, so the shell should stay restrained in both themes:
- App background: near-white neutral.
- Work surface: slightly warmer white.
- Borders: soft neutral gray.
- Text: high-contrast charcoal.
- Muted text: neutral gray.
- Accent: monochrome black/charcoal used for active state, selected item, progress, and export success.
- Dark theme accent: near-white used sparingly for active state, selected item, progress, and export success.

Avoid:
- Purple/blue AI gradients.
- Beige luxury palettes.
- Dark slate dashboards.
- Floating decorative cards.
- Heavy drop shadows.

### Suggested Tokens
```css
:root {
  --color-bg: #f6f6f3;
  --color-surface: #ffffff;
  --color-surface-alt: #eeeeea;
  --color-border: #d9d9d2;
  --color-border-strong: #b8b8ad;
  --color-text: #1f211d;
  --color-muted: #727268;
  --color-accent: #1f211d;
  --color-accent-soft: #e4e4de;
  --color-warning: #9a5b12;
  --color-danger: #a33a2f;
  --radius-control: 8px;
  --radius-panel: 8px;
  --shadow-popover: 0 16px 44px rgb(31 33 29 / 0.14);
}

[data-theme="dark"] {
  --color-bg: #11120f;
  --color-surface: #181916;
  --color-surface-alt: #22231f;
  --color-border: #33352f;
  --color-border-strong: #4c4f47;
  --color-text: #f1f1ea;
  --color-muted: #a4a59a;
  --color-accent: #f1f1ea;
  --color-accent-soft: #2c2e29;
  --color-warning: #d4a253;
  --color-danger: #d66d61;
  --shadow-popover: 0 16px 44px rgb(0 0 0 / 0.38);
}
```

### Typography
- Use a neutral, readable sans typeface.
- Recommended: Geist or system UI.
- Use a mono font only for dimensions, filenames, and technical export info.
- No oversized display typography inside the app.
- Compact labels should be 12 to 13 px.
- Body/control text should be 14 px.
- Section labels should be calm and functional, not editorial.

## Workspace Model
The app has two connected workspaces:

1. Source Canvas on the left.
2. Instagram Grid Organizer on the right.

This should feel like a visual sorting table connected to a publishing layout. The left side is for discovery, comparison, grouping, rough composition, and carousel building. The right side is the intentional final grid.

Design goal: the user should never have to open a file manager or separate moodboard tool while arranging the feed.

## Two-Pane Layout

### Default Desktop Frame
```text
+--------------------------------------------------------------------------------+
| App bar: project name, undo/redo, mode, aspect switcher, import, export        |
+------------------------------------------------+-------------------------------+
| Source Canvas                                  | Grid Organizer                |
| PureRef-style free canvas                      | 3-column Instagram grid       |
| image piles, groups, zoom, pan                 | final order, crops, exports   |
| carousel editor when a carousel post selected  | selected post state           |
+------------------------------------------------+-------------------------------+
| Status bar: item count, selected format, source health, save state             |
+--------------------------------------------------------------------------------+
```

### Regions
- App bar: persistent project and global actions.
- Theme switcher lives in the app bar as an icon button or compact toggle.
- Source Canvas: freeform infinite workspace for all candidate images and carousel editing.
- Grid Organizer: the final 3-column Instagram grid with true aspect-ratio cells.
- Context Inspector: appears as a compact side panel or drawer only when needed for crop, export, and metadata.
- Status bar: small, stable operational feedback.

### Sizing
- App bar height: 56 px.
- Source Canvas default width: 58 percent.
- Grid Organizer default width: 42 percent.
- The divider between workspaces is draggable so the user can resize Source Canvas versus Grid Organizer.
- Source Canvas can be temporarily maximized for sorting.
- Grid Organizer can be temporarily maximized for final review and export.
- Context Inspector width: 320 to 360 px when open.
- Grid width should adapt to aspect ratio while keeping the 3-column structure legible.
- Grid gap: 8 px for realistic Instagram planning.
- Toolbar controls: 32 to 36 px tall.

## Source Canvas
The Source Canvas behaves like a focused PureRef-style image table.

Core behavior:
- Drag images from Windows directly onto the canvas.
- Drop many images at once.
- Pan with middle mouse or spacebar-drag.
- Zoom with wheel or trackpad.
- Select, multi-select, move, scale, and arrange images freely.
- Auto-arrange selected images into a tidy board.
- Stack or group related images.
- Lock images or groups to prevent accidental movement.
- Add lightweight labels or color tags only if needed for sorting.
- Send selected image or group to the Grid Organizer.
- Drag images from the Source Canvas onto any grid slot.

Canvas rules:
- Candidate images can be any size on the canvas without changing their export crop.
- Canvas scale is for thinking and comparison only.
- Original images remain linked to their source asset records.
- Images already used in the grid stay visible on the canvas with a subtle used marker.
- The used marker must not obscure the image.
- Missing source files show a recoverable placeholder.

Canvas controls:
- Fit all.
- Actual size.
- Zoom in/out.
- Auto-arrange.
- Group.
- Ungroup.
- Send to grid.
- Create carousel from selection.
- Split long image to carousel.

Visual treatment:
- The canvas background should be a calm neutral plane with a very subtle grid or dot pattern.
- Image items cast only a tiny separation shadow or border.
- Selection uses an accent outline and corner handles.
- Multi-selection shows a single bounding box.
- Avoid decorative frames around images.

## Workspace Link Rules
- Drag from Source Canvas to an empty grid slot creates a grid post.
- Drag from Source Canvas to an occupied grid slot offers replace, insert before, insert after, or create carousel.
- Drag from Grid Organizer back to Source Canvas removes the post from the grid only after confirmation or undo-safe action.
- Drag between grid slots reorders posts.
- Double-clicking a grid post focuses its source image on the Source Canvas.
- Selecting a grid post highlights its source image or source group on the Source Canvas.
- Selecting a canvas image highlights every grid post or carousel slide that uses it.
- A source image may be reused in multiple grid posts or carousel slides with separate crop metadata.
- Deleting a source image should warn if it is used in the grid or a carousel.

## Grid Versions
The app should support multiple layout versions inside one project.

UI pattern:
- Version switcher in the app bar or Grid Organizer header.
- Duplicate current version action.
- Rename version action.
- Compare version action later.

Rules:
- Versions save grid order and post placement.
- Source Canvas remains shared across versions.
- Crops and carousel contents can remain tied to posts unless a future versioning model requires branching them.
- Switching versions should be instant and clearly labeled.

## Main Grid
- Always render a true 3-column grid.
- Cell aspect follows selected mode:
  - 4:5 default.
  - 3:4 tall.
  - 1:1 square.
- Images preserve their original proportions in every grid mode; format changes crop the visible frame, never stretch the bitmap.
- Empty slots are quiet drop targets with a fine dashed border.
- Selected post gets a 2 px accent outline outside the image, not over the photo.
- Dragging should show the destination slot and keep all other cells stable.
- Quality warnings appear as small corner badges with tooltips, not large overlays.
- Carousel posts show a small slide-count badge.
- Posted/ready status can use a tiny lower-left marker, but no loud labels over the image.

## Grid Organizer
The Grid Organizer is the right workspace and represents the publishable feed plan.

Core behavior:
- Drag posts to reorder.
- Drop source images into exact slots.
- Insert between posts without destroying the existing order.
- Replace an image while preserving the slot's crop settings only when the user confirms.
- Toggle post kind between single image and carousel.
- Open crop controls for the selected post.
- Show export readiness per post.
- Review the grid in 4:5, 3:4, and 1:1.
- Lock published or fixed slots.
- Open quality map for the whole grid.
- Toggle safe-zone guides.

Grid density:
- The grid should show enough rows to understand rhythm.
- The selected row should stay visible while editing.
- Empty future slots may be visible at the bottom as quiet drop targets.
- Locked slots should feel protected, not disabled. Use a small lock icon and subtle fixed outline.

Best-practice detail:
- The right workspace is the source of truth for final ordering.
- The left workspace is the source of truth for candidate assets and carousel composition.
- Reordering should be undoable and should never delete source assets.
- Locked posts should not move during bulk reorder unless explicitly unlocked.

## Quality Map
Quality Map is a review mode for the Grid Organizer.

Purpose:
- Find every image-quality or export-readiness issue before export.
- Avoid discovering problems one file at a time.

UI:
- Toggle in the Grid Organizer header.
- Grid cells receive small status markers.
- A compact list groups issues by severity.
- Clicking an issue selects the exact post or slide.

States:
- Good.
- Caution.
- Low source resolution.
- Missing source.
- Mixed carousel ratio.
- Duplicate asset.
- Locked/published.

Rules:
- The quality layer must not hide the image composition.
- Warnings use restrained color and iconography.
- Export actions should link back to Quality Map if unresolved severe issues exist.

## Safe-Zone Guides
Safe-zone guides are optional overlays for composition.

Modes:
- Feed frame.
- Profile grid preview.
- Carousel cover preview.

Rules:
- Guides are thin and low-contrast.
- Guides can be toggled globally or per selected item.
- Guides never export.
- Guides should be especially clear in 3:4 mode because it is newer and may have more context-specific display behavior.

## Crop Editor
The crop editor should feel precise and tactile.

Core controls:
- Pan by dragging the image.
- Zoom slider with numeric percent.
- Rotate stepper, with reset.
- Fit, Fill, Center, Reset buttons.
- Aspect selector inherited from project mode, with per-post override only if needed later.
- Before export, show crop source pixels versus target pixels.

Layout:
- Large crop preview at top of inspector.
- Controls grouped below in compact rows.
- Tool buttons use icons with tooltips.
- Advanced controls can be disclosed rather than always visible.

## Carousel Editor
Carousel editing lives in the left workspace when a carousel post is selected in the Grid Organizer.

When the user selects a grid block and changes its kind to carousel, the Source Canvas switches into Carousel Workspace mode for that post. This makes the left side a dedicated carousel editor while the right side keeps the post's position in the grid visible.

Expected controls:
- Horizontal slide strip with stable thumbnails.
- Add images.
- Reorder slides.
- Duplicate slide.
- Remove slide.
- Apply crop to all slides.
- Export carousel.

Rules:
- All slides in one carousel share the same aspect ratio.
- Each slide can have its own crop.
- Slide numbering must match export filenames.
- The first slide is the grid cover by default.
- The user can choose another slide as the grid cover later if needed.
- The carousel workspace must always show which grid post it belongs to.

Carousel Workspace layout:
```text
+------------------------------------------------+-------------------------------+
| Carousel Workspace                             | Grid Organizer                |
| selected post: Grid item 07                    | selected carousel block       |
| slide strip                                    | surrounding feed context      |
| large selected slide crop/preview              |                               |
| source tray for adding more images             |                               |
+------------------------------------------------+-------------------------------+
```

Workspace modes for the left side:
- `Canvas`: freeform PureRef-style candidate board.
- `Carousel`: slide builder for the selected grid post.
- `Splitter`: long-image slicing workflow, then returns to Carousel.

Mode transition rules:
- Selecting a normal grid post keeps the left side in Canvas mode but highlights the source image.
- Converting a grid post to carousel switches the left side to Carousel mode.
- Selecting an existing carousel post switches the left side to Carousel mode.
- Pressing Back to Canvas returns to the freeform board without losing carousel edits.
- Starting Split Long Image opens Splitter mode inside the left workspace.

## Long Image Splitter
This should be a focused mode, not a modal that hides too much context.

Flow:
1. Select a long image.
2. Choose "Split to carousel".
3. App infers horizontal or vertical split from image proportions.
4. User can override direction with a horizontal/vertical switcher.
5. User chooses slide count.
6. App shows slice guides over the original.
7. User can adjust boundaries or accept auto-split.
8. App creates a carousel post with editable slides.

Visual behavior:
- Slice guides are thin accent lines.
- Split direction uses an automatic default with a manual segmented control.
- Slide count is a segmented or stepper control.
- Preview strip updates immediately.
- Warnings appear if any slice cannot meet target export size.

## Context Inspector
Avoid a permanently heavy third panel. Use a compact contextual inspector when precision controls are needed.

Inspector entry points:
- Crop settings.
- Export preflight.
- Post metadata: priority and status.
- File details and quality warnings.

Possible placements:
- A slim drawer attached to the right edge of the Grid Organizer.
- A floating popover for small controls.
- A bottom sheet only for narrow layouts.

Rule:
- The two workspaces should remain visible whenever possible. Precision controls should not hide the relationship between candidate images and final grid placement.

## Export Preflight
The export panel should be calm, clear, and impossible to misunderstand.

Show:
- Preset name.
- Aspect ratio.
- Target dimensions.
- Source crop dimensions.
- File type.
- JPEG quality.
- Warning state.
- Destination folder.
- Filename pattern.
- Remaining quality-map issues.

Quality state labels:
- Good: source crop meets or exceeds target size.
- Caution: source crop is close to target size.
- Low: source crop is below target size and will require upscaling.

Primary action:
- Export selected.
- Export carousel.
- Export grid.

Secondary actions:
- Choose folder.
- Copy filename pattern.
- Save preset.

## Interaction Patterns
- Undo and redo are first-class app-bar icon buttons.
- Drag and drop must be smooth, but animation should be short and quiet.
- Selection changes should be instant.
- Crop changes should update preview in real time.
- Export progress should use a thin progress bar, not a spinner.
- Toasts only for completed exports, errors, and recoverable warnings.
- Destructive actions require confirmation if they remove user work.
- Autosave status should be visible but quiet.
- Theme changes should be instant and should not shift layout.
- Recovery state should appear as a clear startup prompt if unsaved work exists.
- Duplicating a grid version should be a one-click safety action before large reorder experiments.

## Component Rules
- Buttons: 8 px radius, 32 to 36 px height.
- Icon buttons: square, stable size, tooltip on hover.
- Segmented controls: used for aspect ratio and grid modes.
- Sliders: used for zoom and quality.
- Steppers: used for rotation and slide count.
- Toggles: used for view options.
- Menus: used for export presets and batch actions.
- Cards only for repeated assets in the image library or carousel slides.
- No nested cards.

## Icons
Use the project's chosen icon family consistently. Per project instruction, prefer lucide icons when building unless the stack later chooses a different established icon library.

Likely icons:
- Import: upload.
- Export: download.
- Undo/redo: curved arrows.
- Crop: crop.
- Fit/fill: maximize/minimize style icons.
- Split: columns or slices.
- Carousel: panels.
- Warning: triangle alert.
- Quality good: check.
- Delete: trash.
- Duplicate: copy.

## Empty States
The initial state should still be the real editor.

Main empty canvas:
- Large drop zone in the grid area.
- Short text: "Drop images to build your grid."
- Button: "Import images."
- Secondary action: "Open project."

Do not add marketing copy or feature tours.

Recovery state:
- If recoverable work exists, show "Restore last session" and "Open another project".
- The restore action should keep the user in the editor, not a separate onboarding flow.

## Loading And Error States
- Image decoding uses skeleton blocks matching the final aspect-ratio cells.
- Missing file state shows a muted placeholder and recovery action.
- Failed export shows exact failed item and a retry action.
- Low-memory or huge-image warnings should be visible before a long export starts.

## Accessibility
- Full keyboard access for toolbar, grid selection, and inspector controls.
- Visible focus rings using the accent color.
- Drag and drop has keyboard alternatives: move earlier, move later, move to position.
- All icon-only buttons require accessible labels and tooltips.
- Maintain WCAG AA contrast for text and controls.
- Support reduced motion.
- Light and dark themes must both meet WCAG AA contrast for controls and text.

## Responsive Behavior
The primary target is desktop Windows, but the layout should not collapse badly at smaller widths.

- Below 1100 px: Source Canvas can collapse into a mode tab or temporarily hide to prioritize Grid Organizer.
- Below 900 px: inspector becomes a bottom drawer.
- Below 700 px: grid remains usable as a single focused work area with mode tabs.

## Design QA Checklist
- The first viewport is the working editor.
- Photos visually dominate the app.
- No decorative gradients, blobs, or fake hero sections.
- No text overlaps images except tiny semantic badges.
- Aspect-ratio cells never resize because of labels, badges, or hover states.
- Aspect-ratio switching crops previews without squashing or stretching images.
- Buttons do not wrap.
- Every icon-only control has a tooltip.
- Export warnings are visible before export.
- Quality Map shows project-wide readiness.
- Locked posts are visually clear and protected from accidental movement.
- Safe-zone guides are visible, toggleable, and absent from exports.
- Grid version switcher is discoverable.
- Light/dark theme switcher is visible in the app bar.
- Dark theme is checked visually because it is a preferred editing mode.
- Autosave/recovery states are represented.
- Empty, loading, error, and success states exist.
- Desktop screenshot is checked at 1440 x 900.
- Narrow screenshot is checked at 390 x 844 even though the app is desktop-first.

## Open Design Questions
1. Should the app feel slightly warmer and editorial, or colder and more technical?
