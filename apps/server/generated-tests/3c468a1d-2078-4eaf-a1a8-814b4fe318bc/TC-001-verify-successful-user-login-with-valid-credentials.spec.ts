import { test, expect } from '@playwright/test';

const projectName = "NEW";
const testData = {"username":"Admin","password":"admin123"};
const baseUrl = process.env.BASE_URL ?? 'https://opensource-demo.orangehrmlive.com/web/index.php/auth/login';

test.use({
  headless: false,
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
  trace: 'retain-on-failure'
});

test('TC-001 - Verify successful user login with valid credentials', async ({ page }, testInfo) => {
  test.info().annotations.push({
    type: 'sourceTestCaseId',
    description: 'TC-001'
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

  const usernameField = page.locator('input[name="username"], input[name="txtUsername"], input[placeholder*="Username" i], input[type="text"]').first();
  const passwordField = page.locator('input[name="password"], input[placeholder*="Password" i], input[type="password"]').first();
  const submitButton = page.locator('button:has-text("Login"), button:has-text("Sign in"), button[type="submit"], input[type="submit"]').first();

    // Fill in login credentials
    await usernameField.fill(testData.username);
    await passwordField.fill(testData.password);

    // Submit the login form
    await submitButton.click();

    // Verify dashboard is visible
    const successIndicator = page.locator('body').locator('h1, h2, h6, span').filter({ hasText: /dashboard|welcome|home|profile/i }).first();
    await expect(successIndicator).toBeVisible({ timeout: 15000 });

    // Source requirement: User can complete the primary workflow
    // Scenario: Ensure that a user can log into the OrangeHRM portal using valid username and password.
    // Expected result: User is redirected to the dashboard page.
  } catch (error) {
    await captureFailureScreenshot('failure-screenshot');
    throw error;
  }
});
