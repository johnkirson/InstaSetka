import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);
const wideImage = createPng(600, 180);

test("renders the two-workspace editor shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Untitled grid" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Source Canvas" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Grid Organizer" })).toBeVisible();
  await expect(page.getByRole("button", { name: "4:5" })).toHaveClass(/is-active/);
  await expect(page.getByText("4:5 - 1080 x 1350 - JPEG")).toBeVisible();
});

test("switches between dark and light themes", async ({ page }) => {
  await page.goto("/");

  const shell = page.locator(".app-shell");
  await expect(shell).toHaveAttribute("data-theme", "dark");

  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect(shell).toHaveAttribute("data-theme", "light");

  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(shell).toHaveAttribute("data-theme", "dark");
});

test("resizes the source canvas and grid organizer with the divider", async ({ page }) => {
  await page.addInitScript(() => {
    if (!window.localStorage.getItem("instasetka.dividerTestStarted")) {
      window.localStorage.setItem("instasetka.workspaceSplit", "58");
      window.localStorage.setItem("instasetka.dividerTestStarted", "true");
    }
  });
  await page.goto("/");

  const sourceCanvas = page.getByRole("region", { name: "Source Canvas" });
  const gridOrganizer = page.getByRole("region", { name: "Grid Organizer" });
  const divider = page.getByRole("separator", { name: "Resize workspaces" });
  const sourceBefore = await sourceCanvas.boundingBox();
  const gridBefore = await gridOrganizer.boundingBox();
  const dividerBox = await divider.boundingBox();
  if (!sourceBefore || !gridBefore || !dividerBox) {
    throw new Error("Workspace bounding boxes were not available");
  }

  await page.mouse.move(dividerBox.x + dividerBox.width / 2, dividerBox.y + dividerBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(dividerBox.x - 220, dividerBox.y + dividerBox.height / 2, { steps: 8 });
  await page.mouse.up();

  const sourceAfter = await sourceCanvas.boundingBox();
  const gridAfter = await gridOrganizer.boundingBox();
  if (!sourceAfter || !gridAfter) {
    throw new Error("Workspace bounding boxes were not available after resize");
  }

  expect(sourceAfter.width).toBeLessThan(sourceBefore.width - 120);
  expect(gridAfter.width).toBeGreaterThan(gridBefore.width + 120);
  const savedSplit = await page.evaluate(() => Number(window.localStorage.getItem("instasetka.workspaceSplit")));
  expect(savedSplit).toBeLessThan(58);

  await page.reload();
  const sourceReloaded = await sourceCanvas.boundingBox();
  if (!sourceReloaded) {
    throw new Error("Source canvas bounding box was not available after reload");
  }
  expect(Math.abs(sourceReloaded.width - sourceAfter.width)).toBeLessThan(4);
});

test("keeps the app and pane headers fixed while the grid scrolls", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("instasetka.gridZoom", "1");
  });
  await page.goto("/");
  await page.locator(".grid-preview").evaluate((element) => {
    (element as HTMLElement).style.height = "2000px";
  });

  const appBar = page.locator(".app-bar");
  const gridHeader = page.getByRole("region", { name: "Grid Organizer" }).locator(".pane-header");
  const beforeAppBar = await appBar.boundingBox();
  const beforeGridHeader = await gridHeader.boundingBox();
  if (!beforeAppBar || !beforeGridHeader) {
    throw new Error("Header bounding boxes were not available");
  }

  await page.locator(".grid-viewport").evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  const scrollTop = await page.locator(".grid-viewport").evaluate((element) => element.scrollTop);
  expect(scrollTop).toBeGreaterThan(0);

  const afterAppBar = await appBar.boundingBox();
  const afterGridHeader = await gridHeader.boundingBox();
  if (!afterAppBar || !afterGridHeader) {
    throw new Error("Header bounding boxes were not available after scroll");
  }

  expect(Math.abs(afterAppBar.y - beforeAppBar.y)).toBeLessThan(1);
  expect(Math.abs(afterGridHeader.y - beforeGridHeader.y)).toBeLessThan(1);
});

test("imports a PNG into the source canvas", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles({
    name: "fixture-grid.png",
    mimeType: "image/png",
    buffer: tinyPng,
  });

  await expect(page.getByText("1 image on canvas")).toBeVisible();
  await expect(page.getByText("fixture-grid.png")).toBeVisible();
  await expect(page.locator(".canvas-item img")).toHaveCount(1);
});

