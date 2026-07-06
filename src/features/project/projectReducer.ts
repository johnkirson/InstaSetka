import type {
  CanvasItem,
  CropState,
  GridVersion,
  Post,
  Project,
  Slide,
  SlideBackground,
  SlideElement,
  SlideTextElement,
  SlideTextStyle,
  SourceAsset,
} from "../../lib/types";

type SlideTextElementPatch = Partial<Omit<SlideTextElement, "style">> & {
  style?: Partial<SlideTextStyle>;
};

type SlideBackgroundPatch = Partial<SlideBackground>;

export const defaultCrop: CropState = {
  aspectRatio: "4:5",
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
};

export function createEmptyProject(now = new Date().toISOString()): Project {
  const initialVersion: GridVersion = {
    id: "version_default",
    name: "Draft A",
    postOrder: [],
    createdAt: now,
  };

  return {
    id: "project_default",
    name: "Untitled grid",
    activeVersionId: initialVersion.id,
    assets: [],
    canvasItems: [],
    posts: [],
    versions: [initialVersion],
    createdAt: now,
    updatedAt: now,
  };
}

export function addSourceAsset(project: Project, asset: SourceAsset, canvasItem: CanvasItem): Project {
  return {
    ...touch(project),
    assets: [...project.assets, asset],
    canvasItems: [...project.canvasItems, canvasItem],
  };
}

export function moveCanvasItems(
  project: Project,
  canvasItemIds: string[],
  delta: { x: number; y: number },
): Project {
  const selectedIds = new Set(canvasItemIds);

  return {
    ...touch(project),
    canvasItems: project.canvasItems.map((item) =>
      selectedIds.has(item.id)
        ? {
            ...item,
            x: item.x + delta.x,
            y: item.y + delta.y,
          }
        : item,
    ),
  };
}

export function removeCanvasItems(project: Project, canvasItemIds: string[]): Project {
  const removedCanvasItemIds = new Set(canvasItemIds);
  const nextCanvasItems = project.canvasItems.filter((item) => !removedCanvasItemIds.has(item.id));
  const referencedSourceImageIds = getReferencedSourceImageIds({
    canvasItems: nextCanvasItems,
    posts: project.posts,
  });

  return {
    ...touch(project),
    canvasItems: nextCanvasItems,
    assets: project.assets.filter((asset) => referencedSourceImageIds.has(asset.id)),
  };
}

export function setCanvasItemPosition(
  project: Project,
  canvasItemId: string,
  position: { x: number; y: number },
): Project {
  return {
    ...touch(project),
    canvasItems: project.canvasItems.map((item) =>
      item.id === canvasItemId
        ? {
            ...item,
            x: position.x,
            y: position.y,
          }
        : item,
    ),
  };
}

export function autoArrangeCanvasItems(project: Project, options = { columns: 4 }): Project {
  const gap = 28;
  const cellWidth = 220;
  const cellHeight = 260;
  const startX = 48;
  const startY = 82;

  return {
    ...touch(project),
    canvasItems: project.canvasItems.map((item, index) => {
      const column = index % options.columns;
      const row = Math.floor(index / options.columns);

      return {
        ...item,
        x: startX + column * (cellWidth + gap),
        y: startY + row * (cellHeight + gap),
      };
    }),
  };
}

export function insertAssetIntoGrid(project: Project, sourceImageId: string, index: number): Project {
  const activeVersion = getActiveVersion(project);
  const existingPostId = activeVersion.postOrder[index];
  const existingPost = existingPostId ? project.posts.find((post) => post.id === existingPostId) : undefined;

  if (existingPost?.locked) {
    return project;
  }

  const post: Post = {
    id: createId("post"),
    kind: "single",
    priority: project.posts.length + 1,
    status: "draft",
    locked: false,
    slides: [createSlide(sourceImageId)],
  };

  return insertPost(project, post, index);
}

