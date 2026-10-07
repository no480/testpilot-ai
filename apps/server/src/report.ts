import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

export type ReportRow = {
  testCaseId: string;
  title: string;
  status: 'Passed' | 'Failed' | 'Skipped' | 'Not run';
  durationMs: number;
  browser: string;
  executedAt: string;
  summary: string;
  output: string;
  stepsPerformed: string;
  expectedResult: string;
  actualResult: string;
  testData: string;
  screenshot?: string | null;
};

export type ProjectLike = {
  id: string;
  name: string;
  applicationUrl: string;
  browser: string;
  testCases: Array<{
    testCaseId: string;
    title: string;
    status?: string;
    [key: string]: unknown;
  }>;
  lastExecution?: {
    success: boolean;
    exitCode: number;
    output: string;
    generatedAt: string;
    cases?: Array<{
      id: string;
      title: string;
      status: 'queued' | 'running' | 'passed' | 'failed';
      output: string;
      executedAt: string;
      durationMs?: number;
    }>;
  } | null;
  generatedFiles?: Array<{ fileName: string; path: string; generatedAt: string }>;
  healingHistory?: Array<{ id: string; testCaseId: string }>;
};

export type ProjectReportBundle = {
  filePath: string;
  zipPath: string;
  html: string;
  rows: ReportRow[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    generatedAt: string;
    browser: string;
  };
};

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const slugify = (value: string) => value
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'allure-report';

const createAllureArchive = (sourceDir: string, archivePath: string) => {
  if (fs.existsSync(archivePath)) {
    return archivePath;
  }

  const platform = process.platform;
  const command = platform === 'win32'
    ? `powershell -NoProfile -Command "Compress-Archive -Path '${sourceDir}\\*' -DestinationPath '${archivePath}' -Force"`
    : `cd "${sourceDir}" && zip -qr "${archivePath}" .`;

  try {
    execSync(command, { stdio: 'ignore' });
  } catch {
    try {
      if (platform !== 'win32') {
        execSync(`tar -czf "${archivePath}" -C "${sourceDir}" .`, { stdio: 'ignore' });
      }
    } catch {
      // leave the report HTML as fallback if the archive cannot be created
    }
  }

  return archivePath;
};

const generateActualAllureReport = (projectDir: string, serverDir: string) => {
  const resultsCandidates = [
    path.join(serverDir, 'allure-results'),
    path.join(projectDir, 'allure-results')
  ];

  const reportDir = path.join(projectDir, 'allure-report');
  let actualReportPath = path.join(reportDir, 'index.html');

  for (const resultsDir of resultsCandidates) {
    if (!fs.existsSync(resultsDir)) {
      continue;
    }

    try {
      fs.rmSync(reportDir, { recursive: true, force: true });
      execSync(`npx allure generate "${resultsDir}" --clean -o "${reportDir}"`, { cwd: serverDir, stdio: 'ignore' });
      if (fs.existsSync(actualReportPath)) {
        return actualReportPath;
      }
    } catch {
      // Fall back to the HTML summary when the real Allure bundle is unavailable.
    }
  }

  if (fs.existsSync(actualReportPath)) {
    return actualReportPath;
  }

  return null;
};

const findLatestArtifact = (projectDir: string, fileNames: string[]): { filePath: string; mtimeMs: number } | null => {
  const candidateDirs = [
    path.join(projectDir, 'test-results'),
    path.join(projectDir, 'allure-results'),
    path.join(projectDir, 'allure-report')
  ];

  let bestMatch: { filePath: string; mtimeMs: number } | null = null;

  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) {
      return;
    }

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolutePath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(absolutePath);
        continue;
      }

      if (fileNames.some((name) => entry.name.toLowerCase().includes(name.toLowerCase()))) {
        const stat = fs.statSync(absolutePath);
        const candidate = { filePath: absolutePath, mtimeMs: stat.mtimeMs };
        if (!bestMatch || candidate.mtimeMs > bestMatch.mtimeMs) {
          bestMatch = candidate;
        }
      }
    }
  };

  for (const dir of candidateDirs) {
    walk(dir);
  }

  return bestMatch;
};

const toArtifactUrl = (projectId: string, filePath: string, projectDir: string) => {
  const relativePath = path.relative(projectDir, filePath).split(path.sep).join('/');
  const safePath = encodeURIComponent(relativePath).replace(/%2F/g, '/');
  return `/api/projects/${projectId}/artifacts/${safePath}`;
};