test("moves an imported image on the source canvas", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles({
    name: "draggable-grid.png",
    mimeType: "image/png",
    buffer: tinyPng,
  });

  const item = page.locator(".canvas-item").filter({ hasText: "draggable-grid.png" });
  await expect(item).toBeVisible();

  const before = await item.boundingBox();
  if (!before) {
    throw new Error("Canvas item bounding box was not available");
  }

  await item.dragTo(page.locator(".canvas-board"), {
    sourcePosition: { x: before.width / 2, y: before.height / 2 },
    targetPosition: { x: before.x + 120, y: before.y + 90 },
  });

  const after = await item.boundingBox();
  if (!after) {
    throw new Error("Canvas item bounding box was not available after drag");
  }

  expect(after.x).toBeGreaterThan(before.x + 40);
  expect(after.y).toBeGreaterThan(before.y + 25);
});

test("deletes a selected source canvas image", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles({
    name: "delete-canvas.png",
    mimeType: "image/png",
    buffer: tinyPng,
  });

  const item = page.locator(".canvas-item").filter({ hasText: "delete-canvas.png" });
  await expect(item).toBeVisible();
  await item.click();
  await page.keyboard.press("Delete");

  await expect(item).toHaveCount(0);
  await expect(page.getByText("0 assets - 50 comfortable target - 100 usable target")).toBeVisible();
});

test("fit all recovers an image moved far across the canvas", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles({
    name: "recoverable-grid.png",
    mimeType: "image/png",
    buffer: tinyPng,
  });

  const item = page.locator(".canvas-item").filter({ hasText: "recoverable-grid.png" });
  await expect(item).toBeVisible();

  const before = await item.boundingBox();
  if (!before) {
    throw new Error("Canvas item bounding box was not available");
  }

  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(before.x + before.width / 2 + 900, before.y + before.height / 2 + 500);
  await page.mouse.up();

  await page.getByRole("button", { name: "Fit all" }).click();

  const board = await page.locator(".canvas-board").boundingBox();
  const after = await item.boundingBox();
  if (!board || !after) {
    throw new Error("Canvas board or item bounding box was not available");
  }

  expect(after.x).toBeGreaterThanOrEqual(board.x);
  expect(after.y).toBeGreaterThanOrEqual(board.y);
  expect(after.x + after.width).toBeLessThanOrEqual(board.x + board.width);
  expect(after.y + after.height).toBeLessThanOrEqual(board.y + board.height);
});

test("auto arrange lays imported images into a tidy row", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles([
    {
      name: "arrange-a.png",
      mimeType: "image/png",
      buffer: tinyPng,
    },
    {
      name: "arrange-b.png",
      mimeType: "image/png",
      buffer: tinyPng,
    },
  ]);

  const first = page.locator(".canvas-item").filter({ hasText: "arrange-a.png" });
  const second = page.locator(".canvas-item").filter({ hasText: "arrange-b.png" });
  await expect(first).toBeVisible();
  await expect(second).toBeVisible();

  await page.getByRole("button", { name: "Auto arrange" }).click();

  const firstBox = await first.boundingBox();
  const secondBox = await second.boundingBox();
  if (!firstBox || !secondBox) {
    throw new Error("Canvas item bounding boxes were not available");
  }

  expect(secondBox.x).toBeGreaterThan(firstBox.x + firstBox.width);
  expect(Math.abs(secondBox.y - firstBox.y)).toBeLessThan(8);
});

test("drags a source image into the grid organizer", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles({
    name: "grid-drop.png",
    mimeType: "image/png",
    buffer: tinyPng,
  });

  const item = page.locator(".canvas-item").filter({ hasText: "grid-drop.png" });
  const firstGridSlot = page.locator("[data-grid-slot-index='0']");
  await expect(item).toBeVisible();
  await expect(firstGridSlot).toBeVisible();

  const itemBox = await item.boundingBox();
  const slotBox = await firstGridSlot.boundingBox();
  if (!itemBox || !slotBox) {
    throw new Error("Required bounding boxes were not available");
  }

  await page.mouse.move(itemBox.x + itemBox.width / 2, itemBox.y + itemBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(slotBox.x + slotBox.width / 2, slotBox.y + slotBox.height / 2);
  await page.mouse.up();

  await expect(firstGridSlot.locator("img")).toHaveCount(1);
  await expect(item).toBeVisible();
  await expect(page.locator(".grid-cell img")).toHaveCount(1);
});

