# TestPilot AI — Project Roadmap & Scope

> **Project type:** UI-based AI-powered test automation platform  
> **Primary automation stack:** Playwright + TypeScript  
> **AI architecture:** Planner Agent + Generator Agent + Healer Agent  
> **Frontend:** React + TypeScript  
> **Backend:** Node.js + Express + TypeScript  
> **Reporting:** Playwright HTML Report  
> **Realtime communication:** WebSocket  
> **Initial persistence:** JSON  
> **Recommended later persistence:** SQLite  
> **Target environment:** Local development first, deployable later

---

## 1. Project Vision

**TestPilot AI** is a web-based QA automation platform that converts natural-language testing requirements into executable Playwright TypeScript tests.

The system is designed around three specialized AI agents:

1. **Planner Agent** — analyzes the application and requirements and creates structured test cases.
2. **Generator Agent** — converts approved test cases into executable Playwright TypeScript automation scripts.
3. **Healer Agent** — analyzes failed automation, identifies likely automation-level causes such as changed locators, proposes a controlled fix, validates the fix by re-running the test, and records the healing result.

The user should be able to perform the entire workflow from a browser-based UI:

**Create Project → Plan Tests → Review/Approve → Generate Automation → Execute → Analyze Failures → Heal → Re-run → Report**

The goal is to demonstrate an end-to-end, agentic QA automation workflow rather than a collection of disconnected scripts.

---

# 2. Project Objectives

## Primary Objectives

- Build a functional UI-based AI QA automation platform.
- Use **Playwright with TypeScript** for all browser automation and generated test scripts.
- Generate structured test cases from natural-language requirements.
- Generate Playwright `.spec.ts` files from approved test cases.
- Execute generated tests with Playwright Test.
- Capture failures with trace, screenshot, DOM/page information, console output, and test logs where available.
- Use a Healer Agent to propose and validate safe automation repairs.
- Provide the user with visibility into every agent stage.
- Provide reports and execution history.
- Keep generated artifacts traceable back to their originating test case.

## Secondary Objectives

- Demonstrate TypeScript, Playwright, REST APIs, React, Node.js, AI integration, Git, and CI/CD concepts.
- Create a strong portfolio project for QA automation roles.
- Keep the architecture modular so additional agents can be introduced later.

---

# 3. Project Scope

## In Scope — Version 1

### A. Project Management

User can:

- Create a project.
- Enter project name.
- Enter application URL.
- Enter application description.
- Enter requirements/user stories.
- Select browser(s).
- Select environment/base URL.
- Save the project configuration.

### B. Planner Agent

The Planner Agent should:

- Read the provided requirements.
- Understand the requested feature/workflow.
- Explore application pages when needed.
- Identify possible positive, negative, boundary, validation, and usability-oriented scenarios.
- Generate structured test cases.
- Assign priority.
- Provide preconditions, steps, data, and expected results.
- Avoid duplicate scenarios.
- Produce machine-readable JSON output.

### C. Test Case Review

The user should be able to:

- View generated test cases in a table.
- Open a test case for detailed inspection.
- Edit title, steps, data, expected result, priority, and tags.
- Delete a generated test case.
- Approve selected test cases.
- Reject or regenerate test cases.

### D. Generator Agent

The Generator Agent should:

- Read only approved test cases.
- Generate executable Playwright TypeScript test files.
- Use robust Playwright locators.
- Prefer accessible locators such as:
  - `getByRole`
  - `getByLabel`
  - `getByPlaceholder`
  - `getByText`
  - `getByTestId` when appropriate
- Generate assertions for expected outcomes.
- Follow a consistent framework structure.
- Map every generated test to its source Test Case ID.

### E. Test Execution

The platform should:

- Start Playwright Test execution.
- Show execution status.
- Show currently running test.
- Stream logs to the UI.
- Show passed/failed/skipped results.
- Store screenshots for failures.
- Store trace information for failures when enabled.
- Produce an HTML report.

### F. Healer Agent

The Healer Agent should:

- Trigger only for failed tests selected for healing or according to configured policy.
- Read the failure output.
- Read the relevant generated test.
- Inspect DOM/page information and available locators.
- Use failure evidence to determine whether the issue is likely an automation problem.
- Generate a candidate repair.
- Present a before/after diff.
- Allow the user to approve or reject the repair.
- Apply the repair only after validation/approval according to the configured mode.
- Re-run the affected test.
- Record the healing attempt and final result.

