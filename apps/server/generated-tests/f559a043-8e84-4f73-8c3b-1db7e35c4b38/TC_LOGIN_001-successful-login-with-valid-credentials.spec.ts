import { test, expect } from '@playwright/test';

const projectName = "HRM num";
const testData = {"username":"Admin","password":"admin123"};

test('TC_LOGIN_001 - Successful Login with Valid Credentials', async ({ page }) => {
  test.info().annotations.push({
    type: 'sourceTestCaseId',
    description: 'TC_LOGIN_001'
  });

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
  // Scenario: Verify that the user can successfully log into the OrangeHRM application using valid administrator credentials.
  // Expected result: User is successfully authenticated and redirected to the OrangeHRM dashboard page.
});
