import type { AspectRatio, CropState, ExportFormat, SlideBackground, SlideElement, SourceAsset } from "../../lib/types";
import {
  getExportMimeType,
  getExportPreset,
  type SlotSize,
} from "./exportPresets";

export type RenderSlideExportInput = {
  image: CanvasImageSource;
  asset: Pick<SourceAsset, "width" | "height">;
  crop: CropState;
  slot: SlotSize;
  aspectRatio: AspectRatio;
  format: ExportFormat;
  background?: SlideBackground;
  elements?: SlideElement[];
};

export async function renderSlideExport(input: RenderSlideExportInput): Promise<Blob> {
  const preset = getExportPreset(input.aspectRatio);
  const canvas = document.createElement("canvas");
  canvas.width = preset.width;
  canvas.height = preset.height;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas 2D rendering is not available");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  drawCroppedImageOnCanvas(context, {
    image: input.image,
    asset: input.asset,
    crop: input.crop,
    slot: input.slot,
    target: { x: 0, y: 0, width: preset.width, height: preset.height },
  });
  drawSlideBackgroundOverlay(context, input.background, {
    width: preset.width,
    height: preset.height,
  });
  drawSlideElementsOnCanvas(context, input.elements ?? [], {
    width: preset.width,
    height: preset.height,
  });

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

export function drawSlideBackgroundOverlay(
  context: CanvasRenderingContext2D,
  background: SlideBackground | undefined,
  canvasSize: { width: number; height: number },
) {
  const overlayOpacity = Math.max(0, Math.min(0.85, background?.overlayOpacity ?? 0));

  if (overlayOpacity <= 0) {
    return;
  }

  context.save();
  context.fillStyle = `rgba(0, 0, 0, ${overlayOpacity})`;
  context.fillRect(0, 0, canvasSize.width, canvasSize.height);
  context.restore();
}

export function drawSlideElementsOnCanvas(
  context: CanvasRenderingContext2D,
  elements: SlideElement[],
  canvasSize: { width: number; height: number },
) {
  for (const element of elements) {
    context.save();
    context.fillStyle = element.style.color;
    context.font = `${element.style.fontWeight} ${element.style.fontSize}px ${element.style.fontFamily}`;
    context.textAlign = element.style.textAlign;
    context.textBaseline = "top";

    const x = element.x * canvasSize.width;
    const y = element.y * canvasSize.height;
    const width = element.width * canvasSize.width;
    const lineHeight = element.style.fontSize * element.style.lineHeight;
    const anchorX =
      element.style.textAlign === "center"
        ? x + width / 2
        : element.style.textAlign === "right"
          ? x + width
          : x;

    for (const [lineIndex, line] of wrapCanvasText(context, element.content, width).entries()) {
      context.fillText(line, anchorX, y + lineIndex * lineHeight);
    }

    context.restore();
  }
}

function wrapCanvasText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const explicitLines = text.split(/\r?\n/);
  const lines: string[] = [];

  for (const explicitLine of explicitLines) {
    const words = explicitLine.split(/\s+/).filter(Boolean);
    let line = "";

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && context.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }

    lines.push(line);
  }

  return lines.length > 0 ? lines : [""];
}

export function drawCroppedImageOnCanvas(
  context: CanvasRenderingContext2D,
  input: {
    image: CanvasImageSource;
    asset: Pick<SourceAsset, "width" | "height">;
    crop: CropState;
    slot: SlotSize;
    target: { x: number; y: number; width: number; height: number };
  },
) {
  const targetScale = Math.min(input.target.width / input.slot.width, input.target.height / input.slot.height);
  const rotation = normalizeRotation(input.crop.rotation);
  const rotated = rotation % 180 === 90;
  const coverWidth = rotated ? input.asset.height : input.asset.width;
  const coverHeight = rotated ? input.asset.width : input.asset.height;
  const coverScale = Math.max(input.slot.width / coverWidth, input.slot.height / coverHeight);
  const renderedScale = coverScale * input.crop.scale * targetScale;
  const renderedWidth = input.asset.width * renderedScale;
  const renderedHeight = input.asset.height * renderedScale;

  context.save();
  context.beginPath();
  context.rect(input.target.x, input.target.y, input.target.width, input.target.height);
  context.clip();
  context.translate(
    input.target.x + input.target.width / 2 + input.crop.x * targetScale,
    input.target.y + input.target.height / 2 + input.crop.y * targetScale,
  );
  context.rotate((rotation * Math.PI) / 180);
  context.drawImage(
    input.image,
    -renderedWidth / 2,
    -renderedHeight / 2,
    renderedWidth,
    renderedHeight,
  );
  context.restore();
}

function normalizeRotation(rotation: number): number {
  return ((rotation % 360) + 360) % 360;
}
