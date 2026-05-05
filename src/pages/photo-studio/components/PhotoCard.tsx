import { useState } from "react";
import { Download, Maximize2, Pencil, RefreshCw, Trash2, X } from "lucide-react";
import type { PhotoState } from "../hooks/usePhotoStudio";

const STATUS_BG: Record<PhotoState["status"], string> = {
  queued:     "#94A3B8",
  processing: "#D97706",
  done:       "#16A34A",
  error:      "#DC2626",
};

interface Props {
  photo: PhotoState;
  onCompare: () => void;
  onReprocess: () => void;
  onApplyEdit: (instruction: string) => void;
  onSetActiveVersion: (idx: number) => void;
  onDownload: () => void;
  onRemove: () => void;
  isRunning: boolean;
}

export default function PhotoCard({
  photo,
  onCompare,
  onReprocess,
  onApplyEdit,
  onSetActiveVersion,
  onDownload,
  onRemove,
  isRunning,
}: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [editText, setEditText] = useState("");

  const beforeUrl = photo.originalObjectUrl ?? photo.fal_original_url ?? "";
  const activeVersion =
    photo.active_version >= 0 && photo.versions[photo.active_version]
      ? photo.versions[photo.active_version]
      : null;
  const afterUrl = activeVersion?.url ?? null;

  const handleApply = () => {
    const text = editText.trim();
    if (!text) {
      // Empty input → reprocess full pipeline
      setEditOpen(false);
      setEditText("");
      onReprocess();
      return;
    }
    setEditOpen(false);
    setEditText("");
    onApplyEdit(text);
  };

  const chips: { label: string; kind: "auto" | "issue" | "warn" }[] = [];
  chips.push({ label: "light optimizing", kind: "auto" });
  if (photo.analysis) {
    const a = photo.analysis;
    if (!a.valid && a.reject_reason) chips.push({ label: `rejected: ${a.reject_reason}`, kind: "warn" });
    if (a.tilt_issue) chips.push({ label: "tilt issue", kind: "issue" });
    if (a.lens_distortion && a.lens_distortion !== "none") {
      chips.push({ label: `lens: ${a.lens_distortion}`, kind: "issue" });
    }
    if (a.blown_windows) chips.push({ label: "blown windows", kind: "issue" });
    if (a.person_or_pet) chips.push({ label: "person/pet", kind: "issue" });
  }

  const isProcessing = photo.status === "processing";
  const statusLabel = photo.status_label || photo.status;

  return (
    <div
      className="relative flex flex-col gap-2 rounded-lg border bg-white p-2.5"
      style={{ borderColor: "#E8EBEF" }}
    >
      {/* Status badge */}
      <div
        className="absolute z-10 px-2 py-0.5 rounded-full uppercase font-semibold tracking-wide"
        style={{
          top: 14, right: 14,
          fontSize: 9,
          letterSpacing: "0.5px",
          background: STATUS_BG[photo.status],
          color: "#fff",
          animation: isProcessing ? "ps-pulse 1.4s ease-in-out infinite" : undefined,
        }}
      >
        {statusLabel}
      </div>

      {/* Remove button — top-left */}
      <button
        onClick={onRemove}
        title="Remove from batch"
        className="absolute z-10 w-6 h-6 rounded-full flex items-center justify-center transition-colors"
        style={{
          top: 6, left: 6,
          background: "rgba(255,255,255,0.92)",
          border: "1px solid #E8EBEF",
          color: "#A1A9B6",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <X size={12} />
      </button>

      {/* Image grid */}
      <div className="relative grid gap-1" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div
          className="relative overflow-hidden rounded cursor-zoom-in flex items-center justify-center"
          style={{ aspectRatio: "4 / 3", background: "#0a0c10" }}
          onClick={onCompare}
        >
          {beforeUrl ? (
            <img
              src={beforeUrl}
              alt="before"
              className="w-full h-full"
              style={{ objectFit: "contain" }}
            />
          ) : (
            <span className="text-xs" style={{ color: "#4b5563" }}>No source</span>
          )}
          <span
            className="absolute"
            style={{
              bottom: 4, left: 4,
              background: "rgba(0,0,0,0.65)",
              color: "white",
              padding: "2px 7px",
              borderRadius: 3,
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: "0.3px",
            }}
          >Before</span>
        </div>

        <div
          className="relative overflow-hidden rounded flex items-center justify-center cursor-zoom-in"
          style={{ aspectRatio: "4 / 3", background: "#0a0c10" }}
          onClick={onCompare}
        >
          {afterUrl && !isProcessing && (
            <>
              <img
                src={afterUrl}
                alt="after"
                className="w-full h-full"
                style={{ objectFit: "contain" }}
              />
              <span
                className="absolute"
                style={{
                  bottom: 4, left: 4,
                  background: "rgba(0,0,0,0.65)",
                  color: "white",
                  padding: "2px 7px",
                  borderRadius: 3,
                  fontSize: 10,
                  fontWeight: 500,
                  letterSpacing: "0.3px",
                }}
              >After</span>
            </>
          )}
          {!afterUrl && !isProcessing && (
            <span className="text-xs" style={{ color: "#4b5563" }}>Not processed</span>
          )}
          {isProcessing && <ProcessingOverlay label={statusLabel} hasImage={!!afterUrl} priorAfter={afterUrl} />}
        </div>

        {/* Compare button */}
        <button
          onClick={(e) => { e.stopPropagation(); onCompare(); }}
          disabled={!afterUrl}
          title="Fullscreen compare"
          className="absolute z-[2] flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            bottom: 6,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "4px 10px",
            background: "rgba(20, 23, 29, 0.92)",
            border: "1px solid #2a2e38",
            color: "#d1d5db",
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.4px",
            borderRadius: 4,
            backdropFilter: "blur(4px)",
          }}
        >
          <Maximize2 size={10} /> Compare
        </button>
      </div>

      {/* Versions */}
      {photo.versions.length > 1 && (
        <div className="flex flex-wrap items-center gap-1" style={{ paddingTop: 2 }}>
          <span className="mr-1 text-[10px] font-medium" style={{ color: "#6b7280" }}>Versions:</span>
          {photo.versions.map((v, i) => {
            const truncated = v.label.length > 30 ? v.label.slice(0, 27) + "…" : v.label;
            const active = i === photo.active_version;
            return (
              <button
                key={i}
                onClick={() => onSetActiveVersion(i)}
                title={v.label + (v.source === "ai" ? " (initial AI version)" : "")}
                className="text-[10px] font-medium rounded-full transition-all"
                style={{
                  padding: "3px 9px",
                  background: active ? "#1EC9C4" : "#FFFFFF",
                  border: `1px solid ${active ? "#1EC9C4" : "#E8EBEF"}`,
                  color: active ? "#FFFFFF" : "#4B4F55",
                  borderStyle: v.source === "ai" ? "dashed" : "solid",
                  maxWidth: 180,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {truncated}
              </button>
            );
          })}
        </div>
      )}

      {/* Meta */}
      <div className="px-1">
        <div className="text-[11px] truncate" style={{ color: "#4B4F55", wordBreak: "break-all" }}>{photo.filename}</div>
        {(photo.origW || photo.origH) ? (
          <div className="text-[11px]" style={{ color: "#A1A9B6" }}>
            {photo.origW} × {photo.origH}
          </div>
        ) : null}
        {photo.error && <div className="text-[11px]" style={{ color: "#EF4444" }}>{photo.error}</div>}
      </div>

      {/* Chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1 px-1">
          {chips.map((c, i) => (
            <span key={i} className="inline-flex items-center rounded-full" style={chipStyle(c.kind)}>
              {c.label}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-1.5 pt-1 border-t" style={{ borderColor: "#E8EBEF" }}>
        <button
          onClick={() => setEditOpen((o) => !o)}
          disabled={isRunning}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[11px] font-medium transition-colors disabled:opacity-50"
          style={{ background: "#1EC9C4", color: "#fff" }}
        >
          <Pencil size={11} /> Edit
        </button>
        <button
          onClick={onReprocess}
          disabled={isRunning}
          title="Reprocess full pipeline"
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[11px] font-medium transition-colors disabled:opacity-50"
          style={{ background: "transparent", border: "1px solid #E8EBEF", color: "#4B4F55" }}
        >
          <RefreshCw size={11} /> Reprocess
        </button>
        <button
          onClick={onDownload}
          disabled={!afterUrl}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[11px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: "transparent", border: "1px solid #E8EBEF", color: "#4B4F55" }}
        >
          <Download size={11} /> Download
        </button>
      </div>

      {/* Edit panel */}
      {editOpen && (
        <div
          className="mt-1.5 flex flex-col gap-1.5 p-2 rounded border"
          style={{ background: "#F9FAFB", borderColor: "#E8EBEF" }}
        >
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={3}
            placeholder='Targeted change (e.g. "remove the lamp on the left", "make the wood floor warmer"). Leave empty to re-run the full pipeline with current chip settings.'
            className="w-full resize-y px-2 py-1.5 text-[11px] rounded border"
            style={{ borderColor: "#E8EBEF", color: "#2B3340", background: "#fff" }}
          />
          <div className="flex gap-1.5">
            <button
              onClick={handleApply}
              disabled={isRunning}
              className="flex-1 px-2 py-1.5 rounded text-[11px] font-medium transition-colors disabled:opacity-50"
              style={{ background: "#1EC9C4", color: "#fff" }}
            >
              Apply
            </button>
            <button
              onClick={() => { setEditOpen(false); setEditText(""); }}
              className="flex-1 px-2 py-1.5 rounded text-[11px] font-medium transition-colors"
              style={{ background: "transparent", border: "1px solid #E8EBEF", color: "#4B4F55" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProcessingOverlay({
  label,
  hasImage,
  priorAfter,
}: {
  label: string;
  hasImage: boolean;
  priorAfter: string | null;
}) {
  return (
    <>
      {hasImage && priorAfter && (
        <img
          src={priorAfter}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full"
          style={{ objectFit: "contain" }}
        />
      )}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 overflow-hidden z-[2]"
        style={{
          background: hasImage
            ? "rgba(10, 12, 16, 0.55)"
            : "linear-gradient(110deg, #0a0c10 8%, #1a1d24 18%, #0a0c10 33%)",
          backgroundSize: hasImage ? undefined : "200% 100%",
          animation: hasImage ? "ps-backdrop-pulse 2.4s infinite ease-in-out" : "ps-shimmer-bg 2s infinite linear",
          backdropFilter: hasImage ? "blur(3px)" : undefined,
        }}
      >
        <div
          className="relative overflow-hidden rounded-full"
          style={{ width: "62%", height: 2, background: "rgba(255,255,255,0.1)", zIndex: 2 }}
        >
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(90deg, transparent, #1EC9C4 50%, transparent)",
              animation: "ps-progress-bar 1.4s infinite linear",
            }}
          />
        </div>
        <div
          className="text-[11px] font-bold uppercase z-[2]"
          style={{ color: "#e8e8e8", letterSpacing: "0.6px" }}
        >
          {label}
        </div>
      </div>
    </>
  );
}

function chipStyle(kind: "auto" | "issue" | "warn"): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "2px 8px",
    borderRadius: 10,
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: "0.2px",
    border: "1px solid transparent",
    whiteSpace: "nowrap",
  };
  if (kind === "issue") {
    return { ...base, background: "rgba(245, 158, 11, 0.15)", color: "#B45309", borderColor: "rgba(245, 158, 11, 0.35)" };
  }
  if (kind === "warn") {
    return { ...base, background: "rgba(220, 38, 38, 0.18)", color: "#B91C1C", borderColor: "rgba(220, 38, 38, 0.4)" };
  }
  return { ...base, background: "rgba(34, 197, 94, 0.15)", color: "#15803D", borderColor: "rgba(34, 197, 94, 0.35)" };
}
