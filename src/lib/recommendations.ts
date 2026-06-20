import type { CartSummary, Product, ProductCategory, ProjectPreferences } from "../types";
import { products as defaultCatalog } from "../data/catalog";

const priorityCategories: ProductCategory[] = [
  "sofa",
  "chair",
  "coffee-table",
  "rug",
  "lighting",
  "storage",
  "curtains",
  "plant",
  "decor",
];

function scoreProduct(product: Product, preferences: ProjectPreferences): number {
  let score = product.fitScore;

  if (product.styleTags.includes(preferences.style)) {
    score += 12;
  }

  if (product.paletteTags.includes(preferences.palette)) {
    score += 8;
  }

  if (product.roomTypes.includes(preferences.roomType)) {
    score += 10;
  }

  return score;
}

export function createInitialSelection(preferences: ProjectPreferences, catalog?: Product[]): Product[] {
  const sourceCatalog = catalog ?? defaultCatalog;

  if (sourceCatalog.length === 0) {
    return [];
  }

  const selected: Product[] = [];
  let runningTotal = 0;

  for (const category of priorityCategories) {
    const candidates = sourceCatalog
      .filter((product) => product.category === category && product.roomTypes.includes(preferences.roomType))
      .sort((a, b) => {
        const scoreDelta = scoreProduct(b, preferences) - scoreProduct(a, preferences);
        return scoreDelta || a.price - b.price;
      });

    const affordable = candidates.find((product) => runningTotal + product.price <= preferences.budget);

    if (affordable) {
      selected.push(affordable);
      runningTotal += affordable.price;
    }
  }

  return selected;
}

export function calculateCartSummary(products: Product[], budget: number): CartSummary {
  const total = products.reduce((sum, product) => sum + product.price, 0);
  const remaining = budget - total;

  return {
    total,
    budget,
    remaining,
    overBudget: remaining < 0,
    itemCount: products.length,
  };
}

export function removeProduct(products: Product[], productId: string): Product[] {
  return products.filter((product) => product.id !== productId);
}

export function swapProduct(products: Product[], productId: string, catalog: Product[]): Product[] {
  const current = products.find((product) => product.id === productId);

  if (!current) {
    return products;
  }

  const currentIndex = products.findIndex((product) => product.id === productId);
  const selectedIds = new Set(products.map((product) => product.id));
  const replacement = catalog
    .filter((product) => product.category === current.category)
    .filter((product) => !selectedIds.has(product.id))
    .sort((a, b) => b.fitScore - a.fitScore || a.price - b.price)[0];

  if (!replacement) {
    return products;
  }

  return products.map((product, index) => (index === currentIndex ? replacement : product));
}