### G. Reporting

The platform should display:

- Total test cases.
- Generated automation count.
- Total executed.
- Passed count.
- Failed count.
- Healed count.
- Unresolved count.
- Execution duration.
- Last execution.
- Agent activity/history.
- Links to reports, screenshots, traces, and generated scripts.

---

# 4. Out of Scope — Version 1

The following should not be required for the first production-like version:

- Multi-tenant SaaS architecture.
- User billing/subscriptions.
- Enterprise SSO.
- Complex role-based access control.
- Distributed browser grids.
- Large-scale parallel cloud execution.
- Full autonomous deployment to production.
- Automatic modification of business assertions.
- Automatic deletion of failed tests.
- Automatically marking flaky tests as passed.
- Unlimited self-healing loops.
- Training a custom LLM.

These can be added later after the core workflow is stable.

---

# 5. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React + TypeScript | UI |
| Build | Vite | Frontend development/build |
| Styling | Tailwind CSS | UI styling |
| Backend | Node.js + Express + TypeScript | APIs/orchestration |
| Automation | Playwright | Browser automation |
| Test runner | Playwright Test | Execution |
| AI | OpenAI API | Agent intelligence |
| Realtime | WebSocket | Live execution/agent updates |
| Persistence | JSON initially | MVP storage |
| Persistence later | SQLite | Structured project/history storage |
| Reports | Playwright HTML Reporter | Test reporting |
| Version control | Git + GitHub | Source control |
| Optional CI | GitHub Actions | Automated execution |

---

# 6. High-Level Architecture

```text
                        ┌─────────────────────────────┐
                        │        React UI              │
                        │   React + TypeScript         │
                        └──────────────┬──────────────┘
                                       │
                              REST + WebSocket
                                       │
                        ┌──────────────▼──────────────┐
                        │       Node.js API            │
                        │   Express + TypeScript       │
                        └───────┬───────┬───────┬─────┘
                                │       │       │
                         ┌──────▼─┐ ┌───▼────┐ ┌▼────────┐
                         │Planner │ │Generator│ │ Healer  │
                         │ Agent  │ │ Agent   │ │ Agent   │
                         └────┬───┘ └────┬────┘ └────┬───┘
                              │           │           │
                              └───────────┼───────────┘
                                          │
                                  OpenAI / LLM Layer
                                          │
                               ┌──────────▼─────────┐
                               │ Playwright Engine  │
                               │ TypeScript Tests   │
                               └──────────┬─────────┘
                                          │
                          ┌───────────────┼────────────────┐
                          │               │                │
                     Screenshots        Trace          HTML Report
                          │               │                │
                          └───────────────┼────────────────┘
                                          │
                                   Results / History
```

---

# 7. Core End-to-End Workflow

## Step 1 — Create Project

User opens the application and creates a project.

Input:

- Project name
- Application URL
- Requirements
- Browser
- Optional authentication information/configuration

Output:

- Project created
- Project ID generated
- Project visible on dashboard

---

## Step 2 — Plan Tests

User clicks **Plan Tests**.

The Planner Agent:

1. Reads requirements.
2. Reads project configuration.
3. Optionally navigates the application using Playwright.
4. Identifies relevant pages/elements.
5. Generates structured test cases.
6. Validates JSON schema.
7. Saves the result.
8. Sends progress events to the UI.

Output example:

```json
{
  "testCaseId": "TC001",
  "title": "Login with valid credentials",
  "priority": "High",
  "type": "Functional",
  "preconditions": [
    "User is on the login page"
  ],
  "testData": {
    "username": "Admin",
    "password": "admin123"
  },
  "steps": [
    "Enter a valid username",
    "Enter a valid password",
    "Click Login"
  ],
  "expectedResult": "User is navigated to the dashboard",
  "tags": ["login", "smoke"]
}
```

---

# 8. Planner Agent — Detailed Scope

## Input

```text
Project:
  Name
  Application URL
  Application description

Requirements:
  Natural-language feature requirements

Optional:
  Existing test cases
  Business rules
  Test data
  Authentication details
```

## Processing

The Planner Agent should combine:

- Requirements
- Project metadata
- Application observations
- Existing approved tests
- Test generation rules

## Output

Structured test cases with a strict schema.

Recommended schema:

```text
Test Case ID
Title
Description
Type
Priority
Preconditions
Test Data
Steps
Expected Result
Tags
Source Requirement
```

## Planner Validation Rules

