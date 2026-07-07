import type { AspectRatio, CropState, ExportFormat, SlideBackground, SlideElement, SourceAsset } from "../../lib/types";
import { parseInlineTextRuns } from "../text/inlineMarkup";
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
    context.font = `${element.style.fontStyle ?? "normal"} ${element.style.fontWeight} ${element.style.fontSize}px ${element.style.fontFamily}`;
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

    const transformedContent =
      element.style.textTransform === "uppercase" ? element.content.toUpperCase() : element.content;

    for (const [lineIndex, line] of wrapCanvasText(context, transformedContent, width, element.style.letterSpacing ?? 0).entries()) {
      drawCanvasRichTextLine(context, line, anchorX, y + lineIndex * lineHeight, element);
    }

    context.restore();
  }
}

function wrapCanvasText(context: CanvasRenderingContext2D, text: string, maxWidth: number, letterSpacing = 0): string[] {
  const explicitLines = text.split(/\r?\n/);
  const lines: string[] = [];

  for (const explicitLine of explicitLines) {
    const words = explicitLine.split(/\s+/).filter(Boolean);
    let line = "";

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && measureCanvasTextLine(context, candidate, letterSpacing) > maxWidth) {
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

function drawCanvasRichTextLine(
  context: CanvasRenderingContext2D,
  line: string,
  x: number,
  y: number,
  element: SlideElement,
) {
  const letterSpacing = element.style.letterSpacing ?? 0;
  const runs = parseInlineTextRuns(line);
  const width = runs.reduce((sum, run) => {
    context.font = getCanvasTextFont(element, run);
    return sum + measureCanvasTextLine(context, run.text, letterSpacing);
  }, 0);
  const startX = context.textAlign === "center" ? x - width / 2 : context.textAlign === "right" ? x - width : x;
  const originalAlign = context.textAlign;
  let cursorX = startX;

  context.textAlign = "left";

  for (const run of runs) {
    context.font = getCanvasTextFont(element, run);
    drawCanvasTextLine(context, run.text, cursorX, y, letterSpacing);
    cursorX += measureCanvasTextLine(context, run.text, letterSpacing);
  }

  context.textAlign = originalAlign;
}

function getCanvasTextFont(
  element: SlideElement,
  run: { bold: boolean; italic: boolean },
): string {
  const fontStyle = run.italic ? "italic" : element.style.fontStyle ?? "normal";
  const fontWeight = run.bold ? Math.max(700, element.style.fontWeight) : element.style.fontWeight;
  return `${fontStyle} ${fontWeight} ${element.style.fontSize}px ${element.style.fontFamily}`;
}

function measureCanvasTextLine(context: CanvasRenderingContext2D, text: string, letterSpacing: number): number {
  if (letterSpacing === 0 || text.length <= 1) {
    return context.measureText(text).width;
  }

  return context.measureText(text).width + letterSpacing * (text.length - 1);
}

function drawCanvasTextLine(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  letterSpacing: number,
) {
  if (letterSpacing === 0 || text.length <= 1) {
    context.fillText(text, x, y);
    return;
  }

  const width = measureCanvasTextLine(context, text, letterSpacing);
  const startX = context.textAlign === "center" ? x - width / 2 : context.textAlign === "right" ? x - width : x;
  const originalAlign = context.textAlign;
  let cursorX = startX;

  context.textAlign = "left";

  for (const character of text) {
    context.fillText(character, cursorX, y);
    cursorX += context.measureText(character).width + letterSpacing;
  }

  context.textAlign = originalAlign;
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
