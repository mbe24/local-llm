<script>
  import ConfigPanel from "./components/ConfigPanel.svelte";
  import Briefing from "./components/Briefing.svelte";
  import RawJson from "./components/RawJson.svelte";
  import Settings from "./components/Settings.svelte";
  import { defaultConfig, deriveFacts, buildPrompt } from "./lib/scenario.js";
  import { MODELS } from "./lib/models.js";
  import { briefer, browserSupported, probeWebGPU } from "./lib/llm.js";

  let config = $state(defaultConfig());
  let view = $state("briefing"); // "briefing" | "settings"

  const selectedModel = $derived(MODELS.find((m) => m.id === config.model));

  // Recomputes live as the config changes — this is the JS-derived input.
  const derived = $derived(deriveFacts(config));

  let status = $state("idle"); // idle | loading | streaming | error
  let progress = $state(0);
  let statusText = $state(""); // human-readable phase from the engine
  let text = $state("");
  let reasoning = $state(""); // a reasoning model's thinking, if any
  let stats = $state(null); // { outputTokens, tokPerSec, finishReason }
  let error = $state(""); // full error detail for the panel
  let controller = null; // AbortController for the in-flight generation

  const supported = browserSupported();

  // Print everything we can get out of a thrown value: name, message, the whole
  // cause chain, and the stack. WebLLM wraps failures as opaque "Unknown error",
  // so the cause/stack is often the only clue (e.g. mobile WebGPU limits).
  function formatError(e) {
    if (e == null) return "Unknown error (no details provided).";
    if (typeof e === "string") return e;
    const lines = [];
    lines.push([e.name, e.message].filter(Boolean).join(": ") || String(e));
    let cause = e.cause;
    let guard = 0;
    while (cause && guard++ < 6) {
      lines.push("Caused by: " + ([cause.name, cause.message].filter(Boolean).join(": ") || String(cause)));
      cause = cause.cause;
    }
    if (e.stack) lines.push("", String(e.stack));
    return lines.join("\n");
  }

  async function generate() {
    // Preflight: confirm a real GPU adapter exists (the API can be present while
    // requestAdapter() returns null). Fail fast with a clear message.
    const probe = await probeWebGPU();
    if (!probe.ok) {
      status = "error";
      error =
        probe.reason +
        "\n\nCheck https://webgpureport.org/ on this device. If it shows no adapter, this browser/device can't run WebGPU models yet. On Android you can try enabling chrome://flags/#enable-unsafe-webgpu (and restarting Chrome), but some GPUs remain unsupported.";
      return;
    }
    text = "";
    reasoning = "";
    stats = null;
    error = "";
    progress = 0;
    statusText = `Loading ${selectedModel?.label ?? "model"}${
      selectedModel ? ` — first run downloads ~${selectedModel.approxMB} MB` : ""
    }…`;
    status = "loading";
    controller = new AbortController();
    let genStart = 0;
    let genTokens = 0; // self-counted: the WebLLM provider reports usage: 0
    let finishReason = "stop";
    try {
      const prompt = buildPrompt(config);
      let first = true;
      const opts = {
        signal: controller.signal,
        onProgress: (r) => {
          progress = r.progress;
          if (r.text) statusText = r.text;
        },
        onFinish: ({ finishReason: fr }) => {
          if (fr) finishReason = fr;
        },
        params: {
          temperature: config.temperature,
          topP: config.topP,
          maxOutputTokens: config.maxOutputTokens,
          frequencyPenalty: config.frequencyPenalty,
        },
      };
      for await (const part of briefer.stream(config.model, prompt, opts)) {
        if (first) {
          status = "streaming";
          statusText = "Generating…";
          genStart = performance.now();
          first = false;
        }
        genTokens += 1; // WebLLM streams roughly one token per part
        if (part.kind === "reasoning") reasoning += part.text;
        else text += part.text;
      }
      const secs = genStart ? (performance.now() - genStart) / 1000 : 0;
      stats = {
        outputTokens: genTokens,
        tokPerSec: secs > 0 ? Math.round(genTokens / secs) : 0,
        finishReason,
      };
      status = "idle";
    } catch (e) {
      // A user-triggered abort isn't an error — keep whatever streamed.
      if (e?.name === "AbortError" || controller?.signal.aborted) {
        status = "idle";
        statusText = "Stopped.";
      } else {
        status = "error";
        const detail = formatError(e);
        // A network failure mid-download is common on mobile — guide a retry.
        error = /failed to fetch|networkerror|load failed/i.test(detail)
          ? "Couldn't download the model weights (network error). The download is large and can fail partway on a mobile connection — check your connection and press Generate again. A smaller model (SmolLM2 360M) downloads less.\n\n" +
            detail
          : detail;
      }
    } finally {
      controller = null;
    }
  }

  function stop() {
    controller?.abort();
  }

  const busy = $derived(status === "loading" || status === "streaming");
</script>

<main>
  <header>
    <h1>Work-Order Briefing</h1>
    <p class="tagline">
      Structured metadata → a spoken dispatch, generated by a small model running entirely in your
      browser. No server, no API keys.
    </p>
    {#if !supported}
      <p class="warn">⚠ WebGPU not detected — generation will fail. Use Chrome, Edge, or Safari 18+.</p>
    {/if}
  </header>

  <nav class="tabs">
    <button class:active={view === "briefing"} onclick={() => (view = "briefing")}>Briefing</button>
    <button class:active={view === "settings"} onclick={() => (view = "settings")}>Settings</button>
  </nav>

  {#if view === "briefing"}
    <div class="grid">
      <ConfigPanel bind:config disabled={busy} />
      <div class="right-col">
        <Briefing
          {text}
          {reasoning}
          {stats}
          {status}
          {progress}
          {statusText}
          {error}
          onGenerate={generate}
          onStop={stop}
        />
      </div>
    </div>

    <RawJson facts={derived.facts} />
  {:else}
    <Settings bind:config disabled={busy} />
  {/if}

  <footer>
    <span>Model runs locally via WebGPU · <code>{config.model}</code></span>
  </footer>
</main>
