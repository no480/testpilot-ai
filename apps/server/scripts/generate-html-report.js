#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function formatMs(ms) {
  if (!ms || ms <= 0) return '0 ms';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function toFriendlyStatus(status) {
  if (!status) return 'Not run';
  const s = status.toLowerCase();
  if (s === 'passed' || s === 'pass') return 'Passed';
  if (s === 'failed' || s === 'fail') return 'Failed';
  if (s === 'skipped') return 'Skipped';
  return status;
}

function generateHtml(results, outPath) {
  const rows = Array.isArray(results) ? results : [results];

  const total = rows.length;
  const passed = rows.filter(r => (r.status||'').toLowerCase() === 'passed').length;
  const failed = rows.filter(r => (r.status||'').toLowerCase() === 'failed').length;
  const skipped = rows.filter(r => (r.status||'').toLowerCase() === 'skipped').length;
  const accuracy = total === 0 ? 0 : Math.round((passed / total) * 10000) / 100;

  const tableRows = rows.map(r => {
    const start = r.time?.start ? new Date(r.time.start).toLocaleString() : '';
    const duration = r.time?.duration ?? 0;
    const expected = (r.description && r.description.match(/Expected:\s*([^\n]*)/)) ? RegExp.$1 : (r.description ? r.description.split('\n')[0].replace(/^Expected:\s*/,'') : 'No expected result defined');
    const actual = (r.description && r.description.match(/Actual:\s*([^\n]*)/)) ? RegExp.$1 : (r.description ? (r.description.split('\n')[1]||'No actual result available').replace(/^Actual:\s*/,'') : 'No actual result available');
    const attachments = (r.attachments || []).map(a => a.source);
    return {
      id: r.fullName || r.uuid || r.name,
      name: r.name,
      status: toFriendlyStatus(r.status || (r.labels?.find(l=> l.name==='status')?.value)),
      browser: r.labels?.find(l => l.name === 'browser')?.value || 'Unknown',
      duration,
      durationFriendly: formatMs(duration),
      start,
      expected,
      actual,
      attachments
    };
  });

  const html = `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Execution Report</title>
    <style>
      body{font-family:Inter,Arial,Helvetica,sans-serif;background:#07131f;color:#eaf6ff;padding:24px}
      .card{background:#07202a;border-radius:12px;padding:18px;border:1px solid rgba(125,170,255,0.12)}
      h1{margin:0 0 8px}
      .summary{display:flex;gap:1rem;align-items:center;margin-bottom:12px}
      .badge{padding:8px 12px;border-radius:999px;background:rgba(255,255,255,0.03);font-weight:700}
      table{width:100%;border-collapse:collapse;margin-top:12px}
      th,td{padding:10px;border-bottom:1px solid rgba(255,255,255,0.03);text-align:left}
      th{color:#9fd1ff}
      .status-pass{color:#6ef0b6;font-weight:700}
      .status-fail{color:#ff9aa2;font-weight:700}
      .status-skip{color:#d6d9ff;font-weight:700}
      .small{font-size:0.85rem;color:#cfe9ff}
      .right{margin-left:auto}
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Execution Report</h1>
      <div class="summary">
        <div class="badge">Total: ${total}</div>
        <div class="badge">Passed: ${passed}</div>
        <div class="badge">Failed: ${failed}</div>
        <div class="badge">Skipped: ${skipped}</div>
        <div class="badge right">Accuracy: ${accuracy}%</div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Test</th>
            <th>Title</th>
            <th>Status</th>
            <th>Browser</th>
            <th>Duration</th>
            <th>Start</th>
            <th>Expected</th>
            <th>Actual</th>
            <th>Attachment</th>
          </tr>
        </thead>
        <tbody>
        ${tableRows.map(r => `
          <tr>
            <td class="small">${escapeHtml(r.id)}</td>
            <td>${escapeHtml(r.name)}</td>
            <td class="${r.status==='Passed'?'status-pass':r.status==='Failed'?'status-fail':'status-skip'}">${escapeHtml(r.status)}</td>
            <td>${escapeHtml(r.browser)}</td>
            <td>${escapeHtml(r.durationFriendly)}</td>
            <td class="small">${escapeHtml(r.start)}</td>
            <td>${escapeHtml(r.expected)}</td>
            <td>${escapeHtml(r.actual)}</td>
            <td>${r.attachments.length>0? r.attachments.map(a=> `<a href="${escapeHtml(a)}" target="_blank">${escapeHtml(a)}</a>`).join('<br/>') : '—'}</td>
          </tr>
        `).join('\n')}
        </tbody>
      </table>
    </div>
  </body>
  </html>`;

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html, 'utf8');
  return outPath;
}

function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: generate-html-report.js <results.json> [out.html]');
  process.exit(2);
}

const src = args[0];
const out = args[1] || path.join(path.dirname(src), 'report.html');
const results = readJson(src);
const written = generateHtml(results, out);
console.log('Wrote report:', written);

export { generateHtml };
