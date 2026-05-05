import { ensureFalConfigured, fal } from "./fal-client";

export { ensureFalConfigured };
import {
  ANALYSIS_SYSTEM_PROMPT,
  BASE_PROMPT,
  EXPOSURE_ADDENDA,
  FALLBACK_ANALYSIS,
  LENS_ADDENDA,
  PERSON_OR_PET_ADDENDUM,
  TILT_ADDENDUM,
  type PhotoAnalysis,
} from "./prompts";

export const EDIT_MODEL = "fal-ai/bytedance/seedream/v5/lite/edit";
export const VISION_MODEL = "nvidia/nemotron-3-nano-omni/vision";

// seedream v5 lite output canvas constraints (per fal docs).
const MIN_PIXELS = 2560 * 1440;
const MAX_PIXELS = 4096 * 4096;
const MAX_SIDE = 4096;

export const BREATHING_ROOM_PCT = 0.10;

export async function safeUpload(file: File): Promise<string> {
  const resp: unknown = await fal.storage.upload(file);
  const url =
    typeof resp === "string"
      ? resp
      : ((resp as { url?: string; file_url?: string; fileUrl?: string }).url ??
         (resp as { file_url?: string }).file_url ??
         (resp as { fileUrl?: string }).fileUrl);
  if (!url) throw new Error("fal upload returned no URL");
  return url;
}

export async function analyzePhoto(imageUrl: string): Promise<PhotoAnalysis> {
  const result = await fal.subscribe(VISION_MODEL, {
    input: {
      prompt:
        "Analyze this real estate interior photo and output the JSON object as specified.",
      image_url: imageUrl,
      system_prompt: ANALYSIS_SYSTEM_PROMPT,
      reasoning_mode: "no_think",
      max_tokens: 1024,
      temperature: 0.2,
    },
    logs: false,
  });

  const data = (result as { data?: unknown })?.data ?? result;
  const text =
    (data as { output?: string }).output ??
    (data as { text?: string }).text ??
    (data as { response?: string }).response ??
    (data as { message?: string }).message ??
    "";
  if (!text) throw new Error("Vision model returned no text");

  const parsed = parseAnalysisJson(String(text));
  return normalizeAnalysis(parsed);
}

function parseAnalysisJson(text: string): PhotoAnalysis {
  const cleaned = text.trim().replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, "$1").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("No JSON object in vision response");
  }
  return JSON.parse(cleaned.slice(start, end + 1)) as PhotoAnalysis;
}

function normalizeAnalysis(a: Partial<PhotoAnalysis>): PhotoAnalysis {
  const out = { ...FALLBACK_ANALYSIS, ...a } as PhotoAnalysis;
  return out;
}

export function buildPrompt(analysis: PhotoAnalysis): string {
  const addenda: string[] = [];
  if (analysis.lens_distortion && analysis.lens_distortion !== "none") {
    addenda.push(LENS_ADDENDA[analysis.lens_distortion]);
  }
  if (analysis.blown_windows) addenda.push(EXPOSURE_ADDENDA.blown_windows);
  if (analysis.person_or_pet) addenda.push(PERSON_OR_PET_ADDENDUM);

  const tiltTail = analysis.tilt_issue ? TILT_ADDENDUM : "";
  const block = addenda.length
    ? "\n\nADDITIONAL TARGETED CORRECTIONS:\n- " + addenda.join("\n- ")
    : "";

  return BASE_PROMPT + block + tiltTail;
}

export function fitToBounds(w: number, h: number): { width: number; height: number } {
  let area = w * h;
  if (area < MIN_PIXELS) {
    const s = Math.sqrt(MIN_PIXELS / area);
    w *= s; h *= s; area = w * h;
  }
  if (area > MAX_PIXELS) {
    const s = Math.sqrt(MAX_PIXELS / area);
    w *= s; h *= s;
  }
  if (Math.max(w, h) > MAX_SIDE) {
    const s = MAX_SIDE / Math.max(w, h);
    w *= s; h *= s;
  }
  w = Math.round(w / 8) * 8;
  h = Math.round(h / 8) * 8;
  return {
    width: Math.min(MAX_SIDE, Math.max(8, w)),
    height: Math.min(MAX_SIDE, Math.max(8, h)),
  };
}

export async function callEditor(
  inputUrl: string,
  prompt: string,
  origW: number,
  origH: number,
): Promise<{ url: string; blob: Blob }> {
  const targetW = Math.round(origW * (1 + BREATHING_ROOM_PCT));
  const targetH = Math.round(origH * (1 + BREATHING_ROOM_PCT));
  const { width, height } = fitToBounds(targetW, targetH);

  const result = await fal.subscribe(EDIT_MODEL, {
    input: {
      prompt,
      image_urls: [inputUrl],
      image_size: { width, height },
      num_images: 1,
      max_images: 1,
      enable_safety_checker: false,
    },
    logs: false,
  });

  const url = extractResultUrl(result);
  if (!url) throw new Error("Result URL not found in editor response");

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Result download failed: HTTP ${res.status}`);
  return { url, blob: await res.blob() };
}

type EditorResult = {
  data?: { images?: Array<{ url?: string } | string>; output?: Array<{ url?: string }> };
  images?: Array<{ url?: string } | string>;
  output?: Array<{ url?: string }>;
};

function extractResultUrl(result: unknown): string | null {
  const r = result as EditorResult;
  const data = r.data ?? r;
  const images = (data as { images?: Array<{ url?: string } | string> }).images;
  if (Array.isArray(images) && images.length) {
    const first = images[0];
    if (typeof first === "string") return first;
    if (first?.url) return first.url;
  }
  const output = (data as { output?: Array<{ url?: string }> }).output;
  if (Array.isArray(output) && output[0]?.url) return output[0].url;
  return null;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function friendlyError(err: unknown): string {
  if (!err) return "unknown error";
  const e = err as {
    body?: unknown;
    status?: number;
    message?: string;
  };
  if (e.body) {
    if (typeof e.body === "string") return e.body.slice(0, 200);
    const b = e.body as { detail?: unknown; message?: string };
    if (typeof b.detail === "string") return b.detail.slice(0, 200);
    if (Array.isArray(b.detail)) {
      return b.detail
        .map((d: { msg?: string; type?: string }) => d.msg ?? d.type ?? JSON.stringify(d))
        .join("; ")
        .slice(0, 250);
    }
    if (b.message) return b.message.slice(0, 200);
  }
  if (e.status === 401 || e.status === 403)
    return "API key rejected by fal — check the FAL_KEY secret in Supabase.";
  if (e.status === 429) return "Rate limited by fal — wait a moment and retry.";
  if (e.status && e.status >= 500) return `fal server error (${e.status})`;
  if (typeof e.message === "string") {
    if (e.message.includes("CORS")) return "CORS error — check fal-proxy is deployed.";
    if (e.message.includes("Failed to fetch")) return "Network error — check console.";
    return e.message.slice(0, 200);
  }
  return String(err).slice(0, 200);
}
