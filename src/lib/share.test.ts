import { describe, expect, it } from "vitest";
import { products } from "../data/catalog";
import { formatShoppingList } from "./share";

describe("formatShoppingList", () => {
  it("includes retailer, product, price, and total", () => {
    const selectedProducts = products.slice(0, 2);

    const summary = formatShoppingList({
      roomType: "living-room",
      location: "Dublin, Ireland",
      budget: 1200,
      products: selectedProducts,
    });

    expect(summary).toContain("Roomwise shopping list");
    expect(summary).toContain(selectedProducts[0].name);
    expect(summary).toContain(selectedProducts[0].retailer);
    expect(summary).toContain(`€${selectedProducts[0].price.toLocaleString("en-IE")}`);
    expect(summary).toContain("Total:");
  });
});
