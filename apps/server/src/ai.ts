import { loadSettings } from './storage.js';
import {
  generatePlannerTestCases,
  type PlannerInput,
  type TestCase,
  type TestPriority,
  type TestStatus,
  type TestType
} from './planner.js';

const validPriorities: TestPriority[] = ['High', 'Medium', 'Low'];
const validTypes: TestType[] = ['Functional', 'Negative', 'Validation', 'Usability'];
const validStatuses: TestStatus[] = ['Draft', 'Approved', 'Rejected'];

function normalizePriority(value: unknown): TestPriority {
  if (typeof value === 'string' && validPriorities.includes(value as TestPriority)) {
    return value as TestPriority;
  }

  return 'Medium';
}

function normalizeType(value: unknown): TestType {
  if (typeof value === 'string' && validTypes.includes(value as TestType)) {
    return value as TestType;
  }

  return 'Functional';
}

function normalizeStatus(value: unknown): TestStatus {
  if (typeof value === 'string' && validStatuses.includes(value as TestStatus)) {
    return value as TestStatus;
  }

  return 'Draft';
}

function normalizeArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => (typeof item === 'string' ? [item] : []));
}

function normalizeMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, innerValue]) =>
      typeof innerValue === 'string' ? [[key, innerValue]] : []
    )
  );
}

function normalizeTestCase(raw: Record<string, unknown>, index: number): TestCase {
  const title = typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : `Generated scenario ${index + 1}`;
  const requirement = typeof raw.sourceRequirement === 'string' && raw.sourceRequirement.trim()
    ? raw.sourceRequirement.trim()
    : title;

  return {
    testCaseId: typeof raw.testCaseId === 'string' && raw.testCaseId.trim() ? raw.testCaseId.trim() : `TC${String(index + 1).padStart(3, '0')}`,
    title,
    description: typeof raw.description === 'string' && raw.description.trim() ? raw.description.trim() : `Scenario generated from requirement: ${requirement}`,
    type: normalizeType(raw.type),
    priority: normalizePriority(raw.priority),
    preconditions: normalizeArray(raw.preconditions),
    testData: normalizeMap(raw.testData),
    steps: normalizeArray(raw.steps),
    expectedResult: typeof raw.expectedResult === 'string' && raw.expectedResult.trim() ? raw.expectedResult.trim() : 'Expected result is visible after the requested action.',
    tags: normalizeArray(raw.tags),
    status: normalizeStatus(raw.status),
    sourceRequirement: requirement
  };
}

export function parseAIPlannerResponse(content: string): TestCase[] {
  if (!content || !content.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(content) as { testCases?: unknown; testCase?: unknown };

    if (Array.isArray(parsed.testCases) && parsed.testCases.length > 0) {
      return parsed.testCases
        .map((entry, index) => (entry && typeof entry === 'object' ? normalizeTestCase(entry as Record<string, unknown>, index) : null))
        .filter((entry): entry is TestCase => Boolean(entry));
    }

    if (parsed.testCase && typeof parsed.testCase === 'object') {
      return [normalizeTestCase(parsed.testCase as Record<string, unknown>, 0)];
    }

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const candidate = parsed as Record<string, unknown>;
      const looksLikeTestCase =
        typeof candidate.title === 'string' ||
        typeof candidate.steps === 'object' ||
        typeof candidate.expectedResult === 'string';

      if (looksLikeTestCase) {
        return [normalizeTestCase(candidate, 0)];
      }
    }

    return [];
  } catch {
    return [];
  }
}

export async function generatePlannerTestCasesWithAI(project: PlannerInput): Promise<TestCase[]> {
  const savedSettings = loadSettings();
  const apiKey = (process.env.GEMINI_API_KEY || savedSettings.apiKey || '').trim();
  const model = (process.env.GEMINI_MODEL || savedSettings.model || 'gemini-2.0-flash').trim();

  if (!apiKey) {
    return generatePlannerTestCases(project);
  }

  try {
    const prompt = JSON.stringify({
      ...project,
      instruction: 'Generate multiple test cases for each meaningful requirement or scenario visible on the page. Do not collapse the response into a single case. Prefer broader coverage based on the actual URL content.'
    });

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `You are a QA planning assistant. Generate multiple structured test cases from the user requirements and from the actual application page when an applicationUrl or discoveredPageContent is provided. Return a JSON object with a top-level property named "testCases" whose value is an array of test cases. Include as many realistic scenarios as possible, especially login, validation, navigation, search, reporting, settings, and error flows. Each item must include: testCaseId, title, description, type, priority, preconditions, testData, steps, expectedResult, tags, status, sourceRequirement.\n\n${prompt}` }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.4
        }
      })
    });

    if (!response.ok) {
      return generatePlannerTestCases(project);
    }

    const data = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    const content = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';

    if (!content) {
      return generatePlannerTestCases(project);
    }

    const parsedCases = parseAIPlannerResponse(content);
    if (parsedCases.length === 0) {
      return generatePlannerTestCases(project);
    }

    return parsedCases;
  } catch {
    return generatePlannerTestCases(project);
  }
}
