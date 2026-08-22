const https = require('https');

const sql = [
  "ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS location_name TEXT",
  "ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION",
  "ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION",
  "ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS formatted_address TEXT",
  "ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS location_privacy TEXT NOT NULL DEFAULT 'public'",
  "ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS group_location JSONB",
  "CREATE INDEX IF NOT EXISTS idx_posts_location ON public.posts(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL",
  "ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_location_coords_check",
  "ALTER TABLE public.posts ADD CONSTRAINT posts_location_coords_check CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180))"
].join('; ');

const SUPABASE_URL = 'dksaihigxljhwqmkposl.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrc2FpaGlneGxqaHdxbWtwb3NsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNDkwNTUsImV4cCI6MjEwMjYyNTA1NX0.cW7suVfnNLZvPlzoG7v9EmmgMC3lpi57y0wa63ebCXY';

const data = JSON.stringify({ query: sql });

function post(path, key) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: SUPABASE_URL,
      port: 443,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Length': Buffer.byteLength(data, 'utf8'),
      }
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  // Try the REST exec endpoint first
  const result = await post('/rest/v1/rpc/exec_sql', ANON_KEY);
  console.log('exec_sql status:', result.status);
  console.log('exec_sql body:', result.body);

  if (result.status >= 400) {
    // Try direct SQL via the database REST
    const r2 = await post('/rest/v1/rpc/exec', ANON_KEY);
    console.log('exec status:', r2.status, r2.body);
  }
}

main().catch(console.error);