test("drops a source image into the exact grid slot", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles({
    name: "exact-slot.png",
    mimeType: "image/png",
    buffer: tinyPng,
  });

  const item = page.locator(".canvas-item").filter({ hasText: "exact-slot.png" });
  const targetSlot = page.locator("[data-grid-slot-index='5']");
  const firstSlot = page.locator("[data-grid-slot-index='0']");
  await expect(item).toBeVisible();

  const itemBox = await item.boundingBox();
  const slotBox = await targetSlot.boundingBox();
  if (!itemBox || !slotBox) {
    throw new Error("Required bounding boxes were not available");
  }

  await page.mouse.move(itemBox.x + itemBox.width / 2, itemBox.y + itemBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(slotBox.x + slotBox.width / 2, slotBox.y + slotBox.height / 2);
  await page.mouse.up();

  await expect(targetSlot.locator("img")).toHaveCount(1);
  await expect(firstSlot.locator("img")).toHaveCount(0);
});

test("reorders grid posts by dragging one slot onto another", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("instasetka.gridZoom", "1");
  });
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles([
    {
      name: "grid-a.png",
      mimeType: "image/png",
      buffer: tinyPng,
    },
    {
      name: "grid-b.png",
      mimeType: "image/png",
      buffer: tinyPng,
    },
  ]);

  for (const [itemName, slotIndex] of [
    ["grid-a.png", 0],
    ["grid-b.png", 1],
  ] as const) {
    const item = page.locator(".canvas-item").filter({ hasText: itemName });
    const slot = page.locator(`[data-grid-slot-index='${slotIndex}']`);
    const itemBox = await item.boundingBox();
    const slotBox = await slot.boundingBox();
    if (!itemBox || !slotBox) {
      throw new Error(`Bounding boxes unavailable for ${itemName}`);
    }

    await page.mouse.move(itemBox.x + itemBox.width / 2, itemBox.y + itemBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(slotBox.x + slotBox.width / 2, slotBox.y + slotBox.height / 2);
    await page.mouse.up();
  }

  const firstSlot = page.locator("[data-grid-slot-index='0']");
  const secondSlot = page.locator("[data-grid-slot-index='1']");
  await expect(firstSlot.locator("img")).toHaveAttribute("alt", "grid-a.png");
  await expect(secondSlot.locator("img")).toHaveAttribute("alt", "grid-b.png");

  const firstBox = await firstSlot.boundingBox();
  const secondBox = await secondSlot.boundingBox();
  if (!firstBox || !secondBox) {
    throw new Error("Grid slot bounding boxes unavailable");
  }

  await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(secondBox.x + secondBox.width / 2, secondBox.y + secondBox.height / 2);
  await page.mouse.up();

  await expect(firstSlot.locator("img")).toHaveAttribute("alt", "grid-b.png");
  await expect(secondSlot.locator("img")).toHaveAttribute("alt", "grid-a.png");
});

test("deletes a selected grid post without removing the source canvas image", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles({
    name: "delete-grid.png",
    mimeType: "image/png",
    buffer: tinyPng,
  });

  const item = page.locator(".canvas-item").filter({ hasText: "delete-grid.png" });
  const targetSlot = page.locator("[data-grid-slot-index='0']");
  const itemBox = await item.boundingBox();
  const slotBox = await targetSlot.boundingBox();
  if (!itemBox || !slotBox) {
    throw new Error("Required bounding boxes were not available");
  }

  await page.mouse.move(itemBox.x + itemBox.width / 2, itemBox.y + itemBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(slotBox.x + slotBox.width / 2, slotBox.y + slotBox.height / 2);
  await page.mouse.up();

  await expect(targetSlot.locator("img")).toHaveAttribute("alt", "delete-grid.png");
  await page.keyboard.press("Delete");

  await expect(targetSlot.locator("img")).toHaveCount(0);
  await expect(targetSlot.getByText("Drop")).toBeVisible();
  await expect(item).toBeVisible();
});

