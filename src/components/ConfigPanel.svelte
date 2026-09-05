<script>
  import { CATEGORIES } from "../lib/scenario.js";

  // Two-way bound config object owned by App.
  let { config = $bindable(), disabled = false } = $props();
</script>

<div class="panel config">
  <h2>Work order</h2>

  <fieldset>
    <legend>Job</legend>
    <label>
      <span>Trade</span>
      <select bind:value={config.category} {disabled}>
        {#each CATEGORIES as c}
          <option value={c}>{c}</option>
        {/each}
      </select>
    </label>
    <label>
      <span>Priority <em>{Math.round(config.priority * 100)}%</em></span>
      <input type="range" min="0" max="1" step="0.05" bind:value={config.priority} {disabled} />
    </label>
    <label class="inline">
      <span>Enterprise account</span>
      <input
        type="checkbox"
        checked={config.tier === "enterprise"}
        onchange={(e) => (config.tier = e.currentTarget.checked ? "enterprise" : "standard")}
        {disabled}
      />
    </label>
    <label class="inline">
      <span>Missing clearance for this job</span>
      <input
        type="checkbox"
        checked={config.clearance === "missing"}
        onchange={(e) => (config.clearance = e.currentTarget.checked ? "missing" : "qualified")}
        {disabled}
      />
    </label>
  </fieldset>

  <fieldset>
    <legend>SLA clock</legend>
    <label>
      <span>Window (hours)</span>
      <input type="number" min="1" max="24" bind:value={config.slaHours} {disabled} />
    </label>
    <label>
      <span>Elapsed (min)</span>
      <input type="number" min="0" max="1440" bind:value={config.elapsedMin} {disabled} />
    </label>
    <label>
      <span>Travel (min)</span>
      <input type="number" min="0" max="600" bind:value={config.travelMin} {disabled} />
    </label>
  </fieldset>

  <fieldset>
    <legend>Parts</legend>
    <label class="inline">
      <span>Quick-fix part in van</span>
      <input type="checkbox" bind:checked={config.partInStock} {disabled} />
    </label>
    <label>
      <span>Blocked part ETA (days)</span>
      <input type="number" min="0" max="30" bind:value={config.partEtaDays} {disabled} />
    </label>
  </fieldset>

  <fieldset>
    <legend>History</legend>
    <label class="inline">
      <span>Recurring issue</span>
      <input type="checkbox" bind:checked={config.recurring} {disabled} />
    </label>
    {#if config.recurring}
      <label>
        <span>Prior visits</span>
        <input type="number" min="1" max="20" bind:value={config.priorVisits} {disabled} />
      </label>
    {/if}
  </fieldset>

  <fieldset>
    <legend>Hazards</legend>
    <label class="inline">
      <span>Rooftop work</span>
      <input type="checkbox" bind:checked={config.hazards.rooftop} {disabled} />
    </label>
    <label class="inline">
      <span>Live electrical</span>
      <input type="checkbox" bind:checked={config.hazards.electrical} {disabled} />
    </label>
    <label class="inline">
      <span>Confined space</span>
      <input type="checkbox" bind:checked={config.hazards.confinedSpace} {disabled} />
    </label>
    <label class="inline">
      <span>Chemical / refrigerant</span>
      <input type="checkbox" bind:checked={config.hazards.chemical} {disabled} />
    </label>
    <label class="inline">
      <span>Heavy lifting</span>
      <input type="checkbox" bind:checked={config.hazards.heavyLift} {disabled} />
    </label>
  </fieldset>

  <fieldset>
    <legend>Site access</legend>
    <label class="inline">
      <span>Badge required</span>
      <input type="checkbox" bind:checked={config.access.badge} {disabled} />
    </label>
    <label class="inline">
      <span>Escort required</span>
      <input type="checkbox" bind:checked={config.access.escort} {disabled} />
    </label>
  </fieldset>
</div>
