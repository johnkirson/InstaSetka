import type { AspectRatio, CropState, ExportFormat, SourceAsset } from "../../lib/types";
import {
  getExportMimeType,
  getExportPreset,
  getSourceCropRect,
  type SlotSize,
} from "./exportPresets";

export type RenderSlideExportInput = {
  image: CanvasImageSource;
  asset: Pick<SourceAsset, "width" | "height">;
  crop: CropState;
  slot: SlotSize;
  aspectRatio: AspectRatio;
  format: ExportFormat;
};

export async function renderSlideExport(input: RenderSlideExportInput): Promise<Blob> {
  const preset = getExportPreset(input.aspectRatio);
  const sourceRect = getSourceCropRect(input.asset, input.crop, input.slot);
  const canvas = document.createElement("canvas");
  canvas.width = preset.width;
  canvas.height = preset.height;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas 2D rendering is not available");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    input.image,
    sourceRect.sx,
    sourceRect.sy,
    sourceRect.sw,
    sourceRect.sh,
    0,
    0,
    preset.width,
    preset.height,
  );

  const mimeType = getExportMimeType(input.format);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Could not create export image"));
        }
      },
      mimeType,
      input.format === "jpeg" ? 0.95 : undefined,
    );
  });
}
