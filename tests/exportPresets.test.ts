import { describe, expect, it } from "vitest";
import {
  createBatchExportFilename,
  createCarouselExportFilename,
  createExportFilename,
  getExportMimeType,
  getExportPreset,
  getSourceCropRect,
} from "../src/features/export/exportPresets";

describe("export presets", () => {
  it("uses Instagram-ready target dimensions for supported ratios", () => {
    expect(getExportPreset("4:5")).toMatchObject({ width: 1080, height: 1350 });
    expect(getExportPreset("3:4")).toMatchObject({ width: 1080, height: 1440 });
    expect(getExportPreset("1:1")).toMatchObject({ width: 1080, height: 1080 });
  });

  it("maps export formats to browser image mime types", () => {
    expect(getExportMimeType("jpeg")).toBe("image/jpeg");
    expect(getExportMimeType("png")).toBe("image/png");
  });

  it("creates stable slot-based filenames", () => {
    expect(createExportFilename("My final image.png", 4, "3:4", "jpeg")).toBe(
      "05-My-final-image-3x4.jpg",
    );
  });

  it("creates stable carousel slide filenames", () => {
    expect(createCarouselExportFilename("Cover image.png", 0, 2, "4:5", "png")).toBe(
      "01-Cover-image-slide-03-4x5.png",
    );
  });

  it("creates position-based batch filenames", () => {
    expect(createBatchExportFilename(0, null, "jpeg")).toBe("line1-1.jpg");
    expect(createBatchExportFilename(5, null, "png")).toBe("line2-3.png");
    expect(createBatchExportFilename(6, 1, "jpeg")).toBe("line3-1-slide02.jpg");
  });

  it("maps the visible centered crop back to source pixels", () => {
    expect(
      getSourceCropRect(
        { width: 2000, height: 1000 },
        { aspectRatio: "4:5", x: 0, y: 0, scale: 1, rotation: 0 },
        { width: 400, height: 500 },
      ),
    ).toEqual({ sx: 600, sy: 0, sw: 800, sh: 1000 });
  });

  it("accounts for user pan and zoom when choosing source pixels", () => {
    expect(
      getSourceCropRect(
        { width: 2000, height: 1000 },
        { aspectRatio: "4:5", x: -100, y: 0, scale: 2, rotation: 0 },
        { width: 400, height: 500 },
      ),
    ).toEqual({ sx: 900, sy: 250, sw: 400, sh: 500 });
  });

  it("accounts for pan and zoom after 90 degree rotation", () => {
    const rect = getSourceCropRect(
      { width: 3000, height: 2000 },
      { aspectRatio: "4:5", x: 100, y: 80, scale: 2, rotation: 90 },
      { width: 400, height: 500 },
    );

    expect(Math.round(rect.sx)).toBe(675);
    expect(Math.round(rect.sy)).toBe(750);
    expect(Math.round(rect.sw)).toBe(1250);
    expect(Math.round(rect.sh)).toBe(1000);
  });
});
