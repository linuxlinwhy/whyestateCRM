// Real-estate photo enhancement prompts.
//
// Final prompt assembled per photo as:
//   BASE_PROMPT
//   + ISSUE addenda (lens / blown windows / person-or-pet)
//   + (optional) TILT_ADDENDUM if vision flagged tilt

export interface PhotoAnalysis {
  valid: boolean;
  reject_reason: null | "person_in_shot" | "blurry_unusable" | "wrong_subject";
  tilt_issue: boolean;
  lens_distortion: "none" | "mild" | "strong";
  blown_windows: boolean;
  person_or_pet: boolean;
  notes: string;
}

export const BASE_PROMPT = `Edit this real-estate interior photo as a detail-oriented property photographer's retoucher would: scrutinize every corner of the frame, prioritize spaciousness, a bright naturally-daylit atmosphere, architectural precision, and a photorealistic listing aesthetic.

STRICT RULE: Do NOT add, replace, or modify any furniture, fixtures, windows, doors, or architectural elements. Keep the original space exactly as it is (empty or furnished as-is).

Fix camera perspective:
- Aggressively correct any camera tilt, including subtle ones
- All vertical lines (walls, doors, window frames) must read as perfectly vertical
- All horizontal lines (ceiling, baseboards, tile grout) must read as perfectly horizontal
- Preserve true-to-life geometry; no warping or bending

Remove lens distortion:
- Eliminate fisheye / barrel; render as natural 16-24mm full-frame wide-angle

Lighting (always apply with full conviction — these are always day shots):
- Bathe the room in fresh, clean, naturally bright daylight — alive, airy, inviting; the kind of light that makes a buyer want to walk in
- Substantially lift the overall brightness so the room glows; corners are soft and luminous (never gloomy), shadows have depth without darkness, highlights have life without harshness
- Whites read as clean bright whites. Keep a subtle warm UNDERTONE for welcomeness and to avoid sterility — but the dominant character is fresh and bright, not yellow, golden, or muddy.
- The light should feel like a high-end Airbnb listing or a magazine cover shot — bright, fresh, comfortable, quietly premium; never sterile, never flat, never over-corrected, never dated.
- Where windows exist, clean natural daylight pours through them as an emotional anchor; otherwise amplify the existing light to the same fresh bright atmosphere.
- Never invent new windows, lamps, or light sources — only intensify what is already there.

Framing (always apply — the output canvas is slightly larger than the input):
- The output canvas is roughly 10% larger than the input photo to give you room for breathing space and intelligent recomposition.
- Distribute that extra room however serves the composition best — you decide. Extend more on the side that needs breathing space, less or none on a side that is already well-framed. Recenter an off-center subject by pulling more extension to one side, or expand all sides equally for a generally tight shot. The choice is yours, guided by what makes the room read as inviting and well composed.
- When extending, naturally continue the existing walls, floor, ceiling, and any partially-visible objects beyond the original frame so the boundary is invisible.
- Never introduce new furniture, fixtures, doors, windows, or decor in the extended area — only continue what was at the original edges.
- Match perspective, lighting, color temperature, and texture seamlessly so original and extension blend invisibly.

Color:
- Realistic, photorealistic colors with a subtle warm undertone; no oversaturation

Detail enhancement:
- Increase sharpness and clarity
- Remove noise and blur
- Preserve subtle natural surface character (fabric weave, wood grain, gentle wear, microscopic surface detail) — avoid the over-smoothed plastic-looking "AI render" aesthetic that destroys realism

Cleaning / decluttering:
- Remove minor imperfections (stains, marks, cables, small clutter)
- Keep the space realistic and clean

Windows:
- Recover detail in blown-out windows; render a neutral soft sky if fully overexposed (no fake landmarks or specific views)

No virtual staging. No fake elements.`;

