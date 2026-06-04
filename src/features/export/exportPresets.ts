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
  const coverScale = Math.max(slot.width / asset.width, slot.height / asset.height);
  const renderedScale = coverScale * crop.scale;
  const renderedWidth = asset.width * renderedScale;
  const renderedHeight = asset.height * renderedScale;
  const sx = (renderedWidth / 2 - slot.width / 2 - crop.x) / renderedScale;
  const sy = (renderedHeight / 2 - slot.height / 2 - crop.y) / renderedScale;
  const sw = slot.width / renderedScale;
  const sh = slot.height / renderedScale;

  return clampSourceCropRect({ sx, sy, sw, sh }, asset);
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
