"use client";

import React, { useCallback, useState } from "react";

type Asset = {
  id: string;
  sourceUrl: string;
  imageUrl: string;
  title: string;
  description: string;
  siteName?: string;
  createdAt: string;
};

const InspoGallery: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selected, setSelected] = useState<Asset | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Simple id helper
  const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  // -----------------------------
  // LINK IMPORT (Cosmos / Pinterest / IG / ANYTHING)
  // -----------------------------
  const handleImportFromUrl = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!urlInput.trim()) return;

      setIsImporting(true);
      setError(null);

      try {
        const res = await fetch("/api/fetch-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: urlInput.trim() }),
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Failed to import link");
        }

        const { asset } = data as { asset: any };

        const newAsset: Asset = {
          id: createId(),
          sourceUrl: asset.sourceUrl || urlInput.trim(),
          imageUrl: asset.imageUrl || asset.src || "",
          title: asset.title || "",
          description: asset.description || "",
          siteName: asset.siteName || "",
          createdAt: new Date().toISOString(),
        };

        setAssets((prev) => [newAsset, ...prev]);
        setSelected(newAsset);
        setUrlInput("");
      } catch (err: any) {
        console.error("Import error:", err);
        setError(err?.message || "Failed to import link");
      } finally {
        setIsImporting(false);
      }
    },
    [urlInput]
  );

  // -----------------------------
  // DRAG & DROP / FILE UPLOAD
  // -----------------------------
  const handleFilesUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      // assumes /api/upload expects "file"
      // if it supports multiple files, you can loop and append
      formData.append("file", files[0]);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to upload");
      }

      // Expecting something like { ok: true, url: string }
      const imageUrl: string = data.url || data.imageUrl;

      const newAsset: Asset = {
        id: createId(),
        sourceUrl: imageUrl,
        imageUrl,
        title: "",
        description: "",
        siteName: "",
        createdAt: new Date().toISOString(),
      };

      setAssets((prev) => [newAsset, ...prev]);
      setSelected(newAsset);
    } catch (err: any) {
      console.error("Upload error:", err);
      setError(err?.message || "Failed to upload");
    } finally {
      setIsUploading(false);
    }
  }, []);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    handleFilesUpload(files);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  // -----------------------------
  // RENDER
  // -----------------------------
  return (
    <div className="flex h-full w-full flex-col bg-[#f0f0f0] text-black">
      {/* TOP BAR: URL IMPORT + UPLOAD */}
      <div className="flex items-center gap-3 border-b border-black/10 bg-white px-6 py-4">
        <form
          onSubmit={handleImportFromUrl}
          className="flex flex-1 items-center gap-2"
        >
          <input
            type="url"
            placeholder="Paste a link from Cosmos, Pinterest, Instagram, etc."
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="flex-1 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black/40"
          />
          <button
            type="submit"
            disabled={!urlInput.trim() || isImporting}
            className="rounded-xl border border-black bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:border-black/30 disabled:bg-black/30"
          >
            {isImporting ? "Importing…" : "Import"}
          </button>
        </form>

        <label className="cursor-pointer rounded-xl border border-black/20 bg-white px-4 py-2 text-sm font-medium shadow-sm transition hover:shadow-md">
          {isUploading ? "Uploading…" : "Upload"}
          <input
            type="file"
            className="hidden"
            accept="image/*"
            onChange={(e) => handleFilesUpload(e.target.files)}
          />
        </label>
      </div>

      {/* ERROR BANNER */}
      {error && (
        <div className="bg-red-100 px-6 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* MAIN: DROP ZONE + GALLERY */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: DROP ZONE + GRID */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`mb-6 flex min-h-[140px] items-center justify-center rounded-2xl border border-dashed border-black/20 bg-[url('/noise.png')] bg-cover bg-center px-6 text-center text-xs font-medium uppercase tracking-wide text-black/60 transition ${
              isDragging ? "border-black/70 bg-black/5" : ""
            }`}
          >
            <span>Drag &amp; drop media here or use Import / Upload</span>
          </div>

          {/* GRID */}
          {assets.length === 0 ? (
            <div className="mt-10 text-center text-xs text-black/50">
              No media yet. Import a link or drag something in.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => setSelected(asset)}
                  className="group relative aspect-[3/4] overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
                >
                  {asset.imageUrl ? (
                    <img
                      src={asset.imageUrl}
                      alt={asset.title || "Imported image"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] text-black/40">
                      No image
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-0 bg-black/0 transition group-hover:bg-black/5" />
                  {asset.siteName && (
                    <div className="absolute bottom-2 left-2 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-black/70">
                      {asset.siteName}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: DETAIL PANEL (like your modal info area) */}
        <div className="hidden w-[320px] flex-shrink-0 border-l border-black/10 bg-white/80 px-4 py-4 text-xs text-black/80 md:block">
          {selected ? (
            <div className="flex h-full flex-col">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-black">
                Details
              </div>
              <div className="mb-3 aspect-[3/4] w-full overflow-hidden rounded-xl border border-black/10 bg-black/5">
                {selected.imageUrl && (
                  <img
                    src={selected.imageUrl}
                    alt={selected.title || "Selected image"}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>

              <div className="space-y-2 overflow-y-auto">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-black/50">
                    Title
                  </div>
                  <div className="text-xs font-medium">
                    {selected.title || "—"}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-wide text-black/50">
                    Description
                  </div>
                  <div className="text-xs">
                    {selected.description || "—"}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-wide text-black/50">
                    Source
                  </div>
                  <a
                    href={selected.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-[11px] text-blue-600 underline"
                  >
                    {selected.sourceUrl}
                  </a>
                </div>

                {selected.siteName && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-black/50">
                      Site
                    </div>
                    <div className="text-xs">{selected.siteName}</div>
                  </div>
                )}

                <div>
                  <div className="text-[10px] uppercase tracking-wide text-black/50">
                    Created
                  </div>
                  <div className="text-xs">
                    {new Date(selected.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-[11px] text-black/40">
              Select an item to see details
            </div>
          )}
        </div>
      </div>

      {/* SIMPLE MOBILE MODAL FOR SELECTED ITEM */}
      {selected && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4 md:hidden">
          <div className="max-h-full w-full max-w-sm overflow-hidden rounded-2xl bg-white text-xs text-black shadow-xl">
            <div className="flex items-center justify-between border-b border-black/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide">
              <span>Details</span>
              <button
                className="text-[11px] text-black/60"
                onClick={() => setSelected(null)}
              >
                Close
              </button>
            </div>
            <div className="space-y-2 overflow-y-auto px-4 py-3">
              <div className="aspect-[3/4] w-full overflow-hidden rounded-xl border border-black/10 bg-black/5">
                {selected.imageUrl && (
                  <img
                    src={selected.imageUrl}
                    alt={selected.title || "Selected image"}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-wide text-black/50">
                  Title
                </div>
                <div className="text-xs font-medium">
                  {selected.title || "—"}
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-wide text-black/50">
                  Description
                </div>
                <div className="text-xs">{selected.description || "—"}</div>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-wide text-black/50">
                  Source
                </div>
                <a
                  href={selected.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-[11px] text-blue-600 underline"
                >
                  {selected.sourceUrl}
                </a>
              </div>

              {selected.siteName && (
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-black/50">
                    Site
                  </div>
                  <div className="text-xs">{selected.siteName}</div>
                </div>
              )}

              <div>
                <div className="text-[10px] uppercase tracking-wide text-black/50">
                  Created
                </div>
                <div className="text-xs">
                  {new Date(selected.createdAt).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InspoGallery;