export function replaceAssetInGridSlot(project: Project, sourceImageId: string, index: number): Project {
  const activeVersion = getActiveVersion(project);
  const postOrder = [...activeVersion.postOrder];
  const boundedIndex = Math.max(0, index);

  while (postOrder.length <= boundedIndex) {
    postOrder.push(null);
  }

  const targetPostId = postOrder[boundedIndex];
  const targetPost = targetPostId ? project.posts.find((post) => post.id === targetPostId) : undefined;

  if (targetPost?.locked) {
    return project;
  }

  const post: Post = {
    id: createId("post"),
    kind: "single",
    priority: project.posts.length + 1,
    status: "draft",
    locked: false,
    slides: [createSlide(sourceImageId)],
  };

  postOrder[boundedIndex] = post.id;

  const nextProject = updateActiveVersion(project, { ...activeVersion, postOrder });
  const referencedPostIds = new Set(
    nextProject.versions.flatMap((version) => version.postOrder.filter(Boolean) as string[]),
  );
  const keptPosts = unlinkMosaicSlots(
    nextProject.posts.filter((candidate) => referencedPostIds.has(candidate.id)),
    [boundedIndex],
    new Set(postOrder.filter(Boolean) as string[]),
  );
  const projectWithPosts = {
    ...nextProject,
    posts: [...keptPosts, post],
  };
  const referencedSourceImageIds = getReferencedSourceImageIds({
    canvasItems: projectWithPosts.canvasItems,
    posts: projectWithPosts.posts,
  });

  return {
    ...projectWithPosts,
    assets: projectWithPosts.assets.filter((asset) => referencedSourceImageIds.has(asset.id)),
  };
}

export function insertAssetAcrossGridSlots(
  project: Project,
  sourceImageId: string,
  slotIndexes: number[],
  crops: CropState[],
): Project {
  const uniqueSlotIndexes = [...new Set(slotIndexes)]
    .filter((slotIndex) => slotIndex >= 0)
    .sort((left, right) => left - right);

  if (uniqueSlotIndexes.length < 2 || crops.length !== uniqueSlotIndexes.length) {
    return project;
  }

  const activeVersion = getActiveVersion(project);
  const postOrder = [...activeVersion.postOrder];

  while (postOrder.length <= uniqueSlotIndexes[uniqueSlotIndexes.length - 1]) {
    postOrder.push(null);
  }

  const targetPostIds = uniqueSlotIndexes
    .map((slotIndex) => postOrder[slotIndex])
    .filter(Boolean) as string[];
  const hasLockedTarget = targetPostIds.some(
    (postId) => project.posts.find((post) => post.id === postId)?.locked,
  );

  if (hasLockedTarget) {
    return project;
  }

  const mosaicGroup = {
    id: `mosaic_${sourceImageId}_${uniqueSlotIndexes.join("_")}`,
    sourceImageId,
    slotIndexes: uniqueSlotIndexes,
  };
  const nextPosts: Post[] = uniqueSlotIndexes.map((slotIndex, index) => ({
    id: createId("post"),
    kind: "single",
    priority: project.posts.length + index + 1,
    status: "draft",
    locked: false,
    mosaicGroup,
    slides: [
      {
        id: createId("slide"),
        sourceImageId,
        crop: crops[index],
      },
    ],
  }));

  uniqueSlotIndexes.forEach((slotIndex, index) => {
    postOrder[slotIndex] = nextPosts[index].id;
  });

  const nextProject = updateActiveVersion(project, { ...activeVersion, postOrder });
  const referencedPostIds = new Set(
    nextProject.versions.flatMap((version) => version.postOrder.filter(Boolean) as string[]),
  );
  const keptPosts = unlinkMosaicSlots(
    nextProject.posts.filter(
      (post) => referencedPostIds.has(post.id),
    ),
    uniqueSlotIndexes,
    new Set(postOrder.filter(Boolean) as string[]),
  );
  const projectWithPosts = {
    ...nextProject,
    posts: [...keptPosts, ...nextPosts],
  };
  const referencedSourceImageIds = getReferencedSourceImageIds({
    canvasItems: projectWithPosts.canvasItems,
    posts: projectWithPosts.posts,
  });

  return {
    ...projectWithPosts,
    assets: projectWithPosts.assets.filter((asset) => referencedSourceImageIds.has(asset.id)),
  };
}