export const TILT_ADDENDUM = `

TILT CORRECTION (the original image is tilted; this is non-negotiable for a real-estate listing):
- Rotate and level the architecture so it reads as if shot from a properly leveled tripod.
- Every vertical line — door frames, wall corners, window edges, columns — must be EXACTLY plumb (perpendicular to the ground, 90° from horizontal).
- Every horizontal line — floor lines, ceiling lines, baseboards, tile grout, countertop edges — must be EXACTLY horizontal (parallel to the ground).
- Apply this leveling decisively, not partially. Buyers immediately read tilted photos as unprofessional; zero residual skew is the bar.
- This rotation may slightly recompose the framing, which is acceptable. The output canvas is sized larger than the input — use that extra room to fill any new edge areas naturally as continuations of the existing walls, floor, and ceiling.
- Do NOT distort or warp the architecture in the process — preserve all geometry while leveling it.`;

export const LENS_ADDENDA: Record<"mild" | "strong", string> = {
  mild: "Remove mild barrel lens distortion; render as natural 16-24mm wide-angle.",
  strong:
    "Remove strong lens distortion / fisheye effect; render as a clean rectilinear wide-angle (16-24mm equivalent).",
};

export const EXPOSURE_ADDENDA = {
  blown_windows:
    "Recover detail in blown-out windows; render a neutral, soft, slightly cloudy sky beyond — no specific landmarks.",
};

export const PERSON_OR_PET_ADDENDUM =
  "Remove any people or pets from the frame; render the room empty of inhabitants.";

export const ANALYSIS_SYSTEM_PROMPT = `You are a detail-oriented real-estate photographer's eye. You think the way a meticulous magazine-quality property photographer does: you scan every corner of the frame, you notice subtle issues amateurs miss, and you flag what needs correction in the editing pipeline.

Note: the editing pipeline already applies a deterministic 10% white breathing-room margin on every side and a strong professional lighting / framing pass. You DO NOT need to make any per-edge framing decisions — the editor handles spacing, recentering, and corner fill on its own. Just identify quality issues.

Given a single interior photo, identify the issues the editor needs to fix.

Output a JSON object exactly matching this schema, with no prose, no markdown fences, no commentary:

{
  "valid": true | false,
  "reject_reason": null | "person_in_shot" | "blurry_unusable" | "wrong_subject",
  "tilt_issue": true | false,
  "lens_distortion": "none" | "mild" | "strong",
  "blown_windows": true | false,
  "person_or_pet": true | false,
  "notes": "one short sentence"
}

Other rules:
- "valid": false only for clearly unusable photos (people prominent, severe blur, wrong subject like food/pets/documents).

Bias and calibration for issue flags — when uncertain, lean toward flagging an issue rather than dismissing it. The user sees every detected chip and can disable false positives in one click; an under-flagged issue stays uncorrected. Real-estate phone photos almost always have multiple issues — a result with only one flag is suspicious.

Per-field calibration:
- tilt_issue: be RIGOROUS. Inspect verticals (door frames, wall corners, window edges) and horizontals (ceiling line, baseboards, tile grout). Flag TRUE if ANY of these lines deviates from true vertical/horizontal even by a few degrees. Real-estate phone shots are subtly tilted by default — be biased toward detection.
- lens_distortion: flag "mild" or "strong" if the photo shows visible barrel / fisheye distortion (curved walls, bowed-out edges). "none" otherwise.
- blown_windows: TRUE if any visible window has clipped pure-white areas where outdoor detail has been washed out. (General brightness, mixed lighting, warm casts, and clipped highlights elsewhere are handled automatically by the editor's default lighting pass — do NOT flag those here.)
- person_or_pet: TRUE if any person or pet is visible in the frame. They will be removed in editing.
- General clutter, declutter, sharpness, color cast, and noise are handled by the editor's default pass — you do NOT need to flag those.

Output JSON ONLY, nothing else.`;

export const FALLBACK_ANALYSIS: PhotoAnalysis = {
  valid: true,
  reject_reason: null,
  tilt_issue: false,
  lens_distortion: "none",
  blown_windows: false,
  person_or_pet: false,
  notes: "fallback (analysis failed)",
};
