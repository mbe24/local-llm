# local-llm

local-llm is a static, in-browser demo that turns structured work-order metadata
into a natural prose dispatch briefing, generated **entirely client-side** by a
small language model over WebGPU. It is built with Vite + Svelte 5; WebLLM (via
[`@browser-ai/web-llm`](https://github.com/jakobhoeg/browser-ai) + the Vercel AI
SDK) runs the model in a Web Worker. It builds to a self-contained static site
hosted on GitHub Pages — no server, no API keys.

## Commits

Use Conventional Commits with a scope on the component you touched. Imperative
mood, lowercase start, no trailing period.

- Structure: `type(scope): summary`
- Types: `feat`, `fix`, `chore`, `build`, `docs`, `refactor`, `test`, `perf`
- Scope: the component, e.g. `ui`, `scenario`, `prompt`, `llm`, `models`,
  `styles`, `build`, `ci`, `docs`
- Example: `feat(scenario): derive site-access notes from badge/escort toggles`
- Do NOT append a `Co-Authored-By:` / agent-attribution trailer (or any
  Claude/session line) to commit messages.

## Validation before committing

This repo builds with Node + Vite — no Docker/WSL needed. After a series of
changes, run:

- `npm run build` — the static `dist/` must build clean. This is the gate; there
  is no separate lint/test suite yet.
- Sanity-check in a WebGPU browser (`npm run preview`, or `npm run dev`) that the
  page mounts and a generation streams without console errors.
- Keep the build self-contained: relative asset paths and `base: "./"` in
  `vite.config.js`, so GitHub Pages keeps working under the `/<repo>/` subpath.
  Root-absolute `/asset` URLs and hard-coded hosts break the deployed site.
