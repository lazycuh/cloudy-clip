/**
 * Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
 * MY_KV_NAMESPACE: KVNamespace;
 *
 * Example binding to Durable Object. Learn more at
 * https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
 * MY_DURABLE_OBJECT: DurableObjectNamespace;
 *
 * Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
 * MY_BUCKET: R2Bucket;
 *
 * Example binding to a Service. Learn more at https://developers.cloudflare.com/workers/runtime-apis/service-bindings/
 * MY_SERVICE: Fetcher;
 *
 * Example binding to a Queue. Learn more at https://developers.cloudflare.com/queues/javascript-apis/
 * MY_QUEUE: Queue;
 */

/**
 * These will be copied onto `env` object imported from `node:process`
 */
interface Env {
  ENVIRONMENT: string;
  UPSTREAM: string;
}

// declare namespace NodeJS {
//   export interface ProcessEnv {}
// }

declare const __ENVIRONMENT__: 'development' | 'production' | 'staging';
declare const __ACCESS_CONTROL_ALLOW_ORIGIN__: 'https://localhost:4300' | 'https://cloudyclip.com';
declare const __UPSTREAM__: 'http://localhost:8282';
