import { describe, expect, it } from "vitest";
import { getSourceCropRect } from "../src/features/export/exportPresets";
import {
  createGridMosaicSplitCrops,
  createGridRowSplitCrops,
  createSplitCrops,
  inferSplitDirection,
} from "../src/features/splitter/longImageSplitter";

describe("long image splitter", () => {
  it("infers horizontal split for wide sources and vertical split for tall sources", () => {
    expect(inferSplitDirection({ width: 2400, height: 900 }, "4:5")).toBe("horizontal");
    expect(inferSplitDirection({ width: 900, height: 2400 }, "4:5")).toBe("vertical");
  });

  it("creates horizontal crop offsets from left to right", () => {
    const crops = createSplitCrops({
      asset: { width: 2400, height: 900 },
      aspectRatio: "4:5",
      count: 3,
      direction: "horizontal",
      slot: { width: 400, height: 500 },
    });

    expect(crops).toHaveLength(3);
    expect(crops[0].x).toBeGreaterThan(crops[1].x);
    expect(crops[1].x).toBeGreaterThan(crops[2].x);
    expect(crops.every((crop) => crop.y === 0)).toBe(true);
  });

  it("creates vertical crop offsets from top to bottom", () => {
    const crops = createSplitCrops({
      asset: { width: 900, height: 2400 },
      aspectRatio: "4:5",
      count: 3,
      direction: "vertical",
      slot: { width: 400, height: 500 },
    });

    expect(crops).toHaveLength(3);
    expect(crops[0].y).toBeGreaterThan(crops[1].y);
    expect(crops[1].y).toBeGreaterThan(crops[2].y);
    expect(crops.every((crop) => crop.x === 0)).toBe(true);
  });

  it("creates seamless grid row crops with shared scale and adjacent source windows", () => {
    const asset = { width: 1800, height: 1200 };
    const slot = { width: 400, height: 500 };
    const crops = createGridRowSplitCrops({
      asset,
      aspectRatio: "4:5",
      count: 3,
      slot,
    });
    const sourceRects = crops.map((crop) => getSourceCropRect(asset, crop, slot));

    expect(crops).toHaveLength(3);
    expect(new Set(crops.map((crop) => crop.scale))).toHaveLength(1);
    expect(sourceRects[0].sx + sourceRects[0].sw).toBeCloseTo(sourceRects[1].sx, 5);
    expect(sourceRects[1].sx + sourceRects[1].sw).toBeCloseTo(sourceRects[2].sx, 5);
    expect(sourceRects[0].sy).toBeCloseTo(sourceRects[1].sy, 5);
    expect(sourceRects[1].sy).toBeCloseTo(sourceRects[2].sy, 5);
  });

  it("creates mosaic crops using each selected grid slot position", () => {
    const asset = { width: 2400, height: 2400 };
    const slot = { width: 300, height: 300 };
    const crops = createGridMosaicSplitCrops({
      asset,
      aspectRatio: "1:1",
      slotIndexes: [0, 2, 6, 8],
      slot,
    });
    const sourceRects = crops.map((crop) => getSourceCropRect(asset, crop, slot));

    expect(crops).toHaveLength(4);
    expect(new Set(crops.map((crop) => crop.scale))).toHaveLength(1);
    expect(sourceRects[0].sy).toBeCloseTo(sourceRects[1].sy, 5);
    expect(sourceRects[2].sy).toBeCloseTo(sourceRects[3].sy, 5);
    expect(sourceRects[2].sy).toBeGreaterThan(sourceRects[0].sy);
    expect(sourceRects[1].sx).toBeGreaterThan(sourceRects[0].sx);
    expect(sourceRects[3].sx).toBeGreaterThan(sourceRects[2].sx);
  });
});
