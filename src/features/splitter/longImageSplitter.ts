import type { AspectRatio, CropState, SourceAsset } from "../../lib/types";

export type SplitDirection = "horizontal" | "vertical";

export function inferSplitDirection(
  asset: Pick<SourceAsset, "width" | "height">,
  aspectRatio: AspectRatio,
): SplitDirection {
  return asset.width / asset.height >= aspectToNumber(aspectRatio) ? "horizontal" : "vertical";
}

export function createSplitCrops(input: {
  asset: Pick<SourceAsset, "width" | "height">;
  aspectRatio: AspectRatio;
  count: number;
  direction: SplitDirection;
  slot: { width: number; height: number };
}): CropState[] {
  const count = Math.max(1, Math.floor(input.count));
  const coverScale = Math.max(input.slot.width / input.asset.width, input.slot.height / input.asset.height);
  const renderedWidth = input.asset.width * coverScale;
  const renderedHeight = input.asset.height * coverScale;
  const sourceWindowWidth = input.slot.width / coverScale;
  const sourceWindowHeight = input.slot.height / coverScale;

  return Array.from({ length: count }, (_, index) => {
    const progress = count === 1 ? 0.5 : index / (count - 1);
    const sx =
      input.direction === "horizontal"
        ? progress * Math.max(0, input.asset.width - sourceWindowWidth)
        : (input.asset.width - sourceWindowWidth) / 2;
    const sy =
      input.direction === "vertical"
        ? progress * Math.max(0, input.asset.height - sourceWindowHeight)
        : (input.asset.height - sourceWindowHeight) / 2;

    return {
      aspectRatio: input.aspectRatio,
      x: renderedWidth / 2 - input.slot.width / 2 - sx * coverScale,
      y: renderedHeight / 2 - input.slot.height / 2 - sy * coverScale,
      scale: 1,
      rotation: 0,
    };
  });
}

export function createGridRowSplitCrops(input: {
  asset: Pick<SourceAsset, "width" | "height">;
  aspectRatio: AspectRatio;
  count: number;
  slot: { width: number; height: number };
}): CropState[] {
  const count = Math.max(1, Math.floor(input.count));
  return createGridMosaicSplitCrops({
    asset: input.asset,
    aspectRatio: input.aspectRatio,
    slotIndexes: Array.from({ length: count }, (_, index) => index),
    slot: input.slot,
  });
}

export function createGridMosaicSplitCrops(input: {
  asset: Pick<SourceAsset, "width" | "height">;
  aspectRatio: AspectRatio;
  slotIndexes: number[];
  slot: { width: number; height: number };
  columns?: number;
}): CropState[] {
  const columns = input.columns ?? 3;
  const slots = input.slotIndexes.map((slotIndex) => ({
    slotIndex,
    column: slotIndex % columns,
    row: Math.floor(slotIndex / columns),
  }));

  if (slots.length === 0) {
    return [];
  }

  const minColumn = Math.min(...slots.map((slot) => slot.column));
  const maxColumn = Math.max(...slots.map((slot) => slot.column));
  const minRow = Math.min(...slots.map((slot) => slot.row));
  const maxRow = Math.max(...slots.map((slot) => slot.row));
  const combinedSlot = {
    width: input.slot.width * (maxColumn - minColumn + 1),
    height: input.slot.height * (maxRow - minRow + 1),
  };
  const combinedCoverScale = Math.max(
    combinedSlot.width / input.asset.width,
    combinedSlot.height / input.asset.height,
  );
  const singleSlotCoverScale = Math.max(
    input.slot.width / input.asset.width,
    input.slot.height / input.asset.height,
  );
  const renderedWidth = input.asset.width * combinedCoverScale;
  const renderedHeight = input.asset.height * combinedCoverScale;
  const sourceLeft = (renderedWidth / 2 - combinedSlot.width / 2) / combinedCoverScale;
  const sourceTop = (renderedHeight / 2 - combinedSlot.height / 2) / combinedCoverScale;
  const sourceWindowWidth = input.slot.width / combinedCoverScale;
  const sourceWindowHeight = input.slot.height / combinedCoverScale;
  const scale = combinedCoverScale / singleSlotCoverScale;

  return slots.map((slot) => {
    const sx = sourceLeft + (slot.column - minColumn) * sourceWindowWidth;
    const sy = sourceTop + (slot.row - minRow) * sourceWindowHeight;

    return {
      aspectRatio: input.aspectRatio,
      x: renderedWidth / 2 - input.slot.width / 2 - sx * combinedCoverScale,
      y: renderedHeight / 2 - input.slot.height / 2 - sy * combinedCoverScale,
      scale,
      rotation: 0,
    };
  });
}

function aspectToNumber(aspectRatio: AspectRatio): number {
  const [width, height] = aspectRatio.split(":").map(Number);
  return width / height;
}