test("switches grid aspect ratio without losing post placement", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles({
    name: "aspect-stable.png",
    mimeType: "image/png",
    buffer: tinyPng,
  });

  const item = page.locator(".canvas-item").filter({ hasText: "aspect-stable.png" });
  const targetSlot = page.locator("[data-grid-slot-index='4']");
  const itemBox = await item.boundingBox();
  const slotBox = await targetSlot.boundingBox();
  if (!itemBox || !slotBox) {
    throw new Error("Required bounding boxes were not available");
  }

  await page.mouse.move(itemBox.x + itemBox.width / 2, itemBox.y + itemBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(slotBox.x + slotBox.width / 2, slotBox.y + slotBox.height / 2);
  await page.mouse.up();

  await expect(targetSlot.locator("img")).toHaveAttribute("alt", "aspect-stable.png");
  const before = await targetSlot.boundingBox();
  if (!before) {
    throw new Error("Target slot bounding box unavailable before aspect switch");
  }

  await page.getByRole("button", { name: "1:1" }).click();
  await expect(page.locator(".grid-preview")).toHaveAttribute("data-active-aspect", "1:1");
  await expect(targetSlot.locator("img")).toHaveAttribute("alt", "aspect-stable.png");
  await expect(page.getByText("1:1 - 1080 x 1080 - JPEG")).toBeVisible();

  const after = await targetSlot.boundingBox();
  if (!after) {
    throw new Error("Target slot bounding box unavailable after aspect switch");
  }

  expect(Math.abs(after.width - after.height)).toBeLessThan(2);
  expect(Math.abs(before.height - after.height)).toBeGreaterThan(20);

  await page.getByRole("button", { name: "3:4" }).click();
  await expect(page.locator(".grid-preview")).toHaveAttribute("data-active-aspect", "3:4");
  await expect(targetSlot.locator("img")).toHaveAttribute("alt", "aspect-stable.png");
  await expect(page.getByText("3:4 - 1080 x 1440 - JPEG")).toBeVisible();
});

