import type { AspectRatio, CropState, ExportFormat, SourceAsset } from "../../lib/types";

export type ExportPreset = {
  aspectRatio: AspectRatio;
  width: number;
  height: number;
};

export type SlotSize = {
  width: number;
  height: number;
};

export type SourceCropRect = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
};

export const exportPresets: Record<AspectRatio, ExportPreset> = {
  "4:5": {
    aspectRatio: "4:5",
    width: 1080,
    height: 1350,
  },
  "3:4": {
    aspectRatio: "3:4",
    width: 1080,
    height: 1440,
  },
  "1:1": {
    aspectRatio: "1:1",
    width: 1080,
    height: 1080,
  },
};

export function getExportPreset(aspectRatio: AspectRatio): ExportPreset {
  return exportPresets[aspectRatio];
}

export function getExportMimeType(format: ExportFormat): "image/jpeg" | "image/png" {
  return format === "jpeg" ? "image/jpeg" : "image/png";
}

export function createExportFilename(
  assetName: string,
  slotIndex: number,
  aspectRatio: AspectRatio,
  format: ExportFormat,
): string {
  const extension = format === "jpeg" ? "jpg" : "png";
  const baseName = assetName.replace(/\.[^.]+$/, "").replace(/[^a-z0-9а-яё_-]+/gi, "-");
  const normalizedBaseName = baseName.replace(/^-+|-+$/g, "") || "post";
  const aspectLabel = aspectRatio.replace(":", "x");

  return `${String(slotIndex + 1).padStart(2, "0")}-${normalizedBaseName}-${aspectLabel}.${extension}`;
}

export function createCarouselExportFilename(
  assetName: string,
  slotIndex: number,
  slideIndex: number,
  aspectRatio: AspectRatio,
  format: ExportFormat,
): string {
  const extension = format === "jpeg" ? "jpg" : "png";
  const baseName = assetName.replace(/\.[^.]+$/, "").replace(/[^a-z0-9а-яё_-]+/gi, "-");
  const normalizedBaseName = baseName.replace(/^-+|-+$/g, "") || "carousel";
  const aspectLabel = aspectRatio.replace(":", "x");

  return `${String(slotIndex + 1).padStart(2, "0")}-${normalizedBaseName}-slide-${String(
    slideIndex + 1,
  ).padStart(2, "0")}-${aspectLabel}.${extension}`;
}

export function createBatchExportFilename(
  slotIndex: number,
  slideIndex: number | null,
  format: ExportFormat,
): string {
  const extension = format === "jpeg" ? "jpg" : "png";
  const line = Math.floor(slotIndex / 3) + 1;
  const column = (slotIndex % 3) + 1;
  const position = `line${line}-${column}`;

  return slideIndex === null
    ? `${position}.${extension}`
    : `${position}-slide${String(slideIndex + 1).padStart(2, "0")}.${extension}`;
}

export function getSourceCropRect(
  asset: Pick<SourceAsset, "width" | "height">,
  crop: CropState,
  slot: SlotSize,
): SourceCropRect {
  const rotation = normalizeRotation(crop.rotation);
  const radians = (rotation * Math.PI) / 180;
  const rotated = rotation % 180 === 90;
  const coverWidth = rotated ? asset.height : asset.width;
  const coverHeight = rotated ? asset.width : asset.height;
  const coverScale = Math.max(slot.width / coverWidth, slot.height / coverHeight);
  const renderedScale = coverScale * crop.scale;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const slotCorners = [
    { x: -slot.width / 2, y: -slot.height / 2 },
    { x: slot.width / 2, y: -slot.height / 2 },
    { x: slot.width / 2, y: slot.height / 2 },
    { x: -slot.width / 2, y: slot.height / 2 },
  ];
  const sourceCorners = slotCorners.map((corner) => {
    const offsetX = corner.x - crop.x;
    const offsetY = corner.y - crop.y;
    const unrotatedX = cos * offsetX + sin * offsetY;
    const unrotatedY = -sin * offsetX + cos * offsetY;

    return {
      x: unrotatedX / renderedScale + asset.width / 2,
      y: unrotatedY / renderedScale + asset.height / 2,
    };
  });
  const left = Math.min(...sourceCorners.map((corner) => corner.x));
  const top = Math.min(...sourceCorners.map((corner) => corner.y));
  const right = Math.max(...sourceCorners.map((corner) => corner.x));
  const bottom = Math.max(...sourceCorners.map((corner) => corner.y));

  return clampSourceCropRect({ sx: left, sy: top, sw: right - left, sh: bottom - top }, asset);
}

function clampSourceCropRect(
  rect: SourceCropRect,
  asset: Pick<SourceAsset, "width" | "height">,
): SourceCropRect {
  const sw = Math.min(asset.width, rect.sw);
  const sh = Math.min(asset.height, rect.sh);
  const sx = clamp(rect.sx, 0, asset.width - sw);
  const sy = clamp(rect.sy, 0, asset.height - sh);

  return { sx, sy, sw, sh };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeRotation(rotation: number): number {
  return ((rotation % 360) + 360) % 360;
}
