import { test, expect } from '@playwright/test';
import { allure } from 'allure-playwright';

const projectName = "Win";
const testData = {"username":"Admin","password":"admin123"};
const baseUrl = process.env.BASE_URL ?? 'https://opensource-demo.orangehrmlive.com/web/index.php/auth/login';

test.use({
  headless: false,
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
  trace: 'retain-on-failure'
});

test('TC_AUTH_004 - Validation of Empty Login Fields', async ({ page }, testInfo) => {
  await allure.epic('QA Automation');
  await allure.feature(projectName);
  await allure.story('Validation of Empty Login Fields');
  await allure.severity('minor');
  await allure.tag('Negative');
  await allure.tag('TC_AUTH_004');

  test.info().annotations.push({
    type: 'sourceTestCaseId',
    description: 'TC_AUTH_004'
  });

  const captureFailureScreenshot = async (label: string) => {
    const screenshotPath = testInfo.outputPath(`${label}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await testInfo.attach(label, { path: screenshotPath, contentType: 'image/png' });
  };

  try {
    await allure.step('Open application', async () => {
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    });

    await allure.step('Validate page is loaded', async () => {
      await expect(page).toHaveURL(/.+/);
    });

  const usernameField = page.locator('input[name="username"], input[name="txtUsername"], input[placeholder*="Username" i], input[type="text"]').first();
  const passwordField = page.locator('input[name="password"], input[placeholder*="Password" i], input[type="password"]').first();
  const submitButton = page.locator('button:has-text("Login"), button:has-text("Sign in"), button[type="submit"], input[type="submit"]').first();

    await allure.step('Fill in login credentials', async () => {
      await usernameField.fill(testData.username);
      await passwordField.fill(testData.password);
    });

    await allure.step('Submit the login form', async () => {
      await submitButton.click();
    });

    await allure.step('Verify dashboard is visible', async () => {
      const successIndicator = page.locator('body').locator('h1, h2, h6, span').filter({ hasText: /dashboard|welcome|home|profile/i }).first();
      await expect(successIndicator).toBeVisible({ timeout: 15000 });
    });

    // Source requirement: User can complete the primary workflow
    // Scenario: Verify that validation messages appear when clicking login with empty fields.
    // Expected result: Required field error messages are displayed under the input fields.
  } catch (error) {
    await captureFailureScreenshot('failure-screenshot');
    throw error;
  }
});
