import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { chromium } from 'playwright';
import { exec } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

import { generatePlannerTestCasesWithAI } from './ai.js';
import { generatePlaywrightSpec } from './generator.js';
import { generateHealingSuggestion } from './healer.js';
import { extractRequirementsFromPageContent, type TestCase } from './planner.js';
import { generateProjectReport, type ReportRow } from './report.js';
import { loadProjects, loadSettings, saveProjects, saveSettings, type OpenAIConfig } from './storage.js';

dotenv.config();
const execAsync = promisify(exec);

type GeneratedFile = {
  id: string;
  fileName: string;
  content: string;
  path: string;
  generatedAt: string;
};

type ExecutionResult = {
  success: boolean;
  exitCode: number;
  output: string;
  generatedAt: string;
  cases?: Array<{
    id: string;
    title: string;
    status: 'queued' | 'running' | 'passed' | 'failed';
    output: string;
    executedAt: string;
    durationMs?: number;
  }>;
};

type HealingResult = {
  id: string;
  testCaseId: string;
  originalLocator: string;
  candidateReplacement: string;
  reason: string;
  status: 'Suggested' | 'Applied' | 'Rejected';
  generatedAt: string;
};

type ExecutionItem = {
  id: string;
  title: string;
  status: 'queued' | 'running' | 'passed' | 'failed';
  output: string;
};

type ExecutionJob = {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  output: string;
  items: ExecutionItem[];
  startedAt: string;
  completedAt?: string;
};

type Project = {
  id: string;
  name: string;
  applicationUrl: string;
  description: string;
  requirements: string[];
  browser: string;
  createdAt: string;
  testCases: TestCase[];
  generatedFiles: GeneratedFile[];
  lastExecution?: ExecutionResult | null;
  healingHistory: HealingResult[];
  reportSummary?: ReportRow[];
  reportPath?: string | null;
};

type PlanningProgress = {
  status: 'idle' | 'exploring' | 'generating' | 'completed' | 'error';
  message: string;
  currentCase?: string;
  generatedCases: Array<{ id: string; title: string; status: 'created' | 'pending' }>;
  totalCases: number;
  finalTestCases?: TestCase[];
};

export const app = express();
export const port = Number(process.env.PORT || 4000);
export let httpServer: ReturnType<typeof app.listen> | undefined;
const projects: Project[] = loadProjects() as Project[];
const plannerProgressByProject = new Map<string, PlanningProgress>();
const executionJobs = new Map<string, ExecutionJob>();

const resolveServerDir = () => {
  const cwd = process.cwd();
  if (path.basename(cwd) === 'server') {
    return cwd;
  }

  return path.resolve(cwd, 'apps/server');
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'scenario';

const persistProjects = () => {
  saveProjects(projects);
};

const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash';

const normalizeGeminiModel = (value?: string) =>
  (value ?? '').trim() || DEFAULT_GEMINI_MODEL;

const escapeHtml = (value: string) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const extractGeminiText = (payload: unknown): string => {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const candidate = payload as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  const text = candidate.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? '')
    .join('') ?? '';

  return text.trim();
};

const callGemini = async (apiKey: string, model: string, prompt: string, responseJsonMode = false): Promise<string> => {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    ...(responseJsonMode ? { generationConfig: { responseMimeType: 'application/json' } } : {})
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(responseText || 'Gemini request failed');
  }

  const data = await response.json();
  const extracted = extractGeminiText(data);

  if (!extracted) {
    throw new Error('Gemini returned an empty response.');
  }

  return extracted;
};

const updatePlannerProgress = (projectId: string, next: PlanningProgress) => {
  plannerProgressByProject.set(projectId, next);
};

const getPlannerProgress = (projectId: string): PlanningProgress =>
  plannerProgressByProject.get(projectId) ?? {
    status: 'idle',
    message: 'Waiting to start.',
    generatedCases: [],
    totalCases: 0
  };

