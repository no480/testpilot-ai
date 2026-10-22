import { useEffect, useState, type FormEvent } from 'react';

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

type TestCase = {
  testCaseId: string;
  title: string;
  description: string;
  type: string;
  priority: 'High' | 'Medium' | 'Low';
  preconditions: string[];
  testData: Record<string, string>;
  steps: string[];
  expectedResult: string;
  tags: string[];
  status: 'Draft' | 'Approved' | 'Rejected';
  sourceRequirement: string;
};

type ExecutionItem = {
  id: string;
  title: string;
  status: 'queued' | 'running' | 'passed' | 'failed';
  output: string;
};

type ReportRow = {
  testCaseId: string;
  title: string;
  status: 'Passed' | 'Failed' | 'Skipped' | 'Not run';
  durationMs: number;
  browser: string;
  executedAt: string;
  summary: string;
  output: string;
  stepsPerformed: string;
  expectedResult: string;
  actualResult: string;
  testData: string;
  screenshot?: string | null;
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

type AIProviderId = 'gemini' | 'openai';

type AIConfig = {
  provider: AIProviderId;
  apiKey: string;
  model: string;
  baseUrl: string;
  availableModels: string[];
  isValid: boolean;
  hasServerKey: boolean;
};

type ModelsStatus = {
  state: 'idle' | 'loading' | 'loaded' | 'empty' | 'error';
  message: string;
};

const aiKeyStorageId = (provider: AIProviderId) => `testpilot-ai.ai-key.${provider}`;

const readStoredAIKey = (provider: AIProviderId): string => {
  try {
    return window.sessionStorage.getItem(aiKeyStorageId(provider)) ?? '';
  } catch {
    return '';
  }
};

const writeStoredAIKey = (provider: AIProviderId, key: string) => {
  try {
    if (key) {
      window.sessionStorage.setItem(aiKeyStorageId(provider), key);
    } else {
      window.sessionStorage.removeItem(aiKeyStorageId(provider));
    }
  } catch {
    // Session storage can be unavailable in restricted contexts; the key still works for this page load.
  }
};

type PlanningProgress = {
  status: 'idle' | 'exploring' | 'generating' | 'completed' | 'error';
  message: string;
  currentCase?: string;
  generatedCases: Array<{ id: string; title: string; status: 'created' | 'pending' }>;
  totalCases: number;
  finalTestCases?: TestCase[];
};

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

const emptyForm = {
  name: '',
  applicationUrl: '',
  description: '',
  requirements: '',
  browser: 'Chromium'
};

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectForm, setProjectForm] = useState(emptyForm);
  const [selectedCase, setSelectedCase] = useState<TestCase | null>(null);
  const [selectedHealing, setSelectedHealing] = useState<HealingResult | null>(null);
  const [executionStatus, setExecutionStatus] = useState<{ status: 'idle' | 'running' | 'completed' | 'failed'; items: ExecutionItem[]; output: string }>({
    status: 'idle',
    items: [],
    output: ''
  });
  const [reportRows, setReportRows] = useState<ReportRow[]>([]);
  const [nextActionNote, setNextActionNote] = useState('Select a case, run the suite, and then review the execution table below.');
  const [repairStatus, setRepairStatus] = useState({
    isApplying: false,
    percent: 0,
    message: 'No repair is active yet. Analyze a failed test to inspect a locator fix.',
    tone: 'idle' as 'idle' | 'busy' | 'success' | 'error'
  });
  const [actionNote, setActionNote] = useState('Select a project and a testcase to begin. Next: create or plan a test, then generate scripts and run them.');
  const [aiConfig, setAIConfig] = useState<AIConfig>({
    provider: 'gemini',
    apiKey: readStoredAIKey('gemini'),
    model: 'gemini-2.0-flash',
    baseUrl: '',
    availableModels: [],
    isValid: false,
    hasServerKey: false
  });
  const [modelsStatus, setModelsStatus] = useState<ModelsStatus>({ state: 'idle', message: '' });
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [isValidatingKey, setIsValidatingKey] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState('');
  const [promptText, setPromptText] = useState('');
  const [promptResponse, setPromptResponse] = useState('');
  const [isPrompting, setIsPrompting] = useState(false);
  const [appTheme, setAppTheme] = useState<'original' | 'red' | 'yellow' | 'green'>('original');
  const [planningProgress, setPlanningProgress] = useState<PlanningProgress>({
    status: 'idle',
    message: 'Not generating yet.',
    generatedCases: [],
    totalCases: 0
  });
  

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;

  useEffect(() => {
    fetchProjects();
    fetchAIConfig();
  }, []);

  useEffect(() => {
    document.body.dataset.theme = appTheme;
    // reflect busy state for global CSS (used to show button spinner)
    const root = document.querySelector('.page-shell') as HTMLElement | null;
    if (root) {
      if (isBusy) root.setAttribute('data-busy', 'true');
      else root.removeAttribute('data-busy');
    }
  }, [appTheme]);

  useEffect(() => {
    const root = document.querySelector('.page-shell') as HTMLElement | null;
    if (root) {
      if (isBusy) root.setAttribute('data-busy', 'true');
      else root.removeAttribute('data-busy');
    }
  }, [isBusy]);

  useEffect(() => {
    if (!selectedProjectId) {
      return;
    }

    const loadProjectReport = async () => {
      try {
        const response = await fetch(`${API_URL}/projects/${selectedProjectId}/reports`);
        const data = await response.json();
        if (response.ok) {
          setReportRows(Array.isArray(data.reportRows) ? data.reportRows : []);
        }
      } catch {
        setReportRows([]);
      }
    };

    loadProjectReport();
  }, [selectedProjectId]);

  const fetchAIConfig = async () => {
    try {
      const response = await fetch(`${API_URL}/config/ai`);
      const data = await response.json();
      const provider: AIProviderId = data.provider === 'openai' ? 'openai' : 'gemini';
      const availableModels = Array.isArray(data.availableModels)
        ? data.availableModels.filter((item: unknown): item is string => typeof item === 'string')
        : [];

      setAIConfig({
        provider,
        apiKey: readStoredAIKey(provider),
        model: typeof data.model === 'string' && data.model ? data.model : 'gemini-2.0-flash',
        baseUrl: typeof data.baseUrl === 'string' ? data.baseUrl : '',
        availableModels,
        isValid: Boolean(data.isValid),
        hasServerKey: Boolean(data.hasServerKey)
      });
    } catch {
      setError('Unable to load AI settings.');
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await fetch(`${API_URL}/projects`);
      const data = await response.json();
      const projectList: Project[] = data.projects ?? [];
      setProjects(projectList);

      if (projectList.length > 0 && !selectedProjectId) {
        setSelectedProjectId(projectList[0].id);
      }
    } catch (err) {
      setError('Unable to load projects from the API server.');
    }
  };

  const handleCreateProject = async (event: FormEvent) => {
    event.preventDefault();
    setIsBusy(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectForm.name,
          applicationUrl: projectForm.applicationUrl,
          description: projectForm.description,
          requirements: projectForm.requirements
            .split(/\n|\r\n|;/)
            .map((item) => item.trim())
            .filter(Boolean),
          browser: projectForm.browser
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to create project');
      }

      const nextProjects = [...projects, data.project];
      setProjects(nextProjects);
      setSelectedProjectId(data.project.id);
      setSelectedCase(null);
      setProjectForm(emptyForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create project');
    } finally {
      setIsBusy(false);
    }
  };

  

  const handlePlanTests = async () => {
    if (!selectedProject) {
      return;
    }

    setIsBusy(true);
    setError('');
    setPlanningProgress({
      status: 'exploring',
      message: 'AI is opening the target URL and exploring the page...',
      generatedCases: [],
      totalCases: 0
    });

    try {
      const response = await fetch(`${API_URL}/projects/${selectedProject.id}/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aiConfig: {
            provider: aiConfig.provider,
            apiKey: aiConfig.apiKey,
            model: aiConfig.model.trim(),
            baseUrl: aiConfig.baseUrl
          }
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to generate test cases');
      }

      let done = false;
      while (!done) {
        const statusResponse = await fetch(`${API_URL}/projects/${selectedProject.id}/plan/status`);
        const statusData = await statusResponse.json();

        setPlanningProgress({
          status: statusData.status ?? 'exploring',
          message: statusData.message ?? 'Generating test cases...',
          currentCase: statusData.currentCase,
          generatedCases: Array.isArray(statusData.generatedCases) ? statusData.generatedCases : [],
          totalCases: Number(statusData.totalCases ?? 0),
          finalTestCases: statusData.finalTestCases ?? []
        });

        if (statusData.status === 'completed' || statusData.status === 'error') {
          done = true;
          if (statusData.finalTestCases?.length) {
            setProjects((current) =>
              current.map((project) =>
                project.id === selectedProject.id ? { ...project, testCases: statusData.finalTestCases } : project
              )
            );
            setSelectedCase(statusData.finalTestCases[0]);
          }
        } else {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    } catch (err) {
      setPlanningProgress({
        status: 'error',
        message: err instanceof Error ? err.message : 'Unable to generate test cases',
        generatedCases: [],
        totalCases: 0
      });
      setError(err instanceof Error ? err.message : 'Unable to generate test cases');
    } finally {
      setIsBusy(false);
    }
  };

  const handlePatchCase = async () => {
    if (!selectedProject || !selectedCase) {
      return;
    }

    setIsBusy(true);
    setError('');

    try {
      const response = await fetch(
        `${API_URL}/projects/${selectedProject.id}/test-cases/${selectedCase.testCaseId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(selectedCase)
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to save test case');
      }

      setProjects((current) =>
        current.map((project) => {
          if (project.id !== selectedProject.id) {
            return project;
          }

          return {
            ...project,
            testCases: project.testCases.map((item) =>
              item.testCaseId === selectedCase.testCaseId ? data.testCase : item
            )
          };
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save test case');
    } finally {
      setIsBusy(false);
    }
  };

  const handleApproveCase = async () => {
    if (!selectedProject || !selectedCase) {
      return;
    }

    setIsBusy(true);
    setError('');

    try {
      const response = await fetch(
        `${API_URL}/projects/${selectedProject.id}/test-cases/${selectedCase.testCaseId}/approve`,
        { method: 'POST' }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to approve test case');
      }

      setSelectedCase(data.testCase);
      setProjects((current) =>
        current.map((project) =>
          project.id === selectedProject.id
            ? {
                ...project,
                testCases: project.testCases.map((item) =>
                  item.testCaseId === data.testCase.testCaseId ? data.testCase : item
                )
              }
            : project
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to approve test case');
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeleteCase = async () => {
    if (!selectedProject || !selectedCase) {
      return;
    }

    setIsBusy(true);
    setError('');

    try {
      const response = await fetch(
        `${API_URL}/projects/${selectedProject.id}/test-cases/${selectedCase.testCaseId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? 'Unable to delete test case');
      }

      setProjects((current) =>
        current.map((project) =>
          project.id === selectedProject.id
            ? { ...project, testCases: project.testCases.filter((item) => item.testCaseId !== selectedCase.testCaseId) }
            : project
        )
      );

      if (selectedProject.testCases.length <= 1) {
        setSelectedCase(null);
      } else {
        const fallback = selectedProject.testCases.find((item) => item.testCaseId !== selectedCase.testCaseId);
        setSelectedCase(fallback ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete test case');
    } finally {
      setIsBusy(false);
    }
  };

  const handleGenerateTests = async () => {
    if (!selectedProject) {
      return;
    }

    setIsBusy(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/projects/${selectedProject.id}/generate-tests`, { method: 'POST' });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to generate Playwright tests');
      }

      setProjects((current) =>
        current.map((project) =>
          project.id === selectedProject.id ? { ...project, generatedFiles: data.generatedFiles } : project
        )
      );
      setActionNote('Generation complete. Next step: select the approved testcase and click “Run Tests” to execute the Playwright script.');
    } catch (err) {
      setActionNote('Generation did not complete. Next step: review the error, fix the testcase, and generate the script again.');
      setError(err instanceof Error ? err.message : 'Unable to generate Playwright tests');
    } finally {
      setIsBusy(false);
    }
  };

  const handleRunTests = async () => {
    if (!selectedProject) {
      return;
    }

    setIsBusy(true);
    setError('');
    setExecutionStatus({
      status: 'running',
      items: selectedProject.generatedFiles.map((file) => ({
        id: file.id,
        title: file.fileName.replace(/\.spec\.ts$/i, ''),
        status: 'queued',
        output: 'Waiting to run...'
      })),
      output: 'Starting Playwright execution...'
    });
    setActionNote('Running each generated testcase one by one so the UI stays responsive and the execution status updates live.');

    try {
      const response = await fetch(`${API_URL}/projects/${selectedProject.id}/run-tests`, { method: 'POST' });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to run generated tests');
      }

      const jobId = data.jobId ?? 'current';
      let finalStatus = 'running';
      let finalOutput = '';
      const pollStartedAt = Date.now();

      const pollStatus = async () => {
        const statusResponse = await fetch(`${API_URL}/projects/${selectedProject.id}/run-tests/status?jobId=${jobId}`);
        const statusData = await statusResponse.json();
        const nextItems = Array.isArray(statusData.items) ? statusData.items : [];
        const nextStatus = statusData.status ?? 'running';
        finalOutput = statusData.output ?? '';

        setExecutionStatus({
          status: nextStatus === 'completed' || nextStatus === 'failed' ? nextStatus : 'running',
          items: nextItems,
          output: finalOutput
        });

        if (nextStatus === 'completed' || nextStatus === 'failed') {
          finalStatus = nextStatus;
          return true;
        }

        return false;
      };

      while (finalStatus === 'running') {
        if (Date.now() - pollStartedAt > 15 * 60 * 1000) {
          throw new Error('Test execution timed out after 15 minutes. Check the server logs and the execution output.');
        }

        const done = await pollStatus();
        if (done) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 800));
      }

      const reportResponse = await fetch(`${API_URL}/projects/${selectedProject.id}/reports`);
      const reportData = await reportResponse.json();
      if (reportResponse.ok) {
        setReportRows(Array.isArray(reportData.reportRows) ? reportData.reportRows : []);
      }

      setProjects((current) =>
        current.map((project) =>
          project.id === selectedProject.id
            ? {
                ...project,
                lastExecution: {
                  success: finalStatus !== 'failed',
                  exitCode: finalStatus === 'failed' ? 1 : 0,
                  output: finalOutput || String(data.output ?? ''),
                  generatedAt: new Date().toISOString(),
                  cases: (executionStatus.items ?? []).map((item) => ({
                    id: item.id,
                    title: item.title,
                    status: item.status,
                    output: item.output || 'Test completed successfully.',
                    executedAt: new Date().toISOString(),
                    durationMs: 1700
                  }))
                }
              }
            : project
        )
      );

      if (finalStatus === 'failed') {
        setActionNote('The test run failed. Next step: select the testcase, click “Analyze Failure”, then “Apply Repair”, and rerun the test.');
        setError('One or more Playwright tests failed. Review the execution status and apply the healer before rerunning.');
      } else {
        setActionNote('The testcase passed in Playwright. Next step: select the next testcase and continue with approval or generation.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to run generated tests';
      // Never leave the execution panel stuck on "running": reset it to a clear failed state.
      setExecutionStatus({
        status: 'failed',
        items: [],
        output: `The run could not start or continue: ${message}`
      });
      setActionNote('The run could not complete. Next step: read the error above, fix it, then click Run Tests again.');
      setError(message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!selectedProject) {
      return;
    }

    setIsBusy(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/projects/${selectedProject.id}/reports/generate`, { method: 'POST' });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to generate report');
      }

      setReportRows(Array.isArray(data.reportRows) ? data.reportRows : []);
      setNextActionNote('Report generated. Opening in a new tab.');

      if (typeof data.html === 'string') {
        const blob = new Blob([data.html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener,noreferrer');
        // revoke after a short delay
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate report');
      setNextActionNote('The report could not be generated. Run the suite first so the execution details are available.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleAnalyzeHealing = async () => {
    if (!selectedProject) {
      return;
    }

    setIsBusy(true);
    setError('');
    setRepairStatus({
      isApplying: false,
      percent: 20,
      message: 'Checking the last failed test and preparing a safer locator replacement…',
      tone: 'busy'
    });

    try {
      const response = await fetch(`${API_URL}/projects/${selectedProject.id}/heal`, { method: 'POST' });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to analyze healing');
      }

      const nextHealing = data.healing ?? selectedProject.healingHistory[0] ?? null;
      setSelectedHealing(nextHealing);
      setProjects((current) =>
        current.map((project) =>
          project.id === selectedProject.id
            ? { ...project, healingHistory: [data.healing, ...project.healingHistory], generatedFiles: data.project?.generatedFiles ?? project.generatedFiles }
            : project
        )
      );
      setRepairStatus({
        isApplying: false,
        percent: 100,
        message: 'Repair suggestion is ready. Review it and click “Apply Repair” to update the locator.',
        tone: 'success'
      });
      setActionNote('Failure analyzed. Next step: review the suggested repair and click “Apply Repair” to update the locator before rerunning the testcase.');
    } catch (err) {
      setRepairStatus({
        isApplying: false,
        percent: 100,
        message: err instanceof Error ? err.message : 'Unable to analyze healing',
        tone: 'error'
      });
      setActionNote('Healing analysis did not return a fix. Next step: inspect the failing output and make sure the testcase is selected before trying again.');
      setError(err instanceof Error ? err.message : 'Unable to analyze healing');
    } finally {
      setIsBusy(false);
    }
  };

  const handleApplyHealing = async () => {
    if (!selectedProject) {
      return;
    }

    const latestHealing = selectedHealing ?? selectedProject.healingHistory[0];
    if (!latestHealing) {
      setRepairStatus({
        isApplying: false,
        percent: 100,
        message: 'There is no repair to apply yet. Analyze the failure first.',
        tone: 'error'
      });
      return;
    }

    setIsBusy(true);
    setError('');
    setRepairStatus({
      isApplying: true,
      percent: 25,
      message: 'Applying the safer locator replacement to the generated Playwright script…',
      tone: 'busy'
    });

    try {
      const response = await fetch(`${API_URL}/projects/${selectedProject.id}/heal/apply`, { method: 'POST' });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to apply repair');
      }

      const updatedHealing = data.healing ?? latestHealing;
      setSelectedHealing(updatedHealing);
      setProjects((current) =>
        current.map((project) =>
          project.id === selectedProject.id
            ? {
                ...project,
                generatedFiles: data.project?.generatedFiles ?? project.generatedFiles,
                healingHistory: project.healingHistory.map((item) =>
                  item.id === updatedHealing.id ? updatedHealing : item
                )
              }
            : project
        )
      );
      setRepairStatus({
        isApplying: false,
        percent: 100,
        message: 'Repair applied successfully. Next step: rerun the Playwright test to confirm the fix and then review the result.',
        tone: 'success'
      });
      setActionNote('Repair applied. Next step: rerun the generated testcase to verify the updated locator and decide whether to approve it.');
    } catch (err) {
      setRepairStatus({
        isApplying: false,
        percent: 100,
        message: err instanceof Error ? err.message : 'Unable to apply repair',
        tone: 'error'
      });
      setError(err instanceof Error ? err.message : 'Unable to apply repair');
    } finally {
      setIsBusy(false);
    }
  };

  const handleProviderChange = (nextProvider: AIProviderId) => {
    setAIConfig((current) => ({
      ...current,
      provider: nextProvider,
      apiKey: readStoredAIKey(nextProvider)
    }));
    setModelsStatus({ state: 'idle', message: '' });
    setConnectionMessage('');
  };

  const handleRefreshModels = async () => {
    setModelsStatus({ state: 'loading', message: 'Loading models from the provider...' });

    try {
      const response = await fetch(`${API_URL}/config/ai/models`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: aiConfig.provider,
          apiKey: aiConfig.apiKey,
          baseUrl: aiConfig.baseUrl
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to load models.');
      }

      const models = Array.isArray(data.models)
        ? data.models.filter((item: unknown): item is string => typeof item === 'string')
        : [];

      setAIConfig((current) => ({ ...current, availableModels: models }));
      setModelsStatus(models.length > 0
        ? { state: 'loaded', message: `${models.length} models available. Type to filter, or enter any model ID manually.` }
        : { state: 'empty', message: 'No models were returned. You can still type a model ID manually.' });
    } catch (err) {
      setModelsStatus({
        state: 'error',
        message: err instanceof Error ? err.message : 'Unable to load models. You can still type a model ID manually.'
      });
    }
  };

  useEffect(() => {
    if (!aiConfig.apiKey.trim()) {
      return;
    }

    const timer = window.setTimeout(() => {
      void handleRefreshModels();
    }, 700);

    return () => window.clearTimeout(timer);
  }, [aiConfig.provider, aiConfig.apiKey, aiConfig.baseUrl]);

  const handleSaveAIConfig = async () => {
    setIsBusy(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/config/ai`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: aiConfig.provider,
          model: aiConfig.model.trim(),
          baseUrl: aiConfig.baseUrl,
          availableModels: aiConfig.availableModels,
          isValid: aiConfig.isValid
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to save AI settings');
      }

      setAIConfig((current) => ({
        ...current,
        model: typeof data.model === 'string' ? data.model : current.model,
        baseUrl: typeof data.baseUrl === 'string' ? data.baseUrl : current.baseUrl,
        availableModels: Array.isArray(data.availableModels)
          ? data.availableModels.filter((item: unknown): item is string => typeof item === 'string')
          : current.availableModels,
        isValid: Boolean(data.isValid),
        hasServerKey: Boolean(data.hasServerKey)
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save AI settings');
    } finally {
      setIsBusy(false);
    }
  };

  const handleValidateAIConfig = async () => {
    setIsValidatingKey(true);
    setError('');
    setConnectionMessage('');

    try {
      const response = await fetch(`${API_URL}/config/ai/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: aiConfig.provider,
          apiKey: aiConfig.apiKey,
          model: aiConfig.model.trim(),
          baseUrl: aiConfig.baseUrl
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'API key validation failed');
      }

      const nextModels = Array.isArray(data.availableModels)
        ? data.availableModels.filter((item: unknown): item is string => typeof item === 'string')
        : [];

      setAIConfig((current) => ({
        ...current,
        model: typeof data.model === 'string' && data.model ? data.model : current.model,
        baseUrl: typeof data.baseUrl === 'string' ? data.baseUrl : current.baseUrl,
        availableModels: nextModels,
        isValid: Boolean(data.isValid),
        hasServerKey: Boolean(data.hasServerKey)
      }));
      setModelsStatus(nextModels.length > 0
        ? { state: 'loaded', message: `${nextModels.length} models available. Type to filter, or enter any model ID manually.` }
        : { state: 'empty', message: 'No models were returned. You can still type a model ID manually.' });
      setConnectionMessage(data.message ?? (data.isValid ? 'Connection successful.' : 'Connection failed.'));
      setError('');
    } catch (err) {
      setAIConfig((current) => ({ ...current, isValid: false }));
      setConnectionMessage(err instanceof Error ? err.message : 'The API key could not be validated.');
      setError(err instanceof Error ? err.message : 'The API key could not be validated.');
    } finally {
      setIsValidatingKey(false);
    }
  };

  const handlePromptAI = async () => {
    if (!aiConfig.apiKey.trim() && !aiConfig.hasServerKey) {
      setError('Please enter an API key before sending a prompt.');
      return;
    }

    if (!promptText.trim()) {
      setError('Please enter a prompt to send to the configured model.');
      return;
    }

    setIsPrompting(true);
    setError('');
    setPromptResponse('');

    try {
      const response = await fetch(`${API_URL}/config/ai/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: aiConfig.provider,
          apiKey: aiConfig.apiKey,
          model: aiConfig.model.trim(),
          baseUrl: aiConfig.baseUrl,
          prompt: promptText
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to run the AI prompt');
      }

      setPromptResponse(typeof data.response === 'string' ? data.response : 'No response returned.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to run the AI prompt');
    } finally {
      setIsPrompting(false);
    }
  };

  return (
    <div className={`page-shell theme-${appTheme}`} data-busy={isBusy}>
      {isBusy ? (
        <div className="app-overlay" aria-hidden>
          <div className="overlay-spinner" />
        </div>
      ) : null}
      <aside className="sidebar">
        <div className="brand">TestPilot AI</div>
        <nav>
          <a href="#">Dashboard</a>
          <a href="#">Projects</a>
          <a href="#">Test Case Planner</a>
          <a href="#">Test Generator</a>
          <a href="#">Test Execution</a>
          <a href="#">Self-Healing Center</a>
          <a href="#">Reports</a>
          <a href="#">Settings</a>
        </nav>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">Full roadmap</p>
            <h1>Project, Planner, Generator & Healing</h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div className="theme-selector">
                <label htmlFor="theme-select">Theme</label>
                <select
                  id="theme-select"
                  value={appTheme}
                  onChange={(event) => setAppTheme(event.target.value as 'original' | 'red' | 'yellow' | 'green')}
                >
                  <option value="original">Original</option>
                  <option value="green">Green</option>
                  <option value="red">Red</option>
                  <option value="yellow">Yellow</option>
                </select>
              </div>

              {isBusy ? (
                <div title="Processing" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div className="global-loader" />
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>Working…</span>
                </div>
              ) : null}
            </div>

            {/* Global loader indicator */}
            {isBusy ? (
              <div title="Processing" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div className="global-loader" />
                <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>Working…</span>
              </div>
            ) : null}
          </div>
        </header>

        <section className="metrics-grid">
          <div className="metric-card">
            <span>Total Projects</span>
            <strong>{projects.length}</strong>
          </div>
          <div className="metric-card">
            <span>Approved</span>
            <strong>{projects.reduce((count, project) => count + project.testCases.filter((item) => item.status === 'Approved').length, 0)}</strong>
          </div>
          <div className="metric-card">
            <span>Draft</span>
            <strong>{projects.reduce((count, project) => count + project.testCases.filter((item) => item.status === 'Draft').length, 0)}</strong>
          </div>
        </section>

        <section className="panel form-panel">
          <h2>AI Configuration</h2>
          <div className="project-form">
            <div className="inline-grid">
              <label>
                AI Provider
                <select
                  value={aiConfig.provider}
                  onChange={(event) => handleProviderChange(event.target.value as AIProviderId)}
                >
                  <option value="gemini">Google Gemini</option>
                  <option value="openai">OpenAI (or any OpenAI-compatible API)</option>
                </select>
              </label>

              <div className="model-lookup">
                <div className="model-lookup-row">
                  <label>
                    Model
                    <input
                      value={aiConfig.model}
                      onChange={(event) => setAIConfig({ ...aiConfig, model: event.target.value })}
                      placeholder={aiConfig.provider === 'gemini' ? 'gemini-2.0-flash' : 'gpt-4o-mini'}
                    />
                  </label>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => { void handleRefreshModels(); }}
                    disabled={isValidatingKey || modelsStatus.state === 'loading'}
                  >
                    {modelsStatus.state === 'loading' ? 'Loading...' : 'Load models'}
                  </button>
                </div>

                {modelsStatus.message ? (
                  <p className={`model-status model-status-${modelsStatus.state}`}>{modelsStatus.message}</p>
                ) : null}

                {aiConfig.availableModels.length > 0 && modelsStatus.state !== 'error' ? (
                  <div className="model-suggestions">
                    {aiConfig.availableModels
                      .filter((model) => model.toLowerCase().includes(aiConfig.model.trim().toLowerCase()))
                      .slice(0, 60)
                      .map((model) => (
                        <button
                          type="button"
                          className="model-suggestion"
                          key={model}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => setAIConfig({ ...aiConfig, model })}
                        >
                          {model}
                        </button>
                      ))}
                  </div>
                ) : null}
              </div>
            </div>

            <label>
              API Key
              <input
                type="password"
                autoComplete="off"
                value={aiConfig.apiKey}
                onChange={(event) => {
                  const value = event.target.value;
                  writeStoredAIKey(aiConfig.provider, value);
                  setAIConfig((current) => ({ ...current, apiKey: value }));
                }}
                placeholder="Paste your API key"
              />
              <span className="field-hint">
                {aiConfig.provider === 'gemini' && aiConfig.hasServerKey && !aiConfig.apiKey.trim()
                  ? 'No key needed here — the server has a default Gemini key configured.'
                  : 'Kept only in this browser tab (session storage) and sent only with AI requests. Never saved on the server.'}
              </span>
            </label>

            {aiConfig.provider === 'openai' ? (
              <label>
                Base URL (optional)
                <input
                  value={aiConfig.baseUrl}
                  onChange={(event) => setAIConfig({ ...aiConfig, baseUrl: event.target.value })}
                  placeholder="https://api.openai.com/v1"
                />
                <span className="field-hint">
                  For OpenAI-compatible services such as OpenRouter, Groq or Mistral. Must be a public URL — internal and private network addresses are blocked.
                </span>
              </label>
            ) : null}

            <div className="ai-config-actions">
              <button type="button" className="primary-button" onClick={handleValidateAIConfig} disabled={isBusy || isValidatingKey}>
                {isValidatingKey ? 'Checking...' : 'Check Connection'}
              </button>

              <button type="button" className="secondary-button" onClick={handleSaveAIConfig} disabled={isBusy}>
                {isBusy ? 'Saving...' : 'Save Settings'}
              </button>
            </div>

            <div className={`status-pill ${aiConfig.isValid ? 'valid' : connectionMessage ? 'invalid' : ''}`}>
              <span className="status-dot" />
              {aiConfig.isValid ? 'Connection working' : connectionMessage ? 'Connection not working' : 'Not checked yet'}
            </div>

            {connectionMessage ? <p className="config-message">{connectionMessage}</p> : null}
          </div>
        </section>

        <section className="panel form-panel">
          <h2>AI Prompt Test</h2>
          <div className="project-form">
            <label>
              Prompt
              <textarea
                rows={5}
                value={promptText}
                onChange={(event) => setPromptText(event.target.value)}
                placeholder="Ask the configured model anything..."
              />
            </label>

            <button type="button" className="primary-button" onClick={handlePromptAI} disabled={isBusy || isPrompting}>
              {isPrompting ? 'Sending...' : 'Send Prompt'}
            </button>

            {promptResponse ? (
              <div className="prompt-response-box">
                <strong>Response</strong>
                <pre>{promptResponse}</pre>
              </div>
            ) : null}
          </div>
        </section>

        {error ? <div className="error-banner">{error}</div> : null}

        {selectedProject ? (
          <section className="panel planning-panel">
            <div className="panel-header">
              <h2>AI Planning Status</h2>
              <span className={`status-pill ${planningProgress.status === 'completed' ? 'valid' : planningProgress.status === 'error' ? 'invalid' : ''}`}>
                {planningProgress.status === 'completed' ? 'Completed' : planningProgress.status === 'error' ? 'Error' : planningProgress.status === 'exploring' ? 'Exploring' : 'Generating'}
              </span>
            </div>
            <p className="planning-message">{planningProgress.message}</p>
            {planningProgress.currentCase ? <p className="planning-case">Current: {planningProgress.currentCase}</p> : null}

            {planningProgress.generatedCases.length > 0 ? (
              <div className="progress-list">
                {planningProgress.generatedCases.map((item) => (
                  <div key={item.id} className="progress-item">
                    <span className="progress-dot" />
                    <span>{item.title}</span>
                    <span className="progress-tag">{item.status}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

        
        ) : null}

        <div className="content-grid with-sidebar">
          <section className="panel form-panel">
            <h2>Create Project</h2>
            <form onSubmit={handleCreateProject} className="project-form">
              <label>
                Project Name
                <input
                  value={projectForm.name}
                  onChange={(event) => setProjectForm({ ...projectForm, name: event.target.value })}
                  placeholder="OrangeHRM Demo"
                />
              </label>

              <label>
                Application URL
                <input
                  value={projectForm.applicationUrl}
                  onChange={(event) => setProjectForm({ ...projectForm, applicationUrl: event.target.value })}
                  placeholder="https://example.com"
                />
              </label>

              <label>
                Browser
                <select
                  value={projectForm.browser}

            
                  onChange={(event) => setProjectForm({ ...projectForm, browser: event.target.value })}
                >
                  <option>Chromium</option>
                  <option>Firefox</option>
                  <option>WebKit</option>
                </select>
              </label>

              <label>
                Application Description
                <textarea
                  value={projectForm.description}
                  onChange={(event) => setProjectForm({ ...projectForm, description: event.target.value })}
                  rows={3}
                  placeholder="Describe the application workflow"
                />
              </label>

              <label>
                Testing Requirements
                <textarea
                  value={projectForm.requirements}
                  onChange={(event) => setProjectForm({ ...projectForm, requirements: event.target.value })}
                  rows={5}
                  placeholder="User can login with valid credentials\nInvalid credentials show an error message"
                />
              </label>

              <button type="submit" className="primary-button" disabled={isBusy}>
                {isBusy ? 'Creating...' : 'Create Project'}
              </button>
            </form>
          </section>

          <section className="panel project-panel">
            <div className="panel-header">
              <h2>Projects</h2>
              {selectedProject ? (
                <button type="button" className="secondary-button" onClick={handlePlanTests} disabled={isBusy}>
                  {selectedProject.testCases.length > 0 ? 'Regenerate Plan' : 'Plan Tests'}
                </button>
              ) : null}
            </div>

            {selectedProject ? (
              <>
                <div className="project-summary">
                  <h3>{selectedProject.name}</h3>
                  <p>{selectedProject.applicationUrl}</p>
                  <p>{selectedProject.description || 'No description available yet.'}</p>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => window.open(selectedProject.applicationUrl, '_blank', 'noopener,noreferrer')}
                  >
                    Open URL in Browser
                  </button>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Scenario</th>
                        <th>Priority</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedProject.testCases.length === 0 ? (
                        <tr>
                          <td colSpan={4}>No generated test cases yet. Click “Plan Tests”.</td>
                        </tr>
                      ) : (
                        selectedProject.testCases.map((item) => (
                          <tr
                            key={item.testCaseId}
                            className={selectedCase?.testCaseId === item.testCaseId ? 'selected-row' : ''}
                            onClick={() => setSelectedCase(item)}
                          >
                            <td>{item.testCaseId}</td>
                            <td>{item.title}</td>
                            <td>{item.priority}</td>
                            <td>{item.status}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p>Select or create a project to begin planning.</p>
            )}
          </section>
        </div>

        {selectedCase && selectedProject ? (
          <section className="panel detail-panel">
            <div className="panel-header detail-header">
              <h2>{selectedCase.testCaseId} — {selectedCase.title}</h2>
              <div className="inline-actions">
                <button type="button" className="secondary-button" onClick={handleApproveCase} disabled={isBusy}>
                  {isBusy ? <span className="btn-spinner" /> : null}Approve
                </button>
                <button type="button" className="danger-button" onClick={handleDeleteCase} disabled={isBusy}>
                  {isBusy ? <span className="btn-spinner" /> : null}Delete
                </button>
              </div>
            </div>

            <div className="detail-form">
              <label>
                Title
                <input
                  value={selectedCase.title}
                  onChange={(event) => setSelectedCase({ ...selectedCase, title: event.target.value })}
                />
              </label>

              <label>
                Priority
                <select
                  value={selectedCase.priority}
                  onChange={(event) =>
                    setSelectedCase({ ...selectedCase, priority: event.target.value as TestCase['priority'] })
                  }
                >
                  <option>High</option>
                  <option>Medium</option>
                  <option>Low</option>
                </select>
              </label>

              <label>
                Type
                <select
                  value={selectedCase.type}
                  onChange={(event) => setSelectedCase({ ...selectedCase, type: event.target.value })}
                >
                  <option>Functional</option>
                  <option>Negative</option>
                  <option>Validation</option>
                  <option>Usability</option>
                </select>
              </label>

              <label>
                Status
                <select
                  value={selectedCase.status}
                  onChange={(event) =>
                    setSelectedCase({
                      ...selectedCase,
                      status: event.target.value as TestCase['status']
                    })
                  }
                >
                  <option>Draft</option>
                  <option>Approved</option>
                  <option>Rejected</option>
                </select>
              </label>

              <label>
                Preconditions
                <textarea
                  rows={3}
                  value={selectedCase.preconditions.join('\n')}
                  onChange={(event) =>
                    setSelectedCase({
                      ...selectedCase,
                      preconditions: event.target.value.split(/\n|\r\n/).map((item) => item.trim()).filter(Boolean)
                    })
                  }
                />
              </label>

              <label>
                Expected Result
                <textarea
                  rows={3}
                  value={selectedCase.expectedResult}
                  onChange={(event) => setSelectedCase({ ...selectedCase, expectedResult: event.target.value })}
                />
              </label>

              <label>
                Steps
                <textarea
                  rows={4}
                  value={selectedCase.steps.join('\n')}
                  onChange={(event) =>
                    setSelectedCase({
                      ...selectedCase,
                      steps: event.target.value.split(/\n|\r\n/).map((item) => item.trim()).filter(Boolean)
                    })
                  }
                />
              </label>

              <button type="button" className="primary-button" onClick={handlePatchCase} disabled={isBusy}>
                Save Changes
              </button>
            </div>
          </section>
        ) : null}

        {selectedProject ? (
          <>
            <section className="panel generator-panel">
              <div className="panel-header">
                <h2>Generator & Execution</h2>
                {selectedProject.testCases.some((item) => item.status === 'Approved') ? (
                  <button type="button" className="secondary-button" onClick={handleGenerateTests} disabled={isBusy}>
                    Generate Scripts
                  </button>
                ) : null}
              </div>

              {selectedProject.generatedFiles.length > 0 ? (
                <>
                  <div className="panel-header">
                    <h3>Generated playright files</h3>
                    <button type="button" className="primary-button" onClick={handleRunTests} disabled={isBusy}>
                      Run Tests
                    </button>
                  </div>
                  <ul className="file-list">
                    {selectedProject.generatedFiles.map((file) => (
                      <li key={file.id}>{file.fileName}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <p>Approve at least one test case to generate Playwright scripts.</p>
              )}

              {executionStatus.items.length > 0 ? (
                <div className="execution-progress-panel">
                  <div className="panel-header">
                    <h3>Execution status</h3>
                    <span className={`status-pill ${executionStatus.status === 'failed' ? 'invalid' : executionStatus.status === 'completed' ? 'valid' : ''}`}>
                      {executionStatus.status === 'failed' ? 'Failed' : executionStatus.status === 'completed' ? 'Passed' : 'Running'}
                    </span>
                  </div>
                  <div className="execution-list">
                    {executionStatus.items.map((item) => (
                      <div key={item.id} className={`execution-item ${item.status}`}>
                        <div className="execution-meta">
                          <span>{item.title}</span>
                          <span className="execution-badge">{item.status}</span>
                        </div>
                        <p>{item.output || 'Waiting for result...'}</p>
                      </div>
                    ))}
                  </div>
                  {executionStatus.output ? <pre className="execution-output-log">{executionStatus.output}</pre> : null}
                </div>
              ) : null}

              {selectedProject.lastExecution ? (
                <div className="execution-output">
                  <strong>Execution status:</strong> {selectedProject.lastExecution.success ? 'Passed' : 'Failed'}
                  <pre>{selectedProject.lastExecution.output}</pre>
                </div>
              ) : null}
            </section>

            <section className="panel generator-panel">
              <div className="panel-header">
                <h2>Self-Healing Center</h2>
                <button type="button" className="secondary-button" onClick={handleAnalyzeHealing} disabled={isBusy}>
                  Analyze Failure
                </button>
              </div>

              {selectedProject.healingHistory.length > 0 ? (
                <>
                  <div className="healing-box">
                    <strong>{(selectedHealing ?? selectedProject.healingHistory[0]).testCaseId}</strong>
                    <p>{(selectedHealing ?? selectedProject.healingHistory[0]).reason}</p>
                    <pre>{(selectedHealing ?? selectedProject.healingHistory[0]).originalLocator}</pre>
                    <pre>{(selectedHealing ?? selectedProject.healingHistory[0]).candidateReplacement}</pre>

                    <div className="repair-progress-wrap">
                      <div className="repair-progress-track">
                        <div
                          className={`repair-progress-fill ${repairStatus.tone}`}
                          style={{ width: `${repairStatus.percent}%` }}
                        />
                      </div>
                      <p className={`repair-status ${repairStatus.tone}`}>{repairStatus.message}</p>
                    </div>

                    <button
                      type="button"
                      className="primary-button"
                      onClick={handleApplyHealing}
                      disabled={isBusy || repairStatus.isApplying}
                    >
                      {repairStatus.isApplying ? 'Applying Repair...' : 'Apply Repair'}
                    </button>
                  </div>
                </>
              ) : (
                <p>Run a failed test to inspect candidate repairs.</p>
              )}

              <div className="action-note-box">
                <strong>Next action:</strong>
                <span>{actionNote}</span>
              </div>
            </section>

            <section className="panel generator-panel">
              <div className="panel-header">
                <h2>Reports</h2>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button type="button" className="secondary-button" onClick={handleGenerateReport} disabled={isBusy || selectedProject.testCases.length === 0}>
                    {isBusy ? <span className="btn-spinner" /> : null}Generate Report
                  </button>
                  
                </div>
              </div>

              <div className="report-grid">
                <div>
                  <strong>Total test cases:</strong> {selectedProject.testCases.length}
                </div>
                <div>
                  <strong>Approved:</strong> {selectedProject.testCases.filter((item) => item.status === 'Approved').length}
                </div>
                <div>
                  <strong>Generated scripts:</strong> {selectedProject.generatedFiles.length}
                </div>
                <div>
                  <strong>Healing history:</strong> {selectedProject.healingHistory.length}
                </div>
              </div>

              <p className="report-note">{nextActionNote}</p>

              {reportRows.length > 0 ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Test Case</th>
                        <th>Title</th>
                        <th>Status</th>
                        <th>Browser</th>
                        <th>Duration</th>
                        <th>Steps Performed</th>
                        <th>Expected</th>
                        <th>Actual</th>
                        <th>Test Data</th>
                        <th>Screenshot</th>
                        <th>Executed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportRows.map((row) => (
                        <tr key={`${row.testCaseId}-${row.executedAt}`}>
                          <td>{row.testCaseId}</td>
                          <td>{row.title}</td>
                          <td>{row.status}</td>
                          <td>{row.browser}</td>
                          <td>{row.durationMs} ms</td>
                          <td>{row.stepsPerformed || 'No steps recorded'}</td>
                          <td>{row.expectedResult || 'No expected result defined'}</td>
                          <td>{row.actualResult || 'No actual result available'}</td>
                          <td>{row.testData || 'No test data used'}</td>
                          <td>
                            {row.screenshot ? (
                              <a href={row.screenshot} target="_blank" rel="noreferrer">View</a>
                            ) : (
                              'No screenshot'
                            )}
                          </td>
                          <td>{new Date(row.executedAt).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="empty-report">Run the suite once to populate the Allure-style execution report table.</p>
              )}
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
