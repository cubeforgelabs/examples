import { useState, useRef, useCallback, useEffect } from 'react'
import Editor, { type Monaco } from '@monaco-editor/react'
import { compile, bundle, buildIframeSrcdoc } from './compiler'
import { TEMPLATES, type VFile } from './templates'

// ── URL hash ──────────────────────────────────────────────────────────────────

function encodeFiles(files: VFile[]): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(files))))
}

function decodeFiles(hash: string): VFile[] | null {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(hash.replace(/^#/, '')))))
  } catch {
    return null
  }
}

function getInitialState(): { files: VFile[]; templateId: string } {
  const hash = window.location.hash
  if (hash && hash.length > 1) {
    const files = decodeFiles(hash)
    if (files) return { files, templateId: '__custom__' }
  }
  return { files: TEMPLATES[0].files, templateId: TEMPLATES[0].id }
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconPlay() {
  return <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M2 1.5l6 3.5-6 3.5V1.5z"/></svg>
}
function IconCopy() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="5" width="9" height="9" rx="1.5"/><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5"/></svg>
}
function IconReset() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 8a6 6 0 1 0 1.5-3.9L2 5.5"/><path d="M2 2v3.5H5.5"/></svg>
}
function IconShare() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 1l4 4-4 4"/><path d="M14 5H6a4 4 0 0 0-4 4v2"/></svg>
}
function IconGitHub() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>
}
function IconCheck() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13.5 4l-7.5 7.5L2.5 8"/></svg>
}
function IconChevron() {
  return <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2.5 4l2.5 2.5L7.5 4"/></svg>
}

// ── File icon ─────────────────────────────────────────────────────────────────