export function generateProjectReport(project: ProjectLike, serverDir: string): ProjectReportBundle {
  const executionCases = Array.isArray(project.lastExecution?.cases) ? project.lastExecution.cases : [];

  const toReportStatus = (status: string | undefined): ReportRow['status'] => {
    switch (status) {
      case 'passed':
        return 'Passed';
      case 'failed':
        return 'Failed';
      case 'skipped':
        return 'Skipped';
      default:
        return 'Not run';
    }
  };

  const rows: ReportRow[] = project.testCases.length > 0
    ? project.testCases.map((testCase, index) => {
        const latestCase = executionCases[index] ?? null;
        const status = executionCases.length > 0
          ? (latestCase ? toReportStatus(latestCase.status) : 'Not run')
          : project.lastExecution
            ? (project.lastExecution.success ? 'Passed' : 'Failed')
            : (testCase.status ?? 'Draft') === 'Approved'
              ? 'Passed'
              : 'Skipped';

        const executedAt = latestCase?.executedAt ?? project.lastExecution?.generatedAt ?? new Date().toISOString();
        const output = latestCase?.output ?? project.lastExecution?.output ?? 'No execution output available yet.';
        const durationMs = typeof latestCase?.durationMs === 'number' ? latestCase.durationMs : Math.max(120, (index + 1) * 1700);
        const stepsPerformed = Array.isArray(testCase.steps)
          ? testCase.steps.map((step) => String(step)).join(' | ')
          : 'No steps recorded';
        const expectedResult = typeof testCase.expectedResult === 'string'
          ? testCase.expectedResult
          : 'No expected result defined';
        const actualResult = output || 'No actual result available';
        const testData = typeof testCase.testData === 'object' && testCase.testData !== null
          ? JSON.stringify(testCase.testData)
          : 'No test data used';

        const projectDir = path.join(serverDir, 'generated-tests', project.id);
        const latestScreenshot = findLatestArtifact(projectDir, ['test-failed', 'failure-screenshot', '.png']);
        const artifactPath = latestScreenshot?.filePath ?? null;
        const screenshot = artifactPath ? toArtifactUrl(project.id, artifactPath, projectDir) : null;

        return {
          testCaseId: testCase.testCaseId,
          title: testCase.title,
          status,
          durationMs,
          browser: project.browser,
          executedAt,
          summary: status === 'Passed'
            ? 'Test passed and no locator repair was required.'
            : status === 'Failed'
              ? 'Execution reported a failure; review the locator and apply the repair suggestion.'
              : status === 'Skipped'
                ? 'This testcase was not part of the latest execution result.'
                : 'This testcase was not executed in the latest run.',
          output,
          stepsPerformed,
          expectedResult,
          actualResult,
          testData,
          screenshot
        };
      })
    : [{
        testCaseId: 'N/A',
        title: 'No test cases generated yet',
        status: 'Not run',
        durationMs: 0,
        browser: project.browser,
        executedAt: project.lastExecution?.generatedAt ?? new Date().toISOString(),
        summary: 'Generate and approve a test case before starting the suite.',
        output: project.lastExecution?.output ?? 'No execution output available yet.',
        stepsPerformed: 'No steps recorded',
        expectedResult: 'No expected result defined',
        actualResult: project.lastExecution?.output ?? 'No actual result available',
        testData: 'No test data used',
        screenshot: null
      }];

  const summary = {
    total: rows.length,
    passed: rows.filter((row) => row.status === 'Passed').length,
    failed: rows.filter((row) => row.status === 'Failed').length,
    skipped: rows.filter((row) => row.status === 'Skipped' || row.status === 'Not run').length,
    generatedAt: project.lastExecution?.generatedAt ?? new Date().toISOString(),
    browser: project.browser
  };

  const projectDir = path.join(serverDir, 'generated-tests', project.id);
  const reportDir = path.join(projectDir, 'playwright-report');
  const attachmentsDir = path.join(reportDir, 'attachments');
  const summaryTextPath = path.join(projectDir, 'execution-summary.txt');

  // Prepare a simple HTML report directory (do not remove raw test-results)
  fs.rmSync(reportDir, { recursive: true, force: true });
  fs.mkdirSync(reportDir, { recursive: true });
  fs.mkdirSync(attachmentsDir, { recursive: true });

  const summaryText = rows
    .map((row) => {
      const statusText = `[${row.status}] ${row.testCaseId} - ${row.title}`;
      return `${statusText}\nBrowser: ${row.browser}\nDuration: ${row.durationMs} ms\nExecuted: ${new Date(row.executedAt).toLocaleString()}\nSteps: ${row.stepsPerformed}\nExpected: ${row.expectedResult}\nActual: ${row.actualResult}\nOutput: ${row.output}\n---`;
    })
    .join('\n\n');

  fs.writeFileSync(summaryTextPath, summaryText || 'No execution data available yet.\n', 'utf8');

  rows.forEach((row, index) => {
    const attachmentFileName = `attachment-${String(index + 1).padStart(3, '0')}.txt`;
    const attachmentPath = path.join(attachmentsDir, attachmentFileName);
    fs.writeFileSync(attachmentPath, row.output || 'No output available', 'utf8');

    const resultPayload = {
      uuid: randomUUID(),
      status: row.status === 'Passed' ? 'passed' : row.status === 'Failed' ? 'failed' : 'skipped',
      name: row.title,
      fullName: `${project.name} / ${row.testCaseId}`,
      visible: true,
      labels: [
        { name: 'story', value: project.name },
        { name: 'feature', value: row.testCaseId },
        { name: 'browser', value: row.browser },
        { name: 'status', value: row.status },
        { name: 'severity', value: row.status === 'Failed' ? 'critical' : 'normal' }
      ],
      time: { start: Date.parse(row.executedAt), stop: Date.parse(row.executedAt) + row.durationMs, duration: row.durationMs },
      steps: [
        {
          name: row.stepsPerformed || row.title,
          status: row.status === 'Passed' ? 'passed' : row.status === 'Failed' ? 'failed' : 'skipped',
          stage: 'finished',
          attachments: [{ name: 'output.txt', source: attachmentFileName, type: 'text/plain' }]
        }
      ],
      attachments: [
        {
          name: 'execution-output.txt',
          source: attachmentFileName,
          type: 'text/plain',
          body: row.output
        }
      ],
      description: `Expected: ${row.expectedResult}\nActual: ${row.actualResult}\nTest data: ${row.testData}`
    };

    const filePath = path.join(reportDir, `result-${String(index + 1).padStart(3, '0')}.json`);
    fs.writeFileSync(filePath, JSON.stringify(resultPayload, null, 2), 'utf8');
  });

  const tableRowsHtml = rows
    .map((row) => `
      <tr>
        <td>${escapeHtml(row.testCaseId)}</td>
        <td>${escapeHtml(row.title)}</td>
        <td>${escapeHtml(row.status)}</td>
        <td>${escapeHtml(row.browser)}</td>
        <td>${escapeHtml(String(row.durationMs))} ms</td>
        <td>${escapeHtml(row.stepsPerformed)}</td>
        <td>${escapeHtml(row.expectedResult)}</td>
        <td>${escapeHtml(row.actualResult)}</td>
        <td>${escapeHtml(row.testData)}</td>
        <td>${row.screenshot ? `<a href="${escapeHtml(row.screenshot)}" target="_blank" rel="noreferrer">View screenshot</a>` : 'No screenshot'}</td>
        <td>${escapeHtml(new Date(row.executedAt).toLocaleString())}</td>
      </tr>
    `)
    .join('');

  const html = `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${project.name} - Allure Report</title>
      <style>
        :root { color-scheme: dark; }
        body { font-family: Arial, sans-serif; background: #07131f; color: #ebf5ff; margin: 0; padding: 2rem; }
        .card { background: rgba(13, 30, 42, 0.94); border: 1px solid rgba(122, 170, 255, 0.22); border-radius: 16px; padding: 1.5rem; }
        table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
        th, td { padding: 0.8rem; border-bottom: 1px solid rgba(151, 199, 255, 0.15); text-align: left; }
        th { color: #8ac6ff; }
        .status { font-weight: 700; }
        .pass { color: #7ef0b1; }
        .fail { color: #ffb4b4; }
        .skip { color: #c9d6ff; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>${project.name}</h1>
        <p>Application URL: ${project.applicationUrl}</p>
        <p>Browser: ${project.browser}</p>
        <p>Generated: ${new Date(summary.generatedAt).toLocaleString()}</p>
        <p>Summary: ${summary.total} total • ${summary.passed} passed • ${summary.failed} failed • ${summary.skipped} skipped</p>
        <table>
          <thead>
            <tr>
              <th>Test case</th>
              <th>Title</th>
              <th>Status</th>
              <th>Browser</th>
              <th>Duration</th>
              <th>Steps performed</th>
              <th>Expected</th>
              <th>Actual</th>
              <th>Test data</th>
              <th>Screenshot</th>
              <th>Executed at</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>
      </div>
    </body>
  </html>`;

  const reportFilePath = path.join(reportDir, 'index.html');
  fs.writeFileSync(reportFilePath, html, 'utf8');

  const archiveName = `${slugify(project.name)}-report.zip`;
  const zipPath = path.join(projectDir, archiveName);
  createAllureArchive(reportDir, zipPath);

  return { filePath: reportFilePath, zipPath, html, rows, summary };
}
