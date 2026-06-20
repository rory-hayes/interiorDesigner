import { Copy, ExternalLink, RefreshCcw, RotateCw, Trash2 } from "lucide-react";
import type { CartSummary, Product } from "../types";
import { formatCurrency } from "../lib/share";

interface ShoppingListProps {
  products: Product[];
  summary: CartSummary;
  shareState: "idle" | "copied" | "fallback";
  onSwap: (productId: string) => void;
  onRemove: (productId: string) => void;
  onRestore: () => void;
  onShare: () => void;
}

export function ShoppingList({
  products,
  summary,
  shareState,
  onSwap,
  onRemove,
  onRestore,
  onShare,
}: ShoppingListProps) {
  return (
    <section className="panel shopping-panel" aria-label="Shopping list">
      <div className="panel-header">
        <div>
          <p className="section-label">Shopping list</p>
          <h2>{summary.itemCount} matched items</h2>
        </div>
        <button className="icon-button" type="button" aria-label="Restore curated list" onClick={onRestore}>
          <RefreshCcw size={17} />
        </button>
      </div>

      <div className={summary.overBudget ? "budget-summary over" : "budget-summary"}>
        <div>
          <span>Total</span>
          <strong>{formatCurrency(summary.total)}</strong>
        </div>
        <div>
          <span>{summary.overBudget ? "Over" : "Remaining"}</span>
          <strong>{formatCurrency(Math.abs(summary.remaining))}</strong>
        </div>
      </div>

      <div className="product-list">
        {products.length === 0 ? (
          <div className="empty-list">
            <strong>No products matched yet</strong>
            <span>Generate a room plan to create a local, budget-aware shortlist.</span>
          </div>
        ) : null}

        {products.map((product) => (
          <article className="product-row" key={product.id}>
            <div className="product-thumb" style={{ background: product.swatch }} aria-hidden="true">
              <span />
            </div>
            <div className="product-info">
              <div className="product-title-row">
                <h3>{product.name}</h3>
                <strong>{formatCurrency(product.price)}</strong>
              </div>
              <p>
                {product.retailer} · {product.color} · {product.dimensions}
              </p>
              <div className="product-meta">
                <span>{product.fitScore}% fit</span>
                <a href={product.url} target="_blank" rel="noreferrer">
                  View <ExternalLink size={12} />
                </a>
              </div>
            </div>
            <div className="product-actions">
              <button type="button" aria-label={`Swap ${product.name}`} onClick={() => onSwap(product.id)}>
                <RotateCw size={15} />
              </button>
              <button type="button" aria-label={`Remove ${product.name}`} onClick={() => onRemove(product.id)}>
                <Trash2 size={15} />
              </button>
            </div>
          </article>
        ))}
      </div>

      <button className="secondary-button share-button" disabled={products.length === 0} type="button" onClick={onShare}>
        <Copy size={16} />
        {shareState === "copied"
          ? "Copied list"
          : shareState === "fallback"
            ? "Summary ready"
            : "Share list"}
      </button>
    </section>
  );
}
