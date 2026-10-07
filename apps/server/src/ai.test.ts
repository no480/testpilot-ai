import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseAIPlannerResponse } from './ai.js';

test('parseAIPlannerResponse supports multiple test cases in a testCases array', () => {
  const response = JSON.stringify({
    testCases: [
      {
        testCaseId: 'TC001',
        title: 'Login with valid credentials',
        description: 'User logs in successfully',
        type: 'Functional',
        priority: 'High',
        preconditions: ['User is on the login page'],
        testData: { username: 'Admin', password: 'admin123' },
        steps: ['Open login page', 'Enter credentials', 'Submit'],
        expectedResult: 'Dashboard is visible',
        tags: ['login', 'high'],
        status: 'Draft',
        sourceRequirement: 'User can log in'
      },
      {
        testCaseId: 'TC002',
        title: 'Login with invalid credentials',
        description: 'User sees validation error',
        type: 'Negative',
        priority: 'High',
        preconditions: ['User is on the login page'],
        testData: { username: 'Admin', password: 'bad-pass' },
        steps: ['Open login page', 'Enter wrong password', 'Submit'],
        expectedResult: 'Error message is displayed',
        tags: ['login', 'error'],
        status: 'Draft',
        sourceRequirement: 'Invalid login should fail'
      }
    ]
  });

  const parsed = parseAIPlannerResponse(response);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].testCaseId, 'TC001');
  assert.equal(parsed[1].testCaseId, 'TC002');
});

test('parseAIPlannerResponse accepts a single object as a single test case', () => {
  const response = JSON.stringify({
    testCaseId: 'TC001',
    title: 'User logs in',
    description: 'Successful login',
    type: 'Functional',
    priority: 'High',
    preconditions: ['User is on the login page'],
    testData: { username: 'Admin', password: 'admin123' },
    steps: ['Open login page', 'Submit'],
    expectedResult: 'Dashboard loads',
    tags: ['login'],
    status: 'Draft',
    sourceRequirement: 'User can log in'
  });

  const parsed = parseAIPlannerResponse(response);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].testCaseId, 'TC001');
});