test("zooms the grid organizer without losing post placement", async ({ page }) => {
  await page.addInitScript(() => {
    if (!window.localStorage.getItem("instasetka.gridZoomTestStarted")) {
      window.localStorage.setItem("instasetka.gridZoom", "1");
      window.localStorage.setItem("instasetka.gridZoomTestStarted", "true");
    }
  });
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles({
    name: "zoom-grid.png",
    mimeType: "image/png",
    buffer: wideImage,
  });

  const item = page.locator(".canvas-item").filter({ hasText: "zoom-grid.png" });
  const targetSlot = page.locator("[data-grid-slot-index='0']");
  const itemBox = await item.boundingBox();
  const slotBox = await targetSlot.boundingBox();
  if (!itemBox || !slotBox) {
    throw new Error("Required bounding boxes were not available");
  }

  await page.mouse.move(itemBox.x + itemBox.width / 2, itemBox.y + itemBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(slotBox.x + slotBox.width / 2, slotBox.y + slotBox.height / 2);
  await page.mouse.up();

  await expect(targetSlot.locator("img")).toHaveAttribute("alt", "zoom-grid.png");
  const before = await targetSlot.boundingBox();
  if (!before) {
    throw new Error("Grid slot bounding box unavailable before zoom");
  }

  await page.getByRole("button", { name: "-" }).click();
  await page.getByRole("button", { name: "-" }).click();
  await expect(page.locator(".grid-preview")).toHaveAttribute("data-grid-zoom", "0.80");
  const after = await targetSlot.boundingBox();
  if (!after) {
    throw new Error("Grid slot bounding box unavailable after zoom");
  }

  expect(after.width).toBeLessThan(before.width - 20);
  await expect(targetSlot.locator("img")).toHaveAttribute("alt", "zoom-grid.png");

  await page.getByRole("button", { name: "PNG" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export" }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  if (!downloadPath) {
    throw new Error("Downloaded file path was unavailable");
  }
  expect(readPngDimensions(await readFile(downloadPath))).toEqual({ width: 1080, height: 1350 });

  await page.reload();
  await expect(page.locator(".grid-preview")).toHaveAttribute("data-grid-zoom", "0.80");
});

test("shows quality preflight for the selected grid post", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles({
    name: "tiny-quality.png",
    mimeType: "image/png",
    buffer: tinyPng,
  });

  const item = page.locator(".canvas-item").filter({ hasText: "tiny-quality.png" });
  const targetSlot = page.locator("[data-grid-slot-index='0']");
  const itemBox = await item.boundingBox();
  const slotBox = await targetSlot.boundingBox();
  if (!itemBox || !slotBox) {
    throw new Error("Required bounding boxes were not available");
  }

  await page.mouse.move(itemBox.x + itemBox.width / 2, itemBox.y + itemBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(slotBox.x + slotBox.width / 2, slotBox.y + slotBox.height / 2);
  await page.mouse.up();

  await expect(page.getByLabel("Crop controls")).toBeVisible();
  await expect(page.getByText("Upscaling")).toBeVisible();
  await expect(page.getByText(/source px for 1080 x 1350/)).toBeVisible();
});

test("adds and edits a text layer in the carousel workspace", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[type="file"][multiple]').setInputFiles({
    name: "carousel-text.png",
    mimeType: "image/png",
    buffer: wideImage,
  });

  const item = page.locator(".canvas-item").filter({ hasText: "carousel-text.png" });
  const targetSlot = page.locator("[data-grid-slot-index='0']");
  const itemBox = await item.boundingBox();
  const slotBox = await targetSlot.boundingBox();
  if (!itemBox || !slotBox) {
    throw new Error("Required bounding boxes were not available");
  }

  await page.mouse.move(itemBox.x + itemBox.width / 2, itemBox.y + itemBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(slotBox.x + slotBox.width / 2, slotBox.y + slotBox.height / 2);
  await page.mouse.up();

  await page.getByRole("button", { name: "Carousel" }).click();
  await expect(page.getByRole("region", { name: "Carousel Workspace" })).toBeVisible();
  const slideStrip = page.getByRole("region", { name: "Carousel slides" });
  const slideStripBox = await slideStrip.boundingBox();
  const firstSlideThumbnail = slideStrip.locator(".carousel-slide-card").first();
  const firstSlideThumbnailBox = await firstSlideThumbnail.boundingBox();
  if (!slideStripBox || !firstSlideThumbnailBox) {
    throw new Error("Carousel slide strip layout boxes were not available");
  }
  expect(slideStripBox.height).toBeLessThanOrEqual(110);
  expect(Math.abs(firstSlideThumbnailBox.width - firstSlideThumbnailBox.height)).toBeLessThan(2);
  await page.getByRole("button", { name: "Text", exact: true }).click();

  const textLayer = page.getByRole("button", { name: "Double-click to edit" });
  await expect(textLayer).toBeVisible();
  await textLayer.click();
  await page.getByLabel("Text content").fill("Launch checklist");

  await expect(page.getByRole("button", { name: "Launch checklist" })).toBeVisible();
  await expect(page.getByLabel("Text properties")).toContainText("Text layer");

  const editedLayer = page.getByRole("button", { name: "Launch checklist" });
  const beforeDrag = await editedLayer.boundingBox();
  if (!beforeDrag) {
    throw new Error("Text layer bounding box was not available");
  }

  await page.mouse.move(beforeDrag.x + beforeDrag.width / 2, beforeDrag.y + beforeDrag.height / 2);
  await page.mouse.down();
  await page.mouse.move(beforeDrag.x + beforeDrag.width / 2 + 100, beforeDrag.y + beforeDrag.height / 2 + 56);
  await page.mouse.up();

  const afterDrag = await editedLayer.boundingBox();
  if (!afterDrag) {
    throw new Error("Text layer bounding box was not available after drag");
  }
  expect(afterDrag.x).toBeGreaterThan(beforeDrag.x + 12);
  expect(afterDrag.y).toBeGreaterThan(beforeDrag.y + 12);
  await expect(editedLayer).not.toHaveAttribute("data-slide-element-x", "0.12");

  await page.getByLabel("Text box width").fill("52");
  await expect(editedLayer).toHaveAttribute("data-slide-element-width", "0.52");

  await page.getByRole("button", { name: /Quote/ }).click();
  await expect(page.getByRole("button", { name: /Strong carousels/ })).toBeVisible();
  await expect(page.getByLabel("Text properties")).toContainText("Quote");
  await page.getByLabel("Text content").fill("Template edited");
  await expect(page.getByRole("button", { name: "Template edited" })).toBeVisible();
  await page.getByLabel("Text font").selectOption({ label: "Poppins" });
  await page.getByRole("button", { name: "Align center" }).click();
  await page.getByRole("button", { name: "Align middle" }).click();
  await expect(page.getByRole("button", { name: "Template edited" })).toHaveAttribute("data-slide-element-x", "0.12");

  const quoteSource = page.getByRole("button", { name: "InstaSetka note" });
  await quoteSource.click({ modifiers: ["Shift"] });
  await expect(page.getByLabel("Text properties")).toContainText("2 text layers");
  await page.getByRole("button", { name: "Align left" }).click();
  await expect(quoteSource).toHaveAttribute("data-slide-element-x", "0.12");
});

