import {
  AlignStartHorizontal,
  ChevronDown,
  Copy,
  Download,
  Files,
  Expand,
  FolderOpen,
  ImagePlus,
  Lock,
  HelpCircle,
  Minus,
  Moon,
  PanelLeft,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  Save,
  ScanLine,
  Sun,
  Trash2,
  Undo2,
  Unlock,
} from "lucide-react";
import { memo, startTransition, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type {
  CSSProperties,
  ChangeEvent,
  DragEvent,
  PointerEvent as ReactPointerEvent,
  WheelEvent,
} from "react";
import {
  deleteUnreferencedAssetBlobs,
  loadAssetBlob,
  loadAssetPreviewUrls,
  saveAssetBlob,
} from "./features/assets/assetBlobStore";
import { clampCropOffset } from "./features/crop/cropBounds";
import {
  createBatchExportFilename,
  createCarouselExportFilename,
  createExportFilename,
  getExportPreset,
} from "./features/export/exportPresets";
import { drawCroppedImageOnCanvas, renderSlideExport } from "./features/export/exportRenderer";
import { getSlideQualityPreflight, type SlideQualityPreflight } from "./features/quality/qualityPreflight";
import {
  addSourceAsset,
  addSlideToPost,
  autoArrangeCanvasItems,
  clearActiveGrid,
  convertPostToCarousel,
  createEmptyProject,
  deleteGridVersion,
  defaultCrop,
  duplicateActiveGridVersion,
  duplicateSlideInPost,
  insertAssetAcrossGridSlots,
  moveCanvasItems,
  movePostToGridSlot,
  replaceAssetInGridSlot,
  moveSlideInPost,
  removeCanvasItems,
  removePostFromGridSlot,
  removeSlideFromPost,
  replacePostSlides,
  rotateSlideCrop,
  setActiveGridVersion,
  setSlideCrop,
  setCanvasItemPosition,
  togglePostLock,
} from "./features/project/projectReducer";
import {
  blobToDataUrl,
  createProjectPackage,
  dataUrlToBlob,
  getProjectPackageFilename,
  parseProjectPackage,
  projectPackageMimeType,
  serializeProjectPackage,
} from "./features/project/projectPackage";
import {
  createProjectSession,
  loadProjectSession,
  saveProjectSession,
} from "./features/project/projectPersistence";
import {
  createGridMosaicSplitCrops,
  createSplitCrops,
  inferSplitDirection,
  type SplitDirection,
} from "./features/splitter/longImageSplitter";
import { FeatureTour, type TourStep } from "./features/tour/FeatureTour";
import type { CanvasItem, MosaicGroup, Project, Slide, SourceAsset } from "./lib/types";
import type { AspectRatio, ExportFormat } from "./lib/types";
import type { SlotSize } from "./features/export/exportPresets";

const aspectModes: AspectRatio[] = ["4:5", "3:4", "1:1"];
const exportFormats: ExportFormat[] = ["jpeg", "png"];
const exportSizeByAspect: Record<AspectRatio, string> = {
  "4:5": "1080 x 1350",
  "3:4": "1080 x 1440",
  "1:1": "1080 x 1080",
};
const cssAspectByMode: Record<AspectRatio, string> = {
  "4:5": "4 / 5",
  "3:4": "3 / 4",
  "1:1": "1 / 1",
};
const themeStorageKey = "instasetka.theme";
const workspaceSplitStorageKey = "instasetka.workspaceSplit";
const gridZoomStorageKey = "instasetka.gridZoom";
const tourSeenStorageKey = "instasetka.tourSeen";
const minWorkspaceSplit = 34;
const maxWorkspaceSplit = 72;
const fallbackQualitySlotSize: SlotSize = { width: 400, height: 500 };
const quickTourSteps: TourStep[] = [
  {
    id: "import",
    target: "[data-tour='import']",
    eyebrow: "Quick Start",
    title: "Bring images in",
    body: "Import JPEG or PNG files, or drag them directly onto the source canvas.",
    placement: "bottom",
  },
  {
    id: "source-canvas",
    target: "[data-tour='source-canvas']",
    eyebrow: "Quick Start",
    title: "Collect before you commit",
    body: "Use this workspace to compare candidates before they enter the feed. Drag on empty space for lasso selection; Alt+drag pans.",
    placement: "right",
  },
  {
    id: "grid",
    target: "[data-tour='grid']",
    eyebrow: "Quick Start",
    title: "Build the final order",
    body: "Drag images from the source canvas into exact grid slots. Drag filled slots to reorder posts.",
    placement: "left",
  },
  {
    id: "canvas-tools",
    target: "[data-tour='canvas-tools']",
    eyebrow: "Quick Start",
    title: "Keep the board tidy",
    body: "Fit all, auto-arrange, or delete selected source images without touching the final feed.",
    placement: "bottom",
  },
  {
    id: "aspect",
    target: "[data-tour='aspect']",
    eyebrow: "Quick Start",
    title: "Switch Instagram ratios",
    body: "Move between 4:5, 3:4, and 1:1. Crops stay proportional instead of stretching the image.",
    placement: "bottom",
  },
  {
    id: "quality",
    target: "[data-tour='quality']",
    eyebrow: "Quick Start",
    title: "Check quality",
    body: "Quality map flags weak crops or sources before you render files for Instagram.",
    placement: "bottom",
  },
  {
    id: "export",
    target: "[data-tour='export']",
    eyebrow: "Quick Start",
    title: "Render the result",
    body: "Export the selected post, batch render the whole feed, or save a snapshot preview.",
    placement: "bottom",
  },
];

const advancedTourSteps: TourStep[] = [
  {
    id: "project-bar",
    target: "[data-tour='project-bar']",
    eyebrow: "Advanced",
    title: "Grouped command bar",
    body: "The top bar is grouped by workflow: history, project, format, versions, import, and export.",
    placement: "bottom",
  },
  {
    id: "history-theme",
    target: "[data-tour='history-theme']",
    eyebrow: "Advanced",
    title: "Undo and redo",
    body: "Use the arrow buttons or Ctrl+Z / Ctrl+Y while you experiment with crops, order, and versions.",
    placement: "bottom",
  },
  {
    id: "project-menu",
    target: "[data-tour='project-menu']",
    eyebrow: "Advanced",
    title: "Project menu",
    body: "Save or open editable InstaSetka projects, duplicate the current version, switch theme, or restart this tour.",
    placement: "bottom",
  },
  {
    id: "export-format",
    target: "[data-tour='export-format']",
    eyebrow: "Advanced",
    title: "Choose JPEG or PNG",
    body: "JPEG is the practical Instagram default. PNG is there when you need lossless output from the editor.",
    placement: "bottom",
  },
  {
    id: "versions",
    target: "[data-tour='versions']",
    eyebrow: "Advanced",
    title: "Draft versions",
    body: "Switch between saved grid drafts or press plus to create a new draft from the current arrangement.",
    placement: "bottom",
  },
  {
    id: "divider",
    target: "[data-tour='divider']",
    eyebrow: "Advanced",
    title: "Resize the two workspaces",
    body: "Drag the divider when you want more room for the source board or more room for the final grid.",
    placement: "right",
  },
  {
    id: "grid-zoom",
    target: "[data-tour='grid-zoom']",
    eyebrow: "Advanced",
    title: "Zoom the feed view",
    body: "Use fit or zoom controls to switch between detailed crop work and a wider overview of the feed.",
    placement: "bottom",
  },
  {
    id: "mosaic",
    target: "[data-tour='grid']",
    eyebrow: "Advanced",
    title: "Split one image across slots",
    body: "Ctrl-click grid slots in the order you want, then drag one image onto the selected slots for a continuous split.",
    placement: "bottom",
  },
  {
    id: "crop-panel",
    target: "[data-tour='crop-panel']",
    eyebrow: "Advanced",
    title: "Tune the selected post",
    body: "After selecting a grid post, adjust zoom here. Double-click the image itself to enter or leave crop-drag mode.",
    placement: "bottom",
  },
  {
    id: "carousel",
    target: "[data-tour='carousel']",
    eyebrow: "Advanced",
    title: "Build multi-slide posts",
    body: "Use Carousel to turn a single post into slides, reorder them, or split one long image into a carousel.",
    placement: "bottom",
  },
  {
    id: "export-options",
    target: "[data-tour='export']",
    eyebrow: "Advanced",
    title: "Export options",
    body: "Export renders the selected post. Open the arrow menu for batch render or one PNG feed snapshot.",
    placement: "bottom",
  },
  {
    id: "clear-grid",
    target: "[data-tour='clear-grid']",
    eyebrow: "Advanced",
    title: "Clear the active grid",
    body: "Clear grid removes posts from the active draft after confirmation while keeping source canvas images available.",
    placement: "bottom",
  },
];

type QualityMapIssue = {
  id: string;
  slotIndex: number;
  postId?: string;
  slideId?: string;
  severity: "warning" | "error";
  title: string;
  detail: string;
};

type AutosaveStatus = "loading" | "saved" | "saving" | "unsaved" | "missing-assets" | "error";

type ProjectHistory = {
  past: Project[];
  future: Project[];
};

type CanvasSelectionRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type CanvasSelectionUpdater = string[] | ((currentIds: string[]) => string[]);

type CanvasSelectionStore = {
  getSnapshot: () => string[];
  setSelection: (nextIds: string[]) => boolean;
  subscribe: (listener: () => void) => () => void;
};

type GridDropHint = {
  label: string;
  x: number;
  y: number;
};

type TourMode = "quick" | "advanced";

type WritableFileHandle = {
  createWritable: () => Promise<{
    write: (blob: Blob) => Promise<void>;
    close: () => Promise<void>;
  }>;
};

type WritableDirectoryHandle = {
  getDirectoryHandle: (
    name: string,
    options?: { create?: boolean },
  ) => Promise<WritableDirectoryHandle>;
  getFileHandle: (name: string, options?: { create?: boolean }) => Promise<WritableFileHandle>;
};

type DirectoryPickerWindow = Window &
  typeof globalThis & {
    showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<WritableDirectoryHandle>;
    showSaveFilePicker?: (options?: {
      suggestedName?: string;
      types?: Array<{
        description: string;
        accept: Record<string, string[]>;
      }>;
    }) => Promise<WritableFileHandle>;
  };

export function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const packageInputRef = useRef<HTMLInputElement>(null);
  const projectMenuRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const canvasBoardRef = useRef<HTMLDivElement>(null);
  const canvasLayerRef = useRef<HTMLDivElement>(null);
  const canvasSelectionRectRef = useRef<HTMLDivElement>(null);
  const canvasSelectionStoreRef = useRef(createCanvasSelectionStore());
  const gridViewportRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const lastGridPointerRef = useRef<{ slotIndex: number; time: number } | null>(null);
  const autosaveReadyRef = useRef(false);
  const autosaveTimerRef = useRef<number | null>(null);
  const [project, setProject] = useState<Project>(() =>
    createEmptyProject("2026-05-31T00:00:00.000Z"),
  );
  const [projectHistory, setProjectHistory] = useState<ProjectHistory>({ past: [], future: [] });
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>("loading");
  const [hasSelectedCanvasItems, setHasSelectedCanvasItems] = useState(false);
  const [gridDropHint, setGridDropHint] = useState<GridDropHint | null>(null);
  const [selectedGridSlotIndex, setSelectedGridSlotIndex] = useState<number | null>(null);
  const [selectedGridSpanIndexes, setSelectedGridSpanIndexes] = useState<number[]>([]);
  const [selectedCarouselSlideId, setSelectedCarouselSlideId] = useState<string | null>(null);
  const [carouselEditorPostId, setCarouselEditorPostId] = useState<string | null>(null);
  const [draggingGridSlotIndex, setDraggingGridSlotIndex] = useState<number | null>(null);
  const [draggingCarouselSlideIndex, setDraggingCarouselSlideIndex] = useState<number | null>(null);
  const [cropEditSlotIndex, setCropEditSlotIndex] = useState<number | null>(null);
  const [canvasView, setCanvasView] = useState({ x: 0, y: 0, zoom: 1 });
  const [activeAspectRatio, setActiveAspectRatio] = useState<AspectRatio>("4:5");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("jpeg");
  const [exportStatus, setExportStatus] = useState("Ready to export");
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [qualityMapOpen, setQualityMapOpen] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [tourMode, setTourMode] = useState<TourMode>("quick");
  const [splitCount, setSplitCount] = useState(3);
  const [splitDirection, setSplitDirection] = useState<"auto" | SplitDirection>("auto");
  const [gridZoom, setGridZoom] = useState(() => {
    const savedZoom = Number(window.localStorage.getItem(gridZoomStorageKey));
    return Number.isFinite(savedZoom) ? clamp(savedZoom, 0.35, 1.4) : 1;
  });
  const [workspaceSplit, setWorkspaceSplit] = useState(() => {
    const savedSplit = Number(window.localStorage.getItem(workspaceSplitStorageKey));
    return Number.isFinite(savedSplit)
      ? clamp(savedSplit, minWorkspaceSplit, maxWorkspaceSplit)
      : 58;
  });
  const [selectedSlotSize, setSelectedSlotSize] = useState<SlotSize | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const savedTheme = window.localStorage.getItem(themeStorageKey);
    return savedTheme === "light" || savedTheme === "dark" ? savedTheme : "dark";
  });
  const isDark = theme === "dark";
  const hasImportedImages = project.canvasItems.length > 0;
  const sourceAssetById = useMemo(
    () => new Map(project.assets.map((asset) => [asset.id, asset])),
    [project.assets],
  );
  const postById = useMemo(() => new Map(project.posts.map((post) => [post.id, post])), [project.posts]);
  const activeGridVersion = project.versions.find((version) => version.id === project.activeVersionId);
  const gridPosts = activeGridVersion
    ? activeGridVersion.postOrder.map((postId) => (postId ? postById.get(postId) : undefined))
    : [];
  const gridSlots = Array.from({ length: Math.max(12, gridPosts.length + 3) }, (_, index) => ({
    index,
    post: gridPosts[index],
  }));
  const selectedGridPost =
    selectedGridSlotIndex !== null ? gridSlots[selectedGridSlotIndex]?.post : undefined;
  const selectedCarouselPost = selectedGridPost?.kind === "carousel" ? selectedGridPost : undefined;
  const carouselMode = Boolean(
    selectedCarouselPost && selectedCarouselPost.id === carouselEditorPostId,
  );
  const selectedCarouselSlide =
    carouselMode
      ? selectedCarouselPost?.slides.find((slide) => slide.id === selectedCarouselSlideId) ??
        selectedCarouselPost?.slides[0]
      : undefined;
  const selectedSlide = carouselMode ? selectedCarouselSlide : selectedGridPost?.slides[0];
  const selectedSlideIndex =
    carouselMode && selectedCarouselPost && selectedSlide
      ? selectedCarouselPost.slides.findIndex((slide) => slide.id === selectedSlide.id)
      : 0;
  const canUndo = projectHistory.past.length > 0;
  const canRedo = projectHistory.future.length > 0;
  const selectedQuality = useMemo<SlideQualityPreflight | null>(() => {
    if (!selectedSlide || !selectedSlotSize) {
      return null;
    }

    const sourceAsset = sourceAssetById.get(selectedSlide.sourceImageId);
    if (!sourceAsset) {
      return null;
    }

    return getSlideQualityPreflight({
      asset: sourceAsset,
      crop: selectedSlide.crop,
      slot: selectedSlotSize,
      aspectRatio: activeAspectRatio,
    });
  }, [activeAspectRatio, selectedSlide, selectedSlotSize, sourceAssetById]);

  function getSelectedCanvasItemIds() {
    return canvasSelectionStoreRef.current.getSnapshot();
  }

  function setSelectedCanvasItemIds(nextSelection: CanvasSelectionUpdater) {
    const currentIds = canvasSelectionStoreRef.current.getSnapshot();
    const nextIds =
      typeof nextSelection === "function" ? nextSelection(currentIds) : nextSelection;

    if (canvasSelectionStoreRef.current.setSelection(nextIds)) {
      setHasSelectedCanvasItems(nextIds.length > 0);
    }
  }

  const qualityMapIssues = useMemo<QualityMapIssue[]>(() => {
    const issues: QualityMapIssue[] = [];
    const sourceUseCounts = new Map<string, number>();
    const slotSize = selectedSlotSize ?? fallbackQualitySlotSize;

    for (const post of gridPosts) {
      for (const slide of post?.slides ?? []) {
        sourceUseCounts.set(slide.sourceImageId, (sourceUseCounts.get(slide.sourceImageId) ?? 0) + 1);
      }
    }

    for (const [slotIndex, post] of gridPosts.entries()) {
      if (!post) {
        continue;
      }

      for (const [slideIndex, slide] of post.slides.entries()) {
        const slideLabel = post.kind === "carousel" ? ` slide ${slideIndex + 1}` : "";
        const sourceAsset = sourceAssetById.get(slide.sourceImageId);
        if (!sourceAsset) {
          issues.push({
            id: `missing-${slotIndex}-${slideIndex}`,
            slotIndex,
            postId: post.id,
            slideId: slide.id,
            severity: "error",
            title: `Slot ${slotIndex + 1}${slideLabel}: Missing source`,
            detail: "Original image metadata is unavailable.",
          });
          continue;
        }

        const preflight = getSlideQualityPreflight({
          asset: sourceAsset,
          crop: slide.crop,
          slot: slotSize,
          aspectRatio: activeAspectRatio,
        });

        if (preflight.status === "warning") {
          issues.push({
            id: `quality-${slotIndex}-${slideIndex}`,
            slotIndex,
            postId: post.id,
            slideId: slide.id,
            severity: "warning",
            title: `Slot ${slotIndex + 1}${slideLabel}: ${preflight.label}`,
            detail: preflight.message,
          });
        }

        if ((sourceUseCounts.get(slide.sourceImageId) ?? 0) > 1) {
          issues.push({
            id: `duplicate-${slotIndex}-${slideIndex}`,
            slotIndex,
            postId: post.id,
            slideId: slide.id,
            severity: "warning",
            title: `Slot ${slotIndex + 1}${slideLabel}: Duplicate image`,
            detail: `${sourceAsset.name} is used more than once in this grid.`,
          });
        }
      }
    }

    return issues;
  }, [activeAspectRatio, gridPosts, selectedSlotSize, sourceAssetById]);

  useEffect(() => {
    let cancelled = false;
    const restoredSession = loadProjectSession(window.localStorage);

    async function restoreSession() {
      if (!restoredSession) {
        setAutosaveStatus("saved");
        autosaveReadyRef.current = true;
        return;
      }

      try {
        const restoredPreviewUrls = await loadAssetPreviewUrls(
          restoredSession.project.assets.map((asset) => asset.id),
        );

        if (cancelled) {
          revokePreviewUrls(restoredPreviewUrls);
          return;
        }

        setProject(restoredSession.project);
        resetProjectHistory();
        setActiveAspectRatio(restoredSession.activeAspectRatio);
        setExportFormat(restoredSession.exportFormat);
        setCanvasView(restoredSession.canvasView);
        setGridZoom(clamp(restoredSession.gridZoom, 0.35, 1.4));
        setWorkspaceSplit(clamp(restoredSession.workspaceSplit, minWorkspaceSplit, maxWorkspaceSplit));
        setPreviewUrls((current) => {
          revokePreviewUrls(current);
          return restoredPreviewUrls;
        });
        setExportStatus(`Restored autosave from ${formatAutosaveTime(restoredSession.savedAt)}`);
        setAutosaveStatus(
          Object.keys(restoredPreviewUrls).length === restoredSession.project.assets.length
            ? "saved"
            : "missing-assets",
        );
        autosaveReadyRef.current = true;
      } catch {
        if (!cancelled) {
          setAutosaveStatus("error");
          autosaveReadyRef.current = true;
        }
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!autosaveReadyRef.current) {
      return;
    }

    setAutosaveStatus("unsaved");

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      setAutosaveStatus("saving");
      try {
        saveProjectSession(
          window.localStorage,
          createProjectSession({
            project,
            activeAspectRatio,
            exportFormat,
            canvasView,
            gridZoom,
            workspaceSplit,
          }),
        );
        setAutosaveStatus(hasMissingPreviewAssets(project, previewUrls) ? "missing-assets" : "saved");
      } catch {
        setAutosaveStatus("error");
      }
    }, 450);

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [activeAspectRatio, canvasView, exportFormat, gridZoom, previewUrls, project, workspaceSplit]);

  useEffect(() => {
    window.localStorage.setItem(themeStorageKey, theme);
  }, [theme]);

  useEffect(() => {
    if (!window.localStorage.getItem(tourSeenStorageKey)) {
      const timerId = window.setTimeout(() => setIsTourOpen(true), 650);
      return () => window.clearTimeout(timerId);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(workspaceSplitStorageKey, String(workspaceSplit));
  }, [workspaceSplit]);

  useEffect(() => {
    window.localStorage.setItem(gridZoomStorageKey, String(gridZoom));
  }, [gridZoom]);

  useEffect(() => {
    if (!projectMenuOpen && !exportMenuOpen) {
      return;
    }

    function closeOpenMenus(event: MouseEvent) {
      const target = event.target as Node;
      if (!projectMenuRef.current?.contains(target)) {
        setProjectMenuOpen(false);
      }
      if (!exportMenuRef.current?.contains(target)) {
        setExportMenuOpen(false);
      }
    }

    function closeOpenMenusOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setProjectMenuOpen(false);
        setExportMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOpenMenus);
    document.addEventListener("keydown", closeOpenMenusOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeOpenMenus);
      document.removeEventListener("keydown", closeOpenMenusOnEscape);
    };
  }, [exportMenuOpen, projectMenuOpen]);

  useEffect(() => {
    if (selectedGridSlotIndex === null) {
      setSelectedSlotSize(null);
      return;
    }

    const slotElement = document.querySelector<HTMLElement>(
      `[data-grid-slot-index="${selectedGridSlotIndex}"]`,
    );
    setSelectedSlotSize(slotElement ? getUnscaledElementSize(slotElement) : null);
  }, [activeAspectRatio, gridZoom, project.posts, selectedGridSlotIndex, workspaceSplit]);

  useEffect(() => {
    if (!carouselMode || !selectedCarouselPost) {
      setSelectedCarouselSlideId(null);
      return;
    }

    const selectedSlideStillExists = selectedCarouselPost.slides.some(
      (slide) => slide.id === selectedCarouselSlideId,
    );
    if (!selectedSlideStillExists) {
      setSelectedCarouselSlideId(selectedCarouselPost.slides[0]?.id ?? null);
    }
  }, [carouselMode, selectedCarouselPost, selectedCarouselSlideId]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();

      if ((event.ctrlKey || event.metaKey) && key === "z") {
        if (isEditableEventTarget(event.target)) {
          return;
        }

        event.preventDefault();
        if (event.shiftKey) {
          redoProjectChange();
        } else {
          undoProjectChange();
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && key === "y") {
        if (isEditableEventTarget(event.target)) {
          return;
        }

        event.preventDefault();
        redoProjectChange();
        return;
      }

      if (event.key !== "Delete" && event.key !== "Backspace") {
        return;
      }

      if (isEditableEventTarget(event.target)) {
        return;
      }

      if (selectedGridPost && selectedGridSlotIndex !== null) {
        event.preventDefault();
        deleteSelectedGridPost();
        return;
      }

      if (hasSelectedCanvasItems) {
        event.preventDefault();
        deleteSelectedCanvasItems();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [projectHistory, hasSelectedCanvasItems, selectedGridPost, selectedGridSlotIndex]);

  async function importFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter((file) =>
      file.type === "image/jpeg" || file.type === "image/png",
    );

    if (files.length === 0) {
      return;
    }

    let nextProject = project;
    const nextPreviewUrls: Record<string, string> = {};

    for (const file of files) {
      const assetId = `asset_${crypto.randomUUID()}`;
      const canvasItemId = `canvas_${crypto.randomUUID()}`;
      const dimensions = await readImageDimensions(file);
      const asset: SourceAsset = {
        id: assetId,
        name: file.name,
        width: dimensions.width,
        height: dimensions.height,
        mimeType: file.type as SourceAsset["mimeType"],
      };
      await saveAssetBlob(assetId, file);
      const index = nextProject.canvasItems.length;
      const column = index % 4;
      const row = Math.floor(index / 4);
      const canvasItem: CanvasItem = {
        id: canvasItemId,
        sourceImageId: assetId,
        x: 36 + column * 210,
        y: 74 + row * 250,
        scale: 1,
        rotation: 0,
      };

      nextProject = addSourceAsset(nextProject, asset, canvasItem);
      nextPreviewUrls[assetId] = URL.createObjectURL(file);
    }

    commitProjectChange(nextProject);
    setPreviewUrls((current) => ({ ...current, ...nextPreviewUrls }));
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) {
      void importFiles(event.target.files);
      event.target.value = "";
    }
  }

  async function saveProjectPackageFile() {
    try {
      setExportStatus("Saving project package...");
      const packageAssets = await Promise.all(
        project.assets.map(async (asset) => {
          const blob = await loadAssetBlob(asset.id);
          if (!blob) {
            throw new Error(`Missing original image for ${asset.name}`);
          }

          return {
            id: asset.id,
            name: asset.name,
            mimeType: asset.mimeType,
            dataUrl: await blobToDataUrl(blob),
          };
        }),
      );
      const projectPackage = createProjectPackage({
        project,
        settings: {
          activeAspectRatio,
          exportFormat,
          canvasView,
          gridZoom,
          workspaceSplit,
        },
        assets: packageAssets,
      });
      const blob = new Blob([serializeProjectPackage(projectPackage)], {
        type: projectPackageMimeType,
      });

      await saveBlobWithDialog(blob, getProjectPackageFilename(project.name), [
        {
          description: "InstaSetka project",
          accept: { "application/json": [".instasetka"] },
        },
      ]);
      setExportStatus(`Saved ${getProjectPackageFilename(project.name)}`);
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : "Project save failed");
    }
  }

  async function openProjectPackageFile(file: File) {
    try {
      setExportStatus("Opening project package...");
      const projectPackage = parseProjectPackage(await file.text());

      await Promise.all(
        projectPackage.assets.map(async (asset) => {
          await saveAssetBlob(asset.id, await dataUrlToBlob(asset.dataUrl));
        }),
      );
      void deleteUnreferencedAssetBlobs(projectPackage.project.assets.map((asset) => asset.id));

      const restoredPreviewUrls = await loadAssetPreviewUrls(
        projectPackage.project.assets.map((asset) => asset.id),
      );

      setProject(projectPackage.project);
      resetProjectHistory();
      setActiveAspectRatio(projectPackage.settings.activeAspectRatio);
      setExportFormat(projectPackage.settings.exportFormat);
      setCanvasView(projectPackage.settings.canvasView);
      setGridZoom(clamp(projectPackage.settings.gridZoom, 0.35, 1.4));
      setWorkspaceSplit(
        clamp(projectPackage.settings.workspaceSplit, minWorkspaceSplit, maxWorkspaceSplit),
      );
      setSelectedCanvasItemIds([]);
      setSelectedGridSlotIndex(null);
      setSelectedCarouselSlideId(null);
      setCarouselEditorPostId(null);
      setCropEditSlotIndex(null);
      setPreviewUrls((current) => {
        revokePreviewUrls(current);
        return restoredPreviewUrls;
      });
      setExportStatus(`Opened ${file.name}`);
      setAutosaveStatus("saved");
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : "Project open failed");
    }
  }

  function handlePackageInput(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      void openProjectPackageFile(file);
      event.target.value = "";
    }
  }

  function commitProjectChange(nextProjectOrUpdater: Project | ((currentProject: Project) => Project)) {
    setProject((currentProject) => {
      const nextProject =
        typeof nextProjectOrUpdater === "function"
          ? nextProjectOrUpdater(currentProject)
          : nextProjectOrUpdater;

      if (nextProject === currentProject) {
        return currentProject;
      }

      setProjectHistory((currentHistory) => ({
        past: [...currentHistory.past, currentProject].slice(-50),
        future: [],
      }));

      return nextProject;
    });
  }

  function resetProjectHistory() {
    setProjectHistory({ past: [], future: [] });
  }

  function rememberProjectForUndo() {
    setProjectHistory((currentHistory) => ({
      past: [...currentHistory.past, project].slice(-50),
      future: [],
    }));
  }

  function undoProjectChange() {
    setProject((currentProject) => {
      const previousProject = projectHistory.past[projectHistory.past.length - 1];
      if (!previousProject) {
        return currentProject;
      }

      setProjectHistory({
        past: projectHistory.past.slice(0, -1),
        future: [currentProject, ...projectHistory.future].slice(0, 50),
      });
      clearTransientEditingState();
      return previousProject;
    });
  }

  function redoProjectChange() {
    setProject((currentProject) => {
      const nextProject = projectHistory.future[0];
      if (!nextProject) {
        return currentProject;
      }

      setProjectHistory({
        past: [...projectHistory.past, currentProject].slice(-50),
        future: projectHistory.future.slice(1),
      });
      clearTransientEditingState();
      return nextProject;
    });
  }

  function clearTransientEditingState() {
    setSelectedCanvasItemIds([]);
    setSelectedGridSlotIndex(null);
    setSelectedGridSpanIndexes([]);
    setSelectedCarouselSlideId(null);
    setCarouselEditorPostId(null);
    setCropEditSlotIndex(null);
    setSelectedSlotSize(null);
  }

  function handleCanvasDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    void importFiles(event.dataTransfer.files);
  }

  function handleCanvasItemPointerDown(event: ReactPointerEvent<HTMLElement>, canvasItemId: string) {
    event.preventDefault();
    event.stopPropagation();

    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      setSelectedCanvasItemIds((currentIds) => {
        const currentSet = new Set(currentIds);
        if (currentSet.has(canvasItemId)) {
          currentSet.delete(canvasItemId);
        } else {
          currentSet.add(canvasItemId);
        }
        return [...currentSet];
      });
      setCropEditSlotIndex(null);
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    const selectedCanvasItemIds = getSelectedCanvasItemIds();
    const draggedCanvasItemIds = selectedCanvasItemIds.includes(canvasItemId)
      ? selectedCanvasItemIds
      : [canvasItemId];
    setSelectedCanvasItemIds(draggedCanvasItemIds);
    setCropEditSlotIndex(null);
    const startItem = project.canvasItems.find((item) => item.id === canvasItemId);
    rememberProjectForUndo();

    const start = {
      x: event.clientX,
      y: event.clientY,
    };
    let previous = start;

    function handlePointerMove(moveEvent: PointerEvent) {
      const delta = {
        x: (moveEvent.clientX - previous.x) / canvasView.zoom,
        y: (moveEvent.clientY - previous.y) / canvasView.zoom,
      };
      previous = {
        x: moveEvent.clientX,
        y: moveEvent.clientY,
      };

      const dropHint = getGridDropHint(moveEvent.clientX, moveEvent.clientY);
      setGridDropHint(dropHint);
      setProject((currentProject) => moveCanvasItems(currentProject, draggedCanvasItemIds, delta));
    }

    function handlePointerUp() {
      const dropTarget = document
        .elementFromPoint(previous.x, previous.y)
        ?.closest<HTMLElement>("[data-grid-slot-index]");
      const slotIndex = dropTarget ? Number(dropTarget.dataset.gridSlotIndex) : Number.NaN;

      if (startItem && draggedCanvasItemIds.length === 1 && Number.isFinite(slotIndex)) {
        setProject((currentProject) => {
          const resetProject = setCanvasItemPosition(currentProject, canvasItemId, {
            x: startItem.x,
            y: startItem.y,
          });
          const sourceAsset = sourceAssetById.get(startItem.sourceImageId);
          const spanIndexes = normalizeGridSelection(selectedGridSpanIndexes);

          if (sourceAsset && spanIndexes.length > 1 && spanIndexes.includes(slotIndex)) {
            const slotElement = document.querySelector<HTMLElement>(
              `[data-grid-slot-index="${slotIndex}"]`,
            );
            const slot = slotElement ? getUnscaledElementSize(slotElement) : fallbackQualitySlotSize;
            const crops = createGridMosaicSplitCrops({
              asset: sourceAsset,
              aspectRatio: activeAspectRatio,
              slotIndexes: spanIndexes,
              slot,
            });

            return insertAssetAcrossGridSlots(resetProject, startItem.sourceImageId, spanIndexes, crops);
          }

          return replaceAssetInGridSlot(resetProject, startItem.sourceImageId, slotIndex);
        });
        setSelectedGridSlotIndex(slotIndex);
        setSelectedGridSpanIndexes((current) =>
          current.length > 1 && current.includes(slotIndex) ? normalizeGridSelection(current) : [],
        );
        setSelectedCanvasItemIds([]);
      }

      setGridDropHint(null);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
  }

  function handleCanvasLayerPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const itemElement = (event.target as HTMLElement).closest<HTMLElement>("[data-canvas-item-id]");
    const canvasItemId = itemElement?.dataset.canvasItemId;
    if (!canvasItemId) {
      return;
    }

    handleCanvasItemPointerDown(event, canvasItemId);
  }

  function getGridDropHint(clientX: number, clientY: number): GridDropHint | null {
    const dropTarget = document
      .elementFromPoint(clientX, clientY)
      ?.closest<HTMLElement>("[data-grid-slot-index]");
    const slotIndex = dropTarget ? Number(dropTarget.dataset.gridSlotIndex) : Number.NaN;

    if (!Number.isFinite(slotIndex)) {
      return null;
    }

    const targetPost = gridSlots[slotIndex]?.post;
    const spanIndexes = normalizeGridSelection(selectedGridSpanIndexes);
    const label =
      targetPost?.locked
        ? "Locked slot"
        : spanIndexes.length > 1 && spanIndexes.includes(slotIndex)
          ? `Replace ${spanIndexes.length} mosaic slots`
          : targetPost
            ? "Replace slot"
            : "Drop into empty slot";

    return {
      label,
      x: clientX + 14,
      y: clientY + 14,
    };
  }

  function handleCanvasPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest(".canvas-item")) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const start = { x: event.clientX, y: event.clientY };
    const shouldPanCanvas = event.button === 1 || event.button === 2 || event.altKey;
    const boardRect = event.currentTarget.getBoundingClientRect();
    const initialSelection = new Set(getSelectedCanvasItemIds());
    const cachedItemRects = project.canvasItems.map((item) => ({
      id: item.id,
      rect: getCanvasItemRect(item, sourceAssetById.get(item.sourceImageId)),
    }));
    const liveCanvasView = { ...canvasView };
    let panFrameId: number | null = null;
    let selectionFrameId: number | null = null;
    let latestSelectionPoint = start;
    let latestSelectionRect: CanvasSelectionRect | null = null;

    if (!shouldPanCanvas) {
      applyCanvasSelectionRectStyle(canvasSelectionRectRef.current, {
        left: start.x - boardRect.left,
        top: start.y - boardRect.top,
        width: 0,
        height: 0,
      });
    } else {
      hideCanvasSelectionRect(canvasSelectionRectRef.current);
    }

    function schedulePanTransform() {
      if (panFrameId !== null) {
        return;
      }

      panFrameId = window.requestAnimationFrame(() => {
        panFrameId = null;
        if (canvasLayerRef.current) {
          canvasLayerRef.current.style.transform = getCanvasLayerTransform(liveCanvasView);
        }
      });
    }

    function getCurrentSelectionRect() {
      return getNormalizedScreenRect(
        start.x - boardRect.left,
        start.y - boardRect.top,
        latestSelectionPoint.x - boardRect.left,
        latestSelectionPoint.y - boardRect.top,
      );
    }

    function commitSelection(selectionRect: CanvasSelectionRect) {
      const worldRect = screenRectToCanvasWorldRect(selectionRect, canvasView);
      const selectedIds = getCanvasItemIdsInRect(cachedItemRects, worldRect);
      const nextSelectionIds =
        event.shiftKey || event.ctrlKey || event.metaKey
          ? [...new Set([...initialSelection, ...selectedIds])]
          : selectedIds;

      startTransition(() => {
        setSelectedCanvasItemIds((currentIds) =>
          areStringArraysEqual(currentIds, nextSelectionIds) ? currentIds : nextSelectionIds,
        );
      });
    }

    function applySelectionUpdate() {
      const selectionRect = getCurrentSelectionRect();
      latestSelectionRect = selectionRect;
      applyCanvasSelectionRectStyle(canvasSelectionRectRef.current, selectionRect);
    }

    function scheduleSelectionUpdate() {
      if (selectionFrameId !== null) {
        return;
      }

      selectionFrameId = window.requestAnimationFrame(() => {
        selectionFrameId = null;
        applySelectionUpdate();
      });
    }

    function handlePointerMove(moveEvent: PointerEvent) {
      if (shouldPanCanvas) {
        liveCanvasView.x += moveEvent.movementX;
        liveCanvasView.y += moveEvent.movementY;
        schedulePanTransform();
        return;
      }

      latestSelectionPoint = {
        x: moveEvent.clientX,
        y: moveEvent.clientY,
      };
      scheduleSelectionUpdate();
    }

    function handlePointerUp() {
      if (panFrameId !== null) {
        window.cancelAnimationFrame(panFrameId);
        panFrameId = null;
      }
      if (shouldPanCanvas) {
        if (canvasLayerRef.current) {
          canvasLayerRef.current.style.transform = "";
        }
        setCanvasView(liveCanvasView);
      }

      if (!shouldPanCanvas) {
        if (selectionFrameId !== null) {
          window.cancelAnimationFrame(selectionFrameId);
          selectionFrameId = null;
          applySelectionUpdate();
        }
        const finalSelectionRect = latestSelectionRect ?? getCurrentSelectionRect();
        const movedDistance = Math.hypot(previousPointerX - start.x, previousPointerY - start.y);
        if (movedDistance < 4 && !(event.shiftKey || event.ctrlKey || event.metaKey)) {
          setSelectedCanvasItemIds([]);
        } else {
          commitSelection(finalSelectionRect);
        }
        hideCanvasSelectionRect(canvasSelectionRectRef.current);
      }
      window.removeEventListener("pointermove", trackPointer);
      window.removeEventListener("pointerup", handlePointerUp);
    }

    let previousPointerX = start.x;
    let previousPointerY = start.y;
    function trackPointer(moveEvent: PointerEvent) {
      previousPointerX = moveEvent.clientX;
      previousPointerY = moveEvent.clientY;
      handlePointerMove(moveEvent);
    }

    window.addEventListener("pointermove", trackPointer);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
  }

  function handleCanvasWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const board = canvasBoardRef.current;
    if (!board) {
      return;
    }

    const rect = board.getBoundingClientRect();
    const pointer = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    const nextZoom = clamp(canvasView.zoom * (event.deltaY > 0 ? 0.92 : 1.08), 0.25, 3);
    const world = {
      x: (pointer.x - canvasView.x) / canvasView.zoom,
      y: (pointer.y - canvasView.y) / canvasView.zoom,
    };

    setCanvasView({
      x: pointer.x - world.x * nextZoom,
      y: pointer.y - world.y * nextZoom,
      zoom: nextZoom,
    });
  }

  function handleGridViewportWheel(event: WheelEvent<HTMLDivElement>) {
    if (!event.ctrlKey) {
      return;
    }

    event.preventDefault();
    const nextZoom = clamp(gridZoom * (event.deltaY > 0 ? 0.92 : 1.08), 0.35, 1.4);
    setGridZoom(Number(nextZoom.toFixed(3)));
  }

  function fitCanvasToItems() {
    const board = canvasBoardRef.current;
    if (!board || project.canvasItems.length === 0) {
      setCanvasView({ x: 0, y: 0, zoom: 1 });
      return;
    }

    const bounds = getCanvasItemsBounds(project.canvasItems, sourceAssetById);
    const rect = board.getBoundingClientRect();
    const padding = 72;
    const zoom = clamp(
      Math.min((rect.width - padding * 2) / bounds.width, (rect.height - padding * 2) / bounds.height),
      0.25,
      1.6,
    );

    setCanvasView({
      zoom,
      x: rect.width / 2 - (bounds.x + bounds.width / 2) * zoom,
      y: rect.height / 2 - (bounds.y + bounds.height / 2) * zoom,
    });
  }

  function arrangeCanvasItems() {
    commitProjectChange((currentProject) => autoArrangeCanvasItems(currentProject));
    setCanvasView({ x: 0, y: 0, zoom: 1 });
  }

  function fitGridToOverview() {
    const viewport = gridViewportRef.current;
    if (!viewport) {
      setGridZoom(1);
      return;
    }

    const viewportRect = viewport.getBoundingClientRect();
    const rowsToShow = Math.ceil(gridSlots.length / 3);
    const gap = 8;
    const availableWidth = viewportRect.width - 6;
    const maxCellWidth = (availableWidth - gap * 2) / 3;
    const aspect = aspectToNumber(activeAspectRatio);
    const unscaledCellHeight = maxCellWidth / aspect;
    const totalHeight = rowsToShow * unscaledCellHeight + Math.max(0, rowsToShow - 1) * gap + 22;
    const nextZoom = clamp((viewportRect.height - 8) / Math.max(1, totalHeight), 0.35, 1);

    setGridZoom(Number(nextZoom.toFixed(3)));
  }

  function handleDividerPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const workspace = workspaceRef.current;

    if (!workspace) {
      return;
    }

    const workspaceRect = workspace.getBoundingClientRect();

    function handlePointerMove(moveEvent: PointerEvent) {
      const nextSplit =
        ((moveEvent.clientX - workspaceRect.left) / Math.max(1, workspaceRect.width)) * 100;
      setWorkspaceSplit(clamp(nextSplit, minWorkspaceSplit, maxWorkspaceSplit));
    }

    function handlePointerUp() {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
  }

  function clearGridSelection() {
    setSelectedGridSpanIndexes([]);
    setSelectedGridSlotIndex(null);
    setCropEditSlotIndex(null);
  }

  function handleGridOrganizerPointerDown(event: ReactPointerEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    const interactiveArea = target.closest(
      ".grid-cell, .crop-panel, .quality-map, .pane-actions, .grid-selection-hint",
    );

    if (interactiveArea) {
      return;
    }

    clearGridSelection();
  }

  function handleGridPostPointerDown(event: ReactPointerEvent<HTMLElement>, fromIndex: number) {
    event.preventDefault();
    event.stopPropagation();
    setSelectedCanvasItemIds([]);
    const post = gridSlots[fromIndex]?.post;

    if (event.shiftKey) {
      selectGridRange(fromIndex);
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      toggleGridMosaicSlot(fromIndex);
      return;
    }

    if (isDoubleGridPointer(fromIndex)) {
      toggleCropEditMode(fromIndex);
      return;
    }

    setSelectedGridSpanIndexes([]);

    if (post?.locked) {
      setSelectedGridSlotIndex(fromIndex);
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedGridSlotIndex(fromIndex);
    setDraggingGridSlotIndex(fromIndex);
    let previous = {
      x: event.clientX,
      y: event.clientY,
    };

    function handlePointerMove(moveEvent: PointerEvent) {
      previous = {
        x: moveEvent.clientX,
        y: moveEvent.clientY,
      };
    }

    function handlePointerUp() {
      const dropTarget = document
        .elementFromPoint(previous.x, previous.y)
        ?.closest<HTMLElement>("[data-grid-slot-index]");
      const toIndex = dropTarget ? Number(dropTarget.dataset.gridSlotIndex) : Number.NaN;

      if (Number.isFinite(toIndex)) {
        commitProjectChange((currentProject) => movePostToGridSlot(currentProject, fromIndex, toIndex));
        setSelectedGridSlotIndex(toIndex);
      }

      setDraggingGridSlotIndex(null);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
  }

  function handleGridSlotPointerDown(event: ReactPointerEvent<HTMLElement>, slotIndex: number) {
    if (gridSlots[slotIndex]?.post) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setSelectedCanvasItemIds([]);
    setCropEditSlotIndex(null);

    if (event.shiftKey) {
      selectGridRange(slotIndex);
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      toggleGridMosaicSlot(slotIndex);
      return;
    }

    setSelectedGridSlotIndex(slotIndex);
    setSelectedGridSpanIndexes([slotIndex]);
  }

  function selectGridRange(slotIndex: number) {
    setSelectedGridSlotIndex(slotIndex);
    setSelectedGridSpanIndexes((currentIndexes) => {
      const anchor = currentIndexes[0] ?? selectedGridSlotIndex ?? slotIndex;
      const start = Math.min(anchor, slotIndex);
      const end = Math.max(anchor, slotIndex);
      const cappedEnd = Math.min(end, start + 11);

      return Array.from({ length: cappedEnd - start + 1 }, (_, index) => start + index);
    });
  }

  function toggleGridMosaicSlot(slotIndex: number) {
    setSelectedGridSlotIndex(slotIndex);
    setCropEditSlotIndex(null);
    setSelectedGridSpanIndexes((currentIndexes) => {
      const startingIndexes =
        currentIndexes.length > 0
          ? currentIndexes
          : selectedGridSlotIndex !== null && selectedGridSlotIndex !== slotIndex
            ? [selectedGridSlotIndex, slotIndex]
            : [slotIndex];
      const selectedIndexes = new Set(startingIndexes);
      if (currentIndexes.includes(slotIndex) && selectedIndexes.size > 1) {
        selectedIndexes.delete(slotIndex);
      } else if (!selectedIndexes.has(slotIndex) && selectedIndexes.size < 12) {
        selectedIndexes.add(slotIndex);
      }

      return normalizeGridSelection([...selectedIndexes]);
    });
  }

  function toggleCropEditMode(slotIndex: number) {
    setSelectedGridSlotIndex(slotIndex);
    setSelectedGridSpanIndexes([]);
    setCropEditSlotIndex((currentSlotIndex) => (currentSlotIndex === slotIndex ? null : slotIndex));
  }

  function isDoubleGridPointer(slotIndex: number) {
    const now = window.performance.now();
    const lastGridPointer = lastGridPointerRef.current;
    if (
      lastGridPointer &&
      lastGridPointer.slotIndex === slotIndex &&
      now - lastGridPointer.time < 360
    ) {
      lastGridPointerRef.current = null;
      return true;
    }

    lastGridPointerRef.current = { slotIndex, time: now };
    return false;
  }

  function handleGridImagePointerDown(
    event: ReactPointerEvent<HTMLImageElement>,
    slotIndex: number,
    slideId: string,
  ) {
    if (cropEditSlotIndex !== slotIndex) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (isDoubleGridPointer(slotIndex)) {
      toggleCropEditMode(slotIndex);
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    rememberProjectForUndo();
    const imageElement = event.currentTarget;
    const slotElement = imageElement.closest<HTMLElement>(".grid-cell");
    let previous = {
      x: event.clientX,
      y: event.clientY,
    };

    function handlePointerMove(moveEvent: PointerEvent) {
      const delta = {
        x: (moveEvent.clientX - previous.x) / gridZoom,
        y: (moveEvent.clientY - previous.y) / gridZoom,
      };
      previous = {
        x: moveEvent.clientX,
        y: moveEvent.clientY,
      };

      setProject((currentProject) => {
        const post = getPostBySlideId(currentProject, slideId);
        const slide = post?.slides.find((candidate) => candidate.id === slideId);
        if (!slide) {
          return currentProject;
        }
        const slotSize = slotElement ? getUnscaledElementSize(slotElement) : null;
        const unclampedOffset = {
          x: slide.crop.x + delta.x,
          y: slide.crop.y + delta.y,
        };
        const offset =
          slotSize && imageElement.naturalWidth && imageElement.naturalHeight
            ? clampCropOffset(
                {
                  slotWidth: slotSize.width,
                  slotHeight: slotSize.height,
                  imageWidth: imageElement.naturalWidth,
                  imageHeight: imageElement.naturalHeight,
                  scale: slide.crop.scale,
                  rotation: slide.crop.rotation,
                },
                unclampedOffset,
              )
            : unclampedOffset;

        return setSlideCrop(currentProject, slideId, {
          ...slide.crop,
          x: offset.x,
          y: offset.y,
        });
      });
    }

    function handlePointerUp() {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
  }

  function updateSelectedCrop(cropPatch: Partial<typeof defaultCrop>) {
    if (!selectedSlide) {
      return;
    }

    commitProjectChange((currentProject) => {
      const nextCropState = {
        ...selectedSlide.crop,
        ...cropPatch,
      };
      const slotElement =
        selectedGridSlotIndex === null
          ? null
          : document.querySelector<HTMLElement>(`[data-grid-slot-index="${selectedGridSlotIndex}"]`);
      const imageElement = slotElement?.querySelector("img");
      const slotSize = slotElement ? getUnscaledElementSize(slotElement) : null;
      const clampedOffset =
        slotSize && imageElement?.naturalWidth && imageElement.naturalHeight
          ? clampCropOffset(
              {
                slotWidth: slotSize.width,
                slotHeight: slotSize.height,
                imageWidth: imageElement.naturalWidth,
                imageHeight: imageElement.naturalHeight,
                scale: nextCropState.scale,
                rotation: nextCropState.rotation,
              },
              { x: nextCropState.x, y: nextCropState.y },
            )
          : { x: nextCropState.x, y: nextCropState.y };

      return setSlideCrop(currentProject, selectedSlide.id, {
        ...nextCropState,
        x: clampedOffset.x,
        y: clampedOffset.y,
      });
    });
  }

  function resetSelectedCrop() {
    if (!selectedSlide) {
      return;
    }

    commitProjectChange((currentProject) => setSlideCrop(currentProject, selectedSlide.id, { ...defaultCrop }));
  }

  function rotateSelectedCrop(direction: -1 | 1) {
    if (!selectedSlide) {
      return;
    }

    commitProjectChange((currentProject) => rotateSlideCrop(currentProject, selectedSlide.id, direction));
  }

  function deleteSelectedCanvasItems() {
    const selectedCanvasItemIds = getSelectedCanvasItemIds();
    if (selectedCanvasItemIds.length === 0) {
      return;
    }

    const nextProject = removeCanvasItems(project, selectedCanvasItemIds);
    commitProjectChange(nextProject);
    setSelectedCanvasItemIds([]);
  }

  function deleteSelectedGridPost() {
    if (selectedGridSlotIndex === null || !selectedGridPost || selectedGridPost.locked) {
      return;
    }

    const nextProject = removePostFromGridSlot(project, selectedGridSlotIndex);
    commitProjectChange(nextProject);
    setSelectedGridSlotIndex(null);
    setCarouselEditorPostId(null);
    setSelectedCarouselSlideId(null);
    setCropEditSlotIndex(null);
    setSelectedSlotSize(null);
  }

  function clearGridSlots() {
    if (
      !window.confirm(
        "Clear unlocked slots in the active grid? Locked posts and source canvas images will stay available.",
      )
    ) {
      return;
    }

    commitProjectChange((currentProject) => clearActiveGrid(currentProject));
    setSelectedGridSlotIndex(null);
    setSelectedGridSpanIndexes([]);
    setCarouselEditorPostId(null);
    setSelectedCarouselSlideId(null);
    setCropEditSlotIndex(null);
    setSelectedSlotSize(null);
  }

  function selectQualityIssue(issue: QualityMapIssue) {
    setSelectedCanvasItemIds([]);
    setSelectedGridSlotIndex(issue.slotIndex);
    const issuePost = gridSlots[issue.slotIndex]?.post;
    if (issuePost?.kind === "carousel" && issue.slideId) {
      setCarouselEditorPostId(issuePost.id);
      setSelectedCarouselSlideId(issue.slideId);
    }
    setCropEditSlotIndex(null);
    window.setTimeout(() => {
      document
        .querySelector<HTMLElement>(`[data-grid-slot-index="${issue.slotIndex}"]`)
        ?.scrollIntoView({ block: "center", inline: "nearest" });
    }, 0);
  }

  function convertSelectedPostToCarousel() {
    if (!selectedGridPost) {
      return;
    }

    commitProjectChange((currentProject) => convertPostToCarousel(currentProject, selectedGridPost.id));
    setCarouselEditorPostId(selectedGridPost.id);
    setSelectedCarouselSlideId(selectedGridPost.slides[0]?.id ?? null);
  }

  function openSelectedCarouselWorkspace() {
    if (!selectedCarouselPost) {
      return;
    }

    setCarouselEditorPostId(selectedCarouselPost.id);
    setSelectedCarouselSlideId(selectedCarouselPost.slides[0]?.id ?? null);
    setSelectedCanvasItemIds([]);
  }

  function addAssetToSelectedCarousel(sourceImageId: string) {
    if (!selectedGridPost) {
      return;
    }

    commitProjectChange((currentProject) => addSlideToPost(currentProject, selectedGridPost.id, sourceImageId));
  }

  function duplicateCarouselSlide(slideId: string) {
    if (!selectedGridPost) {
      return;
    }

    commitProjectChange((currentProject) => duplicateSlideInPost(currentProject, selectedGridPost.id, slideId));
  }

  function removeCarouselSlide(slideId: string) {
    if (!selectedGridPost) {
      return;
    }

    const nextProject = removeSlideFromPost(project, selectedGridPost.id, slideId);
    commitProjectChange(nextProject);
  }

  function moveCarouselSlide(fromIndex: number, toIndex: number) {
    if (!selectedGridPost) {
      return;
    }

    commitProjectChange((currentProject) => moveSlideInPost(currentProject, selectedGridPost.id, fromIndex, toIndex));
  }

  function splitAssetIntoSelectedCarousel(sourceImageId: string) {
    if (!selectedGridPost) {
      return;
    }

    const sourceAsset = sourceAssetById.get(sourceImageId);
    if (!sourceAsset) {
      return;
    }

    const direction =
      splitDirection === "auto" ? inferSplitDirection(sourceAsset, activeAspectRatio) : splitDirection;
    const slot = selectedSlotSize ?? fallbackQualitySlotSize;
    const crops = createSplitCrops({
      asset: sourceAsset,
      aspectRatio: activeAspectRatio,
      count: splitCount,
      direction,
      slot,
    });
    const slides = crops.map((crop) => ({
      id: `slide_${crypto.randomUUID()}`,
      sourceImageId,
      crop,
    }));

    commitProjectChange((currentProject) => replacePostSlides(currentProject, selectedGridPost.id, slides));
    setSelectedCarouselSlideId(slides[0]?.id ?? null);
  }

  function handleCarouselSlidePointerDown(
    event: ReactPointerEvent<HTMLElement>,
    slideId: string,
    fromIndex: number,
  ) {
    if ((event.target as HTMLElement).closest("button")) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedCarouselSlideId(slideId);
    setDraggingCarouselSlideIndex(fromIndex);
    let previous = {
      x: event.clientX,
      y: event.clientY,
    };

    function handlePointerMove(moveEvent: PointerEvent) {
      previous = {
        x: moveEvent.clientX,
        y: moveEvent.clientY,
      };
    }

    function handlePointerUp() {
      const dropTarget = document
        .elementFromPoint(previous.x, previous.y)
        ?.closest<HTMLElement>("[data-carousel-slide-index]");
      const toIndex = dropTarget ? Number(dropTarget.dataset.carouselSlideIndex) : Number.NaN;

      if (Number.isFinite(toIndex) && toIndex !== fromIndex) {
        moveCarouselSlide(fromIndex, toIndex);
      }

      setDraggingCarouselSlideIndex(null);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
  }

  function closeCarouselWorkspace() {
    setCarouselEditorPostId(null);
    setSelectedCarouselSlideId(null);
    setCropEditSlotIndex(null);
  }

  function duplicateCurrentGridVersion() {
    const nextIndex = project.versions.length + 1;
    commitProjectChange((currentProject) => duplicateActiveGridVersion(currentProject, `Draft ${nextIndex}`));
    setSelectedGridSlotIndex(null);
    setSelectedCarouselSlideId(null);
    setCarouselEditorPostId(null);
    setCropEditSlotIndex(null);
  }

  function deleteCurrentGridVersion() {
    const activeVersion = project.versions.find((version) => version.id === project.activeVersionId);

    if (!activeVersion || project.versions.length <= 1) {
      return;
    }

    const confirmed = window.confirm(`Delete "${activeVersion.name}"? This cannot be undone.`);

    if (!confirmed) {
      return;
    }

    commitProjectChange((currentProject) => deleteGridVersion(currentProject, currentProject.activeVersionId));
    setSelectedGridSlotIndex(null);
    setSelectedCarouselSlideId(null);
    setCarouselEditorPostId(null);
    setCropEditSlotIndex(null);
  }

  function switchGridVersion(versionId: string) {
    commitProjectChange((currentProject) => setActiveGridVersion(currentProject, versionId));
    setSelectedGridSlotIndex(null);
    setSelectedCarouselSlideId(null);
    setCarouselEditorPostId(null);
    setCropEditSlotIndex(null);
  }

  function toggleSelectedPostLock() {
    if (!selectedGridPost) {
      return;
    }

    commitProjectChange((currentProject) => togglePostLock(currentProject, selectedGridPost.id));
  }

  function changeAspectRatio(nextAspectRatio: AspectRatio) {
    setActiveAspectRatio(nextAspectRatio);
    window.setTimeout(() => {
      recomputeMosaicGroups(nextAspectRatio);
    }, 0);
  }

  function recomputeMosaicGroups(nextAspectRatio: AspectRatio) {
    setProject((currentProject) => {
      const currentActiveVersion = currentProject.versions.find(
        (version) => version.id === currentProject.activeVersionId,
      );

      if (!currentActiveVersion) {
        return currentProject;
      }

      const currentPostById = new Map(currentProject.posts.map((post) => [post.id, post]));
      const activeMosaicGroups = currentActiveVersion.postOrder.reduce<MosaicGroup[]>(
        (groups, postId) => {
          const group = postId ? currentPostById.get(postId)?.mosaicGroup : undefined;
          return group ? [...groups, group] : groups;
        },
        [],
      );
      const mosaicGroups = new Map(activeMosaicGroups.map((group) => [group.id, group]));

      if (mosaicGroups.size === 0) {
        return currentProject;
      }

      const cropByPostId = new Map<string, ReturnType<typeof createGridMosaicSplitCrops>[number]>();

      for (const group of mosaicGroups.values()) {
        const sourceAsset = currentProject.assets.find((asset) => asset.id === group.sourceImageId);
        if (!sourceAsset) {
          continue;
        }

        const firstSlotIndex = group.slotIndexes[0];
        const slotElement =
          firstSlotIndex === undefined
            ? null
            : document.querySelector<HTMLElement>(`[data-grid-slot-index="${firstSlotIndex}"]`);
        const slot = slotElement
          ? getUnscaledElementSize(slotElement)
          : getFallbackSlotSizeForAspect(nextAspectRatio);
        const crops = createGridMosaicSplitCrops({
          asset: sourceAsset,
          aspectRatio: nextAspectRatio,
          slotIndexes: group.slotIndexes,
          slot,
        });

        for (const [index, slotIndex] of group.slotIndexes.entries()) {
          const postId = currentActiveVersion.postOrder[slotIndex];
          const crop = crops[index];
          if (postId && crop) {
            cropByPostId.set(postId, crop);
          }
        }
      }

      if (cropByPostId.size === 0) {
        return currentProject;
      }

      return {
        ...currentProject,
        posts: currentProject.posts.map((post) => {
          const nextCrop = cropByPostId.get(post.id);
          if (!nextCrop || !post.slides[0]) {
            return post;
          }

          return {
            ...post,
            slides: post.slides.map((slide, index) => (index === 0 ? { ...slide, crop: nextCrop } : slide)),
          };
        }),
        updatedAt: new Date().toISOString(),
      };
    });
  }

  async function exportSelectedPost() {
    if (!selectedGridPost || !selectedSlide || selectedGridSlotIndex === null) {
      setExportStatus("Select a grid post first");
      return;
    }

    const slotElement = document.querySelector<HTMLElement>(
      `[data-grid-slot-index="${selectedGridSlotIndex}"]`,
    );
    const slotSize = slotElement ? getUnscaledElementSize(slotElement) : null;

    if (!slotSize) {
      setExportStatus("Export source is not ready");
      return;
    }

    try {
      const slidesToExport = selectedGridPost.kind === "carousel" ? selectedGridPost.slides : [selectedSlide];
      setExportStatus(
        selectedGridPost.kind === "carousel"
          ? `Rendering ${slidesToExport.length} carousel slides...`
          : "Rendering export...",
      );

      for (const [slideIndex, slide] of slidesToExport.entries()) {
        const rendered = await renderExportBlob({
          slide,
          slot: slotSize,
          slotIndex: selectedGridSlotIndex,
          slideIndex,
          isCarousel: selectedGridPost.kind === "carousel",
        });
        await saveBlobWithDialog(rendered.blob, rendered.filename, getExportSaveTypes(exportFormat));
      }

      const preset = getExportPreset(activeAspectRatio);
      setExportStatus(
        selectedGridPost.kind === "carousel"
          ? `Exported ${slidesToExport.length} slides at ${preset.width} x ${preset.height} ${exportFormat.toUpperCase()}`
          : `Exported ${preset.width} x ${preset.height} ${exportFormat.toUpperCase()}`,
      );
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : "Export failed");
    }
  }

  async function exportBatch() {
    const slotSize = selectedSlotSize ?? fallbackQualitySlotSize;
    const filledSlots = gridSlots.filter((slot) => slot.post);
    const totalSlides = filledSlots.reduce((total, slot) => total + (slot.post?.slides.length ?? 0), 0);

    if (filledSlots.length === 0) {
      setExportStatus("Add posts to the grid before batch export");
      return;
    }

    try {
      const batchDirectory = await selectBatchRenderDirectory();
      if (!batchDirectory) {
        setExportStatus("Batch export cancelled");
        return;
      }

      let renderedSlides = 0;
      setExportStatus(`Rendering ${totalSlides} batch export item${totalSlides === 1 ? "" : "s"}...`);

      for (const { index: slotIndex, post } of filledSlots) {
        if (!post) {
          continue;
        }

        for (const [slideIndex, slide] of post.slides.entries()) {
          const rendered = await renderExportBlob({
            slide,
            slot: slotSize,
            slotIndex,
            slideIndex,
            isCarousel: post.kind === "carousel",
          });
          const batchFilename = createBatchExportFilename(
            slotIndex,
            post.kind === "carousel" ? slideIndex : null,
            exportFormat,
          );
          await writeBlobToDirectory(batchDirectory, batchFilename, rendered.blob);
          renderedSlides += 1;
          setExportStatus(`Batch exported ${renderedSlides} / ${totalSlides}`);
        }
      }

      const preset = getExportPreset(activeAspectRatio);
      setExportStatus(
        `Batch exported ${totalSlides} item${totalSlides === 1 ? "" : "s"} at ${preset.width} x ${preset.height}`,
      );
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : "Batch export failed");
    }
  }

  async function exportFeedSnapshot() {
    const lastFilledSlotIndex = gridSlots.reduce(
      (lastIndex, slot) => (slot.post ? slot.index : lastIndex),
      -1,
    );

    if (lastFilledSlotIndex < 0) {
      setExportStatus("Add posts to the grid before making a snapshot");
      return;
    }

    try {
      setExportStatus("Rendering feed snapshot...");
      const rows = Math.ceil((lastFilledSlotIndex + 1) / 3);
      const snapshotWidth = 1080;
      const snapshotGap = 2;
      const columnWidth = (snapshotWidth - snapshotGap * 2) / 3;
      const cellHeight = Math.round(columnWidth / aspectToNumber(activeAspectRatio));
      const canvas = document.createElement("canvas");
      canvas.width = snapshotWidth;
      canvas.height = rows * cellHeight + Math.max(0, rows - 1) * snapshotGap;
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Canvas 2D rendering is not available");
      }

      context.fillStyle = theme === "dark" ? "#11120f" : "#f6f6f3";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";

      for (let slotIndex = 0; slotIndex <= lastFilledSlotIndex; slotIndex += 1) {
        const post = gridSlots[slotIndex]?.post;
        const slide = post?.slides[0];
        const column = slotIndex % 3;
        const row = Math.floor(slotIndex / 3);
        const dx = column * (columnWidth + snapshotGap);
        const dy = row * (cellHeight + snapshotGap);

        if (!slide) {
          context.fillStyle = theme === "dark" ? "#181916" : "#ffffff";
          context.fillRect(dx, dy, columnWidth, cellHeight);
          continue;
        }

        const asset = sourceAssetById.get(slide.sourceImageId);
        const previewUrl = previewUrls[slide.sourceImageId];

        if (!asset || !previewUrl) {
          throw new Error(`Snapshot source is not ready for slot ${slotIndex + 1}`);
        }

        const slotElement = document.querySelector<HTMLElement>(
          `[data-grid-slot-index="${slotIndex}"]`,
        );
        const slot = slotElement ? getUnscaledElementSize(slotElement) : fallbackQualitySlotSize;
        const image = await loadImageFromUrl(previewUrl);
        drawCroppedImageOnCanvas(context, {
          image,
          asset,
          crop: slide.crop,
          slot,
          target: { x: dx, y: dy, width: columnWidth, height: cellHeight },
        });
      }

      const blob = await canvasToPngBlob(canvas);
      await saveBlobWithDialog(blob, createFeedSnapshotFilename(project.name, activeAspectRatio), [
        {
          description: "PNG image",
          accept: { "image/png": [".png"] },
        },
      ]);
      setExportStatus(`Saved feed snapshot ${canvas.width} x ${canvas.height} PNG`);
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : "Snapshot export failed");
    }
  }

  async function renderExportBlob(input: {
    slide: Slide;
    slot: SlotSize;
    slotIndex: number;
    slideIndex: number;
    isCarousel: boolean;
  }): Promise<{ blob: Blob; filename: string }> {
    const sourceAsset = sourceAssetById.get(input.slide.sourceImageId);
    const previewUrl = previewUrls[input.slide.sourceImageId];

    if (!sourceAsset || !previewUrl) {
      throw new Error(`Export source is not ready for slot ${input.slotIndex + 1}`);
    }

    const image = await loadImageFromUrl(previewUrl);
    const blob = await renderSlideExport({
      image,
      asset: sourceAsset,
      crop: input.slide.crop,
      slot: input.slot,
      aspectRatio: activeAspectRatio,
      format: exportFormat,
    });
    const filename = input.isCarousel
      ? createCarouselExportFilename(
          sourceAsset.name,
          input.slotIndex,
          input.slideIndex,
          activeAspectRatio,
          exportFormat,
        )
      : createExportFilename(sourceAsset.name, input.slotIndex, activeAspectRatio, exportFormat);

    return { blob, filename };
  }

  function openFeatureTour() {
    setTourMode("quick");
    setIsTourOpen(true);
  }

  function closeFeatureTour() {
    window.localStorage.setItem(tourSeenStorageKey, "true");
    setIsTourOpen(false);
  }

  function openAdvancedTour() {
    setTourMode("advanced");
    setIsTourOpen(true);
  }

  return (
    <main className="app-shell" data-theme={theme}>
      <header className="app-bar">
        <div className="project-block">
          <span className="app-mark" aria-hidden="true">
            {Array.from({ length: 9 }, (_, index) => (
              <span key={index} />
            ))}
          </span>
          <div>
            <p className="eyebrow">InstaSetka</p>
            <h1>{project.name}</h1>
          </div>
        </div>

        <div className="toolbar" data-tour="project-bar" aria-label="Project actions">
          <div className="toolbar-group" data-tour="history-theme">
            <button className="icon-button" aria-label="Undo" title="Undo" disabled={!canUndo} onClick={undoProjectChange}>
              <Undo2 size={17} />
            </button>
            <button className="icon-button" aria-label="Redo" title="Redo" disabled={!canRedo} onClick={redoProjectChange}>
              <Redo2 size={17} />
            </button>
          </div>
          <span className="toolbar-divider" aria-hidden="true" />
          <div className="menu-control" ref={projectMenuRef}>
            <button
              className="button secondary"
              data-tour="project-menu"
              aria-expanded={projectMenuOpen}
              aria-haspopup="menu"
              onClick={() => {
                setProjectMenuOpen((current) => !current);
                setExportMenuOpen(false);
              }}
            >
              Project
              <ChevronDown size={15} />
            </button>
            {projectMenuOpen ? (
              <div className="action-menu" role="menu" aria-label="Project menu">
                <button
                  role="menuitem"
                  onClick={() => {
                    setProjectMenuOpen(false);
                    void saveProjectPackageFile();
                  }}
                >
                  <Save size={16} />
                  <span>Save project</span>
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    setProjectMenuOpen(false);
                    packageInputRef.current?.click();
                  }}
                >
                  <FolderOpen size={16} />
                  <span>Open project</span>
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    setProjectMenuOpen(false);
                    duplicateCurrentGridVersion();
                  }}
                >
                  <Copy size={16} />
                  <span>Duplicate version</span>
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    setProjectMenuOpen(false);
                    openFeatureTour();
                  }}
                >
                  <HelpCircle size={16} />
                  <span>Quick tour</span>
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    setProjectMenuOpen(false);
                    setTheme(isDark ? "light" : "dark");
                  }}
                >
                  {isDark ? <Sun size={16} /> : <Moon size={16} />}
                  <span>{isDark ? "Light theme" : "Dark theme"}</span>
                </button>
              </div>
            ) : null}
          </div>
          <button className="icon-button" data-tour="tour" aria-label="Open quick tour" title="Open quick tour" onClick={openFeatureTour}>
            <HelpCircle size={17} />
          </button>
          <span className="toolbar-divider" aria-hidden="true" />
          <div className="toolbar-group toolbar-group-tight">
            <div className="segmented" aria-label="Aspect ratio" data-tour="aspect">
              {aspectModes.map((mode) => (
                <button
                  className={activeAspectRatio === mode ? "is-active" : ""}
                  key={mode}
                  onClick={() => changeAspectRatio(mode)}
                >
                  {mode}
                </button>
              ))}
            </div>
            <div className="segmented" data-tour="export-format" aria-label="Export format">
              {exportFormats.map((format) => (
                <button
                  className={exportFormat === format ? "is-active" : ""}
                  key={format}
                  onClick={() => setExportFormat(format)}
                >
                  {format.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <span className="toolbar-divider" aria-hidden="true" />
          <div className="version-control" data-tour="versions">
            <select
              className="version-select"
              aria-label="Grid version"
              value={project.activeVersionId}
              onChange={(event) => switchGridVersion(event.target.value)}
            >
              {project.versions.map((version) => (
                <option key={version.id} value={version.id}>
                  {version.name}
                </option>
              ))}
            </select>
            <button
              className="icon-button"
              aria-label="Add draft version"
              title="Add draft version"
              onClick={duplicateCurrentGridVersion}
            >
              <Plus size={16} />
            </button>
            <button
              className="icon-button"
              aria-label="Delete current draft version"
              title={
                project.versions.length <= 1
                  ? "Keep at least one draft version"
                  : "Delete current draft version"
              }
              disabled={project.versions.length <= 1}
              onClick={deleteCurrentGridVersion}
            >
              <Minus size={16} />
            </button>
          </div>
          <span className="toolbar-divider" aria-hidden="true" />
          <input
            ref={packageInputRef}
            className="visually-hidden"
            type="file"
            accept=".instasetka,application/json"
            onChange={handlePackageInput}
          />
          <button className="button secondary" data-tour="import" onClick={() => fileInputRef.current?.click()}>
            <ImagePlus size={16} />
            Import
          </button>
          <input
            ref={fileInputRef}
            className="visually-hidden"
            type="file"
            accept="image/jpeg,image/png"
            multiple
            onChange={handleFileInput}
          />
          <div className="export-split" data-tour="export" ref={exportMenuRef}>
            <button className="button primary export-main" onClick={() => void exportSelectedPost()}>
              <Download size={16} />
              Export
            </button>
            <button
              className="icon-button primary export-toggle"
              aria-expanded={exportMenuOpen}
              aria-haspopup="menu"
              aria-label="More export options"
              title="More export options"
              onClick={() => setExportMenuOpen((current) => !current)}
            >
              <ChevronDown size={16} />
            </button>
            {exportMenuOpen ? (
              <div className="action-menu" role="menu" aria-label="Export options">
                <button
                  role="menuitem"
                  onClick={() => {
                    setExportMenuOpen(false);
                    void exportBatch();
                  }}
                >
                  <Files size={16} />
                  <span>Batch render</span>
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    setExportMenuOpen(false);
                    void exportFeedSnapshot();
                  }}
                >
                  <ScanLine size={16} />
                  <span>Feed snapshot</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <section
        ref={workspaceRef}
        className="workspace"
        style={{ "--workspace-left": `${workspaceSplit}%` } as CSSProperties}
      >
        <section className="source-canvas" data-tour="source-canvas" aria-label={carouselMode ? "Carousel Workspace" : "Source Canvas"}>
          <div className="pane-header">
            <div>
              <p className="eyebrow">{carouselMode ? "Carousel Workspace" : "Source Canvas"}</p>
              <h2>
                {carouselMode
                  ? `${selectedCarouselPost?.slides.length ?? 0} slide${selectedCarouselPost?.slides.length === 1 ? "" : "s"} in selected post`
                  : "Drop images, compare, then send to grid"}
              </h2>
            </div>
            <div className="pane-actions" data-tour="canvas-tools">
              {carouselMode ? (
                <button className="button secondary" onClick={closeCarouselWorkspace}>
                  Done
                </button>
              ) : (
                <>
                  <button className="icon-button" aria-label="Fit all" title="Fit all" onClick={fitCanvasToItems}>
                    <PanelLeft size={16} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Auto arrange"
                    title="Auto arrange"
                    onClick={arrangeCanvasItems}
                  >
                    <AlignStartHorizontal size={16} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Delete selected canvas image"
                    disabled={!hasSelectedCanvasItems}
                    title="Delete selected canvas image"
                    onClick={deleteSelectedCanvasItems}
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            </div>
          </div>

          {carouselMode ? (
            <div className="carousel-workspace">
              <section className="carousel-slides" aria-label="Carousel slides">
                {selectedCarouselPost?.slides.map((slide, index) => {
                  const asset = sourceAssetById.get(slide.sourceImageId);
                  const previewUrl = previewUrls[slide.sourceImageId];

                  return (
                    <article
                      className={`carousel-slide-card ${
                        selectedSlide?.id === slide.id ? "is-selected" : ""
                      } ${draggingCarouselSlideIndex === index ? "is-dragging" : ""
                      }`}
                      key={slide.id}
                      data-carousel-slide-index={index}
                      onClick={() => setSelectedCarouselSlideId(slide.id)}
                      onPointerDown={(event) => handleCarouselSlidePointerDown(event, slide.id, index)}
                    >
                      {previewUrl ? <img src={previewUrl} alt={asset?.name ?? "Carousel slide"} /> : <div className="image-placeholder" />}
                      <div>
                        <strong>Slide {index + 1}</strong>
                        <span>{asset?.name ?? "Missing source"}</span>
                      </div>
                      <div className="carousel-slide-actions" onClick={(event) => event.stopPropagation()}>
                        <button className="icon-button" aria-label={`Move slide ${index + 1} left`} disabled={index === 0} onClick={() => moveCarouselSlide(index, index - 1)}>
                          -
                        </button>
                        <button className="icon-button" aria-label={`Move slide ${index + 1} right`} disabled={index === (selectedCarouselPost?.slides.length ?? 1) - 1} onClick={() => moveCarouselSlide(index, index + 1)}>
                          +
                        </button>
                        <button className="icon-button" aria-label={`Duplicate slide ${index + 1}`} onClick={() => duplicateCarouselSlide(slide.id)}>
                          <ImagePlus size={15} />
                        </button>
                        <button className="icon-button" aria-label={`Remove slide ${index + 1}`} disabled={(selectedCarouselPost?.slides.length ?? 1) <= 1} onClick={() => removeCarouselSlide(slide.id)}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </section>
              <section className="carousel-assets" aria-label="Carousel source assets">
                <div className="splitter-controls">
                  <label>
                    Count
                    <input
                      aria-label="Split count"
                      max="10"
                      min="2"
                      type="number"
                      value={splitCount}
                      onChange={(event) => setSplitCount(clamp(Number(event.target.value) || 2, 2, 10))}
                    />
                  </label>
                  <div className="segmented compact" aria-label="Split direction">
                    {(["auto", "horizontal", "vertical"] as const).map((direction) => (
                      <button
                        className={splitDirection === direction ? "is-active" : ""}
                        key={direction}
                        onClick={() => setSplitDirection(direction)}
                      >
                        {direction === "horizontal" ? "H" : direction === "vertical" ? "V" : "Auto"}
                      </button>
                    ))}
                  </div>
                </div>
                {project.assets.map((asset) => (
                  <div className="carousel-asset-card" key={asset.id}>
                    <button className="carousel-asset" onClick={() => addAssetToSelectedCarousel(asset.id)}>
                    {previewUrls[asset.id] ? <img src={previewUrls[asset.id]} alt={asset.name} /> : <div className="image-placeholder" />}
                    <span>{asset.name}</span>
                    </button>
                    <button className="button secondary" onClick={() => splitAssetIntoSelectedCarousel(asset.id)}>
                      Split
                    </button>
                  </div>
                ))}
              </section>
            </div>
          ) : (
            <div
              ref={canvasBoardRef}
              className="canvas-board"
              data-canvas-zoom={canvasView.zoom.toFixed(2)}
              onPointerDown={handleCanvasPointerDown}
              onContextMenu={(event) => event.preventDefault()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleCanvasDrop}
              onWheel={handleCanvasWheel}
            >
            <div className="drop-note">
              <strong>Drop JPEG or PNG images here</strong>
              <span>
                {hasImportedImages
                  ? `${project.canvasItems.length} image${project.canvasItems.length === 1 ? "" : "s"} on canvas`
                  : "Pan, zoom, group, and drag candidates into the grid."}
              </span>
            </div>
            <div
              ref={canvasLayerRef}
              className="canvas-layer"
              onPointerDown={handleCanvasLayerPointerDown}
              style={{
                transform: getCanvasLayerTransform(canvasView),
              }}
            >
              <CanvasItemList
                items={project.canvasItems}
                previewUrls={previewUrls}
                sourceAssetById={sourceAssetById}
              />
              <CanvasSelectionOverlay
                items={project.canvasItems}
                selectionStore={canvasSelectionStoreRef.current}
                sourceAssetById={sourceAssetById}
              />
            </div>
            <div ref={canvasSelectionRectRef} className="canvas-selection-rect" />
          </div>
          )}
        </section>

        <div
          className="divider"
          data-tour="divider"
          role="separator"
          aria-label="Resize workspaces"
          aria-orientation="vertical"
          onPointerDown={handleDividerPointerDown}
        />

        <section className="grid-organizer" aria-label="Grid Organizer" onPointerDown={handleGridOrganizerPointerDown}>
          <div className="pane-header">
            <div>
              <p className="eyebrow">Grid Organizer</p>
              <h2>Final Instagram order</h2>
            </div>
            <div className="pane-actions">
              <button className="icon-button" aria-label="Fit grid" title="Fit grid" onClick={fitGridToOverview}>
                <Expand size={16} />
              </button>
              <div className="segmented compact" data-tour="grid-zoom" aria-label="Grid zoom">
                <button onClick={() => setGridZoom((current) => clamp(Number((current - 0.1).toFixed(2)), 0.35, 1.4))}>
                  -
                </button>
                <span>{Math.round(gridZoom * 100)}%</span>
                <button onClick={() => setGridZoom((current) => clamp(Number((current + 0.1).toFixed(2)), 0.35, 1.4))}>
                  +
                </button>
              </div>
              <button className="button secondary" data-tour="quality" onClick={() => setQualityMapOpen((current) => !current)}>
                Quality map
              </button>
              {selectedGridSpanIndexes.length > 0 ? (
                <button className="button secondary" onClick={() => setSelectedGridSpanIndexes([])}>
                  Clear selection
                </button>
              ) : null}
              <button className="button danger" data-tour="clear-grid" onClick={clearGridSlots}>
                <Trash2 size={16} />
                Clear grid
              </button>
            </div>
          </div>

          {qualityMapOpen ? (
            <div className="quality-map" aria-label="Quality map panel">
              <div className="quality-map-header">
                <div>
                  <p className="eyebrow">Quality Map</p>
                  <strong>
                    {qualityMapIssues.length === 0
                      ? "No issues"
                      : `${qualityMapIssues.length} issue${qualityMapIssues.length === 1 ? "" : "s"}`}
                  </strong>
                </div>
                <button className="icon-button" aria-label="Close quality map" onClick={() => setQualityMapOpen(false)}>
                  ×
                </button>
              </div>
              {qualityMapIssues.length === 0 ? (
                <p className="quality-empty">All filled grid posts match the current export preset.</p>
              ) : (
                <div className="quality-issue-list">
                  {qualityMapIssues.map((issue) => (
                    <button
                      className={`quality-issue is-${issue.severity}`}
                      key={issue.id}
                      onClick={() => selectQualityIssue(issue)}
                    >
                      <strong>{issue.title}</strong>
                      <span>{issue.detail}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          <div
            className={`crop-panel ${selectedSlide ? "" : "is-empty"}`}
            data-tour="crop-panel"
            aria-label={selectedSlide ? "Crop controls" : "Grid selection status"}
          >
            {selectedSlide ? (
              <>
              <div>
                <p className="eyebrow">Crop</p>
                <strong>
                  {cropEditSlotIndex === selectedGridSlotIndex
                    ? selectedCarouselPost
                      ? `Editing slide ${selectedSlideIndex + 1}`
                      : "Editing crop"
                    : carouselMode
                      ? `Slide ${selectedSlideIndex + 1}`
                      : selectedGridPost?.kind === "carousel"
                        ? "Carousel cover"
                      : "Selected post"}
                </strong>
              </div>
              <label>
                Zoom
                <input
                  aria-label="Crop zoom"
                  type="range"
                  min="1"
                  max="3"
                  step="0.05"
                  value={selectedSlide.crop.scale}
                  onChange={(event) => updateSelectedCrop({ scale: Number(event.target.value) })}
                />
                <span>{Math.round(selectedSlide.crop.scale * 100)}%</span>
              </label>
              <button className="button secondary" onClick={resetSelectedCrop}>
                Reset
              </button>
              <button className="icon-button" aria-label="Rotate image left" title="Rotate image left" onClick={() => rotateSelectedCrop(-1)}>
                <RotateCcw size={16} />
              </button>
              <button className="icon-button" aria-label="Rotate image right" title="Rotate image right" onClick={() => rotateSelectedCrop(1)}>
                <RotateCw size={16} />
              </button>
              {selectedGridPost?.kind === "single" ? (
                <button className="button secondary" data-tour="carousel" onClick={convertSelectedPostToCarousel}>
                  Carousel
                </button>
              ) : null}
              {selectedCarouselPost && !carouselMode ? (
                <button className="button secondary" data-tour="carousel" onClick={openSelectedCarouselWorkspace}>
                  Carousel
                </button>
              ) : null}
              <button
                className="icon-button"
                aria-label={selectedGridPost?.locked ? "Unlock selected grid post" : "Lock selected grid post"}
                title={selectedGridPost?.locked ? "Unlock selected grid post" : "Lock selected grid post"}
                onClick={toggleSelectedPostLock}
              >
                {selectedGridPost?.locked ? <Unlock size={16} /> : <Lock size={16} />}
              </button>
              <button className="icon-button" aria-label="Delete selected grid post" title="Delete selected grid post" disabled={selectedGridPost?.locked} onClick={deleteSelectedGridPost}>
                <Trash2 size={16} />
              </button>
              <p className="crop-hint">
                {cropEditSlotIndex === selectedGridSlotIndex
                  ? "Double-click image to lock crop"
                  : "Double-click image to edit crop"}
              </p>
              {selectedQuality ? (
                <div className={`quality-preflight is-${selectedQuality.status}`}>
                  <strong>{selectedQuality.label}</strong>
                  <span>
                    {selectedQuality.message} - target {selectedQuality.target.width} x{" "}
                    {selectedQuality.target.height}
                  </span>
                </div>
              ) : null}
              </>
            ) : (
              <>
                <div>
                  <p className="eyebrow">Selection</p>
                  <strong>
                    {selectedGridSpanIndexes.length > 1
                      ? `${selectedGridSpanIndexes.length} slots selected`
                      : selectedGridSpanIndexes.length === 1
                        ? `Slot ${selectedGridSpanIndexes[0] + 1} selected`
                        : "Grid ready"}
                  </strong>
                </div>
                <p className="crop-hint">
                  {selectedGridSpanIndexes.length > 1
                    ? "Drop one source image onto the selected slots to split it in that order."
                    : "Ctrl-click slots to build a multi-slot split, or click a filled post to edit crop."}
                </p>
              </>
            )}
          </div>

          <div ref={gridViewportRef} className="grid-viewport" data-tour="grid" onWheel={handleGridViewportWheel}>
            <div
              className="grid-preview"
              data-active-aspect={activeAspectRatio}
              data-grid-zoom={gridZoom.toFixed(2)}
              style={
                {
                  "--grid-cell-aspect": cssAspectByMode[activeAspectRatio],
                  "--grid-zoom": gridZoom,
                } as CSSProperties
              }
            >
              {gridSlots.map(({ index, post }) => {
              const coverSlide = post?.slides[0];
              const displaySlide =
                carouselMode && post && post.id === selectedGridPost?.id && post.kind === "carousel" && selectedSlide
                  ? selectedSlide
                  : coverSlide;
              const coverAsset = displaySlide ? sourceAssetById.get(displaySlide.sourceImageId) : undefined;
              const coverPreview = displaySlide ? previewUrls[displaySlide.sourceImageId] : undefined;
              const coverImageStyle =
                displaySlide && coverAsset
                  ? getGridImageStyle(displaySlide.crop, coverAsset, activeAspectRatio)
                  : undefined;
              const mosaicSelectionOrder = selectedGridSpanIndexes.indexOf(index);

              return (
                <article
                  className={`grid-cell ${post ? "has-post" : ""} ${
                    selectedGridSlotIndex === index ? "is-selected" : ""
                  } ${selectedGridSpanIndexes.includes(index) ? "is-span-selected" : ""
                  } ${draggingGridSlotIndex === index ? "is-dragging" : ""} ${
                    cropEditSlotIndex === index ? "is-crop-editing" : ""
                  } ${post?.locked ? "is-locked" : ""
                  }`}
                  data-grid-slot-index={index}
                  key={`${post?.id ?? "empty"}-${index}`}
                  onPointerDown={
                    post
                      ? (event) => handleGridPostPointerDown(event, index)
                      : (event) => handleGridSlotPointerDown(event, index)
                  }
                >
                  {coverPreview ? (
                    <>
                      <div className="grid-image-frame">
                        <img
                          src={coverPreview}
                          alt={coverAsset?.name ?? "Grid post"}
                          data-crop-x={displaySlide?.crop.x ?? 0}
                          data-crop-y={displaySlide?.crop.y ?? 0}
                          onPointerDown={
                            displaySlide
                              ? (event) => handleGridImagePointerDown(event, index, displaySlide.id)
                              : undefined
                          }
                          style={coverImageStyle}
                        />
                      </div>
                      {post?.kind === "carousel" ? (
                        <span className="badge">
                          {carouselMode && post.id === selectedGridPost?.id ? `slide ${selectedSlideIndex + 1}` : `${post.slides.length} slides`}
                        </span>
                      ) : null}
                      {post?.locked ? (
                        <span className="lock-badge">
                          <Lock size={12} />
                        </span>
                      ) : null}
                    </>
                ) : (
                  <span className="empty-slot">Drop</span>
                )}
                {mosaicSelectionOrder >= 0 ? (
                  <span className="mosaic-selection-badge">{mosaicSelectionOrder + 1}</span>
                ) : null}
              </article>
              );
            })}
            </div>
          </div>
        </section>
      </section>

      <FeatureTour
        key={tourMode}
        isOpen={isTourOpen}
        steps={tourMode === "quick" ? quickTourSteps : advancedTourSteps}
        advancedSteps={tourMode === "quick" ? advancedTourSteps : []}
        onClose={closeFeatureTour}
        onFinish={closeFeatureTour}
        onAdvanced={openAdvancedTour}
      />

      {gridDropHint ? (
        <div
          className="grid-drop-hint"
          style={{ left: gridDropHint.x, top: gridDropHint.y }}
        >
          <span />
          {gridDropHint.label}
        </div>
      ) : null}

      <footer className="status-bar">
        <span>{getAutosaveStatusLabel(autosaveStatus)} - {project.versions[0].name}</span>
        <span>
          {activeAspectRatio} - {exportSizeByAspect[activeAspectRatio]} - {exportFormat.toUpperCase()}
        </span>
        <span className="export-status">{exportStatus}</span>
        <span>{project.assets.length} assets - 50 comfortable target - 100 usable target</span>
      </footer>
    </main>
  );
}

type CanvasItemListProps = {
  items: CanvasItem[];
  previewUrls: Record<string, string>;
  sourceAssetById: Map<string, SourceAsset>;
};

const CanvasItemList = memo(
  function CanvasItemList({ items, previewUrls, sourceAssetById }: CanvasItemListProps) {
    return (
      <>
        {items.map((item) => {
          const asset = sourceAssetById.get(item.sourceImageId);
          const previewUrl = previewUrls[item.sourceImageId];
          const width = asset ? Math.min(260, Math.max(150, asset.width / 9)) : 180;
          const height = asset ? width * (asset.height / asset.width) : 225;

          return (
            <article
              className="canvas-item"
              key={item.id}
              data-canvas-item-id={item.id}
              style={{
                left: item.x,
                top: item.y,
                width,
                height: Math.min(300, Math.max(112, height)),
              }}
            >
              {previewUrl ? (
                <img src={previewUrl} alt={asset?.name ?? "Imported image"} />
              ) : (
                <div className="image-placeholder" />
              )}
              <span>{asset?.name ?? "Imported image"}</span>
            </article>
          );
        })}
      </>
    );
  },
  (previous, next) =>
    previous.items === next.items &&
    previous.previewUrls === next.previewUrls &&
    previous.sourceAssetById === next.sourceAssetById,
);

type CanvasSelectionOverlayProps = {
  items: CanvasItem[];
  selectionStore: CanvasSelectionStore;
  sourceAssetById: Map<string, SourceAsset>;
};

const CanvasSelectionOverlay = memo(function CanvasSelectionOverlay({
  items,
  selectionStore,
  sourceAssetById,
}: CanvasSelectionOverlayProps) {
  const selectedIds = useSyncExternalStore(
    selectionStore.subscribe,
    selectionStore.getSnapshot,
    selectionStore.getSnapshot,
  );
  const selectedRects = useMemo(() => {
    if (selectedIds.length === 0) {
      return [];
    }

    const canvasItemById = new Map(items.map((item) => [item.id, item]));
    return selectedIds.flatMap((canvasItemId) => {
      const item = canvasItemById.get(canvasItemId);
      if (!item) {
        return [];
      }

      return [{ id: item.id, rect: getCanvasItemRect(item, sourceAssetById.get(item.sourceImageId)) }];
    });
  }, [items, selectedIds, sourceAssetById]);

  return (
    <>
      {selectedRects.map(({ id, rect }) => (
        <div
          className="canvas-item-selection-outline"
          key={`selection-${id}`}
          style={{
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          }}
        />
      ))}
    </>
  );
});

function createCanvasSelectionStore(): CanvasSelectionStore {
  let selectedIds: string[] = [];
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => selectedIds,
    setSelection: (nextIds) => {
      if (areStringArraysEqual(selectedIds, nextIds)) {
        return false;
      }

      selectedIds = nextIds;
      listeners.forEach((listener) => listener());
      return true;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

async function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  if ("createImageBitmap" in window) {
    try {
      const image = await createImageBitmap(file);
      const dimensions = { width: image.width, height: image.height };
      image.close();
      return dimensions;
    } catch {
      // Some browser/file combinations fail createImageBitmap even when an img can decode them.
    }
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error(`Could not decode image: ${file.name}`));
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function getNormalizedScreenRect(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): CanvasSelectionRect {
  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);

  return {
    left,
    top,
    width: Math.abs(endX - startX),
    height: Math.abs(endY - startY),
  };
}

function screenRectToCanvasWorldRect(
  rect: CanvasSelectionRect,
  canvasView: { x: number; y: number; zoom: number },
): CanvasSelectionRect {
  return {
    left: (rect.left - canvasView.x) / canvasView.zoom,
    top: (rect.top - canvasView.y) / canvasView.zoom,
    width: rect.width / canvasView.zoom,
    height: rect.height / canvasView.zoom,
  };
}

function getCanvasLayerTransform(canvasView: { x: number; y: number; zoom: number }): string {
  return `translate(${canvasView.x}px, ${canvasView.y}px) scale(${canvasView.zoom})`;
}

function applyCanvasSelectionRectStyle(element: HTMLElement | null, rect: CanvasSelectionRect) {
  if (!element) {
    return;
  }

  element.style.display = "block";
  element.style.left = `${rect.left}px`;
  element.style.top = `${rect.top}px`;
  element.style.width = `${rect.width}px`;
  element.style.height = `${rect.height}px`;
}

function hideCanvasSelectionRect(element: HTMLElement | null) {
  if (!element) {
    return;
  }

  element.style.display = "none";
}

function getCanvasItemIdsInRect(
  itemRects: Array<{ id: string; rect: CanvasSelectionRect }>,
  rect: CanvasSelectionRect,
): string[] {
  return itemRects
    .filter((itemRect) => rectanglesIntersect(rect, itemRect.rect))
    .map((itemRect) => itemRect.id);
}

function areStringArraysEqual(first: string[], second: string[]): boolean {
  return first.length === second.length && first.every((value, index) => value === second[index]);
}

function getCanvasItemRect(
  item: CanvasItem,
  asset: SourceAsset | undefined,
): CanvasSelectionRect {
  const width = asset ? Math.min(260, Math.max(150, asset.width / 9)) : 180;
  const height = asset ? Math.min(300, Math.max(112, width * (asset.height / asset.width))) : 225;

  return {
    left: item.x,
    top: item.y,
    width,
    height,
  };
}

function rectanglesIntersect(first: CanvasSelectionRect, second: CanvasSelectionRect): boolean {
  return (
    first.left <= second.left + second.width &&
    first.left + first.width >= second.left &&
    first.top <= second.top + second.height &&
    first.top + first.height >= second.top
  );
}

function getCanvasItemsBounds(
  items: CanvasItem[],
  sourceAssetById: Map<string, SourceAsset>,
): { x: number; y: number; width: number; height: number } {
  const itemBounds = items.map((item) => {
    const itemRect = getCanvasItemRect(item, sourceAssetById.get(item.sourceImageId));

    return {
      left: itemRect.left,
      top: itemRect.top,
      right: itemRect.left + itemRect.width,
      bottom: itemRect.top + itemRect.height,
    };
  });

  const left = Math.min(...itemBounds.map((bounds) => bounds.left));
  const top = Math.min(...itemBounds.map((bounds) => bounds.top));
  const right = Math.max(...itemBounds.map((bounds) => bounds.right));
  const bottom = Math.max(...itemBounds.map((bounds) => bounds.bottom));

  return {
    x: left,
    y: top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function aspectToNumber(aspectRatio: AspectRatio): number {
  const [width, height] = aspectRatio.split(":").map(Number);
  return width / height;
}

function getGridImageStyle(crop: Slide["crop"], asset: SourceAsset, aspectRatio: AspectRatio): CSSProperties {
  const slotWidth = aspectToNumber(aspectRatio);
  const slotHeight = 1;
  const rotation = normalizeRotation(crop.rotation);
  const rotated = rotation % 180 === 90;
  const coverWidth = rotated ? asset.height : asset.width;
  const coverHeight = rotated ? asset.width : asset.height;
  const coverScale = Math.max(slotWidth / coverWidth, slotHeight / coverHeight);
  const imageWidthPercent = (asset.width * coverScale * 100) / slotWidth;
  const imageHeightPercent = (asset.height * coverScale * 100) / slotHeight;

  return {
    width: `${imageWidthPercent}%`,
    height: `${imageHeightPercent}%`,
    transform: `translate(-50%, -50%) translate(${crop.x}px, ${crop.y}px) rotate(${rotation}deg) scale(${crop.scale})`,
  };
}

function normalizeRotation(rotation: number): number {
  return ((rotation % 360) + 360) % 360;
}

function getAutosaveStatusLabel(status: AutosaveStatus): string {
  switch (status) {
    case "loading":
      return "Loading autosave";
    case "saving":
      return "Saving locally";
    case "unsaved":
      return "Unsaved changes";
    case "missing-assets":
      return "Recovered layout - missing originals";
    case "error":
      return "Autosave needs attention";
    case "saved":
    default:
      return "Saved locally";
  }
}

function formatAutosaveTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "local storage" : date.toLocaleString();
}

function revokePreviewUrls(previewUrls: Record<string, string>) {
  for (const previewUrl of Object.values(previewUrls)) {
    URL.revokeObjectURL(previewUrl);
  }
}

function hasMissingPreviewAssets(project: Project, previewUrls: Record<string, string>): boolean {
  return project.assets.some((asset) => !previewUrls[asset.id]);
}

function getFallbackSlotSizeForAspect(aspectRatio: AspectRatio): SlotSize {
  const width = 400;
  return {
    width,
    height: width / aspectToNumber(aspectRatio),
  };
}

function normalizeGridSelection(slotIndexes: number[]): number[] {
  return [...new Set(slotIndexes)]
    .filter((slotIndex) => slotIndex >= 0)
    .slice(0, 12);
}

function getPostBySlideId(project: Project, slideId: string) {
  return project.posts.find((post) => post.slides.some((slide) => slide.id === slideId));
}

function getUnscaledElementSize(element: HTMLElement): SlotSize {
  return {
    width: element.offsetWidth,
    height: element.offsetHeight,
  };
}

function isEditableEventTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(target.closest("input, textarea, select, button, [contenteditable='true']"));
}

async function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The source image cannot be decoded."));
    image.src = url;

    if (image.complete && image.naturalWidth > 0) {
      resolve(image);
    }
  });
}

async function selectBatchRenderDirectory(): Promise<WritableDirectoryHandle | null> {
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
  if (!picker) {
    throw new Error("Folder batch export is not supported in this browser");
  }

  try {
    const rootDirectory = await picker({ mode: "readwrite" });
    return rootDirectory.getDirectoryHandle("Batch render", { create: true });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return null;
    }
    throw error;
  }
}

async function writeBlobToDirectory(
  directory: WritableDirectoryHandle,
  filename: string,
  blob: Blob,
): Promise<void> {
  const fileHandle = await directory.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();

  try {
    await writable.write(blob);
  } finally {
    await writable.close();
  }
}

async function saveBlobWithDialog(
  blob: Blob,
  suggestedName: string,
  types?: Array<{ description: string; accept: Record<string, string[]> }>,
): Promise<void> {
  const picker = (window as DirectoryPickerWindow).showSaveFilePicker;

  if (!picker) {
    downloadBlob(blob, suggestedName);
    return;
  }

  try {
    const fileHandle = await picker({ suggestedName, types });
    const writable = await fileHandle.createWritable();
    try {
      await writable.write(blob);
    } finally {
      await writable.close();
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Save cancelled");
    }
    throw error;
  }
}

function getExportSaveTypes(format: ExportFormat) {
  return format === "jpeg"
    ? [
        {
          description: "JPEG image",
          accept: { "image/jpeg": [".jpg", ".jpeg"] },
        },
      ]
    : [
        {
          description: "PNG image",
          accept: { "image/png": [".png"] },
        },
      ];
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Could not create snapshot image"));
      }
    }, "image/png");
  });
}

function createFeedSnapshotFilename(projectName: string, aspectRatio: AspectRatio): string {
  const cleanName =
    projectName
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "instasetka-feed";
  const aspectLabel = aspectRatio.replace(":", "x");

  return `${cleanName}-feed-${aspectLabel}.png`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
