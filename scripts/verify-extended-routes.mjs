import http from 'node:http';

const locales = ['ro', 'en', 'fa'];
const paths = [
  // Solutions & subpages
  '/solutions',
  '/solutions/property-owners',
  '/solutions/property-managers',
  '/solutions/associations',
  '/solutions/residents',
  '/solutions/tenants',
  // Dedicated modules & system domains
  '/modules',
  '/platform',
  '/airprop',
  '/service',
  '/operations',
  '/lifecycle',
  // Trust, security, legal
  '/trust',
  '/security',
  '/privacy',
  '/terms',
  '/cookies',
  // FAQ
  '/resources/faq',
  // Contact
  '/contact'
];

async function checkRoute(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      resolve({ status: res.statusCode, location: res.headers.location || null });
    });
    req.on('error', (err) => {
      resolve({ status: 'ERR', error: err.message });
    });
    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ status: 'TIMEOUT' });
    });
  });
}

async function run() {
  console.log('=== CLADORA V1.1 EXTENDED ROUTE VERIFICATION MATRIX ===\n');
  const results = [];
  let allPass = true;

  for (const locale of locales) {
    console.log(`Checking Locale: [${locale.toUpperCase()}]`);
    for (const p of paths) {
      const fullPath = `/${locale}${p}`;
      const url = `http://localhost:3000${fullPath}`;
      const res = await checkRoute(url);
      const isOk = res.status === 200 || (res.status >= 300 && res.status < 400);
      if (!isOk) allPass = false;
      console.log(`  ${fullPath.padEnd(35)} -> Status: ${res.status}${res.location ? ` (Redirect to: ${res.location})` : ''}`);
      results.push({ locale, path: p, fullPath, status: res.status, location: res.location });
    }
  }

  // Also check top-level alias /faq if any
  for (const locale of locales) {
    const fullPath = `/${locale}/faq`;
    const res = await checkRoute(`http://localhost:3000${fullPath}`);
    console.log(`  ${fullPath.padEnd(35)} -> Status: ${res.status}${res.location ? ` (Redirect to: ${res.location})` : ''}`);
  }

  console.log(`\nAll expected routes healthy: ${allPass ? 'YES (PASS)' : 'NO (FAIL)'}`);
  if (!allPass) process.exit(1);
}

run();
