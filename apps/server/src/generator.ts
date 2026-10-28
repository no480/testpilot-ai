import type { TestCase } from './planner.js';

export function generatePlaywrightSpec(testCase: TestCase, projectName: string): string {
  const safeProjectName = projectName.replace(/['"\\]/g, '');
  const credentialData = {
    username: testCase.testData?.username ?? 'Admin',
    password: testCase.testData?.password ?? 'admin123'
  };

  const testTitle = `${testCase.testCaseId} - ${testCase.title}`;
  const locatorExample = [
    "  const usernameField = page.locator('input[name=\"username\"], input[name=\"txtUsername\"], input[placeholder*=\"Username\" i], input[type=\"text\"]').first();",
    "  const passwordField = page.locator('input[name=\"password\"], input[placeholder*=\"Password\" i], input[type=\"password\"]').first();",
    "  const submitButton = page.locator('button:has-text(\"Login\"), button:has-text(\"Sign in\"), button[type=\"submit\"], input[type=\"submit\"]').first();"
  ].join('\n');

  const escapedTitle = testTitle.replace(/'/g, "\\'");
  const priority = testCase.priority === 'High' ? 'critical' : testCase.priority === 'Medium' ? 'normal' : 'minor';

  return `import { test, expect } from '@playwright/test';

const projectName = ${JSON.stringify(safeProjectName)};
const testData = ${JSON.stringify(credentialData)};
const baseUrl = process.env.BASE_URL ?? 'https://opensource-demo.orangehrmlive.com/web/index.php/auth/login';

test.use({
  headless: process.env.PLAYWRIGHT_HEADLESS !== false,
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
  trace: 'retain-on-failure'
});

test('${escapedTitle}', async ({ page }, testInfo) => {
  test.info().annotations.push({
    type: 'sourceTestCaseId',
    description: '${testCase.testCaseId}'
  });

  const captureFailureScreenshot = async (label: string) => {
    const screenshotPath = testInfo.outputPath(label + '.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await testInfo.attach(label, { path: screenshotPath, contentType: 'image/png' });
  };

  try {
    // Open application
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    // Validate page is loaded
    await expect(page).toHaveURL(/.+/);

${locatorExample}

    // Fill in login credentials
    await usernameField.fill(testData.username);
    await passwordField.fill(testData.password);

    // Submit the login form
    await submitButton.click();

    // Verify dashboard is visible
    const successIndicator = page.locator('body').locator('h1, h2, h6, span').filter({ hasText: /dashboard|welcome|home|profile/i }).first();
    await expect(successIndicator).toBeVisible({ timeout: 15000 });

    // Source requirement: ${testCase.sourceRequirement}
    // Scenario: ${testCase.description}
    // Expected result: ${testCase.expectedResult}
  } catch (error) {
    await captureFailureScreenshot('failure-screenshot');
    throw error;
  }
});
`;
}

