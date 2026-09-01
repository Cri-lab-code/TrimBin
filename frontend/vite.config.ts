import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    base: './',
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    build: {
        outDir: path.resolve(__dirname, 'dist/renderer'),
        emptyOutDir: true,
        rollupOptions: {
            input: path.resolve(__dirname, 'index.html'),
        },
    },
});
