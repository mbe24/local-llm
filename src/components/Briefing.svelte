<script>
  import { marked } from "marked";

  let {
    text = "",
    reasoning = "",
    stats = null,
    status = "idle",
    progress = 0,
    statusText = "",
    error = "",
    onGenerate,
    onStop,
  } = $props();

  marked.setOptions({ breaks: false, gfm: true });

  const pct = $derived(Math.round(progress * 100));
  const busy = $derived(status === "loading" || status === "streaming");
  // Model output is local and rendered as HTML; marked handles the markdown.
  const html = $derived(text ? marked.parse(text) : "");
</script>

<div class="panel briefing">
  <div class="briefing-head">
    <h2>Dispatch briefing</h2>
    {#if busy}
      <button class="stop" onclick={onStop}>Stop</button>
    {:else}
      <button onclick={onGenerate}>Generate</button>
    {/if}
  </div>

  {#if status === "loading"}
    <div class="progress" role="status">
      <div class="bar"><div class="fill" style="width:{pct}%"></div></div>
      <span>{statusText || "Loading model…"} {pct}%</span>
    </div>
  {:else if status === "streaming"}
    <div class="progress" role="status">
      <span class="live">● {statusText || "Generating…"}</span>
    </div>
  {/if}

  {#if status === "error"}
    <div class="error-box">
      <div class="error-title">Generation failed</div>
      <pre class="error-detail">{error}</pre>
    </div>
  {/if}

  {#if reasoning}
    <details class="reasoning">
      <summary>Model reasoning</summary>
      <div class="reasoning-body">{reasoning}</div>
    </details>
  {/if}

  <div class="output" class:empty={!text}>
    {#if text}
      {@html html}
    {:else if status !== "error"}
      <span class="hint">Configure the work order, then press Generate. The briefing streams in here.</span>
    {/if}
  </div>

  {#if stats}
    <div class="stats">{stats.outputTokens} tokens · {stats.tokPerSec} tok/s · finished: {stats.finishReason}</div>
  {/if}
</div>
