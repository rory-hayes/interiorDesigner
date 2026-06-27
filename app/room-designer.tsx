"use client";

/* eslint-disable @next/next/no-img-element */

import { useMemo, useRef, useState } from "react";
import { concepts, palettes, products, roomTypes, styles } from "../src/data/catalog";
import {
  calculateCartSummary,
  createInitialSelection,
  removeProduct,
  swapProduct,
} from "../src/lib/recommendations";
import { copyShoppingList, formatCurrency } from "../src/lib/share";
import type { GeneratedRender, Product, ProjectPreferences, RoomConcept } from "../src/types";

const initialPreferences: ProjectPreferences = {
  budget: 2500,
  style: "warm-minimal",
  palette: "walnut-cream",
  roomType: "living-room",
  location: "Dublin, Ireland",
  designIntensity: "balanced",
  shoppingPriority: "balanced",
  mustKeep: "",
};

type GenerateState = "idle" | "reading" | "planning" | "rendering" | "ready" | "error";

type SavedDesign = {
  id: string;
  conceptName: string;
  createdAt: string;
  generatedImageUrl: string | null;
  preferences: ProjectPreferences;
  products: Product[];
  roomPhoto: {
    dataUrl: string;
    name: string;
  };
};

const savedDesignStorageKey = "roomwise-saved-designs-v1";

function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that room photo."));
    reader.readAsDataURL(file);
  });
}

function isSupportedImage(file: File) {
  return ["image/jpeg", "image/png", "image/webp"].includes(file.type);
}

function selectConcept(preferences: ProjectPreferences): RoomConcept {
  return (
    concepts.find((concept) => concept.id === (preferences.style === "warm-minimal" ? "warm-minimal" : "soft-modern")) ??
    concepts[0]
  );
}

function createSavedDesignId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());
}

function loadSavedDesigns(): SavedDesign[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(savedDesignStorageKey) ?? "[]") as SavedDesign[];
    return Array.isArray(parsed) ? parsed.slice(0, 6) : [];
  } catch {
    return [];
  }
}

function storeSavedDesigns(savedDesigns: SavedDesign[]) {
  window.localStorage.setItem(savedDesignStorageKey, JSON.stringify(savedDesigns.slice(0, 6)));
}

function formatSavedDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

