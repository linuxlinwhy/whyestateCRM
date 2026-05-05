import { fal } from "@fal-ai/client";

// Configure the fal client to route every request through our Supabase Edge
// Function (`fal-proxy`). The function injects the FAL_KEY server-side so the
// browser never sees credentials.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
if (!SUPABASE_URL) {
  throw new Error("VITE_SUPABASE_URL missing — required for fal proxy URL");
}

const PROXY_URL = `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/fal-proxy`;

let configured = false;
export function ensureFalConfigured(): void {
  if (configured) return;
  fal.config({ proxyUrl: PROXY_URL });
  configured = true;
}

export { fal };
