<script>
  let { facts } = $props();
  let open = $state(false);

  const json = $derived(JSON.stringify(facts, null, 2));

  // Offer the derived data as a downloadable .json attachment.
  function download() {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${facts.work_order ?? "work-order"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Tiny dependency-free JSON highlighter: escape HTML, then wrap tokens
  // (keys, strings, numbers, booleans, null) in classed spans.
  const highlighted = $derived(highlight(json));

  function highlight(src) {
    const esc = src
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return esc.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false)\b|\bnull\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (m) => {
        let cls = "num";
        if (/^"/.test(m)) cls = /:$/.test(m) ? "key" : "str";
        else if (/^(true|false)$/.test(m)) cls = "bool";
        else if (/^null$/.test(m)) cls = "null";
        return `<span class="j-${cls}">${m}</span>`;
      },
    );
  }
</script>

<div class="panel raw">
  <button class="disclose" onclick={() => (open = !open)} aria-expanded={open}>
    {open ? "▾" : "▸"} Facts sent to the model
  </button>
  {#if open}
    <div class="raw-head">
      <p class="raw-note">
        The UI edits a flat config; these interdependent facts are derived from it in JS (SLA slack,
        parts outlook, clearance flag). The model only turns them into prose.
      </p>
      <button class="link" onclick={download}>Download JSON</button>
    </div>
    <pre class="json">{@html highlighted}</pre>
  {/if}
</div>
