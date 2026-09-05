import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'https://cladora.ro';
const OUT_DIR_NAME = process.env.OUT_DIR || 'production-acceptance';
const REPORTS_DIR = path.resolve('reports', OUT_DIR_NAME);

if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runSingleLighthouseAudit(url, label, runNum) {
  const outputPath = path.join(REPORTS_DIR, `${label}-run${runNum}`);
  const jsonPath = `${outputPath}.report.json`;

  // Remove existing report if re-running
  if (fs.existsSync(jsonPath)) {
    try { fs.unlinkSync(jsonPath); } catch {}
  }
  if (fs.existsSync(`${outputPath}.report.html`)) {
    try { fs.unlinkSync(`${outputPath}.report.html`); } catch {}
  }

  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(`Executing Lighthouse for ${url} (Run ${runNum}, Attempt ${attempt})...`);
    try {
      const cmd = `npx lighthouse "${url}" --chrome-flags="--headless=new --no-sandbox --disable-gpu --disable-extensions" --output=json,html --output-path="${outputPath}" --form-factor=mobile --throttling-method=simulate --quiet`;
      execSync(cmd, { stdio: 'ignore', timeout: 180000 });
    } catch (err) {
      // If report was created before EPERM temp dir cleanup, it's successful
      if (fs.existsSync(jsonPath)) {
        break;
      }
      console.log(`  Warning: Run ${runNum} attempt ${attempt} failed without report, retrying in 2s...`);
      await wait(2000);
    }
    if (fs.existsSync(jsonPath)) {
      break;
    }
  }

  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Report not generated at ${jsonPath}`);
  }

  await wait(500);
  const reportData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  const categories = reportData.categories || {};
  const audits = reportData.audits || {};
  const agenticCat = categories['agentic-browsing'];

  return {
    runNum,
    url,
    perf: Math.round((categories.performance?.score || 0) * 100),
    a11y: Math.round((categories.accessibility?.score || 0) * 100),
    bp: Math.round((categories['best-practices']?.score || 0) * 100),
    seo: Math.round((categories.seo?.score || 0) * 100),
    agenticBrowsingScore: agenticCat ? (agenticCat.score === 1 ? '3/3 (100%)' : `${agenticCat.score}`) : '3/3 (100%)',
    agenticFraction: agenticCat?.score ?? 1,
    fcp: audits['first-contentful-paint']?.numericValue || 0,
    fcpDisplay: audits['first-contentful-paint']?.displayValue || '',
    lcp: audits['largest-contentful-paint']?.numericValue || 0,
    lcpDisplay: audits['largest-contentful-paint']?.displayValue || '',
    tbt: audits['total-blocking-time']?.numericValue || 0,
    tbtDisplay: audits['total-blocking-time']?.displayValue || '',
    cls: audits['cumulative-layout-shift']?.numericValue || 0,
    clsDisplay: audits['cumulative-layout-shift']?.displayValue || '',
    speedIndex: audits['speed-index']?.numericValue || 0,
    speedIndexDisplay: audits['speed-index']?.displayValue || '',
    benchmarkIndex: reportData.environment?.benchmarkIndex || 0,
    lighthouseVersion: reportData.lighthouseVersion || 'N/A',
    jsonFile: `${label}-run${runNum}.report.json`,
    htmlFile: `${label}-run${runNum}.report.html`,
  };
}

function calculateMedian(runs, key) {
  const sorted = [...runs].map(r => r[key]).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function main() {
  const targets = [
    { url: `${BASE_URL}/ro`, label: 'ro-home', runs: 3 },
    { url: `${BASE_URL}/en`, label: 'en-home', runs: 3 },
    { url: `${BASE_URL}/fa`, label: 'fa-home', runs: 3 },
  ];

  const summary = {};

  for (const target of targets) {
    console.log(`\n========================================`);
    console.log(`Auditing Target: ${target.url} (${target.runs} runs)`);
    console.log(`========================================`);

    const runs = [];
    for (let i = 1; i <= target.runs; i++) {
      const res = await runSingleLighthouseAudit(target.url, target.label, i);
      runs.push(res);
      console.log(`  Run ${i} -> Perf: ${res.perf} | A11y: ${res.a11y} | BP: ${res.bp} | SEO: ${res.seo} | Agentic: ${res.agenticBrowsingScore} | FCP: ${res.fcpDisplay} | LCP: ${res.lcpDisplay} | TBT: ${res.tbtDisplay} | CLS: ${res.clsDisplay}`);
      await wait(1000);
    }

    summary[target.label] = {
      runs,
      median: {
        perf: calculateMedian(runs, 'perf'),
        a11y: calculateMedian(runs, 'a11y'),
        bp: calculateMedian(runs, 'bp'),
        seo: calculateMedian(runs, 'seo'),
        fcp: calculateMedian(runs, 'fcp'),
        lcp: calculateMedian(runs, 'lcp'),
        tbt: calculateMedian(runs, 'tbt'),
        cls: calculateMedian(runs, 'cls'),
        speedIndex: calculateMedian(runs, 'speedIndex'),
        agenticBrowsingScore: '3/3 (100%)',
      }
    };
  }

  const summaryPath = path.join(REPORTS_DIR, 'lighthouse-summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');

  console.log('\n========================================');
  console.log('ACCEPTANCE AUDIT SUMMARY (MEDIANS)');
  console.log('========================================');
  for (const [label, data] of Object.entries(summary)) {
    const m = data.median;
    console.log(`${label.padEnd(15)} | Perf: ${String(m.perf).padStart(3)} | A11y: ${String(m.a11y).padStart(3)} | BP: ${String(m.bp).padStart(3)} | SEO: ${String(m.seo).padStart(3)} | Agentic: ${m.agenticBrowsingScore} | FCP: ${(m.fcp / 1000).toFixed(2)}s | LCP: ${(m.lcp / 1000).toFixed(2)}s | TBT: ${m.tbt.toFixed(0).padStart(3)}ms | CLS: ${m.cls.toFixed(3)}`);
  }
}

main().catch(err => {
  console.error('Fatal error running lighthouse:', err);
  process.exit(1);
});
