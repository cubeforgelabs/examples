import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'

const engine = fileURLToPath(new URL('../../cubeforge/packages', import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@cubeforge/core':     `${engine}/core/src/index.ts`,
      '@cubeforge/input':    `${engine}/input/src/index.ts`,
      '@cubeforge/renderer': `${engine}/renderer/src/index.ts`,
      '@cubeforge/physics':  `${engine}/physics/src/index.ts`,
      '@cubeforge/react':    `${engine}/react/src/index.ts`,
    },
  },
})
