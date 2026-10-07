import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { generateProjectReport } from './report.js';

test('generateProjectReport creates summary rows and HTML report content', async () => {
  const report = generateProjectReport({
    id: 'project-1',
    name: 'OrangeHRM Demo',
    applicationUrl: 'https://example.com',
    browser: 'Chromium',
    testCases: [
      {
        testCaseId: 'TC001',
        title: 'Login with valid credentials',
        description: 'User logs in successfully',
        type: 'Functional',
        priority: 'High',
        preconditions: ['User is on the login page'],
        testData: { username: 'Admin', password: 'admin123' },
        steps: ['Open page', 'Login'],
        expectedResult: 'Dashboard loads',
        tags: ['login'],
        status: 'Approved',
        sourceRequirement: 'Allow valid login'
      }
    ],
    lastExecution: {
      success: false,
      exitCode: 1,
      output: 'locator.click: Timeout 10000ms exceeded',
      generatedAt: new Date().toISOString()
    },
    generatedFiles: [],
    healingHistory: []
  }, 'c:/AI Test/apps/server');

  assert.equal(report.summary.total, 1);
  assert.equal(report.rows[0].status, 'Failed');
  assert.match(report.html, /OrangeHRM Demo/);
  assert.match(report.html, /TC001/);
  assert.ok(report.filePath.replace(/\\/g, '/').endsWith('playwright-report/index.html'));

  const summaryPath = 'c:/AI Test/apps/server/generated-tests/project-1/execution-summary.txt';
  assert.ok(summaryPath.includes('execution-summary.txt'));
  assert.match(fs.readFileSync(summaryPath, 'utf8'), /TC001/);

  const artifactDir = path.join('c:/AI Test/apps/server/generated-tests/project-1/test-results', 'artifact-check');
  fs.mkdirSync(artifactDir, { recursive: true });
  const screenshotPath = path.join(artifactDir, 'test-failed-1.png');
  fs.writeFileSync(screenshotPath, 'fake-png-content');

  const artifactReport = generateProjectReport({
    id: 'project-1',
    name: 'OrangeHRM Demo',
    applicationUrl: 'https://example.com',
    browser: 'Chromium',
    testCases: [{
      testCaseId: 'TC001',
      title: 'Login with valid credentials',
      status: 'Approved'
    }],
    lastExecution: {
      success: false,
      exitCode: 1,
      output: 'locator.click: Timeout 10000ms exceeded',
      generatedAt: new Date().toISOString()
    },
    generatedFiles: [],
    healingHistory: []
  }, 'c:/AI Test/apps/server');

  assert.match(artifactReport.rows[0].screenshot ?? '', /\/api\/projects\/project-1\/artifacts\//);
});

test('generateProjectReport reflects only the latest executed test cases in the report', () => {
  const executedAt = new Date().toISOString();
  const report = generateProjectReport({
    id: 'project-2',
    name: 'Partial run report',
    applicationUrl: 'https://example.com',
    browser: 'Chromium',
    testCases: [
      { testCaseId: 'TC001', title: 'Login', status: 'Approved' },
      { testCaseId: 'TC002', title: 'Reset Password', status: 'Approved' },
      { testCaseId: 'TC003', title: 'View Dashboard', status: 'Approved' },
      { testCaseId: 'TC004', title: 'Logout', status: 'Approved' },
      { testCaseId: 'TC005', title: 'Create user', status: 'Approved' }
    ],
    lastExecution: {
      success: false,
      exitCode: 1,
      output: 'Two testcases failed during the latest run.',
      generatedAt: executedAt,
      cases: [
        { id: 'TC001', title: 'Login', status: 'passed', output: 'Passed', executedAt },
        { id: 'TC002', title: 'Reset Password', status: 'failed', output: 'Failed on empty reset link', executedAt },
        { id: 'TC003', title: 'View Dashboard', status: 'passed', output: 'Passed', executedAt }
      ]
    } as any,
    generatedFiles: [],
    healingHistory: []
  }, 'c:/AI Test/apps/server');

  assert.equal(report.summary.total, 5);
  assert.equal(report.summary.passed, 2);
  assert.equal(report.summary.failed, 1);
  assert.equal(report.summary.skipped, 2);
  assert.equal(report.rows[0].status, 'Passed');
  assert.equal(report.rows[1].status, 'Failed');
  assert.equal(report.rows[2].status, 'Passed');
  assert.equal(report.rows[3].status, 'Not run');
  assert.equal(report.rows[4].status, 'Not run');
});
