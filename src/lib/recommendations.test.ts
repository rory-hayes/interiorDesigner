import { describe, expect, it } from "vitest";
import { products } from "../data/catalog";
import {
  calculateCartSummary,
  createInitialSelection,
  removeProduct,
  swapProduct,
} from "./recommendations";

describe("recommendations", () => {
  it("keeps the initial curated list under a realistic budget when matching products exist", () => {
    const selection = createInitialSelection({
      budget: 1700,
      style: "soft-modern",
      palette: "sage-clay",
      roomType: "living-room",
      location: "Dublin, Ireland",
    });

    const summary = calculateCartSummary(selection, 1700);

    expect(selection.length).toBeGreaterThanOrEqual(4);
    expect(summary.total).toBeLessThanOrEqual(1700);
    expect(summary.remaining).toBeGreaterThanOrEqual(0);
    expect(summary.overBudget).toBe(false);
  });

  it("updates totals when a product is removed", () => {
    const selection = createInitialSelection({
      budget: 2200,
      style: "warm-minimal",
      palette: "walnut-cream",
      roomType: "living-room",
      location: "London, UK",
    });
    const productToRemove = selection[0];
    const originalTotal = calculateCartSummary(selection, 2200).total;

    const nextSelection = removeProduct(selection, productToRemove.id);
    const nextTotal = calculateCartSummary(nextSelection, 2200).total;

    expect(nextSelection).not.toContain(productToRemove);
    expect(nextTotal).toBe(originalTotal - productToRemove.price);
  });

  it("swaps to another product in the same category", () => {
    const selection = createInitialSelection({
      budget: 2400,
      style: "soft-modern",
      palette: "sage-clay",
      roomType: "living-room",
      location: "Manchester, UK",
    });
    const sofa = selection.find((product) => product.category === "sofa");

    expect(sofa).toBeDefined();

    const swapped = swapProduct(selection, sofa!.id, products);
    const replacement = swapped.find((product) => product.category === "sofa");

    expect(replacement).toBeDefined();
    expect(replacement!.category).toBe("sofa");
    expect(replacement!.id).not.toBe(sofa!.id);
  });
});
