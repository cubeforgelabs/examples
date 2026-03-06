import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // esbuild-wasm ships its own WASM file; exclude from Vite pre-bundling
    exclude: ['esbuild-wasm'],
  },
  server: {
    headers: {
      // Required for SharedArrayBuffer used by esbuild-wasm
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
})
