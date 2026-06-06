import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addSlideToPost,
  addSourceAsset,
  autoArrangeCanvasItems,
  clearActiveGrid,
  convertPostToCarousel,
  createEmptyProject,
  duplicateActiveGridVersion,
  duplicateSlideInPost,
  insertAssetAcrossGridSlots,
  insertAssetIntoGrid,
  moveCanvasItems,
  movePostToGridSlot,
  moveSlideInPost,
  removeCanvasItems,
  removePostFromGridSlot,
  removeSlideFromPost,
  replaceAssetInGridSlot,
  replacePostSlides,
  reorderActiveGrid,
  rotateSlideCrop,
  setActiveGridVersion,
  setCanvasItemPosition,
  setSlideCrop,
  togglePostLock,
} from "../src/features/project/projectReducer";
import type { CanvasItem, SourceAsset } from "../src/lib/types";

const ids = ["post-a", "slide-a", "post-b", "slide-b", "version-b"];

beforeEach(() => {
  let index = 0;
  vi.stubGlobal("crypto", {
    randomUUID: vi.fn(() => ids[index++] ?? `id-${index}`),
  });
});

function asset(id: string): SourceAsset {
  return {
    id,
    name: `${id}.jpg`,
    width: 2000,
    height: 2500,
    mimeType: "image/jpeg",
  };
}

function canvasItem(id: string, sourceImageId: string): CanvasItem {
  return {
    id,
    sourceImageId,
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0,
  };
}