export function reorderActiveGrid(project: Project, fromIndex: number, toIndex: number): Project {
  const activeVersion = getActiveVersion(project);
  const movingPostId = activeVersion.postOrder[fromIndex];
  const targetPostId = activeVersion.postOrder[toIndex];
  const movingPost = movingPostId ? project.posts.find((post) => post.id === movingPostId) : undefined;
  const targetPost = targetPostId ? project.posts.find((post) => post.id === targetPostId) : undefined;

  if (movingPost?.locked || targetPost?.locked) {
    return project;
  }

  const postOrder = moveItem(activeVersion.postOrder, fromIndex, toIndex);

  return updateActiveVersion(project, { ...activeVersion, postOrder });
}

export function movePostToGridSlot(project: Project, fromIndex: number, toIndex: number): Project {
  if (fromIndex === toIndex) {
    return project;
  }

  const activeVersion = getActiveVersion(project);
  const postOrder = [...activeVersion.postOrder];
  const boundedFromIndex = Math.max(0, fromIndex);
  const boundedToIndex = Math.max(0, toIndex);

  while (postOrder.length <= Math.max(boundedFromIndex, boundedToIndex)) {
    postOrder.push(null);
  }

  const movingPostId = postOrder[boundedFromIndex];
  if (!movingPostId) {
    return project;
  }

  const movingPost = project.posts.find((post) => post.id === movingPostId);
  const targetPostId = postOrder[boundedToIndex];
  const targetPost = targetPostId ? project.posts.find((post) => post.id === targetPostId) : undefined;

  if (movingPost?.locked || targetPost?.locked) {
    return project;
  }

  postOrder[boundedFromIndex] = postOrder[boundedToIndex] ?? null;
  postOrder[boundedToIndex] = movingPostId;

  return updateActiveVersion(project, { ...activeVersion, postOrder });
}

export function removePostFromGridSlot(project: Project, index: number): Project {
  const activeVersion = getActiveVersion(project);
  const postOrder = [...activeVersion.postOrder];

  if (!postOrder[index]) {
    return project;
  }

  const removingPost = project.posts.find((post) => post.id === postOrder[index]);
  if (removingPost?.locked) {
    return project;
  }

  postOrder[index] = null;
  const nextProject = updateActiveVersion(project, { ...activeVersion, postOrder });
  const referencedPostIds = new Set(
    nextProject.versions.flatMap((version) => version.postOrder.filter(Boolean) as string[]),
  );
  const nextPosts = nextProject.posts.filter((post) => referencedPostIds.has(post.id));
  const referencedSourceImageIds = getReferencedSourceImageIds({
    canvasItems: nextProject.canvasItems,
    posts: nextPosts,
  });

  return {
    ...nextProject,
    posts: nextPosts,
    assets: nextProject.assets.filter((asset) => referencedSourceImageIds.has(asset.id)),
  };
}

export function clearActiveGrid(project: Project): Project {
  const activeVersion = getActiveVersion(project);
  const lockedPostIds = new Set(project.posts.filter((post) => post.locked).map((post) => post.id));
  const clearedSlotIndexes: number[] = [];
  const postOrder = activeVersion.postOrder.map((postId, index) => {
    if (postId && !lockedPostIds.has(postId)) {
      clearedSlotIndexes.push(index);
      return null;
    }

    return postId;
  });
  const nextProject = updateActiveVersion(project, {
    ...activeVersion,
    postOrder,
  });
  const referencedPostIds = new Set(
    nextProject.versions.flatMap((version) => version.postOrder.filter(Boolean) as string[]),
  );
  const nextPosts = unlinkMosaicSlots(
    nextProject.posts.filter((post) => referencedPostIds.has(post.id)),
    clearedSlotIndexes,
    new Set(postOrder.filter(Boolean) as string[]),
  );
  const referencedSourceImageIds = getReferencedSourceImageIds({
    canvasItems: nextProject.canvasItems,
    posts: nextPosts,
  });

  return {
    ...nextProject,
    posts: nextPosts,
    assets: nextProject.assets.filter((asset) => referencedSourceImageIds.has(asset.id)),
  };
}

export function setSlideCrop(project: Project, slideId: string, crop: CropState): Project {
  return {
    ...touch(project),
    posts: project.posts.map((post) => ({
      ...post,
      slides: post.slides.map((slide) => (slide.id === slideId ? { ...slide, crop } : slide)),
    })),
  };
}

