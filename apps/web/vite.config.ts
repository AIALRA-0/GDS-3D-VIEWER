import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.VITE_API_BASE_URL?.trim().replace(/\/$/, "") || "http://127.0.0.1:34000";

  return {
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules/react")) {
              return "react-vendor";
            }
            if (id.includes("node_modules/three")) {
              return "three-vendor";
            }
            if (id.includes("node_modules")) {
              return "vendor";
            }
          },
        },
      },
    },
    server: {
      host: "0.0.0.0",
      port: 4173,
      proxy: {
        "/api": apiTarget,
        "/review-assets": apiTarget,
      },
    },
    preview: {
      host: "0.0.0.0",
      port: 4173,
    },
  };
});
