import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
// import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react({ tsDecorators: true })],
});