export function updateSlideBackground(
  project: Project,
  slideId: string,
  patch: SlideBackgroundPatch,
): Project {
  return {
    ...touch(project),
    posts: project.posts.map((post) => ({
      ...post,
      slides: post.slides.map((slide) =>
        slide.id === slideId
          ? {
              ...slide,
              background: {
                type: "solid",
                color: "#000000",
                ...(slide.background ?? {}),
                ...patch,
              },
            }
          : slide,
      ),
    })),
  };
}

export function addTextElementToSlide(
  project: Project,
  slideId: string,
  input: Partial<Pick<SlideTextElement, "id" | "x" | "y" | "width" | "height" | "content">> = {},
): Project {
  const textElement: SlideTextElement = {
    id: input.id ?? createId("element"),
    type: "text",
    x: input.x ?? 0.12,
    y: input.y ?? 0.18,
    width: input.width ?? 0.76,
    height: input.height ?? 0.18,
    content: input.content ?? "Double-click to edit",
    style: {
      fontFamily: "Inter, Arial, sans-serif",
      fontSize: 72,
      fontWeight: 700,
      color: "#f8fafc",
      textAlign: "center",
      lineHeight: 1.05,
    },
  };

  return {
    ...touch(project),
    posts: project.posts.map((post) => ({
      ...post,
      slides: post.slides.map((slide) =>
        slide.id === slideId
          ? {
              ...slide,
              elements: [...(slide.elements ?? []), textElement],
            }
          : slide,
      ),
    })),
  };
}

export function updateSlideElement(
  project: Project,
  slideId: string,
  elementId: string,
  patch: SlideTextElementPatch,
): Project {
  return {
    ...touch(project),
    posts: project.posts.map((post) => ({
      ...post,
      slides: post.slides.map((slide) =>
        slide.id === slideId
          ? {
              ...slide,
              elements: (slide.elements ?? []).map((element) =>
                element.id === elementId
                  ? {
                      ...element,
                      ...patch,
                      style: patch.style ? { ...element.style, ...patch.style } : element.style,
                    }
                  : element,
              ),
            }
          : slide,
      ),
    })),
  };
}

export function removeSlideElement(project: Project, slideId: string, elementId: string): Project {
  return {
    ...touch(project),
    posts: project.posts.map((post) => ({
      ...post,
      slides: post.slides.map((slide) =>
        slide.id === slideId
          ? {
              ...slide,
              elements: (slide.elements ?? []).filter((element) => element.id !== elementId),
            }
          : slide,
      ),
    })),
  };
}

export function duplicateSlideElement(project: Project, slideId: string, elementId: string): Project {
  return {
    ...touch(project),
    posts: project.posts.map((post) => ({
      ...post,
      slides: post.slides.map((slide) => {
        if (slide.id !== slideId) {
          return slide;
        }

        const elements = slide.elements ?? [];
        const elementIndex = elements.findIndex((element) => element.id === elementId);
        const sourceElement = elements[elementIndex];

        if (!sourceElement) {
          return slide;
        }

        const duplicatedElement: SlideElement = {
          ...cloneSlideElement(sourceElement),
          x: Number(Math.min(1 - sourceElement.width, sourceElement.x + 0.04).toFixed(4)),
          y: Number(Math.min(1 - sourceElement.height, sourceElement.y + 0.04).toFixed(4)),
        };
        const nextElements = [...elements];
        nextElements.splice(elementIndex + 1, 0, duplicatedElement);

        return {
          ...slide,
          elements: nextElements,
        };
      }),
    })),
  };
}

export function moveSlideElement(project: Project, slideId: string, elementId: string, toIndex: number): Project {
  return {
    ...touch(project),
    posts: project.posts.map((post) => ({
      ...post,
      slides: post.slides.map((slide) => {
        if (slide.id !== slideId) {
          return slide;
        }

        const elements = slide.elements ?? [];
        const fromIndex = elements.findIndex((element) => element.id === elementId);

        if (fromIndex < 0) {
          return slide;
        }

        return {
          ...slide,
          elements: moveItem(elements, fromIndex, toIndex),
        };
      }),
    })),
  };
}

export function applySlideTemplate(
  project: Project,
  slideId: string,
  template: { id: string; elements: SlideElement[] },
): Project {
  return {
    ...touch(project),
    posts: project.posts.map((post) => ({
      ...post,
      slides: post.slides.map((slide) =>
        slide.id === slideId
          ? {
              ...slide,
              templateId: template.id,
              elements: template.elements.map(cloneSlideElement),
            }
          : slide,
      ),
    })),
  };
}

