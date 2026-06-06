export type CropBoundsInput = {
  slotWidth: number;
  slotHeight: number;
  imageWidth: number;
  imageHeight: number;
  scale: number;
  rotation?: number;
};

export type CropOffset = {
  x: number;
  y: number;
};

export function clampCropOffset(input: CropBoundsInput, offset: CropOffset): CropOffset {
  const fitted = getCoverSize(input);
  const renderedWidth = fitted.width * input.scale;
  const renderedHeight = fitted.height * input.scale;
  const maxX = Math.max(0, (renderedWidth - input.slotWidth) / 2);
  const maxY = Math.max(0, (renderedHeight - input.slotHeight) / 2);

  return {
    x: normalizeZero(clamp(offset.x, -maxX, maxX)),
    y: normalizeZero(clamp(offset.y, -maxY, maxY)),
  };
}

function getCoverSize(input: CropBoundsInput): { width: number; height: number } {
  const rotated = Math.abs(input.rotation ?? 0) % 180 === 90;
  const coverWidth = rotated ? input.imageHeight : input.imageWidth;
  const coverHeight = rotated ? input.imageWidth : input.imageHeight;
  const coverScale = Math.max(input.slotWidth / coverWidth, input.slotHeight / coverHeight);

  return {
    width: coverWidth * coverScale,
    height: coverHeight * coverScale,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeZero(value: number): number {
  return Math.abs(value) < 0.001 ? 0 : value;
}
