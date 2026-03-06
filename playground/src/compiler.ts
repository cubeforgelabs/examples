import type { TransformOptions } from 'esbuild-wasm'

let initialized = false
let initPromise: Promise<void> | null = null

async function ensureInitialized(): Promise<void> {
  if (initialized) return
  if (initPromise) return initPromise
  initPromise = (async () => {
    const esbuild = await import('esbuild-wasm')
    await esbuild.initialize({
      wasmURL: new URL('esbuild-wasm/esbuild.wasm', import.meta.url).href,
    })
    initialized = true
  })()
  return initPromise
}

export interface CompileResult {
  code: string
  error: null
}

export interface CompileError {
  code: null
  error: string
}

export async function compile(source: string): Promise<CompileResult | CompileError> {
  await ensureInitialized()
  const esbuild = await import('esbuild-wasm')
  const opts: TransformOptions = {
    loader: 'tsx',
    target: 'es2020',
    jsx: 'automatic',
    jsxImportSource: 'react',
    format: 'esm',
  }
  try {
    const result = await esbuild.transform(source, opts)
    return { code: result.code, error: null }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { code: null, error: message }
  }
}

/**
 * Wraps compiled ES module code in a full HTML document that:
 * - uses an import map to resolve cubeforge + react from esm.sh CDN
 * - mounts the module as a script[type=module]
 * - provides a #root element for React
 */
export function buildIframeSrcdoc(compiledCode: string): string {
  const importMap = JSON.stringify({
    imports: {
      react: 'https://esm.sh/react@18',
      'react-dom': 'https://esm.sh/react-dom@18',
      'react-dom/client': 'https://esm.sh/react-dom@18/client',
      'react/jsx-runtime': 'https://esm.sh/react@18/jsx-runtime',
      cubeforge: 'https://esm.sh/cubeforge@latest',
    },
  })

  return `<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #12131f; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    #root { display: contents; }
  </style>
  <script type="importmap">${importMap}</script>
</head>
<body>
  <div id="root"></div>
  <script type="module">
${compiledCode}
  </script>
</body>
</html>`
}