function FileIcon({ name }: { name: string }) {
  const isTsx = name.endsWith('.tsx')
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}>
      <rect x="1" y="1" width="8" height="11" rx="1" stroke="currentColor" strokeWidth="1" opacity="0.5"/>
      <path d="M7 1v3h3" stroke="currentColor" strokeWidth="1" opacity="0.5"/>
      {isTsx
        ? <text x="2" y="10" fontSize="4" fill="var(--accent)" fontFamily="monospace" fontWeight="bold">tsx</text>
        : <text x="2.5" y="10" fontSize="4" fill="var(--text-dim)" fontFamily="monospace" fontWeight="bold">ts</text>
      }
    </svg>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({ files, activeFile, onSelect, onAddFile }: {
  files: VFile[]; activeFile: string; onSelect: (n: string) => void; onAddFile: () => void
}) {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span>EXPLORER</span>
        <button className="sidebar-add-btn" onClick={onAddFile} title="New file">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M6 2v8M2 6h8"/>
          </svg>
        </button>
      </div>
      <div className="file-tree">
        <div className="file-tree-dir">
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 2l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
          <span>src</span>
        </div>
        {files.map(f => (
          <div
            key={f.name}
            className={`file-tree-file${f.name === activeFile ? ' active' : ''}`}
            onClick={() => onSelect(f.name)}
          >
            <FileIcon name={f.name} />
            <span>{f.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Template picker ───────────────────────────────────────────────────────────

function TemplatePicker({ templateId, onChange }: { templateId: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = TEMPLATES.find(t => t.id === templateId)

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  return (
    <div className="template-picker" ref={ref}>
      <button className={`template-trigger${open ? ' open' : ''}`} onClick={() => setOpen(o => !o)}>
        <span style={{ fontSize: 13 }}>{current?.icon ?? '📄'}</span>
        {current?.label ?? 'Custom'}
        <span className="template-trigger-chevron"><IconChevron /></span>
      </button>
      {open && (
        <div className="template-dropdown">
          {TEMPLATES.map(t => (
            <div
              key={t.id}
              className={`template-option${t.id === templateId ? ' active' : ''}`}
              onClick={() => { onChange(t.id); setOpen(false) }}
            >
              <div className="template-option-icon">{t.icon}</div>
              <div className="template-option-info">
                <div className="template-option-name">{t.label}</div>
                <div className="template-option-desc">{t.description}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Status badge ──────────────────────────────────────────────────────────────

type Status = { kind: 'idle' } | { kind: 'ok' } | { kind: 'building' } | { kind: 'error'; message: string }

function StatusBadge({ status }: { status: Status }) {
  const label = status.kind === 'ok' ? 'READY' : status.kind === 'building' ? 'BUILDING' : status.kind === 'error' ? 'ERROR' : 'IDLE'
  const cls   = status.kind === 'idle' ? 'building' : status.kind
  return (
    <div className={`status-badge ${cls}`}>
      <span className="status-dot" />
      {label}
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────

export function App() {
  const initial = getInitialState()

  const [templateId, setTemplateId]           = useState(initial.templateId)
  const [files, setFiles]                     = useState<VFile[]>(initial.files)
  const [activeFile, setActiveFile]           = useState(initial.files[0].name)
  const [srcdoc, setSrcdoc]                   = useState('')
  const [iframeKey, setIframeKey]             = useState(0)
  const [editorVersion, setEditorVersion]     = useState(0) // bump to remount Monaco (template reset)
  const [status, setStatus]                   = useState<Status>({ kind: 'idle' })
  const [iframeError, setIframeError]         = useState<string | null>(null)
  const [copied, setCopied]                   = useState(false)
  const [shared, setShared]                   = useState(false)

  const filesRef = useRef(files)
  useEffect(() => { filesRef.current = files }, [files])

  // Listen for runtime errors from the iframe via postMessage
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.data?.type === 'iframe-error') {
        setIframeError(e.data.message)
        setStatus({ kind: 'error', message: e.data.message })
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  const run = useCallback((allFiles: VFile[]) => {
    setStatus({ kind: 'building' })
    setIframeError(null)
    setTimeout(() => {
      const source = bundle(allFiles)
      const result = compile(source)
      if (result.error !== null) {
        setSrcdoc('')
        setStatus({ kind: 'error', message: result.error })
      } else {
        setSrcdoc(buildIframeSrcdoc(result.code))
        setIframeKey(k => k + 1)   // force iframe remount every run
        setStatus({ kind: 'ok' })
      }
    }, 0)
  }, [])

  // Cmd/Ctrl+Enter
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        run(filesRef.current)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [run])

  function handleTemplateChange(id: string) {
    const tpl = TEMPLATES.find(t => t.id === id)
    if (!tpl) return
    setTemplateId(id)
    setFiles(tpl.files)
    setActiveFile(tpl.files[0].name)
    setSrcdoc('')
    setStatus({ kind: 'idle' })
    setIframeError(null)
    setEditorVersion(v => v + 1)   // remount Monaco so models reset
    window.location.hash = ''
  }

  function handleReset() {
    const tpl = TEMPLATES.find(t => t.id === templateId) ?? TEMPLATES[0]
    setFiles(tpl.files)
    setActiveFile(tpl.files[0].name)
    setSrcdoc('')
    setStatus({ kind: 'idle' })
    setIframeError(null)
    setEditorVersion(v => v + 1)
    window.location.hash = ''
  }

  function handleEditorMount(_: unknown, monaco: Monaco) {
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false,
    })
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
      jsxImportSource: 'react',
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      allowSyntheticDefaultImports: true,
      esModuleInterop: true,
    })
  }

  function handleCodeChange(value: string) {
    setFiles(prev => prev.map(f => f.name === activeFile ? { ...f, content: value } : f))
  }

  function handleAddFile() {
    const name = prompt('File name (e.g. Enemy.tsx):')
    if (!name) return
    setFiles(prev => [...prev, { name, content: `// ${name}\n` }])
    setActiveFile(name)
  }

  function handleCopy() {
    const f = filesRef.current.find(f => f.name === activeFile)
    navigator.clipboard.writeText(f?.content ?? '').then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  function handleShare() {
    window.location.hash = encodeFiles(filesRef.current)
    navigator.clipboard.writeText(window.location.href).then(() => {
      setShared(true)
      setTimeout(() => setShared(false), 1800)
    })
  }

  const currentFile = files.find(f => f.name === activeFile)
  const errorMessage = status.kind === 'error' ? status.message : iframeError

  return (
    <div className="playground">
      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-logo">
          <div className="toolbar-logo-mark">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="1" y="1" width="4" height="4" fill="#0b0d14"/>
              <rect x="7" y="1" width="4" height="4" fill="#0b0d14"/>
              <rect x="1" y="7" width="4" height="4" fill="#0b0d14"/>
              <rect x="7" y="7" width="4" height="4" fill="#0b0d14"/>
            </svg>
          </div>
          <span className="toolbar-logo-text">cube<span>forge</span></span>
        </div>

        <div className="toolbar-divider" />
        <TemplatePicker templateId={templateId} onChange={handleTemplateChange} />
        <div className="toolbar-spacer" />
        <StatusBadge status={status} />
        <div className="toolbar-divider" />

        <button className={`icon-btn${copied ? ' copied' : ''}`} onClick={handleCopy}>
          {copied ? <IconCheck /> : <IconCopy />}
          <span className="tooltip">Copy active file</span>
        </button>
        <button className={`icon-btn${shared ? ' copied' : ''}`} onClick={handleShare}>
          {shared ? <IconCheck /> : <IconShare />}
          <span className="tooltip">Copy share link</span>
        </button>
        <button className="icon-btn danger" onClick={handleReset}>
          <IconReset />
          <span className="tooltip">Reset template</span>
        </button>

        <div className="toolbar-divider" />
        <a className="github-link" href="https://github.com/1homsi/cubeforge" target="_blank" rel="noopener noreferrer">
          <IconGitHub />
          <span className="tooltip">GitHub</span>
        </a>
        <div className="toolbar-divider" />

        <button className="run-btn" onClick={() => run(filesRef.current)}>
          <IconPlay />
          RUN
          <span className="run-btn-hint">⌘↵</span>
        </button>
      </div>

      {/* Panels */}
      <div className="panels">
        <Sidebar files={files} activeFile={activeFile} onSelect={setActiveFile} onAddFile={handleAddFile} />

        {/* Editor */}
        <div className="editor-panel">
          <div className="editor-tab-bar">
            {files.map(f => (
              <div
                key={f.name}
                className={`editor-tab${f.name === activeFile ? ' active' : ''}`}
                onClick={() => setActiveFile(f.name)}
              >
                {f.name === activeFile && <span className="editor-tab-dot" />}
                {f.name}
              </div>
            ))}
          </div>
          <div className="editor-body">
            <Editor
              key={editorVersion}
              path={`file:///${activeFile}`}
              defaultLanguage="typescript"
              theme="vs-dark"
              defaultValue={currentFile?.content ?? ''}
              onChange={v => handleCodeChange(v ?? '')}
              onMount={handleEditorMount}
              options={{
                fontSize: 13,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                tabSize: 2,
                wordWrap: 'on',
                padding: { top: 12 },
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                fontLigatures: true,
                lineHeight: 20,
                renderLineHighlight: 'gutter',
                smoothScrolling: true,
              }}
            />
          </div>
        </div>

        {/* Preview */}
        <div className="preview-panel">
          <div className="preview-tab-bar">
            <span>PREVIEW</span>
          </div>
          <div className="preview-body">
            {srcdoc ? (
              <iframe
                key={iframeKey}
                srcDoc={srcdoc}
                sandbox="allow-scripts allow-pointer-lock"
                title="game preview"
              />
            ) : (
              <div className="preview-empty">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
                  <polygon points="6 3.5 22 14 6 24.5 6 3.5"/>
                </svg>
                <span>Press Run to start</span>
                <span style={{ fontSize: 10, opacity: 0.5 }}>⌘↵ or click RUN</span>
              </div>
            )}
            {errorMessage && (
              <div className="error-overlay">
                <div className="error-box">{errorMessage}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