The Planner must:

- Return valid JSON.
- Use unique Test Case IDs.
- Avoid duplicate scenarios.
- Include at least one expected result.
- Keep test steps actionable.
- Distinguish test data from expected behavior.
- Preserve the intent of the requirement.

---

# 9. Generator Agent — Detailed Scope

## Input

- Approved test case JSON
- Application URL
- Framework rules
- Locator preferences
- Optional page information

## Output

```text
tests/generated/TC001-login.spec.ts
tests/generated/TC002-invalid-login.spec.ts
...
```

## Generated Test Requirements

Every test should:

- Use Playwright Test.
- Use TypeScript.
- Have a clear test title.
- Contain meaningful assertions.
- Avoid arbitrary hard waits.
- Prefer resilient locators.
- Use reusable fixtures/page objects when beneficial.
- Include source Test Case ID metadata.

Example:

```ts
import { test, expect } from '@playwright/test';

test('TC001 - Login with valid credentials', async ({ page }) => {
  await page.goto(process.env.BASE_URL!);

  await page.getByLabel('Username').fill('Admin');
  await page.getByLabel('Password').fill('admin123');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(
    page.getByRole('heading', { name: 'Dashboard' })
  ).toBeVisible();
});
```

---

# 10. Execution Engine

The backend should control Playwright execution.

Recommended command concept:

```bash
npx playwright test
```

The backend should not depend on a human opening a terminal.

## Execution flow

```text
Start Run
   ↓
Discover Generated Tests
   ↓
Launch Playwright
   ↓
Capture Test Events
   ↓
Stream Events to UI
   ↓
Store Results
   ↓
Generate Report
   ↓
Identify Failed Tests
   ↓
Offer/Trigger Healing
```

---

# 11. Healer Agent — Detailed Scope

## Failure Sources

The Healer may inspect:

- Playwright error message
- Stack trace
- Generated test source
- Screenshot
- Current DOM
- Relevant HTML
- Locator information
- Console errors where relevant
- Network information where useful
- Trace output when configured

## Example failure

```text
Error:
locator.click: Timeout 10000ms exceeded.

Locator:
getByRole('button', { name: 'Login' })
```

The Healer may inspect the current page and identify that the accessible name is now:

```text
Sign in
```

Candidate repair:

```ts
await page.getByRole('button', { name: 'Sign in' }).click();
```

## Healer workflow

```text
Test fails
   ↓
Collect failure evidence
   ↓
Classify failure
   ↓
Is this likely an automation issue?
   ├── No → Mark unresolved
   └── Yes
        ↓
   Generate candidate fix
        ↓
   Show diff
        ↓
   Validate candidate
        ↓
   Re-run test
        ↓
   ├── Pass → Mark healed
   └── Fail → Mark unresolved / next candidate
```

## Critical Healer Safety Rules

The Healer must **not**:

- Remove an assertion merely because it fails.
- Change the expected business behavior to match actual behavior.
- Add `test.skip()` to hide a failure.
- Increase timeouts indefinitely as a universal fix.
- Replace every locator with a weak selector.
- Modify unrelated tests.
- Create an infinite repair loop.

A healing action must preserve the original test intention.

---

# 12. UI / UX Scope

## Design Direction

Recommended UI style:

- Modern QA/SaaS dashboard.
- Dark-mode-first design.
- Clear agent status.
- Strong visual hierarchy.
- Code preview.
- Real-time execution output.
- Before/after healing diff.
- Minimal but professional navigation.

---

# 13. Main Navigation

Sidebar:

```text
TestPilot AI

Dashboard

Projects

Test Case Planner

Test Generator

Test Execution

Self-Healing Center

Reports

Settings
```

---

# 14. Dashboard UI

## Dashboard content

### KPI cards

```text
Total Projects        4
Test Cases            128
Automated Tests       103
Passed                89
Failed                14
Healed                9
```

These are example values for the wireframe and should become dynamic in the implementation.

### Additional sections

- Recent projects
- Latest test run
- Agent activity
- Recent failures
- Healing success history
- Quick actions

### Quick actions

```text
+ New Project
Plan Tests
Generate Tests
Run Tests
Open Reports
```

---

# 15. Project Creation UI

## Form

```text
Create New Project

Project Name
[________________________]

Application URL
[https://_________________]

Application Description
[________________________]
[________________________]

Testing Requirements
[________________________]
[________________________]
[________________________]

Browser
○ Chromium
○ Firefox
○ WebKit

[Create Project]
```

