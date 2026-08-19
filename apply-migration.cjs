const fs = require('fs');
const https = require('https');

const sql = fs.readFileSync('supabase/migrations/20260819000000_barkada_system.sql', 'utf8');

const data = JSON.stringify({ query: sql });

const req = https.request({
  hostname: 'dksaihigxljhwqmkposl.supabase.co',
  port: 443,
  path: '/rest/v1/rpc/exec',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrc2FpaGlneGxqaHdxbWtwb3NsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNDkwNTUsImV4cCI6MjEwMjYyNTA1NX0.cW7suVfnNLZvPlzoG7v9EmmgMC3lpi57y0wa63ebCXY',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrc2FpaGlneGxqaHdxbWtwb3NsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNDkwNTUsImV4cCI6MjEwMjYyNTA1NX0.cW7suVfnNLZvPlzoG7v9EmmgMC3lpi57y0wa63ebCXY',
    'Content-Length': Buffer.byteLength(data)
  }
}, (res) => {
  let responseData = '';
  res.on('data', d => responseData += d);
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Body: ${responseData}`);
  });
});

req.on('error', (e) => {
  console.error(e);
});

req.write(data);
req.end();