describe("projectReducer", () => {
  it("keeps source assets separate from canvas items", () => {
    const project = createEmptyProject("2026-05-31T00:00:00.000Z");
    const nextProject = addSourceAsset(project, asset("asset-a"), canvasItem("canvas-a", "asset-a"));

    expect(nextProject.assets).toHaveLength(1);
    expect(nextProject.canvasItems).toHaveLength(1);
    expect(nextProject.posts).toHaveLength(0);
  });

  it("moves selected canvas items without changing source assets", () => {
    const project = createEmptyProject("2026-05-31T00:00:00.000Z");
    const withAsset = addSourceAsset(project, asset("asset-a"), canvasItem("canvas-a", "asset-a"));
    const moved = moveCanvasItems(withAsset, ["canvas-a"], { x: 24, y: -12 });

    expect(moved.canvasItems[0]).toMatchObject({ x: 24, y: -12 });
    expect(moved.assets[0]).toEqual(withAsset.assets[0]);
    expect(withAsset.canvasItems[0]).toMatchObject({ x: 0, y: 0 });
  });

  it("removes canvas items and prunes unreferenced source assets", () => {
    const project = createEmptyProject("2026-05-31T00:00:00.000Z");
    const withFirst = addSourceAsset(project, asset("asset-a"), canvasItem("canvas-a", "asset-a"));
    const withSecond = addSourceAsset(withFirst, asset("asset-b"), canvasItem("canvas-b", "asset-b"));
    const removed = removeCanvasItems(withSecond, ["canvas-a"]);

    expect(removed.canvasItems.map((item) => item.id)).toEqual(["canvas-b"]);
    expect(removed.assets.map((sourceAsset) => sourceAsset.id)).toEqual(["asset-b"]);
  });

  it("keeps a source asset when removing a canvas item used by the grid", () => {
    const project = createEmptyProject("2026-05-31T00:00:00.000Z");
    const withAsset = addSourceAsset(project, asset("asset-a"), canvasItem("canvas-a", "asset-a"));
    const withPost = insertAssetIntoGrid(withAsset, "asset-a", 0);
    const removed = removeCanvasItems(withPost, ["canvas-a"]);

    expect(removed.canvasItems).toHaveLength(0);
    expect(removed.assets.map((sourceAsset) => sourceAsset.id)).toEqual(["asset-a"]);
    expect(removed.posts).toHaveLength(1);
  });

  it("sets a canvas item position directly", () => {
    const project = createEmptyProject("2026-05-31T00:00:00.000Z");
    const withAsset = addSourceAsset(project, asset("asset-a"), canvasItem("canvas-a", "asset-a"));
    const moved = setCanvasItemPosition(withAsset, "canvas-a", { x: 120, y: 240 });

    expect(moved.canvasItems[0]).toMatchObject({ x: 120, y: 240 });
    expect(withAsset.canvasItems[0]).toMatchObject({ x: 0, y: 0 });
  });

  it("auto-arranges canvas items into a tidy board", () => {
    const project = createEmptyProject("2026-05-31T00:00:00.000Z");
    const withFirst = addSourceAsset(project, asset("asset-a"), {
      ...canvasItem("canvas-a", "asset-a"),
      x: 900,
      y: 500,
    });
    const withSecond = addSourceAsset(withFirst, asset("asset-b"), {
      ...canvasItem("canvas-b", "asset-b"),
      x: -300,
      y: 1200,
    });
    const arranged = autoArrangeCanvasItems(withSecond, { columns: 2 });

    expect(arranged.canvasItems.map((item) => ({ x: item.x, y: item.y }))).toEqual([
      { x: 48, y: 82 },
      { x: 296, y: 82 },
    ]);
    expect(withSecond.canvasItems[0]).toMatchObject({ x: 900, y: 500 });
  });

  it("inserts source assets into the active grid version", () => {
    const project = createEmptyProject("2026-05-31T00:00:00.000Z");
    const withFirstPost = insertAssetIntoGrid(project, "asset-a", 0);
    const withSecondPost = insertAssetIntoGrid(withFirstPost, "asset-b", 0);
    const activeVersion = withSecondPost.versions[0];

    expect(withSecondPost.posts).toHaveLength(2);
    expect(activeVersion.postOrder).toEqual(["post_post-b", "post_post-a"]);
  });

  it("preserves empty grid slots when inserting into a later slot", () => {
    const project = createEmptyProject("2026-05-31T00:00:00.000Z");
    const withPost = insertAssetIntoGrid(project, "asset-a", 4);

    expect(withPost.versions[0].postOrder).toEqual([null, null, null, null, "post_post-a"]);
  });

  it("replaces a grid slot without shifting existing posts", () => {
    const project = createEmptyProject("2026-05-31T00:00:00.000Z");
    const withFirstPost = insertAssetIntoGrid(project, "asset-a", 0);
    const withSecondPost = insertAssetIntoGrid(withFirstPost, "asset-b", 1);
    const replaced = replaceAssetInGridSlot(withSecondPost, "asset-c", 0);
    const firstPost = replaced.posts.find((post) => post.id === replaced.versions[0].postOrder[0]);
    const secondPost = replaced.posts.find((post) => post.id === replaced.versions[0].postOrder[1]);

    expect(replaced.versions[0].postOrder).toHaveLength(2);
    expect(firstPost?.slides[0].sourceImageId).toBe("asset-c");
    expect(secondPost?.slides[0].sourceImageId).toBe("asset-b");
  });

  it("unlinks replaced slots from existing mosaic groups", () => {
    const project = createEmptyProject("2026-05-31T00:00:00.000Z");
    const crops = [0, 1, 2].map((index) => ({
      aspectRatio: "4:5" as const,
      x: index * 10,
      y: 0,
      scale: 1,
      rotation: 0,
    }));
    const withMosaic = insertAssetAcrossGridSlots(project, "asset-a", [0, 1, 2], crops);
    const replaced = replaceAssetInGridSlot(withMosaic, "asset-b", 1);
    const postBySlot = replaced.versions[0].postOrder.map((postId) =>
      replaced.posts.find((post) => post.id === postId),
    );

    expect(postBySlot[0]?.mosaicGroup?.slotIndexes).toEqual([0, 2]);
    expect(postBySlot[1]?.mosaicGroup).toBeUndefined();
    expect(postBySlot[1]?.slides[0].sourceImageId).toBe("asset-b");
    expect(postBySlot[2]?.mosaicGroup?.slotIndexes).toEqual([0, 2]);
  });

  it("moves a post into an empty grid slot", () => {
    const project = createEmptyProject("2026-05-31T00:00:00.000Z");
    const withPost = insertAssetIntoGrid(project, "asset-a", 0);
    const moved = movePostToGridSlot(withPost, 0, 4);

    expect(moved.versions[0].postOrder).toEqual([null, null, null, null, "post_post-a"]);
  });

  it("swaps posts when moving onto an occupied grid slot", () => {
    const project = createEmptyProject("2026-05-31T00:00:00.000Z");
    const withFirstPost = insertAssetIntoGrid(project, "asset-a", 0);
    const withSecondPost = insertAssetIntoGrid(withFirstPost, "asset-b", 1);
    const moved = movePostToGridSlot(withSecondPost, 0, 1);

    expect(moved.versions[0].postOrder).toEqual(["post_post-b", "post_post-a"]);
  });

  it("removes a post from the active grid slot and prunes unused source assets", () => {
    const project = createEmptyProject("2026-05-31T00:00:00.000Z");
    const withAsset = addSourceAsset(project, asset("asset-a"), canvasItem("canvas-a", "asset-a"));
    const withPost = insertAssetIntoGrid(withAsset, "asset-a", 0);
    const withoutCanvas = removeCanvasItems(withPost, ["canvas-a"]);
    const removed = removePostFromGridSlot(withoutCanvas, 0);

    expect(removed.versions[0].postOrder).toEqual([null]);
    expect(removed.posts).toHaveLength(0);
    expect(removed.assets).toHaveLength(0);
  });

  it("clears the active grid while keeping canvas assets available", () => {
    const project = createEmptyProject("2026-05-31T00:00:00.000Z");
    const withAsset = addSourceAsset(project, asset("asset-a"), canvasItem("canvas-a", "asset-a"));
    const withFirstPost = insertAssetIntoGrid(withAsset, "asset-a", 0);
    const withSecondPost = insertAssetIntoGrid(withFirstPost, "asset-b", 2);
    const cleared = clearActiveGrid(withSecondPost);

    expect(cleared.versions[0].postOrder).toEqual([null, null, null]);
    expect(cleared.posts).toHaveLength(0);
    expect(cleared.canvasItems.map((item) => item.sourceImageId)).toEqual(["asset-a"]);
    expect(cleared.assets.map((sourceAsset) => sourceAsset.id)).toEqual(["asset-a"]);
  });

  it("keeps locked posts in place when clearing the active grid", () => {
    const project = createEmptyProject("2026-05-31T00:00:00.000Z");
    const withFirstPost = insertAssetIntoGrid(project, "asset-a", 0);
    const withSecondPost = insertAssetIntoGrid(withFirstPost, "asset-b", 1);
    const locked = togglePostLock(withSecondPost, withSecondPost.posts[1].id);
    const cleared = clearActiveGrid(locked);

    expect(cleared.versions[0].postOrder).toEqual([null, "post_post-b"]);
    expect(cleared.posts.map((post) => post.id)).toEqual(["post_post-b"]);
    expect(cleared.posts[0].locked).toBe(true);
  });

  it("unlinks locked mosaic posts from cleared mosaic slots", () => {
    const project = createEmptyProject("2026-05-31T00:00:00.000Z");
    const withMosaic = insertAssetAcrossGridSlots(
      project,
      "asset-a",
      [0, 1, 2],
      [
        { aspectRatio: "4:5", x: 100, y: 0, scale: 1, rotation: 0 },
        { aspectRatio: "4:5", x: 0, y: 0, scale: 1, rotation: 0 },
        { aspectRatio: "4:5", x: -100, y: 0, scale: 1, rotation: 0 },
      ],
    );
    const lockedPostId = withMosaic.posts[1].id;
    const locked = togglePostLock(withMosaic, lockedPostId);
    const cleared = clearActiveGrid(locked);
    const remainingPost = cleared.posts.find((post) => post.id === lockedPostId);

    expect(cleared.versions[0].postOrder).toEqual([null, lockedPostId, null]);
    expect(remainingPost?.locked).toBe(true);
    expect(remainingPost?.mosaicGroup).toBeUndefined();
  });

  it("keeps posts that are still referenced by another grid version when clearing", () => {
    const project = createEmptyProject("2026-05-31T00:00:00.000Z");
    const withPost = insertAssetIntoGrid(project, "asset-a", 0);
    const duplicated = duplicateActiveGridVersion(withPost, "Draft B", "2026-05-31T00:01:00.000Z");
    const cleared = clearActiveGrid(duplicated);

    expect(cleared.versions.find((version) => version.id === cleared.activeVersionId)?.postOrder).toEqual([null]);
    expect(cleared.versions.find((version) => version.id === "version_default")?.postOrder).toEqual(["post_post-a"]);
    expect(cleared.posts.map((post) => post.id)).toEqual(["post_post-a"]);
  });

  it("reorders posts without mutating post records", () => {
    const project = createEmptyProject("2026-05-31T00:00:00.000Z");
    const withFirstPost = insertAssetIntoGrid(project, "asset-a", 0);
    const withSecondPost = insertAssetIntoGrid(withFirstPost, "asset-b", 1);
    const reordered = reorderActiveGrid(withSecondPost, 0, 1);

    expect(reordered.versions[0].postOrder).toEqual(["post_post-b", "post_post-a"]);
    expect(reordered.posts.map((post) => post.id)).toEqual(["post_post-a", "post_post-b"]);
  });

  it("updates slide crop metadata non-destructively", () => {
    const project = createEmptyProject("2026-05-31T00:00:00.000Z");
    const withPost = insertAssetIntoGrid(project, "asset-a", 0);
    const slideId = withPost.posts[0].slides[0].id;
    const cropped = setSlideCrop(withPost, slideId, {
      aspectRatio: "3:4",
      x: 0.2,
      y: -0.1,
      scale: 1.4,
      rotation: 2,
    });

    expect(cropped.posts[0].slides[0].crop).toMatchObject({
      aspectRatio: "3:4",
      scale: 1.4,
    });
    expect(withPost.posts[0].slides[0].crop.aspectRatio).toBe("4:5");
  });

  it("rotates slide crops in 90 degree steps without mutating the original project", () => {
    const project = createEmptyProject("2026-05-31T00:00:00.000Z");
    const withPost = insertAssetIntoGrid(project, "asset-a", 0);
    const slideId = withPost.posts[0].slides[0].id;
    const cropped = setSlideCrop(withPost, slideId, {
      aspectRatio: "4:5",
      x: 42,
      y: -18,
      scale: 1.4,
      rotation: 270,
    });
    const rotatedRight = rotateSlideCrop(cropped, slideId, 1);
    const rotatedLeft = rotateSlideCrop(rotatedRight, slideId, -1);

    expect(rotatedRight.posts[0].slides[0].crop).toMatchObject({
      x: 0,
      y: 0,
      scale: 1.4,
      rotation: 0,
    });
    expect(rotatedLeft.posts[0].slides[0].crop.rotation).toBe(270);
    expect(cropped.posts[0].slides[0].crop).toMatchObject({ x: 42, y: -18, rotation: 270 });
  });

  it("converts a post to carousel and adds slides", () => {
    const project = createEmptyProject("2026-05-31T00:00:00.000Z");
    const withPost = insertAssetIntoGrid(project, "asset-a", 0);
    const postId = withPost.posts[0].id;
    const carousel = addSlideToPost(convertPostToCarousel(withPost, postId), postId, "asset-b");

    expect(carousel.posts[0].kind).toBe("carousel");
    expect(carousel.posts[0].slides).toHaveLength(2);
  });

  it("duplicates, reorders, and removes carousel slides", () => {
    const project = createEmptyProject("2026-05-31T00:00:00.000Z");
    const withPost = insertAssetIntoGrid(project, "asset-a", 0);
    const postId = withPost.posts[0].id;
    const withSlides = addSlideToPost(convertPostToCarousel(withPost, postId), postId, "asset-b");
    const duplicated = duplicateSlideInPost(withSlides, postId, withSlides.posts[0].slides[0].id);
    const moved = moveSlideInPost(duplicated, postId, 0, 2);
    const removed = removeSlideFromPost(moved, postId, moved.posts[0].slides[1].id);

    expect(duplicated.posts[0].slides).toHaveLength(3);
    expect(moved.posts[0].slides[2].sourceImageId).toBe("asset-a");
    expect(removed.posts[0].slides).toHaveLength(2);
  });

  it("replaces a post with generated carousel slides", () => {
    const project = createEmptyProject("2026-05-31T00:00:00.000Z");
    const withPost = insertAssetIntoGrid(project, "asset-a", 0);
    const postId = withPost.posts[0].id;
    const replaced = replacePostSlides(withPost, postId, [
      {
        id: "slide-custom-a",
        sourceImageId: "asset-a",
        crop: { aspectRatio: "4:5", x: 10, y: 0, scale: 1, rotation: 0 },
      },
      {
        id: "slide-custom-b",
        sourceImageId: "asset-a",
        crop: { aspectRatio: "4:5", x: -10, y: 0, scale: 1, rotation: 0 },
      },
    ]);

    expect(replaced.posts[0].kind).toBe("carousel");
    expect(replaced.posts[0].slides.map((slide) => slide.id)).toEqual([
      "slide-custom-a",
      "slide-custom-b",
    ]);
  });

  it("duplicates the active grid version", () => {
    const project = createEmptyProject("2026-05-31T00:00:00.000Z");
    const withPost = insertAssetIntoGrid(project, "asset-a", 0);
    const duplicated = duplicateActiveGridVersion(withPost, "Draft B", "2026-05-31T00:01:00.000Z");

    expect(duplicated.versions).toHaveLength(2);
    expect(duplicated.activeVersionId).toBe(duplicated.versions[1].id);
    expect(duplicated.activeVersionId).toMatch(/^version_/);
    expect(duplicated.versions[1].postOrder).toEqual(withPost.versions[0].postOrder);
  });

  it("switches the active grid version", () => {
    const project = createEmptyProject("2026-05-31T00:00:00.000Z");
    const duplicated = duplicateActiveGridVersion(project, "Draft B", "2026-05-31T00:01:00.000Z");
    const switched = setActiveGridVersion(duplicated, "version_default");

    expect(switched.activeVersionId).toBe("version_default");
  });

  it("prevents moving, replacing, or deleting locked posts", () => {
    const project = createEmptyProject("2026-05-31T00:00:00.000Z");
    const withFirstPost = insertAssetIntoGrid(project, "asset-a", 0);
    const withSecondPost = insertAssetIntoGrid(withFirstPost, "asset-b", 1);
    const locked = togglePostLock(withSecondPost, withSecondPost.posts[0].id);
    const moved = movePostToGridSlot(locked, 0, 1);
    const reordered = reorderActiveGrid(locked, 0, 1);
    const inserted = insertAssetIntoGrid(locked, "asset-c", 0);
    const replaced = replaceAssetInGridSlot(locked, "asset-c", 0);
    const removed = removePostFromGridSlot(locked, 0);

    expect(locked.posts[0].locked).toBe(true);
    expect(moved.versions[0].postOrder).toEqual(locked.versions[0].postOrder);
    expect(reordered.versions[0].postOrder).toEqual(locked.versions[0].postOrder);
    expect(inserted.versions[0].postOrder).toEqual(locked.versions[0].postOrder);
    expect(replaced.versions[0].postOrder).toEqual(locked.versions[0].postOrder);
    expect(removed.versions[0].postOrder).toEqual(locked.versions[0].postOrder);
  });

  it("splits one source image across exact grid slots", () => {
    const project = createEmptyProject("2026-05-31T00:00:00.000Z");
    const split = insertAssetAcrossGridSlots(
      project,
      "asset-a",
      [0, 1, 2],
      [
        { aspectRatio: "4:5", x: 100, y: 0, scale: 1, rotation: 0 },
        { aspectRatio: "4:5", x: 0, y: 0, scale: 1, rotation: 0 },
        { aspectRatio: "4:5", x: -100, y: 0, scale: 1, rotation: 0 },
      ],
    );

    expect(split.posts).toHaveLength(3);
    expect(split.versions[0].postOrder).toEqual(split.posts.map((post) => post.id));
    expect(split.posts.map((post) => post.slides[0].sourceImageId)).toEqual([
      "asset-a",
      "asset-a",
      "asset-a",
    ]);
    expect(new Set(split.posts.map((post) => post.mosaicGroup?.id))).toHaveLength(1);
    expect(split.posts[0].mosaicGroup?.slotIndexes).toEqual([0, 1, 2]);
  });
});