Optional advanced section:

```text
Authentication
Environment Variables
Test Data
Advanced Agent Settings
```

---

# 16. Planner UI

## Header

```text
Test Case Planner

Project: OrangeHRM Demo

Planner Agent ● Ready
```

### Requirement panel

Show:

- Project URL
- Requirements
- Agent settings
- Generate button

### Generated Test Case Table

Columns:

| Column | Purpose |
|---|---|
| ID | Unique test case ID |
| Scenario | Test description |
| Type | Functional, negative, validation, etc. |
| Priority | High/Medium/Low |
| Status | Draft/Approved/Rejected |
| Tags | Search/filter |

Actions:

```text
View
Edit
Approve
Reject
Regenerate
```

---

# 17. Test Case Details UI

When a user opens a test case:

```text
TC001

Login with valid credentials

Priority: High
Type: Functional
Status: Approved

Preconditions
User is on login page

Test Data
Username: Admin
Password: ********

Steps
1. Enter username
2. Enter password
3. Click Login

Expected Result
Dashboard is displayed

[Save Changes] [Approve]
```

---

# 18. Generator UI

## Generator screen

Show:

```text
Generator Agent ● Working

Approved Test Cases: 15
Generated: 12
Pending: 3
```

### File list

```text
TC001-login.spec.ts
TC002-invalid-login.spec.ts
TC003-empty-password.spec.ts
```

### Code preview

Left panel:

```text
Test Case
TC001
```

Right panel:

```ts
test('TC001 - Login with valid credentials', async ({ page }) => {
   ...
});
```

Actions:

```text
Regenerate
Edit
Open Test
Execute
```

---

# 19. Execution UI

## Execution dashboard

### Summary

```text
Run #42

Passed: 10
Failed: 3
Skipped: 1
Duration: 01:42
```

### Test list

```text
✓ TC001 Login
✓ TC002 Invalid password
✕ TC003 Empty password
✓ TC004 Logout
✕ TC005 User search
```

### Live log panel

```text
[14:32:01] Starting Playwright
[14:32:03] Running TC001
[14:32:05] TC001 passed
[14:32:05] Running TC002
[14:32:08] TC002 passed
[14:32:08] Running TC003
[14:32:19] TC003 failed
[14:32:19] Capturing screenshot
[14:32:20] Sending failure to Healer Agent
```

---

# 20. Self-Healing Center UI

This is one of the key differentiators of the project.

## Failure card

```text
TC003 - Empty password

Status: Failed
Failure Type: Locator timeout

Error
locator.fill: Timeout exceeded

[View Screenshot]
[View Trace]
[View Source]
[Analyze Failure]
```

## AI analysis

```text
Healer Agent

Observed:
Current button accessible name = "Sign in"

Original locator:
getByRole('button', { name: 'Login' })

Candidate:
getByRole('button', { name: 'Sign in' })

Confidence:
High
```

## Code diff

```diff
- await page.getByRole('button', { name: 'Login' }).click();
+ await page.getByRole('button', { name: 'Sign in' }).click();
```

Actions:

```text
[Validate Fix]
[Approve & Apply]
[Reject]
```

## Healing result

```text
✓ Test healed successfully

TC003 passed after repair

Healing recorded:
Locator changed from "Login" to "Sign in"
```

---

# 21. Reports UI

## Report dashboard

Display:

- Run number
- Date/time
- Total
- Passed
- Failed
- Healed
- Unresolved
- Duration

## Test result details

Each result should provide:

```text
Test Case
Generated Script
Execution Log
Screenshot
Trace
Healing History
Final Status
```

Actions:

```text
Open HTML Report
Open Screenshot
Open Trace
Open Source
```

---

# 22. Settings UI

Settings should contain:

## AI settings

```text
Model
API Key
Planner temperature/config
Generator rules
Healer rules
Maximum healing attempts
```

## Playwright settings

```text
Browser
Headless
Timeout
Retries
Workers
Trace
Screenshot
Video
```

## Execution settings

```text
Auto-heal failures
Require approval before applying healing
Maximum healing retries
```

## Project defaults

```text
Base URL
Default test directory
Report directory
```

Secrets should be stored in environment variables rather than hardcoded in source code.

---

# 23. Recommended Project Structure

