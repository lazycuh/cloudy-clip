/* eslint-disable vitest/require-top-level-describe */
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll } from 'vitest';

/**
 * Should be called inside a `describe` block to set up an
 * [HTTP request mock](https://mswjs.io/docs/getting-started/mocks/rest-api#request-handler)
 */
export function startMockingApiRequests(urlsToIgnore: string[] = []) {
  const server = setupServer();

  beforeAll(() => {
    if (urlsToIgnore.length === 0) {
      server.listen();
    } else {
      server.listen({
        onUnhandledRequest: ({ method, url }) => {
          if (!urlsToIgnore.some(urlToIgnore => url.includes(urlToIgnore))) {
            const unhandledRequestWarning = `
            |[MSW] Error: captured a request without a matching request handler:
            |
            |  • ${method} ${url}
            `
              .trim()
              .replace(/\s*\|/g, '\n');

            console.error(unhandledRequestWarning);

            throw new Error(unhandledRequestWarning);
          }
        }
      });
    }
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  return server;
}
