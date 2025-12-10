'use client';

import { useEffect, useRef, useState } from 'react';

type InspoImage = {
  id: number;
  blobUrl: string;
  originalName?: string;
  project?: string;
  style_tags: string[];
  vibes: string[];
  color_palette: string[];
  medium?: string;
  use_case?: string;
  brand_refs: string[];
  notes?: string;
  created_at: string;
};

export default function InspoGallery() {
  const [images, setImages] = useState<InspoImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [useCase, setUseCase] = useState('');
  const [styleTag, setStyleTag] = useState('');
  const [selected, setSelected] = useState<InspoImage | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const projectRef = useRef<HTMLInputElement | null>(null);

  async function fetchImages(params?: {
    q?: string;
    use_case?: string;
    style_tag?: string;
  }) {
    const search = new URLSearchParams();
    if (params?.q) search.set('q', params.q);
    if (params?.use_case) search.set('use_case', params.use_case);
    if (params?.style_tag) search.set('style_tag', params.style_tag);

    const res = await fetch(`/api/images?${search.toString()}`);
    const data = (await res.json()) as InspoImage[];
    setImages(data);
  }

  useEffect(() => {
    fetchImages();
  }, []);

  async function uploadFile(file: File, project?: string) {
    setLoading(true);
    setStatus('Uploading & analyzing…');

    try {
      const formData = new FormData();
      formData.append('file', file);                    // FIXED HERE
      if (project && project.trim()) {
        formData.append('project', project.trim());
      }

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Upload failed');
      }

      setStatus('Done! Refreshing gallery…');
      await fetchImages();
      setTimeout(() => setStatus(''), 2000);
    } catch (err: any) {
      console.error(err);
      setStatus('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setStatus('Please choose an image.');
      return;
    }
    const project = projectRef.current?.value;
    await uploadFile(file, project);

    if (fileInputRef.current) fileInputRef.current.value = '';
    if (projectRef.current) projectRef.current.value = '';
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (!dragActive) setDragActive(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();

    if ((e.target as HTMLElement).classList.contains('dropzone')) {
      setDragActive(false);
    }
  }

  async function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) {
      setStatus('No file dropped.');
      return;
    }

    const file = files[0];
    const project = projectRef.current?.value;
    await uploadFile(file, project);                    // THIS WAS ALREADY CORRECT
  }

  function applyFilters() {
    fetchImages({
      q: query || undefined,
      use_case: useCase || undefined,
      style_tag: styleTag || undefined,
    });
  }

  function clearFilters() {
    setQuery('');
    setUseCase('');
    setStyleTag('');
    fetchImages();
  }

  return (
    <div className="page">
      <header className="header">
        <div className="header-inner">
          <div>
            <h1>MANTIS INSPO LIBRARY</h1>
            <p>Upload, auto-tag, and explore visual references for Mantis projects.</p>
          </div>
          <div className="badge">INTERNAL TOOL</div>
        </div>
      </header>

      <section className="section upload">
        <h2>Upload Image</h2>

        <div
          className={`dropzone ${dragActive ? 'drag-active' : ''} ${
            loading ? 'dropzone-loading' : ''
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="dropzone-content">
            <p className="dropzone-title">
              Drag & drop inspo here
              <span className="dropzone-pill">.jpg .png</span>
            </p>
            <p className="dropzone-sub">
              or use the upload button • We&apos;ll store it in Blob and auto-tag it
              with OpenAI.
            </p>

            <form onSubmit={handleUpload} className="upload-form">
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                disabled={loading}
              />
              <input
                type="text"
                placeholder="Project (optional)"
                ref={projectRef}
                disabled={loading}
              />
              <button type="submit" disabled={loading}>
                {loading ? 'Working…' : 'Upload & Analyze'}
              </button>
              <span className="status">{status}</span>
            </form>
          </div>
        </div>
      </section>

      <section className="section filters">
        <h2>Filter & Search</h2>
        <div className="filters-row">
          <input
            type="text"
            placeholder="Search text (notes, project, brand)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select value={useCase} onChange={(e) => setUseCase(e.target.value)}>
            <option value="">All use cases</option>
            <option value="retail">Retail</option>
            <option value="conference">Conference</option>
            <option value="museum/gallery">Museum / gallery</option>
            <option value="pop-up">Pop-up</option>
            <option value="event entry">Event entry</option>
            <option value="stage">Stage</option>
            <option value="activation zone">Activation zone</option>
            <option value="XR/virtual">XR / virtual</option>
            <option value="architecture/space">Architecture / space</option>
            <option value="misc">Misc</option>
          </select>
          <input
            type="text"
            placeholder="Style tag (e.g. brutalist)"
            value={styleTag}
            onChange={(e) => setStyleTag(e.target.value)}
          />
          <button type="button" onClick={applyFilters}>
            Apply
          </button>
            <button type="button" onClick={clearFilters}>
              Clear
            </button>
        </div>
      </section>

      <main className="main">
        <section className="gallery-section">
          <div className="section-header-row">
            <h2>Gallery</h2>
            <span className="count-pill">
              {images.length === 1
                ? '1 image'
                : `${images.length.toString().padStart(2, '0')} images`}
            </span>
          </div>

          {/* GALLERY GRID */}
          <div className="gallery-grid">
            {images.length === 0 && (
              <p className="empty">No images yet. Upload something to start.</p>
            )}

            {images.map((img) => (
              <div
                key={img.id}
                className="image-card"
                onClick={() => setSelected(img)}
              >
                <div className="thumb-wrapper">
                  <img src={img.blobUrl} alt={img.originalName || ''} />
                </div>
                <div className="meta">
                  <div className="meta-top">
                    <span className="use-case">
                      {img.use_case || 'Unclassified'}
                    </span>
                    <span className="medium">{img.medium || ''}</span>
                  </div>
                  <div className="tags">
                    {(img.style_tags || [])
                      .slice(0, 3)
                      .map((t) => (
                        <span key={t} className="tag">{t}</span>
                      ))}
                  </div>
                  {img.project && (
                    <div className="project-line">
                      <span className="project">{img.project}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div> 
        </section>

        {/* DETAIL PANEL */}
        {selected && (
          <aside className="detail-panel">
            <button
              className="close-detail"
              onClick={() => setSelected(null)}
              aria-label="Close details"
            >
              &times;
            </button>
            <div className="detail-content">
              <div className="detail-image-wrapper">
                <img src={selected.blobUrl} alt={selected.originalName || ''} />
              </div>

              <h2>{selected.project || selected.originalName || 'Inspo image'}</h2>

              <p className="detail-meta-line">
                <strong>Use case:</strong> {selected.use_case || '—'} &nbsp;|&nbsp;
                <strong>Medium:</strong> {selected.medium || '—'}
              </p>

              {selected.brand_refs?.length > 0 && (
                <p className="detail-meta-line">
                  <strong>Brand refs:</strong> {selected.brand_refs.join(', ')}
                </p>
              )}

              {selected.style_tags?.length > 0 && (
                <div className="pill-row">
                  <strong>Style tags:</strong>
                  {selected.style_tags.map((t) => (
                    <span key={t} className="pill">{t}</span>
                  ))}
                </div>
              )}

              {selected.vibes?.length > 0 && (
                <div className="pill-row">
                  <strong>Vibes:</strong>
                  {selected.vibes.map((v) => (
                    <span key={v} className="pill vibe">{v}</span>
                  ))}
                </div>
              )}

              {selected.color_palette?.length > 0 && (
                <div className="palette-row">
                  <strong>Palette:</strong> 
                  {selected.color_palette.map((hex, i) => (
                    <div key={i} className="swatch">
                      <div className="swatch-color" style={{ background: hex }} />
                      <span className="swatch-label">{hex}</span>
                    </div>
                  ))}
                </div>
              )}

              {selected.notes && (
                <div className="notes">
                  <strong>Notes:</strong>
                  <p>{selected.notes}</p>
                </div>
              )}

              <p className="timestamp">
                <strong>Created at:</strong>{' '}
                {new Date(selected.created_at).toLocaleString()}
              </p>
            </div>
          </aside>
        )}
      </main>
    </div>
  );
}