```text
testpilot-ai/
│
├── apps/
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── layouts/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   ├── types/
│   │   │   └── store/
│   │   └── ...
│   │
│   └── backend/
│       ├── src/
│       │   ├── agents/
│       │   │   ├── planner/
│       │   │   ├── generator/
│       │   │   └── healer/
│       │   │
│       │   ├── controllers/
│       │   ├── routes/
│       │   ├── services/
│       │   ├── websocket/
│       │   ├── runners/
│       │   ├── validators/
│       │   ├── models/
│       │   └── utils/
│       └── ...
│
├── automation/
│   ├── tests/
│   │   ├── generated/
│   │   └── manual/
│   ├── pages/
│   ├── fixtures/
│   ├── utils/
│   └── playwright.config.ts
│
├── data/
│   ├── projects/
│   ├── test-cases/
│   ├── executions/
│   └── healing/
│
├── reports/
├── screenshots/
├── traces/
│
├── docs/
│   ├── architecture.md
│   ├── agent-design.md
│   ├── api.md
│   └── ui.md
│
├── .env
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

---

# 24. Backend API Scope

Recommended initial APIs:

## Projects

```http
POST   /api/projects
GET    /api/projects
GET    /api/projects/:id
PUT    /api/projects/:id
DELETE /api/projects/:id
```

## Planner

```http
POST /api/projects/:id/plan
GET  /api/projects/:id/test-cases
PUT  /api/test-cases/:id
POST /api/test-cases/:id/approve
POST /api/test-cases/:id/reject
```

## Generator

```http
POST /api/projects/:id/generate
GET  /api/projects/:id/generated-tests
GET  /api/generated-tests/:id
POST /api/generated-tests/:id/regenerate
```

## Execution

```http
POST /api/projects/:id/run
GET  /api/runs/:id
GET  /api/runs/:id/results
```

## Healing

```http
POST /api/runs/:id/heal
GET  /api/healing/:id
POST /api/healing/:id/validate
POST /api/healing/:id/apply
POST /api/healing/:id/reject
```

## Reports

```http
GET /api/projects/:id/reports
GET /api/runs/:id/report
```

---

# 25. WebSocket Events

For real-time UI updates:

```text
planner.started
planner.progress
planner.completed
planner.failed

generator.started
generator.progress
generator.completed
generator.failed

run.started
run.test.started
run.test.passed
run.test.failed
run.completed

healer.started
healer.analyzing
healer.candidate-found
healer.validation-started
healer.validation-passed
healer.validation-failed
healer.completed
```

These events allow the UI to update without constantly polling the backend.

---

# 26. Core Data Models

## Project

```text
id
name
url
description
requirements
browsers
createdAt
updatedAt
```

## Test Case

```text
id
projectId
title
description
type
priority
preconditions
testData
steps
expectedResult
tags
status
sourceRequirement
createdAt
updatedAt
```

## Generated Test

```text
id
testCaseId
projectId
filePath
code
version
status
createdAt
updatedAt
```

## Execution

```text
id
projectId
startedAt
completedAt
status
total
passed
failed
skipped
healed
duration
reportPath
```

## Healing Attempt

```text
id
executionId
testId
failureType
failureMessage
analysis
originalCode
candidateCode
diff
validationStatus
applicationStatus
attemptCount
createdAt
```

---

# 27. Agent Design Principles

## Planner Agent

Focus:

**What should be tested?**

Should produce test intent, not automation code.

---

## Generator Agent

Focus:

**How should the approved test be automated?**

Should produce Playwright TypeScript implementation.

---

## Healer Agent

Focus:

**Why did the automation fail, and can the automation be repaired without changing test intent?**

Should produce a controlled code patch.

---

# 28. Agent Boundaries

```text
Planner
   ↓
Test Intent

Generator
   ↓
Automation Implementation

Healer
   ↓
Automation Maintenance
```

Agents should not unnecessarily overlap.

The Planner should not generate implementation code.

The Generator should not invent new business scenarios.

The Healer should not redefine business requirements.

---

# 29. AI Prompt Strategy

Use structured prompts instead of unrestricted free-form responses.

## Planner

System-level rules:

```text
You are a QA test planning agent.

Generate structured test cases from the supplied requirements.

Rules:
- Do not generate automation code.
- Cover positive and negative scenarios.
- Avoid duplicates.
- Preserve requirement intent.
- Return valid JSON only.
- Use the provided schema.
```

## Generator

```text
You are a Playwright TypeScript automation generation agent.

Convert the approved test case into executable Playwright Test code.

