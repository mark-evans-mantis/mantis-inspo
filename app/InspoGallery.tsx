"use client";

import React, {
  DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { v4 as uuidv4 } from "uuid";

type InspoItem = {
  id: string;
  src: string; // data URL
  fileName: string;
  mimeType: string;
  createdAt: number;
};

const LOCAL_STORAGE_KEY = "mantis-inspo-items-v1";

function loadItemsFromStorage(): InspoItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function saveItemsToStorage(items: InspoItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

export default function InspoGallery() {
  const [items, setItems] = useState<InspoItem[]>([]);
  const [selected, setSelected] = useState<InspoItem | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const initial = loadItemsFromStorage();
    setItems(initial);
  }, []);

  // Persist whenever items change
  useEffect(() => {
    saveItemsToStorage(items);
  }, [items]);

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => b.createdAt - a.createdAt),
    [items]
  );

  // --- core add function reused by file + URL import ---

  const addFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Only image files are allowed.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      const newItem: InspoItem = {
        id: uuidv4(),
        src,
        fileName: file.name,
        mimeType: file.type,
        createdAt: Date.now(),
      };
      setItems((prev) => [newItem, ...prev]);
    };
    reader.onerror = () => {
      alert(`Failed to read file: ${file.name}`);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const arr = Array.from(files);
      if (!arr.length) return;

      for (const file of arr) {
        addFile(file);
      }

      // === PLACEHOLDER: this is where you previously called OpenAI
      // If your old file had a function like processFiles(files: File[]),
      // you can move that logic here and call it with `arr`.
      // Example:
      // await processFiles(arr);
      // ======================
    },
    [addFile]
  );

  // --- drag & drop ---

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (!files || !files.length) return;
    handleFiles(files);
  };

  // --- file input change ---

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files.length) return;
    handleFiles(files);
    // reset the input so you can re-upload same file if needed
    e.target.value = "";
  };

  // --- import from URL using /api/fetch-image ---

  const handleImportFromUrl = async () => {
    if (!imageUrl) return;

    try {
      setIsImporting(true);

      const res = await fetch("/api/fetch-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: imageUrl }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        alert(error?.error || "Failed to import image from URL.");
        return;
      }

      const data: { base64: string; contentType?: string } = await res.json();

      const contentType = data.contentType || "image/jpeg";
      const binary = atob(data.base64);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: contentType });
      const ext = contentType.split("/")[1] || "jpg";
      const file = new File([blob], `imported.${ext}`, { type: contentType });

      handleFiles([file]);
      setImageUrl("");
    } catch (err) {
      console.error(err);
      alert("Something went wrong importing that URL.");
    } finally {
      setIsImporting(false);
    }
  };

  // --- modal helpers ---

  const closeModal = () => setSelected(null);

  return (
    <div className="flex flex-col gap-8">
      {/* Upload / controls */}
      <section className="grid gap-6 rounded-2xl border border-neutral-200 bg-white/80 p-5 shadow-sm backdrop-blur sm:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)]">
        {/* Left: upload zones */}
        <div className="flex flex-col gap-4">
          <div
            className={`flex flex-1 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center text-sm transition
              ${
                isDragging
                  ? "border-neutral-900 bg-neutral-50"
                  : "border-neutral-300 bg-neutral-50/60 hover:border-neutral-500"
              }`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            <p className="mb-1 font-medium text-neutral-800">
              Drag & drop images here
            </p>
            <p className="text-xs text-neutral-500">
              Supports GIFs and any image type (JPG, PNG, WEBP, etc.)
            </p>

            <div className="mt-4">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-black">
                <span>Browse files</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={onFileInputChange}
                />
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-2 text-xs text-neutral-500">
            <div>Tips</div>
            <ul className="list-disc pl-4">
              <li>GIFs will be stored and displayed like any other image.</li>
              <li>
                Use high-quality reference images for better inspiration results.
              </li>
            </ul>
          </div>
        </div>

        {/* Right: URL import + description */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 text-sm">
            <p className="font-medium text-neutral-800">
              Paste a link from Cosmos, Pinterest, Instagram, etc.
            </p>
            <p className="text-xs text-neutral-500">
              We&apos;ll try to pull the image or GIF from the URL and add it
              into your library. Works best with direct image/CDN links.
            </p>
            <div className="mt-1 flex gap-2">
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 outline-none focus:border-neutral-700 focus:ring-2 focus:ring-neutral-900/10"
              />
              <button
                type="button"
                onClick={handleImportFromUrl}
                disabled={!imageUrl || isImporting}
                className="rounded-lg border border-neutral-900 bg-neutral-900 px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
              >
                {isImporting ? "Importing…" : "Import"}
              </button>
            </div>
          </div>

          <div className="flex flex-1 flex-col justify-end gap-2 text-xs text-neutral-500">
            <p>
              Note: some platforms block direct image access. If a link doesn&apos;t
              work, try opening the image and copying the direct image URL, or
              download and upload manually.
            </p>
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-neutral-600">
            Library
          </h2>
          <span className="text-xs text-neutral-500">
            {sortedItems.length} item{sortedItems.length === 1 ? "" : "s"}
          </span>
        </div>

        {sortedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-white/50 px-6 py-10 text-center text-sm text-neutral-500">
            <p>No inspo yet.</p>
            <p className="mt-1 text-xs">
              Drag images in, upload files, or import from a link to start
              building your library.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {sortedItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelected(item)}
                className="group flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white text-left shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-neutral-100">
                  {/* image itself */}
                  <img
                    src={item.src}
                    alt={item.fileName}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="truncate text-xs font-medium text-neutral-800">
                    {item.fileName}
                  </div>
                  <div className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-neutral-500">
                    {item.mimeType.replace("image/", "")}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Modal for selected image, 16:9 safe zone */}
      {selected && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4"
          onClick={closeModal}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-4xl rounded-2xl bg-[#111111] p-4 text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={closeModal}
              className="absolute right-3 top-3 rounded-full bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/20"
            >
              Close
            </button>

            {/* 16:9 safe zone */}
            <div className="relative mt-4 aspect-video w-full overflow-hidden rounded-xl bg-black">
              <img
                src={selected.src}
                alt={selected.fileName}
                className="absolute inset-0 h-full w-full object-contain"
              />
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-neutral-300">
              <div className="truncate">
                <span className="font-medium text-white">
                  {selected.fileName}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="rounded-full bg-white/10 px-2 py-0.5 uppercase tracking-wide">
                  {selected.mimeType}
                </span>
                <span className="text-neutral-500">
                  Added{" "}
                  {new Date(selected.createdAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