test("lists quality map issues and selects the affected grid slot", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles({
    name: "quality-map.png",
    mimeType: "image/png",
    buffer: tinyPng,
  });

  const item = page.locator(".canvas-item").filter({ hasText: "quality-map.png" });
  const targetSlot = page.locator("[data-grid-slot-index='4']");
  const itemBox = await item.boundingBox();
  const slotBox = await targetSlot.boundingBox();
  if (!itemBox || !slotBox) {
    throw new Error("Required bounding boxes were not available");
  }

  await page.mouse.move(itemBox.x + itemBox.width / 2, itemBox.y + itemBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(slotBox.x + slotBox.width / 2, slotBox.y + slotBox.height / 2);
  await page.mouse.up();

  await page.getByRole("button", { name: "Quality map" }).click();
  await expect(page.getByLabel("Quality map panel")).toBeVisible();
  await expect(page.getByText("Slot 5: Upscaling")).toBeVisible();

  await page.getByText("Slot 5: Upscaling").click();
  await expect(targetSlot).toHaveClass(/is-selected/);
  await expect(page.getByLabel("Crop controls")).toBeVisible();
});

test("exports the selected grid post with the active Instagram preset", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles({
    name: "export-ready.png",
    mimeType: "image/png",
    buffer: wideImage,
  });

  const item = page.locator(".canvas-item").filter({ hasText: "export-ready.png" });
  const targetSlot = page.locator("[data-grid-slot-index='0']");
  const itemBox = await item.boundingBox();
  const slotBox = await targetSlot.boundingBox();
  if (!itemBox || !slotBox) {
    throw new Error("Required bounding boxes were not available");
  }

  await page.mouse.move(itemBox.x + itemBox.width / 2, itemBox.y + itemBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(slotBox.x + slotBox.width / 2, slotBox.y + slotBox.height / 2);
  await page.mouse.up();

  await page.getByRole("button", { name: "3:4" }).click();
  await page.getByRole("button", { name: "PNG" }).click();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("01-export-ready-3x4.png");

  const downloadPath = await download.path();
  if (!downloadPath) {
    throw new Error("Downloaded file path was unavailable");
  }
  const exported = await readFile(downloadPath);
  expect(readPngDimensions(exported)).toEqual({ width: 1080, height: 1440 });
  await expect(page.getByText("Exported 1080 x 1440 PNG")).toBeVisible();
});

test("preserves image proportions when switching grid aspect ratio", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles({
    name: "no-squash.png",
    mimeType: "image/png",
    buffer: tinyPng,
  });

  const item = page.locator(".canvas-item").filter({ hasText: "no-squash.png" });
  const targetSlot = page.locator("[data-grid-slot-index='0']");
  const itemBox = await item.boundingBox();
  const slotBox = await targetSlot.boundingBox();
  if (!itemBox || !slotBox) {
    throw new Error("Required bounding boxes were not available");
  }

  await page.mouse.move(itemBox.x + itemBox.width / 2, itemBox.y + itemBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(slotBox.x + slotBox.width / 2, slotBox.y + slotBox.height / 2);
  await page.mouse.up();

  const image = targetSlot.locator("img");
  await expect(image).toHaveAttribute("alt", "no-squash.png");

  for (const mode of ["4:5", "3:4", "1:1"] as const) {
    await page.getByRole("button", { name: mode }).click();
    await expect(page.locator(".grid-preview")).toHaveAttribute("data-active-aspect", mode);
    await expect(image).toHaveCSS("object-fit", "cover");
    await expect(image).toHaveCSS("object-position", "50% 50%");
  }
});

