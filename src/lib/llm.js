// Thin wrapper around @browser-ai/web-llm + the Vercel AI SDK.
//
// - Inference runs in a Web Worker (src/worker.js) so the UI never blocks —
//   with a fallback to the main thread on devices (e.g. Android Chrome) where
//   WebGPU works on the page but not inside a Worker.
// - The 200 MB+ first download is reported through the engine's
//   initProgressCallback, which gives both a 0..1 fraction AND a human-readable
//   status string ("Loading model from cache[5/24]", "Loading GPU shaders"…).
// - The model instance (and its worker) are cached and only rebuilt when the
//   selected model changes.
import { streamText } from "ai";
import { webLLM, doesBrowserSupportWebLLM } from "@browser-ai/web-llm";

export function browserSupported() {
  return doesBrowserSupportWebLLM();
}

// A real preflight: the API can exist while requestAdapter() still returns null
// (e.g. WebGPU disabled by flag, or Android Chrome blocklisting the GPU).
// Returns { ok, code, reason } where code is "no-api" | "no-adapter" | "error"
// so the UI can give condition-specific guidance.
export async function probeWebGPU() {
  if (typeof navigator === "undefined" || !navigator.gpu) {
    return { ok: false, code: "no-api", reason: "This browser doesn't expose the WebGPU API." };
  }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      return {
        ok: false,
        code: "no-adapter",
        reason:
          "WebGPU is available but no GPU adapter could be obtained (requestAdapter() returned null). This usually means WebGPU is disabled, or your GPU isn't allow-listed.",
      };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      code: "error",
      reason: "WebGPU adapter request failed: " + (e?.message || String(e)),
    };
  }
}

// A worker failing to get a GPU is the signature of a device (notably Android
// Chrome) that exposes WebGPU on the page but not inside a dedicated Worker.
function isWorkerGpuFailure(msg) {
  return /compatible GPU|requestAdapter|GPUAdapter|no adapter|Unknown error/i.test(msg || "");
}

// Cheap check (no model download) of whether a Worker can get a WebGPU adapter.
// Lets us pick the worker vs main-thread path BEFORE downloading, so a device
// where the worker has no GPU doesn't download the model twice.
async function workerWebGPUAvailable() {
  if (typeof Worker === "undefined") return false;
  let w;
  try {
    w = new Worker(new URL("../gpu-probe-worker.js", import.meta.url), { type: "module" });
  } catch {
    return false;
  }
  return new Promise((resolve) => {
    const done = (v) => {
      try {
        w.terminate();
      } catch {
        /* ignore */
      }
      resolve(v);
    };
    const timer = setTimeout(() => done(false), 5000);
    w.onmessage = (ev) => {
      clearTimeout(timer);
      done(!!ev?.data?.ok);
    };
    w.onerror = () => {
      clearTimeout(timer);
      done(false);
    };
  });
}

class Briefer {
  constructor() {
    this.modelId = null;
    this.model = null;
    this.worker = null;
    this.usingWorker = true; // whether the active engine runs off the main thread
  }

