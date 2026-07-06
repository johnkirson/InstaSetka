export type AspectRatio = "4:5" | "3:4" | "1:1";

export type PostStatus = "draft" | "ready" | "scheduled" | "posted";

export type PostKind = "single" | "carousel";

export type Project = {
  id: string;
  name: string;
  activeVersionId: string;
  assets: SourceAsset[];
  canvasItems: CanvasItem[];
  posts: Post[];
  versions: GridVersion[];
  createdAt: string;
  updatedAt: string;
};

export type SourceAsset = {
  id: string;
  name: string;
  width: number;
  height: number;
  mimeType: "image/jpeg" | "image/png";
  originalPath?: string;
};

export type CanvasItem = {
  id: string;
  sourceImageId: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  groupId?: string;
};

export type Post = {
  id: string;
  kind: PostKind;
  priority: number;
  status: PostStatus;
  locked: boolean;
  slides: Slide[];
  mosaicGroup?: MosaicGroup;
};

export type MosaicGroup = {
  id: string;
  sourceImageId: string;
  slotIndexes: number[];
};

export type GridVersion = {
  id: string;
  name: string;
  postOrder: Array<string | null>;
  createdAt: string;
};

export type Slide = {
  id: string;
  sourceImageId: string;
  crop: CropState;
  background?: SlideBackground;
  elements?: SlideElement[];
  templateId?: string;
};

export type CropState = {
  aspectRatio: AspectRatio;
  x: number;
  y: number;
  scale: number;
  rotation: number;
};

export type ExportFormat = "jpeg" | "png";

export type SlideBackground = {
  type: "solid";
  color: string;
  overlayOpacity?: number;
};

export type SlideElement = SlideTextElement;

export type SlideTextElement = {
  id: string;
  type: "text";
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  style: SlideTextStyle;
};

export type SlideTextStyle = {
  fontFamily: string;
  fontSize: number;
  fontWeight: 400 | 500 | 600 | 700 | 800;
  color: string;
  textAlign: "left" | "center" | "right";
  lineHeight: number;
};
