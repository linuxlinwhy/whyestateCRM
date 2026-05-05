import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Download, RefreshCw, Trash2, Upload } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { usePhotoStudio, type PhotoState } from "./hooks/usePhotoStudio";
import PhotoCard from "./components/PhotoCard";
import Lightbox from "./components/Lightbox";
import BatchPicker from "./components/BatchPicker";

export default function PhotoStudio() {
  const user = getCurrentUser();
  const userEmail = user?.email ?? "";

  const studio = usePhotoStudio(userEmail);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hovering, setHovering] = useState(false);

  const [lightbox, setLightbox] = useState<{ before: string; after: string | null } | null>(null);
  const [zipBusy, setZipBusy] = useState(false);

  // Block browser navigation when files are dropped outside the zone.
  useEffect(() => {
    const stop = (e: Event) => e.preventDefault();
    window.addEventListener("dragover", stop, false);
    window.addEventListener("drop", stop, false);
    return () => {
      window.removeEventListener("dragover", stop, false);
      window.removeEventListener("drop", stop, false);
    };
  }, []);

  const photos = useMemo(() => Array.from(studio.photos.values()), [studio.photos]);

  const totals = useMemo(() => {
    let total = 0, queued = 0, processing = 0, done = 0, errors = 0;
    for (const p of photos) {
      total++;
      if (p.status === "queued") queued++;
      else if (p.status === "processing") processing++;
      else if (p.status === "done") done++;
      else if (p.status === "error") errors++;
    }
    return { total, queued, processing, done, errors };
  }, [photos]);

  const hasPending = totals.queued > 0 || totals.errors > 0;

  // ───────────────────────────────────── handlers ──

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setHovering(false);
    if (e.dataTransfer?.files?.length) {
      void studio.addFiles(e.dataTransfer.files);
    }
  };

  const onCardCompare = (p: PhotoState) => {
    const before = p.originalObjectUrl ?? p.fal_original_url ?? "";
    if (!before) return;
    const active =
      p.active_version >= 0 && p.versions[p.active_version]
        ? p.versions[p.active_version].url
        : null;
    setLightbox({ before, after: active });
  };

  const downloadOne = async (p: PhotoState) => {
    if (p.active_version < 0 || !p.versions[p.active_version]) return;
    const url = p.versions[p.active_version].url;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = stripExt(p.filename) + "_enhanced.jpg";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch (e) {
      alert("Download failed: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const downloadZip = async () => {
    if (zipBusy) return;
    setZipBusy(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      for (const p of photos) {
        if (p.status !== "done" || p.active_version < 0) continue;
        const v = p.versions[p.active_version];
        if (!v) continue;
        const res = await fetch(v.url);
        if (!res.ok) continue;
        const blob = await res.blob();
        zip.file(stripExt(p.filename) + "_enhanced.jpg", blob);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `enhanced-${Date.now()}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 8000);
    } finally {
      setZipBusy(false);
    }
  };

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto">
      {/* Page header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "#DAF3F2" }}
        >
          <Camera size={20} style={{ color: "#1EC9C4" }} strokeWidth={2.2} />
        </div>
        <div>
          <h1 className="text-xl font-bold leading-tight" style={{ color: "#2B3340" }}>
            Photo Studio
          </h1>
          <p className="text-xs" style={{ color: "#A1A9B6" }}>
            Vision-driven listing photo enhancement
          </p>
        </div>
        <div className="flex-1" />
        <BatchPicker
          batches={studio.batches}
          activeBatchId={studio.activeBatchId}
          onSelect={studio.selectBatch}
          onNew={() => { void studio.newBatch(); }}
          onRename={studio.renameBatch}
          onDelete={studio.deleteBatch}
        />
      </div>

      {/* Drop zone */}
      <div
        className="rounded-xl text-center cursor-pointer transition-all"
        style={{
          padding: "36px 20px",
          background: hovering ? "#E8F8F7" : "#FFFFFF",
          border: `2px dashed ${hovering ? "#1EC9C4" : "#E8EBEF"}`,
        }}
        onClick={() => fileInputRef.current?.click()}
        onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setHovering(true); }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
          setHovering(true);
        }}
        onDragLeave={(e) => {
          if (e.target === e.currentTarget) setHovering(false);
        }}
        onDrop={onDrop}
      >
        <div className="flex items-center justify-center gap-2 mb-1.5">
          <Upload size={18} style={{ color: "#1EC9C4" }} />
          <p className="text-base font-semibold m-0" style={{ color: "#2B3340" }}>
            Drag photos here <span style={{ color: "#A1A9B6", fontWeight: 400 }}>or click</span>
          </p>
        </div>
        <p className="text-xs m-0" style={{ color: "#A1A9B6" }}>
          JPEG / PNG / WebP — multiple files supported
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) {
              void studio.addFiles(e.target.files);
              e.target.value = "";
            }
          }}
        />
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => { void studio.processAllPending(); }}
          disabled={studio.isRunning || !hasPending}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: "#1EC9C4", color: "#fff" }}
        >
          {studio.isRunning ? "Processing…" : "Process"}
        </button>
        <button
          onClick={() => { void studio.retryFailed(); }}
          disabled={studio.isRunning || totals.errors === 0}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: "transparent", border: "1px solid #E8EBEF", color: "#4B4F55" }}
        >
          <RefreshCw size={14} /> Retry failed
        </button>
        <button
          onClick={() => { void studio.clearAll(); }}
          disabled={photos.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: "transparent", border: "1px solid #E8EBEF", color: "#4B4F55" }}
        >
          <Trash2 size={14} /> Clear all
        </button>
        <button
          onClick={downloadZip}
          disabled={totals.done === 0 || zipBusy}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: "#1EC9C4", color: "#fff" }}
        >
          <Download size={14} /> {zipBusy ? "Preparing ZIP…" : "Download ZIP"}
        </button>
        <span className="ml-auto text-xs" style={{ color: "#A1A9B6" }}>
          {totals.total} photo{totals.total === 1 ? "" : "s"} • {totals.queued} queued • {totals.processing} processing • {totals.done} done
          {totals.errors > 0 ? ` • ${totals.errors} errors` : ""}
        </span>
      </div>

      {/* Loading state when switching batches */}
      {studio.loading && (
        <div className="text-sm" style={{ color: "#A1A9B6" }}>
          Loading batch…
        </div>
      )}

      {/* Empty state */}
      {!studio.loading && photos.length === 0 && (
        <div
          className="text-center py-12 rounded-xl border"
          style={{ borderColor: "#E8EBEF", background: "#FFFFFF" }}
        >
          <p className="text-sm" style={{ color: "#A1A9B6" }}>
            {studio.activeBatchId
              ? "No photos in this batch yet. Drop some above."
              : "Drop photos to start a new batch."}
          </p>
        </div>
      )}

      {/* Card grid */}
      {photos.length > 0 && (
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))" }}
        >
          {photos.map((p) => (
            <PhotoCard
              key={p.id}
              photo={p}
              isRunning={studio.isRunning}
              onCompare={() => onCardCompare(p)}
              onReprocess={() => { void studio.reprocessOne(p.id); }}
              onApplyEdit={(text) => { void studio.applySurgicalEdit(p.id, text); }}
              onSetActiveVersion={(idx) => { void studio.setActiveVersion(p.id, idx); }}
              onDownload={() => { void downloadOne(p); }}
              onRemove={() => { void studio.removePhoto(p.id); }}
            />
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <Lightbox
          beforeUrl={lightbox.before}
          afterUrl={lightbox.after}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}

function stripExt(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}
