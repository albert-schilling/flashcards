import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // GitHub Pages serves the app under the repository name.
  base: "/flashcards/",
  plugins: [react()],
  test: {
    name: "web",
    // Nx runs the tests once; Vitest would otherwise watch in a terminal.
    watch: false,
    // The tests render React components into a DOM.
    environment: "jsdom",
    // jsdom has no IndexedDB; each test starts with an empty fake one.
    setupFiles: ["src/test-setup.ts"],
  },
});