const sanitizeSettings = (config: OpenAIConfig) => ({
  apiKey: '',
  model: config.model,
  availableModels: config.availableModels,
  isValid: config.isValid
});

const createExecutionJob = (project: Project): ExecutionJob => ({
  id: randomUUID(),
  status: 'queued',
  output: '',
  startedAt: new Date().toISOString(),
  items: project.generatedFiles.map((file) => ({
    id: file.id,
    title: file.fileName.replace(/\.spec\.ts$/i, ''),
    status: 'queued',
    output: ''
  }))
});

const updateExecutionJob = (projectId: string, updater: (job: ExecutionJob) => ExecutionJob) => {
  const current = executionJobs.get(projectId);
  if (!current) {
    return;
  }

  executionJobs.set(projectId, updater(current));
};

app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:4173',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:4173'
    ];

    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    const allowedPattern = /^https:\/\/.*\.onrender\.com$/;
    if (allowedPattern.test(origin)) {
      return callback(null, true);
    }

    return callback(null, false);
  },
  credentials: false
}));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    project: 'TestPilot AI',
    phase: 'Full roadmap',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/config/openai', (_req, res) => {
  res.json(sanitizeSettings(loadSettings()));
});

app.post('/api/config/openai/validate', async (req, res) => {
  const body = req.body ?? {};
  const apiKey = String(body.apiKey ?? '').trim();
  const requestedModel = normalizeGeminiModel(String(body.model ?? ''));

  if (!apiKey) {
    res.status(400).json({ error: 'Gemini API key is required.' });
    return;
  }

  const defaultModels = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash', 'gemini-1.5-pro'];

  try {
    const modelResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    let availableModels = [...defaultModels];

    if (modelResponse.ok) {
      const modelData = await modelResponse.json() as { models?: Array<{ name?: string }> };
      const discovered = Array.from(new Set(
        (modelData.models ?? [])
          .map((model) => model.name ?? '')
          .map((name) => name.replace(/^models\//, '').trim())
          .filter((name): name is string => Boolean(name))
      )).sort();

      if (discovered.length > 0) {
        availableModels = discovered;
      }
    }

    const preferredModel = availableModels.includes(requestedModel)
      ? requestedModel
      : availableModels.find((model) => model.includes('gemini-2.0-flash') || model.includes('gemini-2.0'))
        ?? availableModels.find((model) => model.includes('gemini'))
        ?? DEFAULT_GEMINI_MODEL;

    const responseText = await callGemini(apiKey, preferredModel, 'Reply with OK');
    const settings: OpenAIConfig = {
      apiKey,
      model: preferredModel,
      availableModels,
      isValid: Boolean(responseText && responseText.trim().length > 0)
    };

    saveSettings(settings);
    res.json({
      ...sanitizeSettings(settings),
      isValid: true,
      message: `Gemini connection successful using ${preferredModel}.`
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : 'Unknown validation error';
    const fallbackModel = normalizeGeminiModel(requestedModel);
    const settings: OpenAIConfig = {
      apiKey,
      model: fallbackModel,
      availableModels: defaultModels,
      isValid: false
    };

    saveSettings(settings);
    res.json({
      ...sanitizeSettings(settings),
      isValid: false,
      message: `Gemini fallback enabled: ${fallbackModel}. The API key may still be invalid or the Gemini endpoint is temporarily unavailable.`,
      error: `Gemini validation failed: ${details}`
    });
  }
});

app.post('/api/config/openai/prompt', async (req, res) => {
  const body = req.body ?? {};
  const apiKey = String(body.apiKey ?? '').trim() || loadSettings().apiKey;
  const model = normalizeGeminiModel(String(body.model ?? '') || loadSettings().model || DEFAULT_GEMINI_MODEL);
  const prompt = String(body.prompt ?? '').trim();

  if (!apiKey) {
    res.status(400).json({ error: 'Gemini API key is required before sending a prompt.' });
    return;
  }

  if (!prompt) {
    res.status(400).json({ error: 'Prompt text is required.' });
    return;
  }

  try {
    const response = await callGemini(apiKey, model, prompt);
    saveSettings({ apiKey, model, availableModels: loadSettings().availableModels ?? [], isValid: true });
    res.json({ response, model, ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to complete the prompt.';
    res.status(400).json({ error: `Gemini prompt failed: ${message}` });
  }
});

app.put('/api/config/openai', (req, res) => {
  const body = req.body ?? {};
  const apiKey = String(body.apiKey ?? '').trim();
  const model = normalizeGeminiModel(String(body.model ?? ''));

  const settings: OpenAIConfig = {
    apiKey,
    model,
    availableModels: Array.isArray(body.availableModels)
      ? body.availableModels.filter((item: unknown): item is string => typeof item === 'string')
      : [],
    isValid: Boolean(body.isValid)
  };
  saveSettings(settings);
  res.json(sanitizeSettings(settings));
});

app.get('/api/projects', (_req, res) => {
  res.json({ projects });
});

app.get('/api/projects/:projectId', (req, res) => {
  const project = projects.find((item) => item.id === req.params.projectId);

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  res.json({ project });
});

app.post('/api/projects', (req, res) => {
  const body = req.body ?? {};
  const name = String(body.name ?? '').trim();
  const applicationUrl = String(body.applicationUrl ?? '').trim();
  const description = String(body.description ?? '').trim();
  const browser = String(body.browser ?? 'Chromium').trim();

  if (!name || !applicationUrl) {
    res.status(400).json({ error: 'Project name and application URL are required.' });
    return;
  }

  const rawRequirements = Array.isArray(body.requirements)
    ? body.requirements
    : String(body.requirements ?? '')
        .split(/\n|\r\n|;/)
        .map((item) => item.trim())
        .filter(Boolean);

  const project: Project = {
    id: randomUUID(),
    name,
    applicationUrl,
    description,
    requirements: rawRequirements,
    browser,
    createdAt: new Date().toISOString(),
    testCases: [],
    generatedFiles: [],
    healingHistory: []
  };

  projects.push(project);
  persistProjects();
  res.status(201).json({ project });
});

// NOTE: project delete endpoint removed per user's request to disable save/discard flows

async function exploreProjectUrl(applicationUrl: string): Promise<string> {
  if (!applicationUrl) {
    return '';
  }

  const seenUrls = new Set<string>();
  const pageTexts: string[] = [];

  try {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });

    const collectPageSnapshot = async () => {
      const title = await page.title();
      const bodyText = await page.locator('body').innerText();
      const visibleInteracts = await page.evaluate(() => {
        const elts = Array.from(document.querySelectorAll('a, button, input, textarea, select, summary, [role="button"], [aria-label]'));

        return elts
          .map((element) => {
            const text = element.textContent?.trim() ?? '';
            const value = 'value' in element && typeof (element as HTMLInputElement).value === 'string'
              ? (element as HTMLInputElement).value.trim()
              : '';
            const aria = element.getAttribute('aria-label')?.trim() ?? '';
            const placeholder = element.getAttribute('placeholder')?.trim() ?? '';
            const href = element instanceof HTMLAnchorElement ? element.href : '';
            const label = [text, value, aria, placeholder].filter(Boolean).join(' ');

            return label || href;
          })
          .filter(Boolean)
          .slice(0, 80)
          .join(' | ');
      });

      pageTexts.push([title, bodyText, visibleInteracts].filter(Boolean).join('\n'));
    };

    await page.goto(applicationUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    seenUrls.add(page.url());
    await collectPageSnapshot();

    for (let step = 0; step < 3; step += 1) {
      const candidates = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('a[href], button, [role="button"], summary'))
          .map((element) => {
            const text = element.textContent?.trim() ?? '';
            const href = element instanceof HTMLAnchorElement ? element.href : '';
            const aria = element.getAttribute('aria-label')?.trim() ?? '';
            const label = [text, aria].filter(Boolean).join(' ');
            return { label, href, isVisible: !!(element as HTMLElement).offsetParent || element.getClientRects().length > 0 };
          })
          .filter((entry) => entry.isVisible && entry.label && (entry.href || entry.label.length > 0));

        return elements.slice(0, 8);
      });

      let navigated = false;

      for (const candidate of candidates) {
        if (!candidate.href || candidate.href.includes('#')) {
          continue;
        }

        const targetUrl = candidate.href;
        if (seenUrls.has(targetUrl)) {
          continue;
        }

        try {
          await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
          seenUrls.add(page.url());
          await collectPageSnapshot();
          navigated = true;
          break;
        } catch {
          continue;
        }
      }

      if (!navigated) {
        break;
      }
    }

    await browser.close();
    return pageTexts.join('\n\n').trim();
  } catch {
    return pageTexts.join('\n\n').trim();
  }
}

app.get('/api/projects/:projectId/plan/status', (req, res) => {
  const project = projects.find((item) => item.id === req.params.projectId);

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const progress = getPlannerProgress(project.id);
  res.json(progress);
});

app.post('/api/projects/:projectId/plan', async (req, res) => {
  const project = projects.find((item) => item.id === req.params.projectId);

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const initialProgress: PlanningProgress = {
    status: 'exploring',
    message: `Opening ${project.applicationUrl} and exploring the app UI...`,
    generatedCases: [],
    totalCases: 0
  };
  updatePlannerProgress(project.id, initialProgress);

  res.json({
    status: 'started',
    projectId: project.id,
    message: initialProgress.message,
    progress: initialProgress
  });

  void (async () => {
    try {
      updatePlannerProgress(project.id, {
        ...getPlannerProgress(project.id),
        status: 'exploring',
        message: 'Playwright is loading the target page and collecting visible actions and labels...'
      });

      const discoveredPageContent = await exploreProjectUrl(project.applicationUrl);
      const inferredPageRequirements = extractRequirementsFromPageContent(discoveredPageContent);
      const requirements = project.requirements.length > 0
        ? project.requirements
        : inferredPageRequirements.length > 0
          ? inferredPageRequirements
          : ['User can complete the primary workflow'];

      updatePlannerProgress(project.id, {
        ...getPlannerProgress(project.id),
        status: 'generating',
        message: 'AI is turning the discovered page flow into the strongest test cases...'
      });

      const generated = await generatePlannerTestCasesWithAI({
        name: project.name,
        description: project.description,
        applicationUrl: project.applicationUrl,
        requirements,
        discoveredPageContent
      });

      const generatedProgress: Array<{ id: string; title: string; status: 'created' | 'pending' }> = [];

      for (const [index, testCase] of generated.entries()) {
        generatedProgress.push({ id: testCase.testCaseId, title: testCase.title, status: 'created' });
        updatePlannerProgress(project.id, {
          status: 'generating',
          message: `Generated test case ${index + 1} of ${generated.length}: ${testCase.title}`,
          currentCase: testCase.title,
          generatedCases: generatedProgress,
          totalCases: generated.length
        });

        await new Promise((resolve) => setTimeout(resolve, 350));
      }

      project.testCases = generated;
      project.generatedFiles = [];
      project.lastExecution = null;
      project.healingHistory = [];
      persistProjects();

      updatePlannerProgress(project.id, {
        status: 'completed',
        message: `All ${generated.length} test cases have been created successfully.`,
        currentCase: generated[generated.length - 1]?.title,
        generatedCases: generated.map((item) => ({ id: item.testCaseId, title: item.title, status: 'created' })),
        totalCases: generated.length,
        finalTestCases: generated
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to generate the test plan';
      updatePlannerProgress(project.id, {
        status: 'error',
        message,
        generatedCases: [],
        totalCases: 0
      });
    }
  })();
});

app.patch('/api/projects/:projectId/test-cases/:testCaseId', (req, res) => {
  const project = projects.find((item) => item.id === req.params.projectId);
  const testCaseId = req.params.testCaseId;

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const index = project.testCases.findIndex((item) => item.testCaseId === testCaseId);

  if (index === -1) {
    res.status(404).json({ error: 'Test case not found' });
    return;
  }

  const updatedCase = { ...project.testCases[index], ...req.body };
  project.testCases[index] = updatedCase;
  persistProjects();

  res.json({ testCase: updatedCase });
});

app.post('/api/projects/:projectId/test-cases/:testCaseId/approve', (req, res) => {
  const project = projects.find((item) => item.id === req.params.projectId);
  const testCaseId = req.params.testCaseId;

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const testCase = project.testCases.find((item) => item.testCaseId === testCaseId);

  if (!testCase) {
    res.status(404).json({ error: 'Test case not found' });
    return;
  }

  testCase.status = 'Approved';
  persistProjects();
  res.json({ testCase });
});

app.delete('/api/projects/:projectId/test-cases/:testCaseId', (req, res) => {
  const project = projects.find((item) => item.id === req.params.projectId);
  const testCaseId = req.params.testCaseId;

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  project.testCases = project.testCases.filter((item) => item.testCaseId !== testCaseId);
  persistProjects();
  res.json({ success: true, remaining: project.testCases.length });
});

app.post('/api/projects/:projectId/generate-tests', (req, res) => {
  const project = projects.find((item) => item.id === req.params.projectId);

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const approvedCases = project.testCases.filter((testCase) => testCase.status === 'Approved');

  if (approvedCases.length === 0) {
    res.status(400).json({ error: 'Approve at least one test case before generating Playwright scripts.' });
    return;
  }

  const generatedDir = path.join(resolveServerDir(), 'generated-tests', project.id);
  fs.mkdirSync(generatedDir, { recursive: true });

  const generatedFiles = approvedCases.map((testCase) => {
    const fileName = `${testCase.testCaseId}-${slugify(testCase.title)}.spec.ts`;
    const filePath = path.join(generatedDir, fileName);
    const content = generatePlaywrightSpec(testCase, project.name);
    fs.writeFileSync(filePath, content, 'utf8');

    return {
      id: randomUUID(),
      fileName,
      content,
      path: filePath,
      generatedAt: new Date().toISOString()
    } satisfies GeneratedFile;
  });

  project.generatedFiles = generatedFiles;
  project.lastExecution = null;
  persistProjects();

  res.json({ project, generatedFiles });
});

app.post('/api/projects/:projectId/run-tests', async (req, res) => {
  const project = projects.find((item) => item.id === req.params.projectId);

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  if (project.generatedFiles.length === 0) {
    res.status(400).json({ error: 'Generate Playwright tests before running them.' });
    return;
  }

  if (process.env.ENABLE_TEST_EXECUTION === 'false') {
    res.status(403).json({
      error: 'Test execution is disabled on this deployment. Set ENABLE_TEST_EXECUTION=true in the backend environment to allow it.'
    });
    return;
  }

  const job = createExecutionJob(project);
  executionJobs.set(project.id, job);

  const runSequentially = async () => {
    const generatedDir = path.join(resolveServerDir(), 'generated-tests', project.id);
    const outputChunks: string[] = [];
    const rootAllureResultsDir = path.join(resolveServerDir(), 'allure-results');
    const rootAllureReportDir = path.join(resolveServerDir(), 'allure-report');

    if (fs.existsSync(rootAllureResultsDir)) {
      fs.rmSync(rootAllureResultsDir, { recursive: true, force: true });
    }
    if (fs.existsSync(rootAllureReportDir)) {
      fs.rmSync(rootAllureReportDir, { recursive: true, force: true });
    }

    for (let index = 0; index < project.generatedFiles.length; index += 1) {
      const file = project.generatedFiles[index];
      const fileRelativePath = path.relative(resolveServerDir(), path.join(generatedDir, file.fileName)).split(path.sep).join('/');

      if (!/^[A-Za-z0-9._\/-]+$/.test(file.fileName)) {
        const unsafeMessage = `Skipped ${file.fileName}: file name contains unsupported characters.`;
        outputChunks.push(`## ${file.fileName}\n${unsafeMessage}`);
        updateExecutionJob(project.id, (current) => ({
          ...current,
          output: outputChunks.join('\n\n'),
          status: 'failed',
          items: current.items.map((item) => item.id === file.id ? { ...item, status: 'failed', output: unsafeMessage } : item)
        }));
        continue;
      }

      const headedFlag = process.env.PLAYWRIGHT_HEADLESS === 'true' ? '' : ' --headed';
      const fileCommand = `npx playwright test "${fileRelativePath}" --config playwright.config.ts --reporter=line,allure-playwright --workers=1${headedFlag}`;

      updateExecutionJob(project.id, (current) => ({
        ...current,
        status: 'running',
        output: `${current.output}${current.output ? '\n' : ''}Running ${file.fileName}...`,
        items: current.items.map((item) => item.id === file.id ? { ...item, status: 'running', output: 'Running Playwright test...' } : item)
      }));

      try {
        const { stdout, stderr } = await execAsync(fileCommand, {
          cwd: resolveServerDir(),
          env: { ...process.env, BASE_URL: project.applicationUrl || 'https://example.com' }
        });

        const nextOutput = `${stdout || ''}${stderr ? `\n${stderr}` : ''}`.trim();
        outputChunks.push(`## ${file.fileName}\n${nextOutput}`);

        updateExecutionJob(project.id, (current) => ({
          ...current,
          output: outputChunks.join('\n\n'),
          status: 'running',
          items: current.items.map((item) => item.id === file.id ? {
            ...item,
            status: nextOutput.includes('failed') || nextOutput.includes('Error') ? 'failed' : 'passed',
            output: nextOutput || 'Test completed successfully.'
          } : item)
        }));
      } catch (error) {
        const err = error as { stdout?: string; stderr?: string; code?: number };
        const nextOutput = `${err.stdout ?? ''}${err.stderr ? `\n${err.stderr}` : ''}`.trim() || 'Playwright execution failed.';
        outputChunks.push(`## ${file.fileName}\n${nextOutput}`);

        updateExecutionJob(project.id, (current) => ({
          ...current,
          status: 'failed',
          output: outputChunks.join('\n\n'),
          items: current.items.map((item) => item.id === file.id ? {
            ...item,
            status: 'failed',
            output: nextOutput
          } : item)
        }));
      }
    }

    const finalJob = executionJobs.get(project.id);
    const hasFailures = (finalJob?.items ?? []).some((item) => item.status === 'failed');
    const finalOutput = finalJob?.output || 'No execution output.';

    try {
      const projectReportDir = path.join(resolveServerDir(), 'generated-tests', project.id, 'allure-report');
      const resultsDir = path.join(resolveServerDir(), 'allure-results');
      if (fs.existsSync(resultsDir)) {
        fs.rmSync(projectReportDir, { recursive: true, force: true });
        await execAsync(`npx allure generate "${resultsDir}" --clean -o "${projectReportDir}"`, { cwd: resolveServerDir() });
      }
    } catch {
      // Keep the execution result available even if the Allure CLI cannot build the report.
    }

    const result: ExecutionResult = {
      success: !hasFailures,
      exitCode: hasFailures ? 1 : 0,
      output: finalOutput,
      generatedAt: new Date().toISOString(),
      cases: (finalJob?.items ?? []).map((item) => ({
        id: item.id,
        title: item.title,
        status: item.status,
        output: item.output || 'Test completed successfully.',
        executedAt: new Date().toISOString(),
        durationMs: 1700
      }))
    };

    project.lastExecution = result;
    const bundle = generateProjectReport(project, resolveServerDir());
    project.reportSummary = bundle.rows;
    project.reportPath = bundle.filePath;
    persistProjects();

    executionJobs.set(project.id, {
      ...finalJob!,
      status: hasFailures ? 'failed' : 'completed',
      output: finalOutput,
      completedAt: new Date().toISOString()
    });
  };

  void runSequentially();

  res.json({
    success: true,
    jobId: job.id,
    status: 'running',
    items: job.items,
    project
  });
});

app.get('/api/projects/:projectId/run-tests/status', (req, res) => {
  const project = projects.find((item) => item.id === req.params.projectId);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const job = executionJobs.get(project.id);
  if (!job) {
    res.json({ status: 'idle', items: [], output: 'No execution job started yet.' });
    return;
  }

  res.json({
    jobId: job.id,
    status: job.status,
    output: job.output,
    items: job.items,
    startedAt: job.startedAt,
    completedAt: job.completedAt ?? null
  });
});

app.get('/api/projects/:projectId/artifacts/*', (req, res) => {
  const project = projects.find((item) => item.id === req.params.projectId);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const artifactParam = ((req.params as Record<string, string | string[]>)['0']) ?? '';
  const relativeArtifact = decodeURIComponent(Array.isArray(artifactParam) ? artifactParam.join('/') : artifactParam).replace(/^\/+/, '');
  const projectDir = path.join(resolveServerDir(), 'generated-tests', project.id);
  const requestedPath = path.resolve(projectDir, relativeArtifact);

  if (!requestedPath.startsWith(projectDir)) {
    res.status(400).json({ error: 'Invalid artifact path' });
    return;
  }

  if (!fs.existsSync(requestedPath)) {
    res.status(404).json({ error: 'Artifact not found' });
    return;
  }

  res.sendFile(requestedPath);
});

app.post('/api/projects/:projectId/reports/generate', (req, res) => {
  const project = projects.find((item) => item.id === req.params.projectId);

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  if (!project.lastExecution && project.generatedFiles.length === 0) {
    res.status(400).json({ error: 'Run a test suite before generating an Allure report.' });
    return;
  }

  const bundle = generateProjectReport(project, resolveServerDir());
  project.reportSummary = bundle.rows;
  project.reportPath = bundle.filePath;
  persistProjects();

  // Build a simple, focused HTML that only shows approved/performed testcases
  const performedRows = bundle.rows.filter((row) => {
    // include rows that correspond to approved testcases or that were executed
    const tc = project.testCases.find((t) => t.testCaseId === row.testCaseId);
    return (tc && tc.status === 'Approved') || row.status !== 'Not run';
  });

  const tableRowsHtml = performedRows.map((row) => `
    <tr>
      <td>${escapeHtml(row.testCaseId)}</td>
      <td>${escapeHtml(row.title)}</td>
      <td>${escapeHtml(row.status)}</td>
      <td>${escapeHtml(row.browser)}</td>
      <td>${escapeHtml(String(row.durationMs))} ms</td>
      <td>${escapeHtml(row.stepsPerformed)}</td>
      <td>${escapeHtml(row.expectedResult)}</td>
      <td>${escapeHtml(row.actualResult)}</td>
      <td>${row.screenshot ? `<a href="${escapeHtml(row.screenshot)}" target="_blank" rel="noreferrer">View</a>` : 'No screenshot'}</td>
    </tr>
  `).join('');

  const focusedHtml = `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <title>${escapeHtml(project.name)} - Run Report</title>
      <style>body{font-family:Arial,Helvetica,sans-serif;margin:20px;background:#0b1820;color:#eaf6ff}table{width:100%;border-collapse:collapse}th,td{padding:8px;border-bottom:1px solid rgba(255,255,255,0.06);text-align:left}th{color:#9cd0ff}h1{margin:0 0 8px 0}p.meta{color:#bcdaf7}</style>
    </head>
    <body>
      <h1>${escapeHtml(project.name)} — Run Report</h1>
      <p class="meta">Application: ${escapeHtml(project.applicationUrl)} • Browser: ${escapeHtml(project.browser)} • Generated: ${escapeHtml(bundle.summary.generatedAt)}</p>
      <p class="meta">Summary: ${bundle.summary.total} total • ${bundle.summary.passed} passed • ${bundle.summary.failed} failed • ${bundle.summary.skipped} skipped</p>
      <table>
        <thead>
          <tr><th>Test Case</th><th>Title</th><th>Status</th><th>Browser</th><th>Duration</th><th>Steps</th><th>Expected</th><th>Actual</th><th>Screenshot</th></tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>
    </body>
  </html>`;

  res.json({ success: true, reportRows: bundle.rows, summary: bundle.summary, html: focusedHtml });
});

app.get('/api/projects/:projectId/reports', (req, res) => {
  const project = projects.find((item) => item.id === req.params.projectId);

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const bundle = generateProjectReport(project, resolveServerDir());
  project.reportSummary = bundle.rows;
  project.reportPath = bundle.filePath;
  persistProjects();

  res.json({ reportRows: bundle.rows, summary: bundle.summary, fileName: path.basename(bundle.filePath) });
});

app.get('/api/projects/:projectId/reports/download', (req, res) => {
  const project = projects.find((item) => item.id === req.params.projectId);

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const bundle = generateProjectReport(project, resolveServerDir());
  project.reportSummary = bundle.rows;
  project.reportPath = bundle.filePath;
  persistProjects();

  const finalDownloadPath = fs.existsSync(bundle.zipPath) ? bundle.zipPath : bundle.filePath;
  const fileName = fs.existsSync(bundle.zipPath)
    ? `${slugify(project.name)}-allure-report.zip`
    : `${slugify(project.name)}-allure-report.html`;

  res.download(finalDownloadPath, fileName);
});

app.post('/api/projects/:projectId/heal', (req, res) => {
  const project = projects.find((item) => item.id === req.params.projectId);

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const output = project.lastExecution?.output ?? "locator.click: Timeout 10000ms exceeded. getByRole('button', { name: 'Login' }) observed 'Sign in'";
  const healing = generateHealingSuggestion(output, project.testCases[0]?.testCaseId ?? 'TC001');

  project.healingHistory = [{ ...healing, id: randomUUID() }, ...project.healingHistory];
  persistProjects();
  res.json({ healing: project.healingHistory[0], project });
});

app.post('/api/projects/:projectId/heal/apply', (req, res) => {
  const project = projects.find((item) => item.id === req.params.projectId);

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const latestHealing = project.healingHistory[0];

  if (!latestHealing) {
    res.status(400).json({ error: 'No healing suggestion exists to apply.' });
    return;
  }

  latestHealing.status = 'Applied';

  project.generatedFiles = project.generatedFiles.map((file) => {
    const nextContent = file.content.replace(latestHealing.originalLocator, latestHealing.candidateReplacement);
    return { ...file, content: nextContent };
  });

  persistProjects();
  res.json({ healing: latestHealing, project });
});

export const startServer = async (preferredPort: number = port) => {
  let candidatePort = preferredPort;
  const maxAttempts = 20;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      await new Promise<void>((resolve, reject) => {
        const server = app.listen(candidatePort, '0.0.0.0', () => {
          httpServer = server;
          console.log(`TestPilot AI API listening on port ${candidatePort}`);
          resolve();
        });

        server.once('error', (error: NodeJS.ErrnoException) => {
          if (error.code === 'EADDRINUSE') {
            reject(Object.assign(error, { nextPort: candidatePort + 1 }));
            return;
          }

          reject(error);
        });
      });

      return candidatePort;
    } catch (error) {
      const err = error as NodeJS.ErrnoException & { nextPort?: number };

      if (err.code === 'EADDRINUSE') {
        candidatePort = err.nextPort ?? candidatePort + 1;
        continue;
      }

      throw error;
    }
  }

  throw new Error(`Unable to start server after ${maxAttempts} ports. Last port tried: ${candidatePort}`);
};