Rules:
- Use TypeScript.
- Use Playwright locators.
- Prefer resilient accessible locators.
- Include assertions.
- Do not change expected behavior.
- Return the requested code format.
```

## Healer

```text
You are a Playwright self-healing agent.

Analyze the failure evidence and identify whether the automation can be safely repaired.

Rules:
- Preserve test intent.
- Never remove assertions to hide failures.
- Never skip the test as a healing action.
- Prefer the most robust available locator.
- Provide a small, explainable patch.
- Validate the patch by re-running the test.
```

---

# 30. Security Considerations

The application will potentially process:

- Application URLs
- Credentials/test data
- API keys
- Screenshots
- DOM content
- Logs

Therefore:

- Never hardcode API keys.
- Never commit `.env`.
- Provide `.env.example`.
- Mask sensitive values in the UI.
- Avoid logging real credentials.
- Sanitize generated files where necessary.
- Restrict filesystem access from the backend.
- Validate all generated code before execution.
- Keep execution isolated to the configured project workspace.
- Add configurable limits on AI calls and healing attempts.

---

# 31. Generated Code Validation

Before executing Generator output:

1. Validate file path.
2. Validate TypeScript syntax.
3. Check imports.
4. Ensure test definitions exist.
5. Verify the file belongs to the current project.
6. Run a controlled Playwright validation.
7. Capture compiler/runtime errors.

The Generator should not be considered successful merely because the LLM returned code.

---

# 32. Healer Validation Strategy

Use a layered validation approach:

### Layer 1 — Static validation

Check:

- TypeScript syntax
- Required imports
- Test block presence

### Layer 2 — Candidate validation

Run the affected test with the candidate change.

### Layer 3 — Regression validation

Optionally run:

- The healed test.
- Related tests.
- A small smoke subset.

### Layer 4 — Final acceptance

Mark:

```text
HEALED
```

only after the candidate passes the configured validation.

Otherwise:

```text
UNRESOLVED
```

---

# 33. Healing Attempt Limits

Recommended default:

```text
Maximum healing attempts per test: 2
```

Example:

```text
Attempt 1
  locator replacement
  ↓ failed

Attempt 2
  alternative locator
  ↓ passed

Result: HEALED
```

Do not allow unlimited automatic attempts.

---

# 34. MVP Roadmap

## Phase 0 — Wireframe

Deliverables:

- Interactive HTML wireframe.
- Dashboard.
- Planner screen.
- Generator screen.
- Execution screen.
- Self-Healing Center.
- Reports.
- Settings.

**Status:** Wireframe created.

---

# Phase 1 — Foundation

### Tasks

- Initialize Git repository.
- Initialize Node.js project.
- Configure TypeScript.
- Configure React + Vite.
- Configure Tailwind.
- Configure Express.
- Configure Playwright.
- Configure environment variables.
- Create monorepo/workspace structure.
- Add linting/formatting.
- Add basic logging.

### Exit criteria

The frontend, backend, and Playwright test runner start successfully.

---

# Phase 2 — UI Implementation

### Tasks

- Build application shell.
- Build sidebar.
- Build dashboard.
- Build project creation form.
- Build project list.
- Build planner UI.
- Build test case table.
- Build generator UI.
- Build execution UI.
- Build healing UI.
- Build reports UI.
- Build settings.

### Exit criteria

All screens are functional with mock data and navigation works end-to-end.

---

# Phase 3 — Backend & Project Management

### Tasks

- Create project APIs.
- Add project model.
- Persist project data.
- Add validation.
- Connect frontend to backend.
- Add project selection.
- Add project status.

### Exit criteria

User can create, view, update, and select a project through the UI.

---

# Phase 4 — Planner Agent

### Tasks

- Integrate LLM provider.
- Create Planner Agent service.
- Define strict JSON schema.
- Add prompt templates.
- Validate model output.
- Save test cases.
- Stream generation progress.
- Build test case approval workflow.

### Exit criteria

User can enter requirements and receive usable structured test cases.

---

# Phase 5 — Generator Agent

### Tasks

- Implement Generator Agent.
- Read approved test cases.
- Generate `.spec.ts` files.
- Add code validation.
- Add test-to-file mapping.
- Add code preview in UI.
- Add regenerate/edit flow.

### Exit criteria

Approved test cases can be converted into executable Playwright TypeScript tests.

---

# Phase 6 — Playwright Execution Engine

### Tasks

- Build test execution service.
- Execute Playwright Test programmatically.
- Capture stdout/stderr.
- Capture screenshots.
- Configure traces.
- Parse results.
- Store run history.
- Add WebSocket execution updates.
- Display live logs.

### Exit criteria

User can click **Run Tests** and observe real execution results in the UI.

---

# Phase 7 — Healer Agent

### Tasks

- Detect failures.
- Collect failure evidence.
- Implement failure classification.
- Send evidence to Healer Agent.
- Generate candidate patch.
- Generate code diff.
- Add validation run.
- Add approval/rejection.
- Apply patch.
- Re-run failed test.
- Record healing history.

### Exit criteria

At least one realistic locator-change scenario can be detected, repaired, validated, and recorded.

---

# Phase 8 — Reporting & History

### Tasks

- Integrate Playwright HTML report.
- Build report summary.
- Add screenshots.
- Add trace links.
- Add run history.
- Add healing history.
- Add project-level metrics.

### Exit criteria

A user can open previous runs and inspect their results and artifacts.

---

# Phase 9 — Quality & Hardening

### Tasks

- Add error handling.
- Add validation.
- Add timeout controls.
- Add retry controls.
- Add healing attempt limits.
- Add security checks.
- Add test coverage for backend.
- Add frontend component tests where useful.
- Test concurrent execution behavior.
- Test malformed AI output.
- Test failed AI calls.
- Test missing DOM evidence.
- Test failed healing.

### Exit criteria

The application handles normal failures gracefully and does not hide test failures.

---

# Phase 10 — CI/CD

### Tasks

- Create GitHub Actions workflow.
- Install dependencies.
- Install Playwright browsers.
- Run application tests.
- Run generated tests where configured.
- Upload Playwright reports.
- Upload screenshots/traces.
- Publish build artifacts.

### Exit criteria

The project can be validated automatically in CI.

---

# 35. Version 1 Acceptance Criteria

The MVP is considered complete when the following workflow works:

```text
1. Create project
      ↓
