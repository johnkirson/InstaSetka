import { describe, expect, it } from "vitest";
import {
  createProjectPackage,
  getProjectPackageFilename,
  parseProjectPackage,
  serializeProjectPackage,
} from "../src/features/project/projectPackage";
import { createEmptyProject } from "../src/features/project/projectReducer";

describe("projectPackage", () => {
  it("roundtrips a package manifest", () => {
    const projectPackage = createProjectPackage({
      project: createEmptyProject("2026-06-01T12:00:00.000Z"),
      settings: {
        activeAspectRatio: "4:5",
        exportFormat: "jpeg",
        canvasView: { x: 0, y: 0, zoom: 1 },
        gridZoom: 0.75,
        workspaceSplit: 58,
      },
      assets: [
        {
          id: "asset-a",
          name: "source.jpg",
          mimeType: "image/jpeg",
          dataUrl: "data:image/jpeg;base64,AA==",
        },
      ],
    });

    expect(parseProjectPackage(serializeProjectPackage(projectPackage))).toEqual(projectPackage);
  });

  it("rejects invalid package data", () => {
    expect(() => parseProjectPackage("{bad-json")).toThrow("not valid JSON");
    expect(() => parseProjectPackage(JSON.stringify({ schemaVersion: 999 }))).toThrow("not compatible");
  });

  it("creates a safe package filename", () => {
    expect(getProjectPackageFilename("Untitled grid: June/01")).toBe(
      "untitled-grid-june-01.instasetka",
    );
  });
});
