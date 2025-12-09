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
  src: string; // base64 or blob URL
  fileName: string;
  mimeType: string;
  createdAt: number;
};

const STORAGE_KEY = "mantis-inspo-items-v1";

function loadItems(): InspoItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as InspoItem[];
  } catch {
    return [];
  }
}

function saveItems(items: InspoItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export default function InspoGallery() {
  const [items, setItems] = useState<InspoItem[]>([]);
  const [selected, setSelected] = useState<InspoItem | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    setItems(loadItems());
  }, []);

  useEffect(() => {
    saveItems(items);
  }, [items]);

  const sorted = useMemo(
    () => [...items].sort((a, b) => b.createdAt - a.createdAt),
    [items]
  );

  const addFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Only image files allowed.");
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
    reader.onerror = () => alert("Failed reading file.");
    reader.readAsDataURL(file);
  }, []);

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const arr = Array.from(files);
      for (const file of arr) addFile(file);
    },
    [addFile]
  );

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
    if (e.dataTransfer.files?.length) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
    e.target.value = "";
  };

  const importFromUrl = async () => {
    if (!imageUrl) return;
    try {
      setIsImporting(true);

      const res = await fetch("/api/fetch-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: imageUrl }),
      });

      if (!res.ok) {
        alert("Could not import image from link.");
        return;
      }

      const data = await res.json();
      const base64 = data.base64;
      const contentType = data.contentType || "image/jpeg";

      const binary = atob(base64);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);

      const blob = new Blob([bytes], { type: contentType });
      const ext = contentType.split("/")[1] || "jpg";
      const file = new File([blob], `imported.${ext}`, { type: contentType });

      handleFiles([file]);
      setImageUrl("");
    } catch (err) {
      console.error(err);
      alert("Import failed.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">

      {/* Upload + URL Import */}
      <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm flex flex-col gap-6">

        {/* Drag area */}
        <div
          className={`rounded-xl border-2 border-dashed p-6 text-center transition ${
            isDragging
              ? "border-black bg-neutral-100"
              : "border-neutral-300 bg-neutral-50"
          }`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <p className="font-medium text-sm mb-2">Drag & drop images here</p>
          <p className="text-xs text-neutral-500">
            GIFs, PNG, JPG, WEBP — all supported
          </p>

          <div className="mt-4">
            <label className="cursor-pointer px-4 py-2 bg-black text-white text-xs rounded-lg shadow-sm hover:bg-neutral-800">
              Choose files
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={onFileInput}
              />
            </label>
          </div>
        </div>

        {/* URL Import */}
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Import from link</p>
          <div className="flex gap-2">
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
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
            Works with Cosmos, Pinterest, Instagram, direct image URLs, etc.
          </p>
        </div>

      </section>

      {/* Gallery */}
      <section>
        <h2 className="text-xs uppercase tracking-wide text-neutral-600 mb-3">
          Library ({sorted.length})
        </h2>

        {sorted.length === 0 ? (
          <div className="border border-dashed border-neutral-200 rounded-xl p-10 text-center text-sm text-neutral-500">
            No inspo yet — upload or import to begin.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {sorted.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelected(item)}
                className="group border rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition"
              >
                <div className="aspect-[4/3] w-full bg-neutral-100 overflow-hidden">
                  <img
                    src={item.src}
                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform"
                  />
                </div>
                <div className="px-3 py-2 flex justify-between text-xs text-neutral-600">
                  <span className="truncate">{item.fileName}</span>
                  <span className="uppercase">{item.mimeType.replace("image/", "")}</span>
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
            className="bg-[#111] rounded-xl p-4 w-full max-w-4xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute right-3 top-3 bg-white/10 text-white text-xs px-2 py-1 rounded"
              onClick={() => setSelected(null)}
            >
              Close
            </button>

            <div className="aspect-video w-full bg-black rounded-xl overflow-hidden">
              <img
                src={selected.src}
                className="w-full h-full object-contain"
              />
            </div>

            <div className="text-xs text-neutral-400 mt-3 flex justify-between">
              <span className="text-white">{selected.fileName}</span>
              <span>
                {new Date(selected.createdAt).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