2. Enter application URL
      ↓
3. Enter requirements
      ↓
4. Click Plan Tests
      ↓
5. Planner generates test cases
      ↓
6. User reviews/approves
      ↓
7. Click Generate
      ↓
8. Generator creates .spec.ts files
      ↓
9. Click Execute
      ↓
10. Playwright runs tests
      ↓
11. Failures appear in UI
      ↓
12. Click Analyze/Heal
      ↓
13. Healer analyzes failure
      ↓
14. Candidate patch shown
      ↓
15. Validate patch
      ↓
16. Apply approved fix
      ↓
17. Re-run failed test
      ↓
18. Test becomes Passed/Healed or Unresolved
      ↓
19. Open Report
```

---

# 36. Example Demonstration Scenario

For the first complete demo, use a simple web application login workflow.

## Requirements

```text
Verify that a valid user can log in.

Verify that an invalid password shows an error.

Verify that required-field validation appears
when username or password is empty.
```

## Expected Planner output

```text
TC001 — Valid login
TC002 — Invalid password
TC003 — Empty username
TC004 — Empty password
TC005 — Empty username and password
```

## Generator output

```text
TC001-login.spec.ts
TC002-invalid-password.spec.ts
TC003-empty-username.spec.ts
TC004-empty-password.spec.ts
TC005-empty-fields.spec.ts
```

## Demonstration failure

Intentionally change a locator in one generated test.

For example:

```ts
getByRole('button', { name: 'Login' })
```

Application now exposes:

```text
Sign in
```

The execution produces a failure.

The Healer:

```text
Detects timeout
   ↓
Reads DOM
   ↓
Finds "Sign in"
   ↓
Proposes locator replacement
   ↓
Shows diff
   ↓
Validates
   ↓
Re-runs
   ↓
Passes
```

This gives the final project a clear and demonstrable **self-healing automation** story.

---

# 37. Metrics to Track

The dashboard should eventually track:

### Planning metrics

- Test cases generated.
- Test cases approved.
- Test cases rejected.
- Duplicate scenarios detected.

### Generation metrics

- Scripts generated.
- Generation failures.
- Scripts validated.
- Regeneration count.

### Execution metrics

- Total runs.
- Pass rate.
- Failure rate.
- Average execution time.
- Retry count.

### Healing metrics

- Failures analyzed.
- Healing attempts.
- Successful heals.
- Unresolved failures.
- Average healing attempts.
- Healing validation pass rate.

---

# 38. Future Enhancements — Version 2+

Possible additions:

## Requirement-to-Test Traceability

Map:

```text
Requirement
   ↓
