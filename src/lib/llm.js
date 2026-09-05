// Thin wrapper around @browser-ai/web-llm + the Vercel AI SDK.
//
// - Inference runs in a Web Worker (src/worker.js), so the UI never blocks.
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

class Briefer {
  constructor() {
    this.modelId = null;
    this.model = null;
    this.worker = null;
  }

  // Ensure the requested model is downloaded and ready.
  // `onProgress(report)` receives { progress: 0..1, text: string } during the
  // initial download; it's not called once the model is already resident.
  async ensure(modelId, onProgress) {
    if (this.modelId === modelId && this.model) return this.model;

    // Switching models: tear down the old worker so we don't leak engines.
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.model = null;
    this.modelId = null;

    this.worker = new Worker(new URL("../worker.js", import.meta.url), {
      type: "module",
    });

    // WebLLM's worker reports failures as a `{ kind: "throw", content }` message,
    // then the AI-SDK provider collapses it to "Unknown error". We own the
    // worker, so listen in and keep the real reason to surface it (mobile GPUs
    // often fail here: no shader-f16, buffer-size/memory limits, etc.).
    let workerError = null;
    this.worker.addEventListener("message", (ev) => {
      const d = ev?.data;
      if (d && d.kind === "throw") {
        workerError = typeof d.content === "string" ? d.content : JSON.stringify(d.content);
      }
    });

    const model = webLLM(modelId, {
      worker: this.worker,
      // Rich progress reports (fraction + status text) during weight download.
      engineConfig: {
        initProgressCallback: (report) =>
          onProgress?.({ progress: report.progress ?? 0, text: report.text ?? "" }),
      },
    });

    try {
      const availability = await model.availability();
      if (availability === "unavailable") {
        throw new Error("This browser can't run the model — WebGPU is unavailable.");
      }
      if (availability === "downloadable") {
        // Force the download now so progress shows before generation starts.
        await model.createSessionWithProgress();
      }
    } catch (e) {
      // Attach the real worker error, which the library otherwise hides.
      if (workerError) {
        const err = new Error(
          `${e?.message || String(e)}\n\nEngine reported:\n${workerError}` +
            "\n\nOn phones this usually means the GPU lacks a feature the model needs " +
            "(e.g. shader-f16) or hasn't the memory for it. Try a smaller model, or an f32 build.",
        );
        err.cause = e;
        throw err;
      }
      throw e;
    }

    this.model = model;
    this.modelId = modelId;
    return model;
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
