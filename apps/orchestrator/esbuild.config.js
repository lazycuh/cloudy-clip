import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/process-requests.ts'],
  bundle: true,
  outdir: 'dist',
  platform: 'node',
  format: 'esm',
  minify: true,
  define: {
    __UPSTREAM__: JSON.stringify(process.env.TRADE_TIMELINE_UPSTREAM),
    __ENVIRONMENT__: JSON.stringify(process.env.TRADE_TIMELINE_ENVIRONMENT),
    __ACCESS_CONTROL_ALLOW_ORIGIN__: JSON.stringify(process.env.TRADE_TIMELINE_ACCESS_CONTROL_ALLOW_ORIGIN)
  }
});