export function rotateSlideCrop(project: Project, slideId: string, direction: -1 | 1): Project {
  return {
    ...touch(project),
    posts: project.posts.map((post) => ({
      ...post,
      slides: post.slides.map((slide) =>
        slide.id === slideId
          ? {
              ...slide,
              crop: {
                ...slide.crop,
                x: 0,
                y: 0,
                rotation: normalizeRotation(slide.crop.rotation + direction * 90),
              },
            }
          : slide,
      ),
    })),
  };
}

export function convertPostToCarousel(project: Project, postId: string): Project {
  return {
    ...touch(project),
    posts: project.posts.map((post) =>
      post.id === postId ? { ...post, kind: "carousel" } : post,
    ),
  };
}

export function addSlideToPost(project: Project, postId: string, sourceImageId: string): Project {
  return {
    ...touch(project),
    posts: project.posts.map((post) =>
      post.id === postId
        ? {
            ...post,
            kind: "carousel",
            slides: [...post.slides, createSlide(sourceImageId)],
          }
        : post,
    ),
  };
}

export function duplicateSlideInPost(project: Project, postId: string, slideId: string): Project {
  return {
    ...touch(project),
    posts: project.posts.map((post) => {
      if (post.id !== postId) {
        return post;
      }

      const slideIndex = post.slides.findIndex((slide) => slide.id === slideId);
      const slide = post.slides[slideIndex];
      if (!slide) {
        return post;
      }

      const nextSlides = [...post.slides];
      nextSlides.splice(slideIndex + 1, 0, {
        ...slide,
        id: createId("slide"),
        crop: { ...slide.crop },
      });

      return { ...post, kind: "carousel", slides: nextSlides };
    }),
  };
}

export function removeSlideFromPost(project: Project, postId: string, slideId: string): Project {
  const nextPosts = project.posts.map((post) => {
    if (post.id !== postId || post.slides.length <= 1) {
      return post;
    }

    return {
      ...post,
      slides: post.slides.filter((slide) => slide.id !== slideId),
    };
  });
  const referencedSourceImageIds = getReferencedSourceImageIds({
    canvasItems: project.canvasItems,
    posts: nextPosts,
  });

  return {
    ...touch(project),
    posts: nextPosts,
    assets: project.assets.filter((asset) => referencedSourceImageIds.has(asset.id)),
  };
}

export function moveSlideInPost(project: Project, postId: string, fromIndex: number, toIndex: number): Project {
  return {
    ...touch(project),
    posts: project.posts.map((post) =>
      post.id === postId
        ? {
            ...post,
            kind: "carousel",
            slides: moveItem(post.slides, fromIndex, toIndex),
          }
        : post,
    ),
  };
}

export function replacePostSlides(project: Project, postId: string, slides: Slide[]): Project {
  const nextPosts = project.posts.map((post) =>
    post.id === postId
      ? {
          ...post,
          kind: "carousel" as const,
          slides: slides.length > 0 ? slides : post.slides,
        }
      : post,
  );
  const referencedSourceImageIds = getReferencedSourceImageIds({
    canvasItems: project.canvasItems,
    posts: nextPosts,
  });

  return {
    ...touch(project),
    posts: nextPosts,
    assets: project.assets.filter((asset) => referencedSourceImageIds.has(asset.id)),
  };
}

export function duplicateActiveGridVersion(project: Project, name: string, now = new Date().toISOString()): Project {
  const activeVersion = getActiveVersion(project);
  const nextVersion: GridVersion = {
    id: createId("version"),
    name,
    postOrder: [...activeVersion.postOrder],
    createdAt: now,
  };

  return {
    ...touch(project, now),
    activeVersionId: nextVersion.id,
    versions: [...project.versions, nextVersion],
  };
}

