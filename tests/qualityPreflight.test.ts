import { describe, expect, it } from "vitest";
import { getSlideQualityPreflight } from "../src/features/quality/qualityPreflight";

describe("getSlideQualityPreflight", () => {
  it("passes when visible source crop has enough pixels for export", () => {
    const preflight = getSlideQualityPreflight({
      asset: { width: 3000, height: 3750 },
      crop: { aspectRatio: "4:5", x: 0, y: 0, scale: 1, rotation: 0 },
      slot: { width: 400, height: 500 },
      aspectRatio: "4:5",
    });

    expect(preflight.status).toBe("good");
    expect(preflight.target).toMatchObject({ width: 1080, height: 1350 });
    expect(preflight.sourceCrop.sw).toBe(3000);
    expect(preflight.sourceCrop.sh).toBe(3750);
  });

  it("warns when crop has to be upscaled for the target preset", () => {
    const preflight = getSlideQualityPreflight({
      asset: { width: 800, height: 1000 },
      crop: { aspectRatio: "4:5", x: 0, y: 0, scale: 1, rotation: 0 },
      slot: { width: 400, height: 500 },
      aspectRatio: "4:5",
    });

    expect(preflight.status).toBe("warning");
    expect(preflight.label).toBe("Upscaling");
    expect(preflight.scaleFactor).toBeGreaterThan(1);
  });

  it("warns when zooming into a large source leaves too few visible pixels", () => {
    const preflight = getSlideQualityPreflight({
      asset: { width: 3000, height: 3750 },
      crop: { aspectRatio: "4:5", x: 0, y: 0, scale: 3, rotation: 0 },
      slot: { width: 400, height: 500 },
      aspectRatio: "4:5",
    });

    expect(preflight.status).toBe("warning");
    expect(Math.round(preflight.sourceCrop.sw)).toBe(1000);
    expect(Math.round(preflight.sourceCrop.sh)).toBe(1250);
  });
});
