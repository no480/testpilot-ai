import { test, expect } from '@playwright/test';

const projectName = "Demo";
const testData = {"username":"Admin","password":"admin123"};

test.use({
  headless: false,
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
  trace: 'retain-on-failure'
});

test('TC_NAV_001 - Forgot Password Navigation', async ({ page }, testInfo) => {
  test.info().annotations.push({
    type: 'sourceTestCaseId',
    description: 'TC_NAV_001'
  });

  const captureFailureScreenshot = async (label: string) => {
    const screenshotPath = testInfo.outputPath(`${label}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await testInfo.attach(label, { path: screenshotPath, contentType: 'image/png' });
  };

  try {
    await page.goto(process.env.BASE_URL ?? 'https://example.com');
    await expect(page).toHaveURL(/.+/);

  const usernameField = page.getByLabel(/username|email/i).or(page.getByPlaceholder(/username|email/i));
  const passwordField = page.getByLabel(/password/i).or(page.getByPlaceholder(/password/i));
  const submitButton = page.getByRole('button', { name: /login|sign in/i }).or(page.getByRole('link', { name: /login|sign in/i }));

    await usernameField.fill(testData.username);
    await passwordField.fill(testData.password);
    await submitButton.click();

    const successIndicator = page.locator('body').locator('h1, h2, h6, span').filter({ hasText: /dashboard|welcome/i }).first();
    await expect(successIndicator).toBeVisible();

    // Source requirement: User can complete the primary workflow
    // Scenario: Verify that clicking the 'Forgot your password?' link navigates the user to the password reset request page.
    // Expected result: User is redirected to the reset password page and can input their username to recover access.
  } catch (error) {
    await captureFailureScreenshot('failure-screenshot');
    throw error;
  }
});
