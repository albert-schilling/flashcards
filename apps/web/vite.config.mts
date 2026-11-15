import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  root: import.meta.dirname,
  cacheDir: "../../node_modules/.vite/apps/web",
  // GitHub Pages serves the app under the repository name.
  base: "/flashcards/",
  plugins: [react()],
  test: {
    name: "web",
    watch: false,
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    reporters: ["default"],
  },
});