test("updates selected grid post crop zoom non-destructively", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles({
    name: "crop-zoom.png",
    mimeType: "image/png",
    buffer: tinyPng,
  });

  const item = page.locator(".canvas-item").filter({ hasText: "crop-zoom.png" });
  const targetSlot = page.locator("[data-grid-slot-index='0']");
  const itemBox = await item.boundingBox();
  const slotBox = await targetSlot.boundingBox();
  if (!itemBox || !slotBox) {
    throw new Error("Required bounding boxes were not available");
  }

  await page.mouse.move(itemBox.x + itemBox.width / 2, itemBox.y + itemBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(slotBox.x + slotBox.width / 2, slotBox.y + slotBox.height / 2);
  await page.mouse.up();

  await expect(page.getByLabel("Crop controls")).toBeVisible();
  await targetSlot.dblclick();
  await expect(page.getByText("Double-click image to lock crop")).toBeVisible();
  const zoom = page.getByLabel("Crop zoom");
  const zoomBox = await zoom.boundingBox();
  if (!zoomBox) {
    throw new Error("Zoom slider bounding box unavailable");
  }

  await page.mouse.click(zoomBox.x + zoomBox.width * 0.25, zoomBox.y + zoomBox.height / 2);

  const image = targetSlot.locator("img");
  await expect(page.getByText(/1[3-6]\d%/)).toBeVisible();
  await expect(image).toHaveAttribute("style", /scale\(1\.[3-6]/);

  await page.getByRole("button", { name: "Reset" }).click();
  await expect(page.getByText("100%")).toBeVisible();
  await expect(image).toHaveAttribute("style", /scale\(1\)/);

  await targetSlot.dblclick();
  await expect(page.getByText("Double-click image to edit crop")).toBeVisible();
});

test("pans a selected grid image crop inside its slot", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("instasetka.gridZoom", "1");
  });
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles({
    name: "crop-pan.png",
    mimeType: "image/png",
    buffer: tinyPng,
  });

  const item = page.locator(".canvas-item").filter({ hasText: "crop-pan.png" });
  const targetSlot = page.locator("[data-grid-slot-index='0']");
  const itemBox = await item.boundingBox();
  const slotBox = await targetSlot.boundingBox();
  if (!itemBox || !slotBox) {
    throw new Error("Required bounding boxes were not available");
  }

  await page.mouse.move(itemBox.x + itemBox.width / 2, itemBox.y + itemBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(slotBox.x + slotBox.width / 2, slotBox.y + slotBox.height / 2);
  await page.mouse.up();

  await expect(page.getByLabel("Crop controls")).toBeVisible();
  await targetSlot.dblclick();
  await expect(page.getByText("Double-click image to lock crop")).toBeVisible();
  const zoom = page.getByLabel("Crop zoom");
  const zoomBox = await zoom.boundingBox();
  if (!zoomBox) {
    throw new Error("Zoom slider bounding box unavailable");
  }
  await page.mouse.click(zoomBox.x + zoomBox.width * 0.25, zoomBox.y + zoomBox.height / 2);

  const image = targetSlot.locator("img");
  const imageBox = await image.boundingBox();
  if (!imageBox) {
    throw new Error("Grid image bounding box unavailable");
  }

  await page.mouse.move(imageBox.x + imageBox.width / 2, imageBox.y + imageBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(imageBox.x + imageBox.width / 2 + 34, imageBox.y + imageBox.height / 2 + 21);
  await page.mouse.up();

  await expect(image).toHaveAttribute("data-crop-x", "34");
  await expect(image).toHaveAttribute("data-crop-y", "21");
  await expect(image).toHaveAttribute("style", /translate\(34px, 21px\)/);
});

