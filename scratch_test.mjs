const secretKey = 'sk_test_s7z3idUSCMwlRljrew6DkQXGU7boRoLT63JQmKGw5j';

async function run() {
  console.log('--- 1. TESTING USER DISCOVERY DIRECTORY ---');
  const res = await fetch('https://api.clerk.com/v1/users?limit=100', {
    headers: { Authorization: `Bearer ${secretKey}` }
  });
  const data = await res.json();
  console.log(`Fetched ${data.length} total users in Clerk database.`);

  const testQueries = ['coralxian', '@coralxian', 'Coral', 'coral', 'Xian', 'Nelson', 'xeancoral'];
  for (const q of testQueries) {
    const clean = q.replace(/[@]/g, '').trim().toLowerCase();
    const matches = data.filter(u => {
      const uName = (u.username || '').toLowerCase();
      const first = (u.first_name || '').toLowerCase();
      const last = (u.last_name || '').toLowerCase();
      const full = `${first} ${last}`.toLowerCase();
      return uName.includes(clean) || first.includes(clean) || last.includes(clean) || full.includes(clean);
    });
    console.log(`Search: "${q}" => Matched: ${matches.map(m => `@${m.username} (${m.first_name} ${m.last_name})`).join(', ')}`);
  }

  console.log('\n--- 2. VERIFYING DEV SERVER RESPONSIVENESS ---');
  const devRes = await fetch('http://localhost:5173/');
  console.log('Dev server status:', devRes.status);

  console.log('\n--- ALL VERIFICATIONS COMPLETE ---');
}

run().catch(console.error);
