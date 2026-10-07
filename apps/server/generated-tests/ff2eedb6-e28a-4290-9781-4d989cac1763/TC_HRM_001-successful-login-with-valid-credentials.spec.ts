import { test, expect } from '@playwright/test';

const projectName = "Tst HRM 2";
const testData = {"username":"Admin","password":"admin123"};

test('TC_HRM_001 - Successful Login with Valid Credentials', async ({ page }) => {
  test.info().annotations.push({
    type: 'sourceTestCaseId',
    description: 'TC_HRM_001'
  });

  await page.goto(process.env.BASE_URL ?? 'https://example.com');
  await expect(page).toHaveURL(/.+/);

  const usernameField = page.getByLabel(/username|email/i).or(page.getByPlaceholder(/username|email/i));
  const passwordField = page.getByLabel(/password/i).or(page.getByPlaceholder(/password/i));
  const submitButton = page.getByRole('button', { name: /login|sign in/i }).or(page.getByRole('link', { name: /login|sign in/i }));

  await usernameField.fill(testData.username);
  await passwordField.fill(testData.password);
  await submitButton.click();

  await expect(
    page.getByRole('heading', { name: /dashboard|welcome/i }).or(page.getByText(/welcome|dashboard/i))
  ).toBeVisible();

  // Source requirement: create atleast 15 testcases
  // Scenario: Verify that the user can successfully log in to the OrangeHRM application using valid admin credentials.
  // Expected result: User should be logged in successfully and redirected to the OrangeHRM dashboard page.
});
