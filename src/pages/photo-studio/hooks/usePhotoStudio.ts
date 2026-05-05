import { useCallback, useEffect, useRef, useState } from "react";
import {
  createBatch,
  createBatchItem,
  deleteBatch as apiDeleteBatch,
  deleteBatchItem,
  listBatchItems,
  listBatches,
  renameBatch as apiRenameBatch,
  updateBatchItem,
  type PhotoBatch,
  type PhotoBatchItem,
  type PhotoVersion,
} from "../lib/batches";
import {
  analyzePhoto,
  buildPrompt,
  callEditor,
  ensureFalConfigured,
  friendlyError,
  loadImage,
  safeUpload,
} from "../lib/pipeline";
import { FALLBACK_ANALYSIS, type PhotoAnalysis } from "../lib/prompts";

const CONCURRENCY = 40;
const RETRY_COUNT = 2;
const RETRY_BASE_DELAY_MS = 1500;

export type PhotoStatus = "queued" | "processing" | "done" | "error";

export interface PhotoState {
  id: string;            // local id (matches DB row id once persisted)
  itemId: string | null; // DB row id (null until first persist)
  batchId: string | null;
  filename: string;
  // EITHER file (fresh upload) OR fal_original_url (loaded from history)
  file: File | null;
  originalObjectUrl: string | null; // local blob URL for preview if file present
  fal_original_url: string | null;
  status: PhotoStatus;
  status_label: string;
  analysis: PhotoAnalysis | null;
  versions: PhotoVersion[];
  active_version: number;
  origW: number;
  origH: number;
  error: string | null;
}

function defaultStatusLabel(s: PhotoStatus): string {
  return ({ queued: "Queued", processing: "Processing", done: "Done", error: "Error" } as const)[s];
}

