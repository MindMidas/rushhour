import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const runtime = globalThis as { process?: { env?: Record<string, string | undefined> } };
const base = runtime.process?.env?.APP_BASE_PATH || "/";

export default defineConfig({
  root: "src/frontend",
  base,
  plugins: [react(), tailwindcss()],
  build: { outDir: "dist", emptyOutDir: true },
});
