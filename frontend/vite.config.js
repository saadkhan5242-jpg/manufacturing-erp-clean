import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./", // Forces relative pathways for asset references
  build: {
    outDir: "dist",
    emptyOutDir: true,
    cssCodeSplit: false, // Prevents splitting CSS into separate unreadable files
    rollupOptions: {
      output: {
        // 🚀 FORCES VITE TO COMPILE EVERYTHING INTO A SINGLE UNIFIED JAVASCRIPT FILE
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name].[ext]"
      }
    }
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
        secure: false,
      }
    }
  }
});
