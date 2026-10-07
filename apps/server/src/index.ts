import { port, startServer } from './app.js';

startServer(port).catch((error) => {
  console.error('Failed to start TestPilot AI API:', error);
  process.exit(1);
});
