# TestPilot AI

Phase 0 foundation for the TestPilot AI project described in the roadmap.

## Stack

- Frontend: React + TypeScript + Vite
- Backend: Node.js + Express + TypeScript
- Workspaces: npm workspaces

## Scripts

```bash
npm install
npm run dev
npm run build
```

## Project layout

- `apps/web` — React frontend
- `apps/server` — Express API server

## AI providers

The AI Configuration screen (Settings) supports two provider types. Only the **Planner** agent uses AI; the **Generator** and **Healer** agents are deterministic and run entirely locally without any AI API calls.

| Provider | API format | Model discovery | Notes |
| --- | --- | --- | --- |
| Google Gemini | Native Gemini `generateContent` API | Yes (`/v1beta/models`) | Works with a browser-supplied key, or the optional server-side `GEMINI_API_KEY` environment variable as a default. |
| OpenAI-compatible | OpenAI `chat/completions` + `/models` | Yes | Works with OpenAI directly (default base URL `https://api.openai.com/v1`) and with OpenAI-compatible services (OpenRouter, Groq, Mistral, DeepSeek, ...) via a custom **Base URL**. |

**Not supported** (different, incompatible API formats): Anthropic Claude, Azure OpenAI (deployment-specific URLs and auth), Google Vertex AI, and any service that does not implement the OpenAI-compatible chat completions API.

### API key handling

- Keys entered in the UI are kept in the browser tab only (session storage) and are sent to the server only for the AI request that needs them.
- The server never stores keys in `settings.json`, never returns them in API responses, and redacts them from error messages.
- `GEMINI_API_KEY` (and optional `GEMINI_MODEL`) on the server act only as a **default for the Gemini provider** when the browser sends no key. Remove the variable if you do not want visitors to be able to use your server-side key.
- Custom OpenAI-compatible base URLs must be public `http(s)` addresses; requests to internal, loopback, link-local (including cloud metadata) addresses are blocked.
