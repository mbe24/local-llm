import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// base: "./" keeps every asset path relative, so the built dist/ works both on
// localhost and under the GitHub Pages project subpath (/<repo>/) without
// hard-coding the repo name. Module workers and their chunks resolve the same way.
export default defineConfig({
  base: "./",
  plugins: [svelte()],
  worker: {
    format: "es",
  },
});