export default function RoomDesigner() {
  const [preferences, setPreferences] = useState<ProjectPreferences>(initialPreferences);
  const [roomPhoto, setRoomPhoto] = useState<{ dataUrl: string; name: string } | null>(null);
  const [generatedRender, setGeneratedRender] = useState<GeneratedRender | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [savedDesigns, setSavedDesigns] = useState<SavedDesign[]>(loadSavedDesigns);
  const [state, setState] = useState<GenerateState>("idle");
  const [message, setMessage] = useState("Take or upload one clear room photo to start.");
  const [shareLabel, setShareLabel] = useState("Copy shopping list");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const concept = useMemo(() => selectConcept(preferences), [preferences]);
  const visibleProducts = selectedProducts.length > 0 ? selectedProducts : createInitialSelection(preferences, products);
  const summary = calculateCartSummary(visibleProducts, preferences.budget);
  const hasResult = state === "ready" && (generatedRender || visibleProducts.length > 0);

  function updatePreferences(next: Partial<ProjectPreferences>) {
    setPreferences((current) => ({ ...current, ...next }));
    setShareLabel("Copy shopping list");
  }

  async function handlePhoto(file: File | undefined) {
    if (!file) {
      return;
    }

    if (!isSupportedImage(file)) {
      setState("error");
      setMessage("Use a JPG, PNG, or WebP room photo.");
      return;
    }

    setState("idle");
    setGeneratedRender(null);
    setSelectedProducts([]);
    setMessage("Room photo added. Adjust the brief or generate a redesign.");
    setRoomPhoto({
      dataUrl: await readImageAsDataUrl(file),
      name: file.name || "Room photo",
    });
  }

  async function handleGenerate() {
    if (!roomPhoto) {
      setState("error");
      setMessage("Take or upload a room photo first.");
      return;
    }

    setState("reading");
    setMessage("Reading the room layout...");
    setGeneratedRender(null);
    setShareLabel("Copy shopping list");

    window.setTimeout(() => {
      setState("planning");
      setMessage("Matching style, budget, and furniture...");
    }, 550);

    window.setTimeout(() => {
      setState("rendering");
      setMessage("Generating the after image...");
    }, 1100);

    try {
      const response = await fetch("/api/generate-room-render", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageDataUrl: roomPhoto.dataUrl,
          preferences,
          concept,
        }),
      });
      const payload = (await response.json().catch(() => null)) as (GeneratedRender & { error?: string }) | null;

      const nextProducts = createInitialSelection(preferences, products);
      const imageUrl = response.ok && payload?.imageUrl ? payload.imageUrl : null;

      setSelectedProducts(nextProducts);
      setState("ready");
      saveDesignSnapshot(nextProducts, imageUrl);

      if (!imageUrl) {
        setMessage(payload?.error ?? "Demo shopping plan ready. Connect OPENAI_API_KEY for live image generation.");
        return;
      }

      setGeneratedRender(payload);
      setMessage("Redesign generated. Review the after image and shopping plan.");
    } catch (error) {
      const nextProducts = createInitialSelection(preferences, products);
      setSelectedProducts(nextProducts);
      setState("ready");
      saveDesignSnapshot(nextProducts, null);
      setMessage(error instanceof Error ? error.message : "Demo shopping plan ready. Live generation is unavailable.");
    }
  }

  function handleSwap(productId: string) {
    setSelectedProducts((current) => swapProduct(current.length ? current : visibleProducts, productId, products));
    setShareLabel("Copy shopping list");
  }

  function handleRemove(productId: string) {
    setSelectedProducts((current) => removeProduct(current.length ? current : visibleProducts, productId));
    setShareLabel("Copy shopping list");
  }

  function saveDesignSnapshot(nextProducts: Product[], imageUrl: string | null) {
    if (!roomPhoto) {
      return;
    }

    const snapshot: SavedDesign = {
      id: createSavedDesignId(),
      conceptName: concept.name,
      createdAt: new Date().toISOString(),
      generatedImageUrl: imageUrl,
      preferences,
      products: nextProducts,
      roomPhoto,
    };

    setSavedDesigns((current) => {
      const next = [snapshot, ...current].slice(0, 6);
      storeSavedDesigns(next);
      return next;
    });
  }

  function restoreSavedDesign(savedDesign: SavedDesign) {
    setPreferences(savedDesign.preferences);
    setRoomPhoto(savedDesign.roomPhoto);
    setGeneratedRender(
      savedDesign.generatedImageUrl
        ? {
            imageUrl: savedDesign.generatedImageUrl,
            model: "saved-design",
          }
        : null,
    );
    setSelectedProducts(savedDesign.products);
    setState("ready");
    setMessage("Saved design restored. Review the render and shopping plan.");
    setShareLabel("Copy shopping list");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleCopyShoppingList() {
    await copyShoppingList({
      roomType: preferences.roomType,
      location: preferences.location,
      budget: preferences.budget,
      products: visibleProducts,
    });
    setShareLabel("Copied");
    window.setTimeout(() => setShareLabel("Copy shopping list"), 1400);
  }

  const statusText =
    state === "reading"
      ? "Reading room"
      : state === "planning"
        ? "Planning design"
        : state === "rendering"
          ? "Generating render"
          : hasResult
            ? "Shopping ready"
            : roomPhoto
              ? "Photo ready"
              : "Ready";

  return (
    <main className="min-h-screen bg-[#f3f0e8] text-[#20211d]">
      <section className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 gap-5 px-4 py-4 md:px-6 lg:grid-cols-[minmax(0,1fr)_390px]">
        <div className="flex min-h-[calc(100vh-2rem)] flex-col gap-5">
          <header className="flex items-center justify-between gap-4 rounded-[8px] border border-[#ded8cc] bg-[#fffefa] px-4 py-3 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[#33401f] text-sm font-black text-white">R</span>
              <div>
                <p className="text-sm font-black uppercase tracking-[0.16em]">Roomwise</p>
                <p className="text-xs font-semibold text-[#777268]">Mobile room redesign</p>
              </div>
            </div>
            <span className="rounded-full bg-[#e8eddd] px-3 py-1 text-xs font-black text-[#33401f]">{statusText}</span>
          </header>

          <section className="grid flex-1 overflow-hidden rounded-[8px] border border-[#ded8cc] bg-[#fffefa] shadow-[0_16px_44px_rgba(31,30,25,0.07)]">
            <div className="grid gap-5 p-4 md:p-5">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <div>
                  <h1 className="max-w-3xl text-4xl font-black leading-[0.96] tracking-0 md:text-6xl">
                    Take a room photo. Get a buyable redesign.
                  </h1>
                  <p className="mt-3 max-w-2xl text-base leading-7 text-[#6f6a60] md:text-lg">
                    Use your phone camera, choose a simple brief, then generate a realistic after image and furniture plan.
                  </p>
                </div>
                <button
                  className="min-h-12 rounded-[8px] bg-[#33401f] px-5 text-sm font-black text-white"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Take room photo
                </button>
              </div>

              <input
                ref={fileInputRef}
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                className="sr-only"
                type="file"
                onChange={(event) => void handlePhoto(event.target.files?.[0])}
              />

              <div className="grid gap-4 lg:grid-cols-2">
                <article className="overflow-hidden rounded-[8px] border border-[#ded8cc] bg-[#f8f6ef]">
                  <div className="flex items-center justify-between border-b border-[#ded8cc] px-3 py-2">
                    <strong className="text-sm">Before</strong>
                    <span className="text-xs font-bold text-[#777268]">{roomPhoto?.name ?? "No photo yet"}</span>
                  </div>
                  {roomPhoto ? (
                    <img className="h-[330px] w-full object-cover md:h-[440px]" src={roomPhoto.dataUrl} alt="Uploaded room before redesign" />
                  ) : (
                    <button
                      className="grid h-[330px] w-full place-items-center px-8 text-center md:h-[440px]"
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <span>
                        <span className="block text-3xl font-black">Open camera</span>
                        <span className="mt-3 block text-sm font-semibold text-[#777268]">
                          Take a clear, wide room photo in daylight.
                        </span>
                      </span>
                    </button>
                  )}
                </article>

                <article className="overflow-hidden rounded-[8px] border border-[#ded8cc] bg-[#f8f6ef]">
                  <div className="flex items-center justify-between border-b border-[#ded8cc] px-3 py-2">
                    <strong className="text-sm">After</strong>
                    <span className="text-xs font-bold text-[#777268]">{generatedRender ? "Image model" : "Preview"}</span>
                  </div>
                  {generatedRender ? (
                    <img className="h-[330px] w-full object-cover md:h-[440px]" src={generatedRender.imageUrl} alt="Generated room redesign" />
                  ) : (
                    <div className="grid h-[330px] place-items-center bg-[#ece7dc] px-8 text-center md:h-[440px]">
                      <span>
                        <span className="block text-3xl font-black">{state === "rendering" ? "Generating..." : "After image appears here"}</span>
                        <span className="mt-3 block text-sm font-semibold text-[#777268]">{message}</span>
                      </span>
                    </div>
                  )}
                </article>
              </div>

              <footer className="grid gap-3 border-t border-[#eee8dc] pt-4 md:grid-cols-[minmax(0,1fr)_260px] md:items-center">
                <p className="text-sm font-semibold text-[#6f6a60]">{message}</p>
                <button
                  className="min-h-14 rounded-[8px] bg-[#33401f] px-5 text-base font-black text-white disabled:bg-[#929487]"
                  disabled={!roomPhoto || state === "reading" || state === "planning" || state === "rendering"}
                  type="button"
                  onClick={() => void handleGenerate()}
                >
                  {state === "reading" || state === "planning" || state === "rendering" ? "Generating..." : "Generate redesign"}
                </button>
              </footer>
            </div>
          </section>
        </div>

        <aside className="grid content-start gap-4">
          <section className="rounded-[8px] border border-[#ded8cc] bg-[#fffefa] p-4 shadow-[0_16px_44px_rgba(31,30,25,0.07)]">
            <div className="mb-4">
              <h2 className="text-xl font-black">Design brief</h2>
              <p className="text-sm font-semibold text-[#777268]">{concept.name} · {formatCurrency(preferences.budget)}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-sm font-black">
                Room
                <select className="min-h-11 rounded-[8px] border border-[#d9d2c5] bg-white px-3 font-semibold" value={preferences.roomType} onChange={(event) => updatePreferences({ roomType: event.target.value as ProjectPreferences["roomType"] })}>
                  {roomTypes.map((room) => <option key={room.id} value={room.id}>{room.label}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-black">
                Style
                <select className="min-h-11 rounded-[8px] border border-[#d9d2c5] bg-white px-3 font-semibold" value={preferences.style} onChange={(event) => updatePreferences({ style: event.target.value as ProjectPreferences["style"] })}>
                  {styles.map((style) => <option key={style.id} value={style.id}>{style.label}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-black">
                Palette
                <select className="min-h-11 rounded-[8px] border border-[#d9d2c5] bg-white px-3 font-semibold" value={preferences.palette} onChange={(event) => updatePreferences({ palette: event.target.value as ProjectPreferences["palette"] })}>
                  {palettes.map((palette) => <option key={palette.id} value={palette.id}>{palette.label}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-black">
                Budget
                <select className="min-h-11 rounded-[8px] border border-[#d9d2c5] bg-white px-3 font-semibold" value={preferences.budget} onChange={(event) => updatePreferences({ budget: Number(event.target.value) })}>
                  <option value={1200}>EUR 1,200</option>
                  <option value={2500}>EUR 2,500</option>
                  <option value={4000}>EUR 4,000</option>
                </select>
              </label>
            </div>

            <label className="mt-3 grid gap-1 text-sm font-black">
              Keep or avoid
              <textarea
                className="min-h-24 rounded-[8px] border border-[#d9d2c5] bg-white px-3 py-2 font-semibold"
                placeholder="Example: keep the sofa, avoid grey walls"
                value={preferences.mustKeep}
                onChange={(event) => updatePreferences({ mustKeep: event.target.value })}
              />
            </label>
          </section>

          <section className="rounded-[8px] border border-[#ded8cc] bg-[#fffefa] p-4 shadow-[0_16px_44px_rgba(31,30,25,0.07)]">
            <div className="mb-4">
              <h2 className="text-xl font-black">Saved designs</h2>
              <p className="text-sm font-semibold text-[#777268]">
                {savedDesigns.length ? "Reopen a room plan from this device." : "Generated plans will appear here."}
              </p>
            </div>

            <div className="grid gap-2">
              {savedDesigns.length ? (
                savedDesigns.map((savedDesign) => (
                  <button
                    className="grid grid-cols-[58px_minmax(0,1fr)_auto] items-center gap-3 rounded-[8px] border border-[#e2dccf] bg-[#fbfaf6] p-2 text-left"
                    key={savedDesign.id}
                    type="button"
                    onClick={() => restoreSavedDesign(savedDesign)}
                  >
                    <img
                      className="h-14 w-14 rounded-[6px] object-cover"
                      src={savedDesign.generatedImageUrl ?? savedDesign.roomPhoto.dataUrl}
                      alt=""
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black">{savedDesign.conceptName}</span>
                      <span className="block truncate text-xs font-semibold text-[#777268]">
                        {savedDesign.roomPhoto.name}
                      </span>
                    </span>
                    <span className="text-xs font-black text-[#777268]">{formatSavedDate(savedDesign.createdAt)}</span>
                  </button>
                ))
              ) : (
                <div className="rounded-[8px] border border-dashed border-[#d9d2c5] bg-[#fbfaf6] px-3 py-5 text-sm font-semibold text-[#777268]">
                  Take a photo and generate a redesign to save the first room.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[8px] border border-[#ded8cc] bg-[#fffefa] p-4 shadow-[0_16px_44px_rgba(31,30,25,0.07)]">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">{summary.itemCount} matched items</h2>
                <p className="text-sm font-semibold text-[#777268]">
                  {formatCurrency(summary.total)} total · {formatCurrency(Math.abs(summary.remaining))} {summary.overBudget ? "over" : "remaining"}
                </p>
              </div>
              <button className="rounded-[8px] border border-[#d9d2c5] px-3 py-2 text-xs font-black" type="button" onClick={() => setSelectedProducts(createInitialSelection(preferences, products))}>
                Reset
              </button>
            </div>

            <div className="grid gap-2">
              {visibleProducts.slice(0, 6).map((product) => (
                <article className="grid grid-cols-[42px_minmax(0,1fr)_auto] gap-3 rounded-[8px] border border-[#e2dccf] bg-[#fbfaf6] p-2" key={product.id}>
                  <span className="h-10 rounded-[6px]" style={{ background: product.swatch }} />
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-black">{product.name}</h3>
                    <p className="truncate text-xs font-semibold text-[#777268]">{product.retailer} · {product.color}</p>
                    <a className="text-xs font-black text-[#33401f]" href={product.url} target="_blank" rel="noreferrer">View retailer</a>
                  </div>
                  <div className="grid justify-items-end gap-1">
                    <strong className="text-sm">{formatCurrency(product.price)}</strong>
                    <span className="flex gap-1">
                      <button className="rounded border border-[#d9d2c5] px-2 text-xs font-black" type="button" onClick={() => handleSwap(product.id)}>Swap</button>
                      <button className="rounded border border-[#d9d2c5] px-2 text-xs font-black" type="button" onClick={() => handleRemove(product.id)}>Remove</button>
                    </span>
                  </div>
                </article>
              ))}
            </div>

            <button className="mt-3 min-h-11 w-full rounded-[8px] border border-[#d9d2c5] bg-white px-4 text-sm font-black" type="button" onClick={() => void handleCopyShoppingList()}>
              {shareLabel}
            </button>
          </section>
        </aside>
      </section>
    </main>
  );
}
