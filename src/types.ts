export type RoomType = "living-room" | "bedroom" | "home-office";

export type StyleId = "soft-modern" | "warm-minimal" | "scandi" | "rental-refresh";

export type PaletteId = "sage-clay" | "walnut-cream" | "black-oak" | "linen-terracotta";

export type ProductCategory =
  | "sofa"
  | "chair"
  | "coffee-table"
  | "rug"
  | "lighting"
  | "storage"
  | "curtains"
  | "decor"
  | "plant";

export type GenerationStatus = "idle" | "analyzing" | "matching" | "rendering" | "ready";

export type IntegrationMode = "checking" | "demo" | "live";

export interface ProjectPreferences {
  budget: number;
  style: StyleId;
  palette: PaletteId;
  roomType: RoomType;
  location: string;
}

export interface UploadedRoom {
  url: string;
  name: string;
  type: string;
  size: number;
  objectUrl: boolean;
  dataUrl?: string;
}

export interface GeneratedRender {
  imageUrl: string;
  model: string;
  prompt?: string;
}

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  retailer: string;
  price: number;
  currency: "EUR";
  dimensions: string;
  material: string;
  color: string;
  fitScore: number;
  styleTags: StyleId[];
  paletteTags: PaletteId[];
  roomTypes: RoomType[];
  url: string;
  swatch: string;
}

export interface RoomConcept {
  id: "soft-modern" | "warm-minimal";
  name: string;
  summary: string;
  palette: string[];
  estimatedRenderTime: string;
}

export interface CartSummary {
  total: number;
  budget: number;
  remaining: number;
  overBudget: boolean;
  itemCount: number;
}

export interface SharePayload {
  roomType: RoomType;
  location: string;
  budget: number;
  products: Product[];
}
