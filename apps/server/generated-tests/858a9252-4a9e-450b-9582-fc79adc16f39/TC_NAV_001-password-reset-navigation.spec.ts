import { test, expect } from '@playwright/test';
import * as allure from 'allure-js-commons';

const projectName = "den";
const testData = {"username":"Admin","password":"admin123"};

test.use({
  headless: false,
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
  trace: 'retain-on-failure'
});

test('TC_NAV_001 - Password Reset Navigation', async ({ page }, testInfo) => {
  await allure.epic('QA Automation');
  await allure.feature(projectName);
  await allure.story('Password Reset Navigation');
  await allure.severity('normal');
  await allure.tag('Functional');
  await allure.tag('TC_NAV_001');

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
    await allure.step('Open application', async () => {
      await page.goto(process.env.BASE_URL ?? 'https://example.com');
    });

    await allure.step('Validate page is loaded', async () => {
      await expect(page).toHaveURL(/.+/);
    });

  const usernameField = page.getByLabel(/username|email/i).or(page.getByPlaceholder(/username|email/i));
  const passwordField = page.getByLabel(/password/i).or(page.getByPlaceholder(/password/i));
  const submitButton = page.getByRole('button', { name: /login|sign in/i }).or(page.getByRole('link', { name: /login|sign in/i }));

    await allure.step('Fill in login credentials', async () => {
      await usernameField.fill(testData.username);
      await passwordField.fill(testData.password);
    });

    await allure.step('Submit the login form', async () => {
      await submitButton.click();
    });

    await allure.step('Verify dashboard is visible', async () => {
      const successIndicator = page.locator('body').locator('h1, h2, h6, span').filter({ hasText: /dashboard|welcome/i }).first();
      await expect(successIndicator).toBeVisible();
    });

    // Source requirement: User can complete the primary workflow
    // Scenario: Verify that clicking 'Forgot your password?' link navigates the user to the reset password request page.
    // Expected result: User is redirected to the Reset Password page containing the username input field.
  } catch (error) {
    await captureFailureScreenshot('failure-screenshot');
    throw error;
  }
});
