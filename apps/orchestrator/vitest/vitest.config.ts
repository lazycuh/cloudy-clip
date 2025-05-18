import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  define: {
    __ACCESS_CONTROL_ALLOW_ORIGIN__: JSON.stringify('https://localhost:4300'),
    __ENVIRONMENT__: JSON.stringify('test'),
    __UPSTREAM__: JSON.stringify('http://localhost:8282')
  },
  test: {
    disableConsoleIntercept: true,
    poolOptions: {
      workers: {
        wrangler: { configPath: '../wrangler.toml' }
      }
    }
  }
});
