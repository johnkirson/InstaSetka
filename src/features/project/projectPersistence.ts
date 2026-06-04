import type { AspectRatio, ExportFormat, Project } from "../../lib/types";

export const projectSessionStorageKey = "instasetka.projectSession";
export const projectSessionSchemaVersion = 1;

export type ProjectSession = {
  schemaVersion: typeof projectSessionSchemaVersion;
  savedAt: string;
  project: Project;
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

type ProjectSessionInput = Omit<ProjectSession, "schemaVersion" | "savedAt"> & {
  savedAt?: string;
};

type SessionStorageAdapter = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function createProjectSession(input: ProjectSessionInput): ProjectSession {
  return {
    schemaVersion: projectSessionSchemaVersion,
    savedAt: input.savedAt ?? new Date().toISOString(),
    project: input.project,
    activeAspectRatio: input.activeAspectRatio,
    exportFormat: input.exportFormat,
    canvasView: input.canvasView,
    gridZoom: input.gridZoom,
    workspaceSplit: input.workspaceSplit,
  };
}

export function serializeProjectSession(session: ProjectSession): string {
  return JSON.stringify(session);
}

export function parseProjectSession(value: string | null): ProjectSession | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return isProjectSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveProjectSession(storage: SessionStorageAdapter, session: ProjectSession) {
  storage.setItem(projectSessionStorageKey, serializeProjectSession(session));
}

export function loadProjectSession(storage: SessionStorageAdapter): ProjectSession | null {
  return parseProjectSession(storage.getItem(projectSessionStorageKey));
}

export function clearProjectSession(storage: SessionStorageAdapter) {
  storage.removeItem(projectSessionStorageKey);
}

function isProjectSession(value: unknown): value is ProjectSession {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.schemaVersion === projectSessionSchemaVersion &&
    typeof value.savedAt === "string" &&
    isProject(value.project) &&
    isAspectRatio(value.activeAspectRatio) &&
    isExportFormat(value.exportFormat) &&
    isCanvasView(value.canvasView) &&
    typeof value.gridZoom === "number" &&
    typeof value.workspaceSplit === "number"
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

function isCanvasView(value: unknown): value is ProjectSession["canvasView"] {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
