import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import checker from "vite-plugin-checker";

// https://vitejs.dev/config/
export default defineConfig({
  server: { port: 3001 },
  plugins: [
    react({ tsDecorators: true }),
    checker({
      // e.g. use TypeScript check
      typescript: true,
    }),
  ],
});
