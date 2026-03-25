/**
 * Downloads each game's index.html from Supabase storage, deletes it,
 * and re-uploads with content-type text/html to fix stale S3 metadata.
 * No rebuild required.
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// List all index.html files in the games bucket
const { data: objects, error } = await supabase.storage
  .from('games')
  .list('', { limit: 1000 })

if (error) { console.error('Failed to list bucket root:', error.message); process.exit(1) }

const slugs = objects.map(o => o.name)
console.log(`Found ${slugs.length} game folders: ${slugs.join(', ')}\n`)

let fixed = 0
let failed = 0

for (const slug of slugs) {
  const path = `${slug}/index.html`

  // Download current content
  const { data: blob, error: downloadErr } = await supabase.storage
    .from('games')
    .download(path)

  if (downloadErr) {
    console.log(`  ✗ ${slug}: download failed — ${downloadErr.message}`)
    failed++
    continue
  }

  const content = Buffer.from(await blob.arrayBuffer())

  // Delete then re-upload with correct content-type
  await supabase.storage.from('games').remove([path])

  const { error: uploadErr } = await supabase.storage
    .from('games')
    .upload(path, content, { contentType: 'text/html' })

  if (uploadErr) {
    console.log(`  ✗ ${slug}: upload failed — ${uploadErr.message}`)
    failed++
  } else {
    console.log(`  ✓ ${slug}/index.html → text/html`)
    fixed++
  }
}

console.log(`\nDone. Fixed: ${fixed}, Failed: ${failed}`)