export function deleteGridVersion(project: Project, versionId: string, now = new Date().toISOString()): Project {
  if (project.versions.length <= 1) {
    return project;
  }

  const versionIndex = project.versions.findIndex((version) => version.id === versionId);

  if (versionIndex < 0) {
    return project;
  }

  const nextVersions = project.versions.filter((version) => version.id !== versionId);
  const fallbackVersion = nextVersions[Math.max(0, versionIndex - 1)] ?? nextVersions[0];
  const referencedPostIds = new Set(
    nextVersions.flatMap((version) => version.postOrder.filter(Boolean) as string[]),
  );
  const nextPosts = project.posts.filter((post) => referencedPostIds.has(post.id));
  const referencedSourceImageIds = getReferencedSourceImageIds({
    canvasItems: project.canvasItems,
    posts: nextPosts,
  });

  return {
    ...touch(project, now),
    activeVersionId: project.activeVersionId === versionId ? fallbackVersion.id : project.activeVersionId,
    versions: nextVersions,
    posts: nextPosts,
    assets: project.assets.filter((asset) => referencedSourceImageIds.has(asset.id)),
  };
}

export function setActiveGridVersion(project: Project, versionId: string): Project {
  if (project.activeVersionId === versionId) {
    return project;
  }

  if (!project.versions.some((version) => version.id === versionId)) {
    return project;
  }

  return {
    ...touch(project),
    activeVersionId: versionId,
  };
}

export function togglePostLock(project: Project, postId: string): Project {
  return {
    ...touch(project),
    posts: project.posts.map((post) =>
      post.id === postId ? { ...post, locked: !post.locked } : post,
    ),
  };
}

function insertPost(project: Project, post: Post, index: number): Project {
  const activeVersion = getActiveVersion(project);
  const postOrder = [...activeVersion.postOrder];
  const boundedIndex = Math.max(0, index);

  while (postOrder.length <= boundedIndex) {
    postOrder.push(null);
  }

  if (postOrder[boundedIndex]) {
    postOrder.splice(boundedIndex, 0, post.id);
  } else {
    postOrder[boundedIndex] = post.id;
  }

  return {
    ...updateActiveVersion(project, { ...activeVersion, postOrder }),
    posts: [...project.posts, post],
  };
}

function unlinkMosaicSlots(posts: Post[], slotIndexes: number[], affectedPostIds: Set<string>): Post[] {
  const replacedSlotIndexes = new Set(slotIndexes);

  return posts.map((post) => {
    if (!post.mosaicGroup || !affectedPostIds.has(post.id)) {
      return post;
    }

    const nextSlotIndexes = post.mosaicGroup.slotIndexes.filter(
      (slotIndex) => !replacedSlotIndexes.has(slotIndex),
    );

    if (nextSlotIndexes.length === post.mosaicGroup.slotIndexes.length) {
      return post;
    }

    if (nextSlotIndexes.length < 2) {
      const { mosaicGroup: _mosaicGroup, ...postWithoutMosaicGroup } = post;
      return postWithoutMosaicGroup;
    }

    return {
      ...post,
      mosaicGroup: {
        ...post.mosaicGroup,
        slotIndexes: nextSlotIndexes,
      },
    };
  });
}

function createSlide(sourceImageId: string): Slide {
  return {
    id: createId("slide"),
    sourceImageId,
    crop: { ...defaultCrop },
    elements: [],
  };
}

function cloneSlideElement(element: SlideElement): SlideElement {
  return {
    ...element,
    id: createId("element"),
    style: { ...element.style },
  };
}

function getActiveVersion(project: Project): GridVersion {
  const activeVersion = project.versions.find((version) => version.id === project.activeVersionId);

  if (!activeVersion) {
    throw new Error(`Active grid version not found: ${project.activeVersionId}`);
  }

  return activeVersion;
}

function updateActiveVersion(project: Project, nextVersion: GridVersion): Project {
  return {
    ...touch(project),
    versions: project.versions.map((version) =>
      version.id === nextVersion.id ? nextVersion : version,
    ),
  };
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex) {
    return [...items];
  }

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, movedItem);
  return nextItems;
}

function getReferencedSourceImageIds(input: {
  canvasItems: CanvasItem[];
  posts: Post[];
}): Set<string> {
  return new Set([
    ...input.canvasItems.map((item) => item.sourceImageId),
    ...input.posts.flatMap((post) => post.slides.map((slide) => slide.sourceImageId)),
  ]);
}

function touch(project: Project, updatedAt = new Date().toISOString()): Project {
  return {
    ...project,
    updatedAt,
  };
}

function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function normalizeRotation(rotation: number): number {
  return ((rotation % 360) + 360) % 360;
}