function nextBatchName(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `Batch — ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function usePhotoStudio(userEmail: string) {
  const [batches, setBatches] = useState<PhotoBatch[]>([]);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Map<string, PhotoState>>(new Map());
  const [isRunning, setIsRunning] = useState(false);
  const [loading, setLoading] = useState(false);

  const photosRef = useRef(photos);
  photosRef.current = photos;

  // Load batch list on mount.
  useEffect(() => {
    let cancel = false;
    (async () => {
      ensureFalConfigured();
      try {
        const list = await listBatches(userEmail);
        if (cancel) return;
        setBatches(list);
      } catch (e) {
        console.error("listBatches failed:", e);
      }
    })();
    return () => { cancel = true; };
  }, [userEmail]);

  // Load photos for active batch.
  useEffect(() => {
    if (!activeBatchId) {
      setPhotos(new Map());
      return;
    }
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const items = await listBatchItems(activeBatchId);
        if (cancel) return;
        const next = new Map<string, PhotoState>();
        for (const it of items) {
          next.set(it.id, dbItemToState(it));
        }
        setPhotos(next);
      } catch (e) {
        console.error("listBatchItems failed:", e);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [activeBatchId]);

  // Cleanup object URLs when component unmounts.
  useEffect(() => {
    return () => {
      for (const p of photosRef.current.values()) {
        if (p.originalObjectUrl) URL.revokeObjectURL(p.originalObjectUrl);
      }
    };
  }, []);

  // ───────────────────────────────────── batch lifecycle ──

  const newBatch = useCallback(async (): Promise<string> => {
    const name = nextBatchName();
    const b = await createBatch(userEmail, name);
    setBatches((prev) => [b, ...prev]);
    setActiveBatchId(b.id);
    setPhotos(new Map());
    return b.id;
  }, [userEmail]);

  const selectBatch = useCallback((id: string) => {
    setActiveBatchId(id);
  }, []);

  const renameBatch = useCallback(async (id: string, name: string) => {
    await apiRenameBatch(id, name);
    setBatches((prev) => prev.map((b) => (b.id === id ? { ...b, name } : b)));
  }, []);

  const deleteBatch = useCallback(async (id: string) => {
    await apiDeleteBatch(id);
    setBatches((prev) => prev.filter((b) => b.id !== id));
    if (activeBatchId === id) {
      setActiveBatchId(null);
      setPhotos(new Map());
    }
  }, [activeBatchId]);

  // ───────────────────────────────────── photo lifecycle ──

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;

    let batchId = activeBatchId;
    if (!batchId) {
      batchId = await newBatch();
    }

    const startIdx = photosRef.current.size;
    const created: PhotoState[] = [];
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      const item = await createBatchItem(batchId, startIdx + i, f.name);
      const objectUrl = URL.createObjectURL(f);
      const ps: PhotoState = {
        id: item.id,
        itemId: item.id,
        batchId,
        filename: f.name,
        file: f,
        originalObjectUrl: objectUrl,
        fal_original_url: null,
        status: "queued",
        status_label: "Queued",
        analysis: null,
        versions: [],
        active_version: -1,
        origW: 0,
        origH: 0,
        error: null,
      };
      created.push(ps);
      // Read dimensions async — non-blocking
      loadImage(objectUrl).then((img) => {
        updatePhoto(ps.id, { origW: img.naturalWidth, origH: img.naturalHeight });
      }).catch(() => {});
    }
    setPhotos((prev) => {
      const next = new Map(prev);
      for (const p of created) next.set(p.id, p);
      return next;
    });
  }, [activeBatchId, newBatch]);

  const updatePhoto = useCallback((id: string, patch: Partial<PhotoState>) => {
    setPhotos((prev) => {
      const cur = prev.get(id);
      if (!cur) return prev;
      const next = new Map(prev);
      next.set(id, { ...cur, ...patch });
      return next;
    });
  }, []);

  const removePhoto = useCallback(async (id: string) => {
    const cur = photosRef.current.get(id);
    if (!cur) return;
    if (cur.itemId) {
      try { await deleteBatchItem(cur.itemId); } catch (e) { console.error(e); }
    }
    if (cur.originalObjectUrl) URL.revokeObjectURL(cur.originalObjectUrl);
    setPhotos((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // ───────────────────────────────────── pipeline ──

  // Persist a partial change both locally and to DB.
  const persist = useCallback(
    async (id: string, patch: Partial<PhotoState>): Promise<void> => {
      updatePhoto(id, patch);
      const photo = { ...photosRef.current.get(id), ...patch } as PhotoState;
      if (!photo.itemId) return;
      try {
        await updateBatchItem(photo.itemId, {
          status: photo.status,
          status_label: photo.status_label,
          error: photo.error,
          analysis: photo.analysis,
          original_w: photo.origW || null,
          original_h: photo.origH || null,
          fal_original_url: photo.fal_original_url,
          versions: photo.versions,
          active_version: photo.active_version,
        });
      } catch (e) {
        console.error("persist updateBatchItem failed:", e);
      }
    },
    [updatePhoto],
  );

  const setStatus = useCallback(
    async (id: string, status: PhotoStatus, label?: string) => {
      await persist(id, {
        status,
        status_label: label ?? defaultStatusLabel(status),
      });
    },
    [persist],
  );

  // Run the full pipeline: ensure original uploaded, analyze, edit.
  const runFullPipeline = useCallback(
    async (id: string): Promise<void> => {
      const startPhoto = photosRef.current.get(id);
      if (!startPhoto) return;

      // 1) Ensure original is uploaded to fal
      let falUrl = startPhoto.fal_original_url;
      let origW = startPhoto.origW;
      let origH = startPhoto.origH;
      if (!falUrl) {
        if (!startPhoto.file) {
          throw new Error("Original file no longer available — re-upload required");
        }
        await setStatus(id, "processing", "Uploading");
        const file = new File([startPhoto.file], "input.jpg", {
          type: startPhoto.file.type || "image/jpeg",
        });
        falUrl = await safeUpload(file);
        // Read dimensions if not yet known
        if (!origW || !origH) {
          const img = await loadImage(startPhoto.originalObjectUrl ?? falUrl);
          origW = img.naturalWidth;
          origH = img.naturalHeight;
        }
        await persist(id, { fal_original_url: falUrl, origW, origH });
      }

      // 2) Analyze (or reuse existing analysis)
      const cached = photosRef.current.get(id)?.analysis;
      let analysis: PhotoAnalysis;
      if (cached) {
        analysis = cached;
      } else {
        await setStatus(id, "processing", "Analyzing");
        try {
          analysis = await analyzePhoto(falUrl);
        } catch (e) {
          console.warn("Analysis failed, using fallback:", e);
          analysis = { ...FALLBACK_ANALYSIS };
        }
        await persist(id, { analysis });
      }

      // 3) Editor pass — fresh AI version replaces the version chain
      await setStatus(id, "processing", "Editing");
      // Make sure dimensions are populated
      if (!origW || !origH) {
        const img = await loadImage(falUrl);
        origW = img.naturalWidth;
        origH = img.naturalHeight;
        await persist(id, { origW, origH });
      }
      const prompt = buildPrompt(analysis);
      const { url: resultUrl } = await callEditor(falUrl, prompt, origW, origH);

      const aiVersion: PhotoVersion = { label: "AI", source: "ai", url: resultUrl };
      await persist(id, {
        versions: [aiVersion],
        active_version: 0,
        status: "done",
        status_label: "Done",
        error: null,
      });
    },
    [persist, setStatus],
  );

  const surgicalEdit = useCallback(
    async (id: string, instruction: string): Promise<void> => {
      const photo = photosRef.current.get(id);
      if (!photo || photo.versions.length === 0 || photo.active_version < 0) {
        throw new Error("No active version to edit on");
      }
      const activeUrl = photo.versions[photo.active_version].url;

      const prompt = `Apply ONLY this targeted edit, locally and surgically: ${instruction}.

Preserve everything else exactly as it is — composition, lighting, color, perspective, architectural geometry, framing, and aspect. Do not add furniture, fixtures, windows, or doors unless directly implied by the instruction. Photorealistic, seamless, retaining the magazine-quality real-estate listing aesthetic.`;

      await setStatus(id, "processing", "Editing");
      // Load current to get its dimensions
      const img = await loadImage(activeUrl);
      const { url: newUrl } = await callEditor(
        activeUrl,
        prompt,
        img.naturalWidth,
        img.naturalHeight,
      );

      const newVersion: PhotoVersion = { label: instruction, source: "edit", url: newUrl };
      const versions = [...photo.versions, newVersion];
      await persist(id, {
        versions,
        active_version: versions.length - 1,
        status: "done",
        status_label: "Done",
        error: null,
      });
    },
    [persist, setStatus],
  );

  // Process a single photo with retry.
  const processOne = useCallback(
    async (id: string, mode: "full" | "edit", instruction?: string): Promise<void> => {
      let lastErr: unknown = null;
      for (let attempt = 0; attempt <= RETRY_COUNT; attempt++) {
        try {
          if (mode === "full") {
            await runFullPipeline(id);
          } else {
            await surgicalEdit(id, instruction ?? "");
          }
          return;
        } catch (e) {
          lastErr = e;
          console.warn(`[${id}] attempt ${attempt + 1} failed:`, e);
          if (attempt < RETRY_COUNT) {
            await setStatus(id, "processing", `Retry ${attempt + 1}…`);
            await sleep(RETRY_BASE_DELAY_MS * (attempt + 1));
          }
        }
      }
      await persist(id, {
        status: "error",
        status_label: "Error",
        error: friendlyError(lastErr),
      });
    },
    [runFullPipeline, surgicalEdit, setStatus, persist],
  );

  // Run a queue of ids with CONCURRENCY workers.
  const runQueue = useCallback(
    async (ids: string[]) => {
      if (isRunning) return;
      ensureFalConfigured();
      setIsRunning(true);
      const queue = [...ids];
      const workers: Promise<void>[] = [];
      for (let i = 0; i < CONCURRENCY; i++) {
        workers.push(
          (async () => {
            while (queue.length) {
              const id = queue.shift();
              if (!id) break;
              await processOne(id, "full");
            }
          })(),
        );
      }
      await Promise.all(workers);
      setIsRunning(false);
    },
    [isRunning, processOne],
  );

  const processAllPending = useCallback(async () => {
    const ids: string[] = [];
    for (const p of photosRef.current.values()) {
      if (p.status === "queued" || p.status === "error") {
        ids.push(p.id);
        if (p.status === "error") {
          await persist(p.id, { status: "queued", status_label: "Queued", error: null });
        }
      }
    }
    if (!ids.length) return;
    await runQueue(ids);
  }, [persist, runQueue]);

  const retryFailed = useCallback(async () => {
    const ids: string[] = [];
    for (const p of photosRef.current.values()) {
      if (p.status === "error") {
        ids.push(p.id);
        await persist(p.id, { status: "queued", status_label: "Queued", error: null });
      }
    }
    if (!ids.length) return;
    await runQueue(ids);
  }, [persist, runQueue]);

  const reprocessOne = useCallback(async (id: string) => {
    if (isRunning) return;
    await persist(id, {
      status: "queued",
      status_label: "Queued",
      error: null,
      analysis: null, // force fresh analysis
    });
    await runQueue([id]);
  }, [isRunning, persist, runQueue]);

  const applySurgicalEdit = useCallback(
    async (id: string, instruction: string) => {
      if (isRunning) return;
      ensureFalConfigured();
      setIsRunning(true);
      try {
        await processOne(id, "edit", instruction);
      } finally {
        setIsRunning(false);
      }
    },
    [isRunning, processOne],
  );

  const setActiveVersion = useCallback(
    async (id: string, idx: number) => {
      const cur = photosRef.current.get(id);
      if (!cur) return;
      if (idx < 0 || idx >= cur.versions.length) return;
      await persist(id, { active_version: idx });
    },
    [persist],
  );

  const clearAll = useCallback(async () => {
    if (isRunning && !confirm("A job is running. Clear anyway?")) return;
    const cur = photosRef.current;
    for (const p of cur.values()) {
      if (p.itemId) {
        try { await deleteBatchItem(p.itemId); } catch (e) { console.error(e); }
      }
      if (p.originalObjectUrl) URL.revokeObjectURL(p.originalObjectUrl);
    }
    setPhotos(new Map());
  }, [isRunning]);

  return {
    // batches
    batches,
    activeBatchId,
    selectBatch,
    newBatch,
    renameBatch,
    deleteBatch,
    // photos
    photos,
    loading,
    isRunning,
    addFiles,
    removePhoto,
    processAllPending,
    retryFailed,
    reprocessOne,
    applySurgicalEdit,
    setActiveVersion,
    clearAll,
  };
}

// Translate a DB row into the in-memory PhotoState we render against.
function dbItemToState(it: PhotoBatchItem): PhotoState {
  return {
    id: it.id,
    itemId: it.id,
    batchId: it.batch_id,
    filename: it.filename,
    file: null,
    originalObjectUrl: null,
    fal_original_url: it.fal_original_url,
    status: it.status,
    status_label: it.status_label ?? defaultStatusLabel(it.status),
    analysis: it.analysis,
    versions: it.versions ?? [],
    active_version: it.active_version,
    origW: it.original_w ?? 0,
    origH: it.original_h ?? 0,
    error: it.error,
  };
}