test("prevents crop pan from revealing empty space", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "1:1" }).click();

  await page.locator('input[type="file"]').setInputFiles({
    name: "crop-boundary.png",
    mimeType: "image/png",
    buffer: tinyPng,
  });

  const item = page.locator(".canvas-item").filter({ hasText: "crop-boundary.png" });
  const targetSlot = page.locator("[data-grid-slot-index='0']");
  const itemBox = await item.boundingBox();
  const slotBox = await targetSlot.boundingBox();
  if (!itemBox || !slotBox) {
    throw new Error("Required bounding boxes were not available");
  }

  await page.mouse.move(itemBox.x + itemBox.width / 2, itemBox.y + itemBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(slotBox.x + slotBox.width / 2, slotBox.y + slotBox.height / 2);
  await page.mouse.up();

  const image = targetSlot.locator("img");
  await targetSlot.dblclick();
  await expect(page.getByText("Double-click image to lock crop")).toBeVisible();
  const imageBox = await image.boundingBox();
  if (!imageBox) {
    throw new Error("Grid image bounding box unavailable");
  }

  await page.mouse.move(imageBox.x + imageBox.width / 2, imageBox.y + imageBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(imageBox.x + imageBox.width / 2 + 200, imageBox.y + imageBox.height / 2 + 200);
  await page.mouse.up();

  await expect(image).toHaveAttribute("data-crop-x", "0");
  await expect(image).toHaveAttribute("data-crop-y", "0");
  await expect(image).toHaveAttribute("style", /translate\(0px, 0px\)/);

  await page.mouse.move(imageBox.x + imageBox.width / 2, imageBox.y + imageBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(imageBox.x + imageBox.width / 2 - 240, imageBox.y + imageBox.height / 2);
  await page.mouse.up();

  await expect(image).toHaveAttribute("data-crop-x", "0");
  await expect(image).toHaveAttribute("data-crop-y", "0");
});

test("allows horizontal crop pan for wide images in tall grid slots", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("instasetka.gridZoom", "1");
  });
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles({
    name: "wide-crop.png",
    mimeType: "image/png",
    buffer: wideImage,
  });

  const item = page.locator(".canvas-item").filter({ hasText: "wide-crop.png" });
  const targetSlot = page.locator("[data-grid-slot-index='0']");
  const itemBox = await item.boundingBox();
  const slotBox = await targetSlot.boundingBox();
  if (!itemBox || !slotBox) {
    throw new Error("Required bounding boxes were not available");
  }

  await page.mouse.move(itemBox.x + itemBox.width / 2, itemBox.y + itemBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(slotBox.x + slotBox.width / 2, slotBox.y + slotBox.height / 2);
  await page.mouse.up();

  const image = targetSlot.locator("img");
  await targetSlot.dblclick();
  await expect(page.getByText("Double-click image to lock crop")).toBeVisible();
  await expect(image).toHaveClass(/cover-wide/);
  const initialImageBox = await image.boundingBox();
  const initialSlotBox = await targetSlot.boundingBox();
  if (!initialImageBox || !initialSlotBox) {
    throw new Error("Initial image or slot bounding box unavailable");
  }
  expect(initialImageBox.width).toBeGreaterThan(initialSlotBox.width);
  expect(initialImageBox.height).toBeLessThanOrEqual(initialSlotBox.height + 2);

  const imageBox = await image.boundingBox();
  if (!imageBox) {
    throw new Error("Grid image bounding box unavailable");
  }

  await page.mouse.move(imageBox.x + imageBox.width / 2, imageBox.y + imageBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(imageBox.x + imageBox.width / 2 - 120, imageBox.y + imageBox.height / 2 + 80);
  await page.mouse.up();

  await expect(image).toHaveAttribute("data-crop-x", "-120");
  await expect(image).toHaveAttribute("data-crop-y", "0");
});

function createPng(width: number, height: number): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const raw = Buffer.alloc((width * 4 + 1) * height);

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;

    for (let x = 0; x < width; x += 1) {
      const offset = rowStart + 1 + x * 4;
      raw[offset] = x < width / 3 ? 240 : x < (width * 2) / 3 ? 70 : 40;
      raw[offset + 1] = x < width / 3 ? 70 : x < (width * 2) / 3 ? 190 : 90;
      raw[offset + 2] = x < width / 3 ? 60 : x < (width * 2) / 3 ? 90 : 230;
      raw[offset + 3] = 255;
    }
  }

  return Buffer.concat([
    signature,
    pngChunk("IHDR", Buffer.concat([uint32(width), uint32(height), Buffer.from([8, 6, 0, 0, 0])])),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function readPngDimensions(buffer: Buffer): { width: number; height: number } {
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type, "ascii");
  return Buffer.concat([uint32(data.length), typeBuffer, data, uint32(crc32(Buffer.concat([typeBuffer, data])))]);
}

function uint32(value: number): Buffer {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0);
  return buffer;
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}
