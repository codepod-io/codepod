import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
// import react from "@vitejs/plugin-react";
import checker from "vite-plugin-checker";

// https://vitejs.dev/config/
export default defineConfig({
  server: { port: 3000 },
  build: {
    outDir: "../api/public",
  },
  plugins: [
    react({ tsDecorators: true }),
    checker({
      // e.g. use TypeScript check
      typescript: true,
    }),
  ],
});
