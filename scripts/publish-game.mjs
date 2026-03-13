/**
 * Builds and publishes a single game to Supabase Storage.
 * Usage: node scripts/publish-game.mjs <slug>
 *        SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/publish-game.mjs platformer
 */
import { execSync } from 'child_process'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'
import { createClient } from '@supabase/supabase-js'

const slug = process.argv[2]
if (!slug) { console.error('Usage: publish-game.mjs <slug>'); process.exit(1) }

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const root = new URL('..', import.meta.url).pathname
const gameDir = join(root, 'games', slug)
const distDir = join(gameDir, 'dist')
const metaPath = join(gameDir, 'game.json')

// ── Read metadata ────────────────────────────────────────────
const meta = JSON.parse(readFileSync(metaPath, 'utf8'))
console.log(`📦 Publishing: ${meta.title} (${slug})`)

// ── Install + Build ──────────────────────────────────────────
console.log('📥 Installing dependencies…')
execSync('pnpm install', { cwd: gameDir, stdio: 'inherit' })
console.log('🔨 Building…')
execSync('pnpm build', { cwd: gameDir, stdio: 'inherit' })

// ── Upload dist/ to Supabase Storage ────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

function walkDir(dir) {
  const entries = readdirSync(dir)
  const files = []
  for (const entry of entries) {
    const fullPath = join(dir, entry)
    if (statSync(fullPath).isDirectory()) {
      files.push(...walkDir(fullPath))
    } else {
      files.push(fullPath)
    }
  }
  return files
}

const files = walkDir(distDir)
console.log(`☁️  Uploading ${files.length} files…`)

for (const filePath of files) {
  const storagePath = `${slug}/${relative(distDir, filePath)}`
  const content = readFileSync(filePath)
  const ext = filePath.split('.').pop()
  const contentType = {
    html: 'text/html',
    js: 'application/javascript',
    css: 'text/css',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    json: 'application/json',
    woff2: 'font/woff2',
    woff: 'font/woff',
    mp3: 'audio/mpeg',
    ogg: 'audio/ogg',
    wav: 'audio/wav',
  }[ext] ?? 'application/octet-stream'

  // Remove first so S3 metadata (content-type) is always fresh on re-upload
  await supabase.storage.from('games').remove([storagePath])
  const { error } = await supabase.storage
    .from('games')
    .upload(storagePath, content, { contentType })

  if (error) { console.error(`  ✗ ${storagePath}: ${error.message}`); process.exit(1) }
  console.log(`  ✓ ${storagePath}`)
}

// ── Upsert game record in DB ─────────────────────────────────
const bundlePath = `${slug}/index.html`
const thumbnailPath = `${slug}/thumbnail.png`

// Check if thumbnail exists in storage
const { data: thumbData } = await supabase.storage.from('games').getPublicUrl(thumbnailPath)
const { data: { publicUrl: storageBase } } = supabase.storage.from('games').getPublicUrl('')
const thumbnailUrl = files.some(f => f.endsWith('thumbnail.png'))
  ? `${storageBase}${thumbnailPath}`
  : null

const { error: dbError } = await supabase
  .from('games')
  .upsert({
    slug,
    title: meta.title,
    description: meta.description ?? null,
    tags: meta.tags ?? [],
    thumbnail_url: thumbnailUrl,
    bundle_path: bundlePath,
    is_official: true,
    published_at: new Date().toISOString(),
  }, { onConflict: 'slug' })

if (dbError) { console.error(`DB error: ${dbError.message}`); process.exit(1) }

console.log(`✅ ${meta.title} published — games/${bundlePath}`)
