
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    server: {
      host: "localhost",
      port: 5173,
      strictPort: true,
    },
  },
});
