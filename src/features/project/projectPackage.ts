import type { AspectRatio, ExportFormat, Project, SourceAsset } from "../../lib/types";

export const projectPackageSchemaVersion = 1;
export const projectPackageExtension = "instasetka";
export const projectPackageMimeType = "application/json";

export type ProjectPackageAsset = {
  id: string;
  name: string;
  mimeType: SourceAsset["mimeType"];
  dataUrl: string;
};

export type ProjectPackage = {
  schemaVersion: typeof projectPackageSchemaVersion;
  exportedAt: string;
  project: Project;
  settings: {
    activeAspectRatio: AspectRatio;
    exportFormat: ExportFormat;
    canvasView: {
      x: number;
      y: number;
      zoom: number;
    };
    gridZoom: number;
    workspaceSplit: number;
  };
  assets: ProjectPackageAsset[];
};

export function createProjectPackage(input: Omit<ProjectPackage, "schemaVersion" | "exportedAt">): ProjectPackage {
  return {
    schemaVersion: projectPackageSchemaVersion,
    exportedAt: new Date().toISOString(),
    project: input.project,
    settings: input.settings,
    assets: input.assets,
  };
}

export function serializeProjectPackage(projectPackage: ProjectPackage): string {
  return JSON.stringify(projectPackage);
}

export function parseProjectPackage(value: string): ProjectPackage {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Project package is not valid JSON");
  }

  if (!isProjectPackage(parsed)) {
    throw new Error("Project package is not compatible with this version");
  }

  return parsed;
}

export function getProjectPackageFilename(projectName: string): string {
  const cleanName = projectName
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return `${cleanName || "instasetka-project"}.${projectPackageExtension}`;
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read asset data"));
    reader.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

function isProjectPackage(value: unknown): value is ProjectPackage {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.schemaVersion === projectPackageSchemaVersion &&
    typeof value.exportedAt === "string" &&
    isProject(value.project) &&
    isSettings(value.settings) &&
    Array.isArray(value.assets) &&
    value.assets.every(isPackageAsset)
  );
}

function isProject(value: unknown): value is Project {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.activeVersionId === "string" &&
    Array.isArray(value.assets) &&
    Array.isArray(value.canvasItems) &&
    Array.isArray(value.posts) &&
    Array.isArray(value.versions) &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

function isSettings(value: unknown): value is ProjectPackage["settings"] {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isAspectRatio(value.activeAspectRatio) &&
    isExportFormat(value.exportFormat) &&
    isCanvasView(value.canvasView) &&
    typeof value.gridZoom === "number" &&
    typeof value.workspaceSplit === "number"
  );
}

function isPackageAsset(value: unknown): value is ProjectPackageAsset {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    isAssetMimeType(value.mimeType) &&
    typeof value.dataUrl === "string" &&
    value.dataUrl.startsWith("data:")
  );
}

function isCanvasView(value: unknown): value is ProjectPackage["settings"]["canvasView"] {
  return (
    isRecord(value) &&
    typeof value.x === "number" &&
    typeof value.y === "number" &&
    typeof value.zoom === "number"
  );
}

function isAspectRatio(value: unknown): value is AspectRatio {
  return value === "4:5" || value === "3:4" || value === "1:1";
}

function isExportFormat(value: unknown): value is ExportFormat {
  return value === "jpeg" || value === "png";
}

function isAssetMimeType(value: unknown): value is SourceAsset["mimeType"] {
  return value === "image/jpeg" || value === "image/png";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
