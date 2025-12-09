"use client";

import React, {
  useState,
  useEffect,
  DragEvent,
  useCallback,
} from "react";

type InspoImage = {
  id: number;
  blobUrl: string;
  originalName: string;
  project: string | null;
  style_tags: string[];
  vibes: string[];
  color_palette: string[];
  medium: string | null;
  use_case: string | null;
  brand_refs: string[];
  notes: string | null;
  created_at: string;
};

export default function InspoGallery() {
  const [items, setItems] = useState<InspoImage[]>([]);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<InspoImage | null>(null);

  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [imageUrl, setImageUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  // -------------------------------------------------------------
  // LOAD IMAGES FROM YOUR BACKEND
  // -------------------------------------------------------------
  async function loadImages() {
    try {
      setLoading(true);
      const res = await fetch("/api/images");
      const data = await res.json();
      setItems(data);
    } catch (err) {
      console.error("Failed to load images:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadImages();
  }, []);

  // -------------------------------------------------------------
  // HANDLE FILE UPLOAD (SEQUENTIAL)
  // -------------------------------------------------------------
  async function uploadFileToServer(file: File) {
    const formData = new FormData();
    formData.append("image", file);
    formData.append("project", "");

    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Upload failed");
    }

    return res.json();
  }

  async function handleUpload(files: FileList | File[]) {
    setIsUploading(true);

    const arr = Array.from(files);

    for (const file of arr) {
      try {
        await uploadFileToServer(file);
      } catch (err) {
        console.error("Upload error:", err);
        alert("Upload failed for a file.");
      }
    }

    setIsUploading(false);
    await loadImages(); // refresh gallery from DB
  }

  // -------------------------------------------------------------
  // DRAG & DROP HANDLERS
  // -------------------------------------------------------------
  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(true);
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.length) {
      handleUpload(e.dataTransfer.files);
    }
  };

  // -------------------------------------------------------------
  // URL IMPORT → FILE → UPLOAD
  // -------------------------------------------------------------
  async function importFromUrl() {
    if (!imageUrl) return;

    try {
      setIsImporting(true);

      const res = await fetch("/api/fetch-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: imageUrl }),
      });

      if (!res.ok) {
        alert("Could not import from link.");
        return;
      }

      const data = await res.json();
      const base64 = data.base64;
      const contentType = data.contentType || "image/jpeg";

      // Convert base64 → Blob → File
      const binary = atob(base64);
      const len = binary.length;
      const buffer = new Uint8Array(len);
      for (let i = 0; i < len; i++) buffer[i] = binary.charCodeAt(i);

      const blob = new Blob([buffer], { type: contentType });
      const ext = contentType.split("/")[1] || "jpg";
      const file = new File([blob], `imported.${ext}`, { type: contentType });

      await handleUpload([file]);

      setImageUrl("");
    } catch (err) {
      console.error(err);
      alert("Failed to import link.");
    } finally {
      setIsImporting(false);
    }
  }

  // -------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------
  return (
    <div className="flex flex-col gap-8">

      {/* Upload section */}
      <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm space-y-6">

        {/* Drag & Drop */}
        <div
          className={`rounded-xl border-2 border-dashed p-8 text-center transition
            ${
              dragActive
                ? "border-black bg-neutral-100"
                : "border-neutral-300 bg-neutral-50"
            }`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <p className="text-sm font-medium mb-2">Drag & drop images here</p>
          <p className="text-xs text-neutral-500">GIFs, PNG, JPG, WEBP — all supported</p>

          <div className="mt-4">
            <label className="cursor-pointer inline-block px-4 py-2 bg-black text-white text-xs rounded-lg hover:bg-neutral-800">
              Select files
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && handleUpload(e.target.files)}
              />
            </label>
          </div>

          {isUploading && (
            <p className="text-xs text-neutral-500 mt-2">Uploading…</p>
          )}
        </div>

        {/* URL Import */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Import from link</p>

          <div className="flex gap-2">
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="flex-1 border rounded-lg px-3 py-2 text-sm"
            />

            <button
              onClick={importFromUrl}
              disabled={!imageUrl || isImporting}
              className="px-4 py-2 bg-black text-white text-xs rounded-lg disabled:opacity-40"
            >
              {isImporting ? "Importing…" : "Import"}
            </button>
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section>
        <h2 className="text-xs uppercase tracking-wide text-neutral-600 mb-4">
          Library ({items.length})
        </h2>

        {loading ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-neutral-500">No images yet.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {items.map((img) => (
              <button
                key={img.id}
                onClick={() => setSelected(img)}
                className="group bg-white border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition text-left"
              >
                <div className="aspect-[4/3] bg-neutral-100 overflow-hidden">
                  <img
                    src={img.blobUrl}
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
                  />
                </div>

                <div className="p-3 space-y-1">
                  <p className="text-xs font-medium text-neutral-700 truncate">
                    {img.project || img.originalName}
                  </p>

                  {/* Top 3 style tags */}
                  <div className="flex flex-wrap gap-1 text-[10px] text-neutral-500">
                    {img.style_tags?.slice(0, 3).map((tag, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-neutral-100 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <p className="text-[10px] text-neutral-400">
                    {new Date(img.created_at).toLocaleDateString()}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-[#111] rounded-xl p-4 w-full max-w-4xl relative text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute right-3 top-3 bg-white/10 px-2 py-1 rounded text-xs"
              onClick={() => setSelected(null)}
            >
              Close
            </button>

            {/* Image (16:9 modal safe zone) */}
            <div className="aspect-video bg-black rounded-xl overflow-hidden">
              <img
                src={selected.blobUrl}
                className="w-full h-full object-contain"
              />
            </div>

            {/* Metadata */}
            <div className="mt-4 space-y-3 text-xs text-neutral-300">

              <p className="text-white font-medium text-sm">
                {selected.originalName}
              </p>

              <p>
                <span className="text-neutral-500">Project: </span>
                {selected.project || "—"}
              </p>

              <p>
                <span className="text-neutral-500">Style tags: </span>
                {selected.style_tags?.join(", ")}
              </p>

              <p>
                <span className="text-neutral-500">Vibes: </span>
                {selected.vibes?.join(", ")}
              </p>

              <p>
                <span className="text-neutral-500">Color palette: </span>
                {selected.color_palette?.join(", ")}
              </p>

              <p>
                <span className="text-neutral-500">Medium: </span>
                {selected.medium}
              </p>

              <p>
                <span className="text-neutral-500">Use case: </span>
                {selected.use_case}
              </p>

              <p>
                <span className="text-neutral-500">Brand refs: </span>
                {selected.brand_refs?.join(", ")}
              </p>

              <p>
                <span className="text-neutral-500">Notes: </span>
                {selected.notes}
              </p>

              <p className="text-neutral-500">
                Created: {new Date(selected.created_at).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
