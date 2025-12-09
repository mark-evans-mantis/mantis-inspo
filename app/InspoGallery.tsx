"use client";

import React, { useState, useEffect, DragEvent } from "react";

type InspoItem = {
  id: number;
  blobUrl: string;
  thumbBlobUrl: string | null;
  originalName: string;
  project: string | null;
  mimeType: string;
  durationSeconds: number | null;
  style_tags: string[];
  vibes: string[];
  color_palette: string[];
  medium: string | null;
  use_case: string | null;
  brand_refs: string[];
  notes: string | null;
  created_at: string;
  isVideo: boolean;
  isGif: boolean;
};

export default function InspoGallery() {
  const [items, setItems] = useState<InspoItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<InspoItem | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const [imageUrl, setImageUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  /* -----------------------------------------------------------
     LOAD ITEMS FROM /api/images (robust)
  ----------------------------------------------------------- */
  async function loadItems() {
    try {
      setLoading(true);
      const res = await fetch("/api/images");

      if (!res.ok) {
        console.error("Failed to load /api/images:", res.status);
        setItems([]);
        return;
      }

      const data = await res.json();
      if (Array.isArray(data)) {
        setItems(data);
      } else {
        console.error("Unexpected /api/images payload:", data);
        setItems([]);
      }
    } catch (e) {
      console.error("Error fetching images:", e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadItems();
  }, []);

  /* -----------------------------------------------------------
     CLIENT-SIDE VIDEO THUMBNAIL GENERATION
  ----------------------------------------------------------- */
  function generateVideoThumbnail(
    file: File
  ): Promise<{ thumbFile: File; durationSeconds: number | null }> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");

      video.preload = "metadata";
      video.src = url;
      video.muted = true;
      video.playsInline = true;

      const cleanup = () => {
        URL.revokeObjectURL(url);
      };

      video.addEventListener("error", () => {
        cleanup();
        reject(new Error("Error loading video for thumbnail."));
      });

      video.addEventListener("loadedmetadata", () => {
        let duration = video.duration;
        if (!Number.isFinite(duration) || duration <= 0) {
          duration = 0;
        }

        // Capture at ~10% of duration, or at 1s if duration is unknown
        const captureTime =
          duration > 0 ? Math.min(duration * 0.1, duration - 0.1) : 1;

        // Seek then grab frame
        video.currentTime = captureTime;
      });

      video.addEventListener("seeked", () => {
        const canvas = document.createElement("canvas");
        const width = video.videoWidth || 640;
        const height = video.videoHeight || 360;
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          cleanup();
          return reject(new Error("Canvas 2D context not available"));
        }

        ctx.drawImage(video, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            cleanup();
            if (!blob) {
              return reject(new Error("Failed to create thumbnail blob"));
            }

            const thumbFile = new File(
              [blob],
              file.name.replace(/\.[^/.]+$/, "") + "-thumb.jpg",
              { type: "image/jpeg" }
            );

            const durationSeconds = Number.isFinite(video.duration)
              ? Math.round(video.duration)
              : null;

            resolve({ thumbFile, durationSeconds });
          },
          "image/jpeg",
          0.85
        );
      });
    });
  }

  /* -----------------------------------------------------------
     UPLOAD HANDLING (SEQUENTIAL)
  ----------------------------------------------------------- */
  async function uploadFile(file: File) {
    const formData = new FormData();

    if (file.type.startsWith("video/")) {
      // Generate thumbnail on the client
      try {
        const { thumbFile, durationSeconds } =
          await generateVideoThumbnail(file);
        formData.append("image", file);
        formData.append("thumb", thumbFile);
        if (durationSeconds != null) {
          formData.append("duration", String(durationSeconds));
        }
      } catch (err) {
        console.error("Video thumbnail generation failed:", err);
        // Fallback: upload video without thumb/analysis
        formData.append("image", file);
      }
    } else {
      // Image / GIF
      formData.append("image", file);
    }

    formData.append("project", "");

    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Upload failed");
    }
  }

  async function handleUpload(files: FileList | File[]) {
    setIsUploading(true);
    const arr = Array.from(files);

    for (const file of arr) {
      try {
        await uploadFile(file);
      } catch (err) {
        console.error("Upload failed:", err);
        alert("An upload failed. Continuing with remaining files.");
      }
    }

    setIsUploading(false);
    loadItems();
  }

  /* -----------------------------------------------------------
     DRAG & DROP
  ----------------------------------------------------------- */
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

  /* -----------------------------------------------------------
     URL IMPORT → /api/fetch-image → create File → upload
  ----------------------------------------------------------- */
  async function importFromUrl() {
    if (!imageUrl) return;
    setIsImporting(true);

    try {
      const res = await fetch("/api/fetch-image", {
        method: "POST",
        body: JSON.stringify({ url: imageUrl }),
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        alert("Failed to import from URL.");
        setIsImporting(false);
        return;
      }

      const data = await res.json();
      const base64 = data.base64;
      const mime = data.contentType || "application/octet-stream";

      const byteString = atob(base64);
      const byteArray = new Uint8Array(byteString.length);
      for (let i = 0; i < byteString.length; i++) {
        byteArray[i] = byteString.charCodeAt(i);
      }

      const blob = new Blob([byteArray], { type: mime });
      const ext =
        mime.split("/")[1] ||
        (mime.includes("video") ? "mp4" : mime.includes("image") ? "jpg" : "");

      const file = new File([blob], `imported.${ext}`, { type: mime });

      await handleUpload([file]);
      setImageUrl("");
    } catch (err) {
      console.error("URL import error:", err);
      alert("Import failed.");
    }
    setIsImporting(false);
  }

  /* -----------------------------------------------------------
     DELETE ITEM
  ----------------------------------------------------------- */
  async function deleteItem(id: number) {
    const ok = confirm("Delete this asset permanently? This cannot be undone.");
    if (!ok) return;

    try {
      const res = await fetch(`/api/images/${id}`, { method: "DELETE" });
      if (!res.ok) {
        alert("Failed to delete.");
        return;
      }
      loadItems();
    } catch (err) {
      console.error("Delete error:", err);
      alert("Error deleting asset.");
    }
  }

  /* -----------------------------------------------------------
     RENDER
  ----------------------------------------------------------- */

  return (
    <div className="flex flex-col gap-8">

      {/* UPLOAD PANEL */}
      <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm space-y-6">

        {/* Drag area */}
        <div
          className={`rounded-xl border-2 border-dashed p-8 text-center transition ${
            dragActive
              ? "border-black bg-neutral-100"
              : "border-neutral-300 bg-neutral-50"
          }`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <p className="text-sm font-medium mb-2">Drag & drop media here</p>
          <p className="text-xs text-neutral-500">
            Supports GIFs, MP4, MOV, JPG, PNG, WEBP…
          </p>

          <div className="mt-4">
            <label className="cursor-pointer inline-block px-4 py-2 bg-black text-white text-xs rounded-lg hover:bg-neutral-800">
              Select files
              <input
                type="file"
                accept="image/*,video/*"
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

        {/* URL IMPORT */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Import from link</p>
          <div className="flex gap-2">
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/image-or-video"
              className="flex-1 border rounded-lg px-3 py-2 text-sm"
            />
            <button
              disabled={!imageUrl || isImporting}
              onClick={importFromUrl}
              className="px-4 py-2 bg-black text-white text-xs rounded-lg disabled:opacity-40"
            >
              {isImporting ? "Importing…" : "Import"}
            </button>
          </div>
          <p className="text-xs text-neutral-500">
            Supports Cosmos, Pinterest, Instagram, and most media hosts.
          </p>
        </div>

      </section>

      {/* GALLERY */}
      <section>
        <h2 className="text-xs uppercase tracking-wide text-neutral-600 mb-4">
          Library ({items.length})
        </h2>

        {loading ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-neutral-500">No media yet.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="relative group bg-white border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition"
              >
                <button
                  onClick={() => deleteItem(item.id)}
                  className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition bg-black/50 text-white text-xs px-2 py-1 rounded"
                >
                  Delete
                </button>

                <button
                  className="w-full text-left"
                  onClick={() => setSelected(item)}
                >
                  <div className="aspect-[4/3] bg-neutral-100 overflow-hidden">
                    {item.mimeType?.startsWith("video/") ? (
                      <video
                        src={item.blobUrl}
                        muted
                        loop
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const vid = e.currentTarget;
                          if (item.thumbBlobUrl) vid.src = item.thumbBlobUrl;
                        }}
                      />
                    ) : (
                      <img
                        src={item.blobUrl}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>

                  <div className="p-3 space-y-1">
                    <p className="text-xs font-medium text-neutral-700 truncate">
                      {item.project || item.originalName}
                    </p>

                    <div className="flex flex-wrap gap-1 text-[10px] text-neutral-500">
                      {item.style_tags?.slice(0, 3).map((tag, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-neutral-100 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    <p className="text-[10px] text-neutral-400">
                      {new Date(item.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* MODAL */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-[#111] rounded-xl p-6 w-full max-w-4xl relative text-white overflow-auto max-h-[95vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute right-4 top-4 bg-white/10 px-3 py-1 rounded text-xs"
              onClick={() => setSelected(null)}
            >
              Close
            </button>

            <div className="aspect-video bg-black rounded-xl overflow-hidden mb-4">
              {selected.mimeType?.startsWith("video/") ? (
                <video
                  src={selected.blobUrl}
                  controls
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain"
                />
              ) : (
                <img
                  src={selected.blobUrl}
                  className="w-full h-full object-contain"
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-6 text-xs">
              <div>
                <p className="font-medium text-sm text-white mb-2">
                  {selected.originalName}
                </p>
                <p>
                  <span className="text-neutral-500">Project: </span>
                  {selected.project || "—"}
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
                  <span className="text-neutral-500">Duration: </span>
                  {selected.durationSeconds || 0}s
                </p>
                <p>
                  <span className="text-neutral-500">Created: </span>
                  {new Date(selected.created_at).toLocaleString()}
                </p>
              </div>

              <div>
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
                  <span className="text-neutral-500">Brand refs: </span>
                  {selected.brand_refs?.join(", ")}
                </p>
                <p>
                  <span className="text-neutral-500">Notes: </span>
                  {selected.notes || "—"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
