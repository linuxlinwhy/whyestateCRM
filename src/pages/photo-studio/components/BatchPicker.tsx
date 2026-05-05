import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import type { PhotoBatch } from "../lib/batches";

interface Props {
  batches: PhotoBatch[];
  activeBatchId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export default function BatchPicker({
  batches,
  activeBatchId,
  onSelect,
  onNew,
  onRename,
  onDelete,
}: Props) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const active = batches.find((b) => b.id === activeBatchId) ?? null;

  const startEdit = (b: PhotoBatch) => {
    setEditingId(b.id);
    setDraftName(b.name);
  };
  const commitEdit = async () => {
    const id = editingId;
    if (!id) return;
    const name = draftName.trim();
    setEditingId(null);
    if (!name) return;
    await onRename(id, name);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setDraftName("");
  };

  const handleDelete = async (b: PhotoBatch) => {
    if (!confirm(`Delete batch "${b.name}"?  Items will be removed; fal storage URLs eventually expire on their own.`)) return;
    await onDelete(b.id);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-white transition-colors hover:bg-[#F5F7FA]"
        style={{ borderColor: "#E8EBEF", color: "#2B3340" }}
      >
        <span className="text-sm font-semibold">
          {active ? active.name : batches.length ? "Select a batch" : "No batches yet"}
        </span>
        <ChevronDown size={14} style={{ color: "#A1A9B6" }} />
      </button>

      {open && (
        <div
          className="absolute z-30 mt-1 min-w-[320px] max-w-[440px] bg-white rounded-xl border py-1"
          style={{ borderColor: "#E8EBEF", boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}
        >
          <button
            onClick={() => { setOpen(false); onNew(); }}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#F5F7FA] transition-colors text-left"
            style={{ color: "#1EC9C4" }}
          >
            <Plus size={14} />
            <span className="text-sm font-semibold">New batch</span>
          </button>
          <div className="border-t my-1" style={{ borderColor: "#E8EBEF" }} />

          {batches.length === 0 ? (
            <div className="px-3 py-3 text-xs" style={{ color: "#A1A9B6" }}>
              No batches yet. Drop photos to create your first batch.
            </div>
          ) : (
            <div className="max-h-[360px] overflow-y-auto">
              {batches.map((b) => {
                const isActive = b.id === activeBatchId;
                const isEditing = editingId === b.id;
                return (
                  <div
                    key={b.id}
                    className="flex items-center gap-1 px-2 py-1.5 group"
                    style={{ background: isActive ? "#F0FCFB" : undefined }}
                  >
                    {isEditing ? (
                      <input
                        autoFocus
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEdit();
                          if (e.key === "Escape") cancelEdit();
                        }}
                        className="flex-1 px-2 py-1 text-sm rounded border outline-none"
                        style={{ borderColor: "#1EC9C4", color: "#2B3340" }}
                      />
                    ) : (
                      <button
                        onClick={() => { setOpen(false); onSelect(b.id); }}
                        className="flex-1 px-2 py-1 rounded hover:bg-white text-left min-w-0"
                      >
                        <div className="text-sm font-semibold truncate" style={{ color: isActive ? "#1EC9C4" : "#2B3340" }}>
                          {b.name}
                        </div>
                        <div className="text-[11px]" style={{ color: "#A1A9B6" }}>
                          {formatDate(b.created_at)}
                        </div>
                      </button>
                    )}

                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {isEditing ? (
                        <>
                          <button onMouseDown={(e) => { e.preventDefault(); commitEdit(); }} title="Save" className="p-1 rounded hover:bg-gray-100">
                            <Check size={12} style={{ color: "#16A34A" }} strokeWidth={3} />
                          </button>
                          <button onMouseDown={(e) => { e.preventDefault(); cancelEdit(); }} title="Cancel" className="p-1 rounded hover:bg-gray-100">
                            <X size={12} style={{ color: "#A1A9B6" }} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(b)} title="Rename" className="p-1 rounded hover:bg-gray-100">
                            <Pencil size={11} style={{ color: "#A1A9B6" }} />
                          </button>
                          <button onClick={() => handleDelete(b)} title="Delete" className="p-1 rounded hover:bg-gray-100">
                            <Trash2 size={11} style={{ color: "#EF4444" }} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
