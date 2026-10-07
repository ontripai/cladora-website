const routes = [
  '',
  'platform',
  'airprop',
  'service',
  'operations',
  'lifecycle',
  'solutions',
  'contact',
  'login',
  'pilot'
];
const languages = ['ro', 'en', 'fa'];

async function testRoute(lang, route) {
  const path = route === '' ? `/${lang}` : `/${lang}/${route}`;
  const url = `http://localhost:3000${path}`;
  try {
    const res = await fetch(url, { redirect: 'manual' });
    return {
      Language: lang,
      Route: path,
      Status: res.status,
      Location: res.headers.get('location') || '-'
    };
  } catch (err) {
    return {
      Language: lang,
      Route: path,
      Status: 'ERR',
      Location: err.message
    };
  }
}

async function run() {
  console.log('=== CLADORA PREVIEW ROUTE VERIFICATION MATRIX ===\n');
  const results = [];
  for (const route of routes) {
    for (const lang of languages) {
      const res = await testRoute(lang, route);
      results.push(res);
    }
  }
  console.table(results);
}

run();
