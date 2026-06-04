import { describe, expect, it } from "vitest";
import {
  createProjectSession,
  loadProjectSession,
  parseProjectSession,
  projectSessionStorageKey,
  saveProjectSession,
} from "../src/features/project/projectPersistence";
import { createEmptyProject } from "../src/features/project/projectReducer";

function createMemoryStorage() {
  const values = new Map<string, string>();

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}

describe("projectPersistence", () => {
  it("roundtrips a project session through storage", () => {
    const storage = createMemoryStorage();
    const session = createProjectSession({
      savedAt: "2026-06-01T12:00:00.000Z",
      project: createEmptyProject("2026-06-01T12:00:00.000Z"),
      activeAspectRatio: "3:4",
      exportFormat: "png",
      canvasView: { x: 12, y: -4, zoom: 1.25 },
      gridZoom: 0.8,
      workspaceSplit: 61,
    });

    saveProjectSession(storage, session);

    expect(storage.getItem(projectSessionStorageKey)).toContain("Untitled grid");
    expect(loadProjectSession(storage)).toEqual(session);
  });

  it("rejects corrupted or unsupported autosave data", () => {
    expect(parseProjectSession("{not-json")).toBeNull();
    expect(parseProjectSession(JSON.stringify({ schemaVersion: 999 }))).toBeNull();
  });
});
