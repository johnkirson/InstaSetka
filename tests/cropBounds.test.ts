import { describe, expect, it } from "vitest";
import { clampCropOffset } from "../src/features/crop/cropBounds";

describe("clampCropOffset", () => {
  it("prevents panning when the image exactly covers the slot", () => {
    expect(
      clampCropOffset(
        {
          slotWidth: 400,
          slotHeight: 500,
          imageWidth: 400,
          imageHeight: 500,
          scale: 1,
        },
        { x: 100, y: -100 },
      ),
    ).toEqual({ x: 0, y: 0 });
  });

  it("allows panning only inside scaled image overflow", () => {
    expect(
      clampCropOffset(
        {
          slotWidth: 400,
          slotHeight: 500,
          imageWidth: 400,
          imageHeight: 500,
          scale: 1.5,
        },
        { x: 400, y: -400 },
      ),
    ).toEqual({ x: 100, y: -125 });
  });

  it("allows horizontal pan when cover fit overflows horizontally", () => {
    expect(
      clampCropOffset(
        {
          slotWidth: 400,
          slotHeight: 500,
          imageWidth: 1600,
          imageHeight: 900,
          scale: 1,
        },
        { x: -500, y: 200 },
      ),
    ).toEqual({ x: -244.44444444444446, y: 0 });
  });
});
