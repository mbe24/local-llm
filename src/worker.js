// Web Worker that hosts the WebLLM engine off the main thread, so model
// download and token generation never freeze the config UI.
//
// @browser-ai/web-llm re-exports MLC's worker handler; wiring it up is a
// one-liner. The main thread talks to this worker automatically once you pass
// `worker: new Worker(...)` to webLLM() (see src/lib/llm.js).
import { WebWorkerMLCEngineHandler } from "@browser-ai/web-llm";

const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (msg) => handler.onmessage(msg);
