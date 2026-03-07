import { transform } from 'sucrase'

export interface CompileResult { code: string; error: null }
export interface CompileError  { code: null;   error: string }

// Strip `import X from './Foo'` lines (local inter-file imports)
function stripLocalImports(code: string): string {
  return code
    .split('\n')
    .filter(line => !/^\s*import\s+.+\s+from\s+['"]\.\//.test(line))
    .join('\n')
}

// Strip `export` keyword so everything lands in the same scope
function stripExports(code: string): string {
  return code
    .replace(/^export default /gm, '')
    .replace(/^export function /gm,  'function ')
    .replace(/^export const /gm,     'const ')
    .replace(/^export class /gm,     'class ')
    .replace(/^export type /gm,      'type ')
    .replace(/^export interface /gm, 'interface ')
    .replace(/^export \{[^}]*\}[^\n]*/gm, '')
}

// Naive bundler: all files share one scope, entry (main.tsx) goes last
export function bundle(files: { name: string; content: string }[]): string {
  const entry  = files.find(f => f.name === 'main.tsx') ?? files[files.length - 1]
  const others = files.filter(f => f !== entry)

  const parts = others.map(f => stripLocalImports(stripExports(f.content)))
  parts.push(stripLocalImports(entry.content))

  return parts.join('\n\n')
}

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
    return { code: null, error: err instanceof Error ? err.message : String(err) }
  }
}

export function buildIframeSrcdoc(compiledCode: string): string {
  const importMap = JSON.stringify({
    imports: {
      'react':             'https://esm.sh/react@18',
      'react-dom':         'https://esm.sh/react-dom@18',
      'react-dom/client':  'https://esm.sh/react-dom@18/client',
      'react/jsx-runtime': 'https://esm.sh/react@18/jsx-runtime',
      'cubeforge':         'https://esm.sh/cubeforge@latest',
    },
  })

  return `<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #12131f; display: flex; align-items: center; justify-content: center; min-height: 100vh; overflow: hidden; }
    #root { display: contents; }
  </style>
  <script type="importmap">${importMap}</script>
</head>
<body>
  <div id="root"></div>
  <script>
    window.onerror = function(msg, src, line, col, err) {
      window.parent.postMessage({ type: 'iframe-error', message: (err && err.stack) || msg }, '*')
    }
    window.addEventListener('unhandledrejection', function(e) {
      window.parent.postMessage({ type: 'iframe-error', message: String(e.reason) }, '*')
    })
  </script>
  <script type="module">
${compiledCode}
  </script>
</body>
</html>`
}
