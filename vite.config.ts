import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    base: "./",
    build: {
        outDir: "dist",
        emptyOutDir: true,
    },
    optimizeDeps: {
        include: ["react-select-async-paginate"],
    },
    server: {
        port: 3000,
    },
});
