// Downloads every file from every Supabase Storage bucket into
// ./backup/storage/<bucket>/<path>. Used by .github/workflows/daily-backup.yml.
//
// Required env vars:
//   SUPABASE_URL              — project URL (e.g. https://xyz.supabase.co)
//   SUPABASE_SERVICE_ROLE_KEY — service role key (NOT the anon key)

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const ROOT = path.join('backup', 'storage');

async function downloadFolder(bucket, prefix) {
  const { data: items, error } = await supabase.storage
    .from(bucket)
    .list(prefix, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
  if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
  if (!items) return;

  for (const item of items) {
    if (item.name === '.emptyFolderPlaceholder') continue;
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;

    // Folders are returned with id === null
    if (item.id === null) {
      await downloadFolder(bucket, fullPath);
      continue;
    }

    const { data, error: dlErr } = await supabase.storage
      .from(bucket)
      .download(fullPath);
    if (dlErr) {
      console.error(`  download failed ${bucket}/${fullPath}: ${dlErr.message}`);
      continue;
    }

    const localPath = path.join(ROOT, bucket, fullPath);
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    const buf = Buffer.from(await data.arrayBuffer());
    fs.writeFileSync(localPath, buf);
    console.log(`  ${bucket}/${fullPath} (${buf.length} bytes)`);
  }
}

async function main() {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw new Error(`listBuckets: ${error.message}`);
  if (!buckets || buckets.length === 0) {
    console.log('No buckets found — skipping storage backup.');
    return;
  }
  fs.mkdirSync(ROOT, { recursive: true });
  console.log(`Found ${buckets.length} bucket(s)`);
  for (const b of buckets) {
    console.log(`→ ${b.name}`);
    await downloadFolder(b.name, '');
  }
  console.log('Storage backup complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
