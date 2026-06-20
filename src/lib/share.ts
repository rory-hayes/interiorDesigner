import type { Product, SharePayload } from "../types";

export function formatCurrency(amount: number): string {
  return `€${amount.toLocaleString("en-IE")}`;
}

function formatProductLine(product: Product): string {
  return `- ${product.name} — ${product.retailer} — ${formatCurrency(product.price)} (${product.dimensions})`;
}

export function formatShoppingList(payload: SharePayload): string {
  const total = payload.products.reduce((sum, product) => sum + product.price, 0);
  const remaining = payload.budget - total;

  return [
    "Roomwise shopping list",
    `Room: ${payload.roomType.replace("-", " ")}`,
    `Location: ${payload.location}`,
    `Budget: ${formatCurrency(payload.budget)}`,
    "",
    ...payload.products.map(formatProductLine),
    "",
    `Total: ${formatCurrency(total)}`,
    `${remaining >= 0 ? "Remaining" : "Over budget"}: ${formatCurrency(Math.abs(remaining))}`,
  ].join("\n");
}

export async function copyShoppingList(payload: SharePayload): Promise<string> {
  const text = formatShoppingList(payload);

  if (typeof navigator !== "undefined" && navigator.clipboard) {
    await navigator.clipboard.writeText(text);
  }

  return text;
}
