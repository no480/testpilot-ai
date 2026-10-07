export type TestPriority = 'High' | 'Medium' | 'Low';
export type TestType = 'Functional' | 'Negative' | 'Validation' | 'Usability';
export type TestStatus = 'Draft' | 'Approved' | 'Rejected';

export type TestCase = {
  testCaseId: string;
  title: string;
  description: string;
  type: TestType;
  priority: TestPriority;
  preconditions: string[];
  testData: Record<string, string>;
  steps: string[];
  expectedResult: string;
  tags: string[];
  status: TestStatus;
  sourceRequirement: string;
};

export type PlannerInput = {
  name?: string;
  description?: string;
  applicationUrl?: string;
  requirements: string[];
  discoveredPageContent?: string;
};

const fallbackRequirements = [
  'User can log in with valid credentials',
  'Invalid credentials show a validation error',
  'Password field is required before submission'
];

function sanitizeText(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function mapLabelToRequirement(label: string): string | null {
  const cleaned = label.replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    return null;
  }

  const normalized = cleaned.toLowerCase();

  if (normalized.includes('login')) {
    return 'User can log in with valid credentials';
  }

  if (normalized.includes('signup') || normalized.includes('sign up') || normalized.includes('register')) {
    return 'User can sign up for a new account';
  }

  if (normalized.includes('search')) {
    return 'User can search for content or records';
  }

  if (normalized.includes('report')) {
    return 'User can view and filter reports';
  }

  if (normalized.includes('settings') || normalized.includes('profile')) {
    return 'User can update profile or settings';
  }

  if (normalized.includes('checkout')) {
    return 'User can complete the checkout flow';
  }

  if (normalized.includes('submit')) {
    return 'User can submit the form successfully';
  }

  if (normalized.includes('logout') || normalized.includes('sign out')) {
    return 'User can sign out securely';
  }

  if (normalized.includes('reset') || normalized.includes('forgot password')) {
    return 'User can reset a forgotten password';
  }

  return `User can interact with ${cleaned}`;
}

export function extractRequirementsFromPageContent(content: string): string[] {
  const source = content ?? '';
  if (!source.trim()) {
    return [];
  }

  const candidateLabels = new Set<string>();
  const patterns = [
    /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi,
    /<button[^>]*>([\s\S]*?)<\/button>/gi,
    /<label[^>]*>([\s\S]*?)<\/label>/gi,
    /<a[^>]*>([\s\S]*?)<\/a>/gi,
    /aria-label=["']([^"']+)["']/gi,
    /placeholder=["']([^"']+)["']/gi,
    /title=["']([^"']+)["']/gi
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
      const text = sanitizeText(match[1] ?? match[0] ?? '');
      if (text) {
        candidateLabels.add(text.replace(/\s+/g, ' ').trim());
      }
    }
  }

  const requirements = Array.from(candidateLabels)
    .map((label) => mapLabelToRequirement(label))
    .filter((entry): entry is string => Boolean(entry));

  const uniqueRequirements = Array.from(new Set(requirements.map((item) => item.trim())));
  return uniqueRequirements.slice(0, 12);
}

function inferPriority(text: string): TestPriority {
  const lower = text.toLowerCase();

  if (lower.includes('login') || lower.includes('critical') || lower.includes('checkout')) {
    return 'High';
  }

  if (lower.includes('validation') || lower.includes('password') || lower.includes('search')) {
    return 'Medium';
  }

  return 'Low';
}

function inferType(text: string): TestType {
  const lower = text.toLowerCase();

  if (lower.includes('error') || lower.includes('invalid') || lower.includes('missing')) {
    return 'Negative';
  }

  if (lower.includes('validate') || lower.includes('required') || lower.includes('empty')) {
    return 'Validation';
  }

  if (lower.includes('accessibility') || lower.includes('usability')) {
    return 'Usability';
  }

  return 'Functional';
}

function buildSteps(text: string): string[] {
  const lower = text.toLowerCase();

  if (lower.includes('login')) {
    return [
      'Open the login page',
      'Enter valid user credentials',
      'Click the login button',
      'Verify user is redirected to the main dashboard'
    ];
  }

  if (lower.includes('password') || lower.includes('required')) {
    return [
      'Navigate to the form',
      'Leave the password field blank or invalid',
      'Submit the form',
      'Confirm the validation message is shown'
    ];
  }

  return [
    'Open the target page',
    'Perform the requested user action',
    'Submit the action',
    'Verify the expected result is visible'
  ];
}

function buildExpectedResult(text: string): string {
  const lower = text.toLowerCase();

  if (lower.includes('login')) {
    return 'User is successfully authenticated and redirected to the dashboard.';
  }

  if (lower.includes('error') || lower.includes('invalid') || lower.includes('required')) {
    return 'The system displays a clear validation or error message and prevents the invalid action.';
  }

  return 'The requested workflow succeeds and the expected state is visible to the user.';
}

function buildPreconditions(text: string): string[] {
  if (text.toLowerCase().includes('login')) {
    return ['User is on the login page'];
  }

  return ['Application is reachable and the relevant page is loaded'];
}

function buildTestData(text: string): Record<string, string> {
  if (text.toLowerCase().includes('login')) {
    return {
      username: 'Admin',
      password: 'admin123'
    };
  }

  if (text.toLowerCase().includes('password') || text.toLowerCase().includes('required')) {
    return {
      username: 'User',
      password: ''
    };
  }

  return {
    input: 'Example test data',
    expectedValue: 'Expected outcome'
  };
}

export function generatePlannerTestCases(project: PlannerInput): TestCase[] {
  const explicitRequirements = project.requirements?.filter((item) => item && item.trim().length > 0) ?? [];
  const pageRequirements = extractRequirementsFromPageContent(project.discoveredPageContent ?? '');
  const combinedRequirements = [...explicitRequirements, ...pageRequirements];
  const uniqueRequirements = Array.from(new Set(combinedRequirements.map((item) => item.trim()).filter(Boolean)));

  const sourceRequirements = uniqueRequirements.length > 0 ? uniqueRequirements : fallbackRequirements;

  return sourceRequirements.map((requirement, index) => {
    const title = requirement.trim();
    const testCaseId = `TC${String(index + 1).padStart(3, '0')}`;
    const type = inferType(title);
    const priority = inferPriority(title);

    return {
      testCaseId,
      title: title.charAt(0).toUpperCase() + title.slice(1),
      description: `Scenario generated from the requirement: ${title}`,
      type,
      priority,
      preconditions: buildPreconditions(title),
      testData: buildTestData(title),
      steps: buildSteps(title),
      expectedResult: buildExpectedResult(title),
      tags: [
        type.toLowerCase(),
        priority.toLowerCase(),
        project.name?.toLowerCase().replace(/\s+/g, '-') || 'project',
        ...(project.applicationUrl ? ['url-exploration'] : [])
      ],
      status: 'Draft',
      sourceRequirement: title
    };
  });
}
