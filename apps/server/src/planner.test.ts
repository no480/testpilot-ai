import assert from 'node:assert/strict';
import test from 'node:test';

import { generatePlannerTestCases } from './planner.js';

test('generatePlannerTestCases creates structured test cases from requirements', () => {
  const cases = generatePlannerTestCases({
    name: 'OrangeHRM Demo',
    description: 'A demo login app',
    requirements: [
      'User can login with valid credentials',
      'Invalid credentials show an error message',
      'Password field is required'
    ]
  });

  assert.ok(cases.length >= 3, 'expected at least three generated scenarios');
  assert.ok(cases.every((item) => item.testCaseId.startsWith('TC')));
  assert.ok(cases.every((item) => item.steps.length > 0));
  assert.ok(cases.every((item) => item.expectedResult.length > 0));
  assert.ok(cases.every((item) => ['High', 'Medium', 'Low'].includes(item.priority)));
});

test('generatePlannerTestCases explores page content from applicationUrl and expands the case set', async () => {
  const html = `
    <html>
      <body>
        <h1>Acme Portal</h1>
        <button>Login</button>
        <button>Sign up</button>
        <label>Search</label>
        <input placeholder="Search for reports" />
        <a href="/reports">Reports</a>
        <a href="/settings">Settings</a>
      </body>
    </html>
  `;

  const cases = generatePlannerTestCases({
    name: 'Acme Portal',
    description: 'User portal',
    applicationUrl: 'https://example.com',
    requirements: [],
    discoveredPageContent: html
  });

  assert.ok(cases.length >= 5, 'expected URL exploration to generate multiple test cases');
  assert.ok(cases.some((item) => /login|sign up|signup/i.test(item.title)));
  assert.ok(cases.some((item) => /search|reports|settings/i.test(item.title)));
});
