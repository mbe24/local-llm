<script>
  import { MODELS } from "../lib/models.js";
  import { clearModelCache } from "../lib/llm.js";
  import {
    DEFAULT_SYSTEM_PROMPT,
    DEFAULT_USER_PROMPT,
    WORK_DATA_TOKEN,
    composeUserMessage,
  } from "../lib/scenario.js";

  let { config = $bindable(), disabled = false } = $props();

  let cacheMsg = $state("");
  async function clearCache() {
    cacheMsg = "Clearing…";
    await clearModelCache();
    cacheMsg = "Cleared — the next run re-downloads.";
  }

  const sysModified = $derived(config.systemPrompt !== DEFAULT_SYSTEM_PROMPT);
  const userModified = $derived((config.userPrompt ?? "") !== DEFAULT_USER_PROMPT);
  const selected = $derived(MODELS.find((m) => m.id === config.model));
  // The exact user message the model will receive (with the work-order JSON).
  const userMessage = $derived(composeUserMessage(config));

  function resetSystemPrompt() {
    config.systemPrompt = DEFAULT_SYSTEM_PROMPT;
  }
  function resetUserPrompt() {
    config.userPrompt = DEFAULT_USER_PROMPT;
  }
</script>

<div class="panel settings">
  <h2>Model &amp; generation</h2>

  <label class="model-row">
    <span>Model</span>
    <select bind:value={config.model} {disabled}>
      {#each MODELS as m}
        <option value={m.id}>{m.label} · ~{m.approxMB} MB</option>
      {/each}
    </select>
  </label>
  {#if selected}
    <p class="model-note">{selected.note}</p>
  {/if}
  <p class="model-note">
    On phones, f16 models can output garbled or looping text (mobile GPUs often
    mis-compute f16). If that happens, pick a <strong>(f32)</strong> build.
  </p>

  <div class="params">
    <div class="param">
      <div class="param-head">
        <span>Temperature</span><em>{config.temperature.toFixed(2)}</em>
      </div>
      <input type="range" min="0" max="1.5" step="0.05" bind:value={config.temperature} {disabled} />
      <p class="param-note">Randomness. Low (0–0.3) = focused and repeatable; high (0.8+) = more varied, but small models drift into noise.</p>
    </div>

    <div class="param">
      <div class="param-head">
        <span>Top-p</span><em>{config.topP.toFixed(2)}</em>
      </div>
      <input type="range" min="0.1" max="1" step="0.05" bind:value={config.topP} {disabled} />
      <p class="param-note">Nucleus sampling. Only the most-likely tokens summing to this probability are considered. Lower = safer word choices.</p>
    </div>

    <div class="param">
      <div class="param-head">
        <span>Max tokens</span><em>{config.maxOutputTokens}</em>
      </div>
      <input type="range" min="64" max="1024" step="32" bind:value={config.maxOutputTokens} {disabled} />
      <p class="param-note">Hard length cap on the briefing. Raise it for longer output; lower it to force brevity (may cut off mid-sentence).</p>
    </div>

    <div class="param">
      <div class="param-head">
        <span>Frequency penalty</span><em>{config.frequencyPenalty.toFixed(2)}</em>
      </div>
      <input type="range" min="0" max="1.5" step="0.05" bind:value={config.frequencyPenalty} {disabled} />
      <p class="param-note">Discourages repeating the same words. Nudge up if a small model loops or restates itself; 0 leaves it unchecked.</p>
    </div>
  </div>

  <div class="prompt-editor">
    <div class="prompt-head">
      <span class="prompt-label">System prompt {#if sysModified}<em>(edited)</em>{/if}</span>
      <button class="link" onclick={resetSystemPrompt} disabled={disabled || !sysModified}>
        Reset to default
      </button>
    </div>
    <textarea
      bind:value={config.systemPrompt}
      {disabled}
      spellcheck="false"
      rows="10"
    ></textarea>
    <p class="prompt-note">The model's standing instructions (its role and how to write).</p>
  </div>

  <div class="prompt-editor">
    <div class="prompt-head">
      <span class="prompt-label">User prompt {#if userModified}<em>(edited)</em>{/if}</span>
      <button class="link" onclick={resetUserPrompt} disabled={disabled || !userModified}>
        Reset to default
      </button>
    </div>
    <textarea
      bind:value={config.userPrompt}
      {disabled}
      spellcheck="false"
      rows="4"
      placeholder="(optional) e.g. Brief the tech for {WORK_DATA_TOKEN}"
    ></textarea>
    <p class="prompt-note">
      The request sent with each run. Put <code>{WORK_DATA_TOKEN}</code> where the work-order JSON
      should go; if you leave it out, the JSON is appended at the end. Empty = just the data.
    </p>
  </div>

  <div class="msg-preview-block">
    <span class="prompt-label">User message the model receives</span>
    <pre class="msg-preview">{userMessage}</pre>
    <p class="prompt-note">
      This is the actual user turn for the current work order — your user prompt with the derived
      JSON inserted. The model also gets the system prompt above (as instructions) and one worked
      example before this.
    </p>
  </div>

  <details class="troubleshooting">
    <summary>Troubleshooting</summary>
    <div class="cache-row">
      <button class="link" onclick={clearCache} disabled={disabled}>Clear cached models</button>
      {#if cacheMsg}<span class="cache-msg">{cacheMsg}</span>{/if}
    </div>
    <p class="prompt-note">
      Wipes downloaded weights so the next run re-downloads. Try this if output is garbled after a
      dropped download — a corrupt shard can produce nonsense.
    </p>
  </details>
</div>