Test Case
   ↓
Generated Test
   ↓
Execution
   ↓
Healing History
```

## Test Suite Management

Allow suites such as:

```text
Smoke
Regression
Login
User Management
Critical
```

## Authentication Profiles

Store reusable authentication setup/configuration.

## Page Object Generation

Allow Generator Agent to produce:

```text
pages/LoginPage.ts
pages/DashboardPage.ts
```

and tests that consume those page objects.

## API Test Generation

Add an API Agent for REST/HTTP testing.

## Visual Testing

Add Playwright screenshot comparison.

## Accessibility Testing

Integrate accessibility checks into generated tests.

## CI Integration

Run the project automatically through GitHub Actions/Jenkins.

## Multi-Model Agent Routing

Use different models for:

- Planning
- Code generation
- Failure analysis

## Human-in-the-Loop Modes

Provide:

```text
Manual Approval
Assisted Healing
Auto Healing
```

---

# 39. Recommended Development Order

Do not build all features simultaneously.

Use this order:

```text
1. Playwright TypeScript foundation
        ↓
2. React UI
        ↓
3. Node/Express API
        ↓
4. Project management
        ↓
5. Planner Agent
        ↓
6. Test case review
        ↓
7. Generator Agent
        ↓
8. Test execution
        ↓
9. Live execution UI
        ↓
10. Healer Agent
        ↓
11. Healing validation
        ↓
12. Reports
        ↓
13. CI/CD
```

This sequence makes debugging much easier because every stage can be tested independently.

---

# 40. Portfolio / Resume Value

This project can demonstrate experience with:

```text
Playwright
TypeScript
React
Node.js
Express
REST APIs
WebSockets
AI Agents
LLM integration
Test Case Design
Test Automation
Self-Healing Automation
Page Object Model
Test Reporting
Git/GitHub
CI/CD
```

A concise project description for the repository can be:

> **TestPilot AI** is a UI-based agentic QA automation platform that uses AI-powered Planner, Generator, and Healer agents to transform natural-language requirements into Playwright TypeScript tests, execute them, analyze failures, and validate controlled self-healing repairs.

---

# 41. Definition of Done

The project should be considered production-ready for portfolio demonstration when:

- The UI works without mock data for the core workflow.
- Planner-generated test cases are persisted.
- Approved tests generate actual Playwright TypeScript files.
- Generated tests execute through Playwright Test.
- Failures are captured with useful evidence.
- Healer produces a reviewable patch.
- Healing is validated by execution.
- Reports and artifacts are accessible from the UI.
- The system preserves test intent.
- Configuration/secrets are handled safely.
- The README contains setup and usage instructions.
- The project can be cloned and started from a clean machine.

---

# 42. Final Product Vision

```text
                    TESTPILOT AI

             AI-Powered QA Automation

       ┌─────────────────────────────────────┐
       │          Natural Language            │
       │            Requirements              │
       └──────────────────┬──────────────────┘
                          ↓
                 ┌────────────────┐
                 │ Planner Agent  │
                 └───────┬────────┘
                         ↓
                  Test Case Review
                         ↓
                ┌─────────────────┐
                │ Generator Agent │
                └────────┬────────┘
                         ↓
              Playwright TypeScript
                         ↓
                 Test Execution
                         ↓
                    ┌────┴────┐
                    │         │
                  PASS      FAIL
                    │         │
                    │         ↓
                    │   ┌─────────────┐
                    │   │Healer Agent │
                    │   └──────┬──────┘
                    │          ↓
                    │    Candidate Fix
                    │          ↓
                    │      Validation
                    │          ↓
                    │       Re-run
                    │          ↓
                    └──────────┬┘
                               ↓
                         Final Results
                               ↓
                         Reports/History
```

---

# 43. Immediate Next Steps

The implementation should begin with:

**Milestone 1:** Convert the existing wireframe into a real **React + TypeScript UI**.

Then implement:

**Milestone 2:** Node.js + Express backend and project APIs.

**Milestone 3:** Real Planner Agent.

**Milestone 4:** Real Generator Agent.

**Milestone 5:** Real Playwright execution engine.

**Milestone 6:** Real Healer Agent.

**Milestone 7:** Reports, history, and CI/CD.

The wireframe should remain the UX reference while the real backend and agents are implemented behind it.
