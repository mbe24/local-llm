// The small models we expose in the dropdown. IDs must match WebLLM's prebuilt
// list: https://github.com/mlc-ai/web-llm/blob/main/src/config.ts
//
// All q4-quantized (q4f16_1) — the smallest builds that are still coherent chat
// models. `approxMB` is the exact weight download (from each repo's
// ndarray-cache.json ParamBytes), cached in the browser after the first load.
//
// Note: there is no q4 build of SmolLM2-135M — it ships only as fp16 (~257 MB),
// larger than SmolLM2-360M q4 (194 MB), so it isn't worth including. 194 MB is
// the practical floor for an off-the-shelf q4 chat model.
export const MODELS = [
  {
    id: "Qwen3-0.6B-q4f16_1-MLC",
    label: "Qwen3 0.6B",
    approxMB: 320,
    note: "Handles the structured data model best — full briefing, accurate. Heaviest.",
  },
  {
    id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
    label: "Qwen2.5 0.5B",
    approxMB: 265,
    note: "Medium — good balance of quality and load; friendlier on mobile. Default.",
  },
  {
    id: "SmolLM2-360M-Instruct-q4f16_1-MLC",
    label: "SmolLM2 360M",
    approxMB: 194,
    note: "Smallest q4 chat model — quickest to load, roughest output.",
  },
];

export const DEFAULT_MODEL = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";
