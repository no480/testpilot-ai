import { test, expect } from '@playwright/test';
import * as allure from 'allure-js-commons';

const projectName = "Demo";
const testData = {"username":"Admin","password":"admin123"};

test.use({
  headless: false,
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
  trace: 'retain-on-failure'
});

test('TC_LOGIN_001 - Successful Login with Valid Credentials', async ({ page }, testInfo) => {
  await allure.epic('QA Automation');
  await allure.feature(projectName);
  await allure.story('Successful Login with Valid Credentials');
  await allure.severity('critical');
  await allure.tag('Functional');
  await allure.tag('TC_LOGIN_001');

  test.info().annotations.push({
    type: 'sourceTestCaseId',
    description: 'TC_LOGIN_001'
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
    // Scenario: Verify that a user can successfully log in using valid username and password credentials on the OrangeHRM login page.
    // Expected result: The user is successfully authenticated and redirected to the OrangeHRM dashboard page.
  } catch (error) {
    await captureFailureScreenshot('failure-screenshot');
    throw error;
  }
});
