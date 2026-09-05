<script>
  import { MODELS } from "../lib/models.js";
  import { DEFAULT_SYSTEM_PROMPT } from "../lib/scenario.js";

  let { config = $bindable(), disabled = false } = $props();

  const modified = $derived(config.systemPrompt !== DEFAULT_SYSTEM_PROMPT);
  const selected = $derived(MODELS.find((m) => m.id === config.model));

  function resetPrompt() {
    config.systemPrompt = DEFAULT_SYSTEM_PROMPT;
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
      <span class="prompt-label">System prompt {#if modified}<em>(edited)</em>{/if}</span>
      <button class="link" onclick={resetPrompt} disabled={disabled || !modified}>
        Reset to default
      </button>
    </div>
    <textarea
      bind:value={config.systemPrompt}
      {disabled}
      spellcheck="false"
      rows="10"
    ></textarea>
    <p class="prompt-note">
      Edit the instructions the model gets. The work-order facts are appended as JSON below this
      prompt on each run.
    </p>
  </div>
</div>
