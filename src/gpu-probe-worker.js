// Cheap, download-free probe: can a Web Worker get a WebGPU adapter on this
// device? Android Chrome often exposes the API in workers but returns null from
// requestAdapter(). Knowing this up front lets us skip a doomed worker engine
// init (which would download the whole model before failing at GPU creation).
(async () => {
  try {
    const ok = !!(
      typeof navigator !== "undefined" &&
      navigator.gpu &&
      (await navigator.gpu.requestAdapter())
    );
    self.postMessage({ ok });
  } catch {
    self.postMessage({ ok: false });
  }
})();
