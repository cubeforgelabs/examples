import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@cubeforge/react':    'cubeforge',
      '@cubeforge/core':     'cubeforge',
      '@cubeforge/renderer': 'cubeforge',
      '@cubeforge/input':    'cubeforge',
      '@cubeforge/physics':  'cubeforge',
    },
  },
})

