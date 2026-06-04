import type { AspectRatio, CropState, SourceAsset } from "../../lib/types";
import { getExportPreset, getSourceCropRect, type SlotSize, type SourceCropRect } from "../export/exportPresets";

export type QualityStatus = "good" | "warning";

export type SlideQualityPreflight = {
  status: QualityStatus;
  label: string;
  message: string;
  target: {
    width: number;
    height: number;
  };
  sourceCrop: SourceCropRect;
  scaleFactor: number;
};

export function getSlideQualityPreflight(input: {
  asset: Pick<SourceAsset, "width" | "height">;
  crop: CropState;
  slot: SlotSize;
  aspectRatio: AspectRatio;
}): SlideQualityPreflight {
  const target = getExportPreset(input.aspectRatio);
  const sourceCrop = getSourceCropRect(input.asset, input.crop, input.slot);
  const scaleFactor = Math.max(target.width / sourceCrop.sw, target.height / sourceCrop.sh);
  const roundedWidth = Math.round(sourceCrop.sw);
  const roundedHeight = Math.round(sourceCrop.sh);

  if (sourceCrop.sw >= target.width && sourceCrop.sh >= target.height) {
    return {
      status: "good",
      label: "Good",
      message: `${roundedWidth} x ${roundedHeight} source px`,
      target,
      sourceCrop,
      scaleFactor,
    };
  }

  return {
    status: "warning",
    label: "Upscaling",
    message: `${roundedWidth} x ${roundedHeight} source px for ${target.width} x ${target.height}`,
    target,
    sourceCrop,
    scaleFactor,
  };
}