  teardown() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.model = null;
    this.modelId = null;
  }

  // Build and warm up an engine, either in a Worker or on the main thread.
  async initEngine(modelId, onProgress, useWorker) {
    let workerError = null;
    const settings = {
      engineConfig: {
        initProgressCallback: (report) =>
          onProgress?.({ progress: report.progress ?? 0, text: report.text ?? "" }),
      },
    };

    if (useWorker) {
      this.worker = new Worker(new URL("../worker.js", import.meta.url), { type: "module" });
      // WebLLM's worker reports failures as `{ kind: "throw", content }`, then the
      // provider collapses it to "Unknown error". We own the worker, so keep the
      // real reason.
      this.worker.addEventListener("message", (ev) => {
        const d = ev?.data;
        if (d && d.kind === "throw") {
          workerError = typeof d.content === "string" ? d.content : JSON.stringify(d.content);
        }
      });
      settings.worker = this.worker;
    }

    const model = webLLM(modelId, settings);
    try {
      const availability = await model.availability();
      if (availability === "unavailable") {
        throw new Error("This browser can't run the model — WebGPU is unavailable.");
      }
      if (availability === "downloadable") {
        // The library forwards download progress through THIS callback (it
        // overrides engineConfig.initProgressCallback), so pass it here or the
        // bar never moves. The arg is a 0..1 number (or a {progress,text} report).
        await model.createSessionWithProgress((p) => {
          const progress = typeof p === "number" ? p : (p?.progress ?? 0);
          const text = typeof p === "object" && p ? (p.text ?? "") : "";
          onProgress?.({ progress, text });
        });
      }
    } catch (e) {
      const reason = workerError || e?.message || String(e);
      const err = new Error(workerError ? `${e?.message || String(e)}\n\nEngine reported:\n${workerError}` : reason);
      err.cause = e;
      err.reason = reason;
      throw err;
    }
    return model;
  }

  // Ensure the requested model is downloaded and ready. Tries a Web Worker first
  // (non-blocking UI); if the worker can't get a GPU — common on Android Chrome —
  // falls back to running on the main thread.
  // `onProgress(report)` receives { progress: 0..1, text: string } during download.
  async ensure(modelId, onProgress) {
    if (this.modelId === modelId && this.model) return this.model;
    this.teardown();

    // Decide the path up front (no download) so a worker without a GPU doesn't
    // pull the model just to fail. Only devices that pass use the worker.
    const useWorker = await workerWebGPUAvailable();

    try {
      this.model = await this.initEngine(modelId, onProgress, useWorker);
      this.usingWorker = useWorker;
    } catch (e) {
      // Safety net: if the worker path still failed on GPU, retry on the main
      // thread (weights are cached from the first attempt, so no re-download).
      if (useWorker && isWorkerGpuFailure(e?.reason || e?.message)) {
        this.teardown();
        onProgress?.({ progress: 0, text: "Retrying on the main thread…" });
        this.model = await this.initEngine(modelId, onProgress, false);
        this.usingWorker = false;
      } else {
        throw e;
      }
    }

    this.modelId = modelId;
    return this.model;
  }

  // Stream a briefing. Yields typed parts { kind: "text" | "reasoning", text }
  // so the UI can separate a reasoning model's thinking from the final dispatch.
  //   prompt : { instructions, messages }  (AI SDK v7 — system goes in instructions)
  //   opts   : { onProgress, signal, onFinish }
  async *stream(modelId, prompt, opts = {}) {
    const { onProgress, signal, onFinish, params = {} } = opts;
    const model = await this.ensure(modelId, onProgress);

    // AI SDK v7 routes mid-stream errors to onError and just ends the stream,
    // so capture it here and rethrow after the loop to surface it in the UI.
    let streamError = null;
    const result = streamText({
      model,
      instructions: prompt.instructions,
      messages: prompt.messages,
      // Sampling parameters come from the UI (see the Settings pane).
      temperature: params.temperature ?? 0.5,
      topP: params.topP ?? 0.95,
      maxOutputTokens: params.maxOutputTokens ?? 512,
      frequencyPenalty: params.frequencyPenalty ?? 0,
      abortSignal: signal,
      onError: ({ error }) => {
        streamError = error;
      },
      onFinish: ({ usage, finishReason }) => onFinish?.({ usage, finishReason }),
    });

    // fullStream carries both text-delta and reasoning-delta parts.
    for await (const part of result.fullStream) {
      if (part.type === "text-delta") yield { kind: "text", text: part.text };
      else if (part.type === "reasoning-delta") yield { kind: "reasoning", text: part.text };
    }
    if (streamError) {
      throw streamError instanceof Error ? streamError : new Error(String(streamError));
    }
  }
}

// One engine for the whole page.
export const briefer = new Briefer();
