import assert from 'node:assert/strict';
import test from 'node:test';

import { generatePlaywrightSpec } from './generator.js';

test('generatePlaywrightSpec creates executable Playwright test code with case metadata', () => {
  const generated = generatePlaywrightSpec(
    {
      testCaseId: 'TC001',
      title: 'Login with valid credentials',
      description: 'User logs in successfully',
      type: 'Functional',
      priority: 'High',
      preconditions: ['User is on the login page'],
      testData: { username: 'Admin', password: 'admin123' },
      steps: ['Open the login page', 'Enter valid username', 'Enter valid password', 'Click login'],
      expectedResult: 'User is redirected to the dashboard',
      tags: ['login', 'smoke'],
      status: 'Approved',
      sourceRequirement: 'User can login with valid credentials'
    },
    'OrangeHRM Demo'
  );

  assert.match(generated, /test\('TC001 - Login with valid credentials'/);
  assert.match(generated, /sourceTestCaseId/);
  assert.match(generated, /import\s+\{\s*allure\s*\}\s+from\s+'allure-playwright'/);
  assert.match(generated, /getByLabel|getByRole|page\.goto/);
  assert.match(generated, /expect\(/);
  assert.match(generated, /headless:\s*false/);
  assert.match(generated, /screenshot:\s*'only-on-failure'/);
  assert.match(generated, /outputPath\(|attach\('failure-screenshot'/);
});
