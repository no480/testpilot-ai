import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { test } from 'node:test';

import { httpServer, startServer } from './app.js';

test('startServer retries with the next free port when the default port is busy', async () => {
  const preferredPort = 41000 + Math.floor(Math.random() * 1000);
  const blocker = createServer();

  await new Promise<void>((resolve) => {
    blocker.listen(preferredPort, () => resolve());
  });

  const port = await startServer(preferredPort);

  assert.equal(port, preferredPort + 1);

  await new Promise<void>((resolve, reject) => {
    if (httpServer) {
      httpServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
      return;
    }

    resolve();
  });

  await new Promise<void>((resolve, reject) => {
    blocker.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
});
