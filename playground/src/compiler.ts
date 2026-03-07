import { transform } from 'sucrase'

export interface CompileResult {
  code: string
  error: null
}

export interface CompileError {
  code: null
  error: string
}

// Synchronous — no WASM, no async init, instant
export function compile(source: string): CompileResult | CompileError {
  try {
    const result = transform(source, {
      transforms: ['typescript', 'jsx'],
      jsxRuntime: 'automatic',
      jsxImportSource: 'react',
      production: true,
    })
    return { code: result.code, error: null }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { code: null, error: message }
  }
}

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
