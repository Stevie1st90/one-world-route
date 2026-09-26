import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

for (const script of [
  'build-flight-geometries.mjs',
  'validate-public-data.mjs',
  'validate-platform-data.mjs',
  'audit-route-continuity.mjs',
  'audit-flagship-readiness.mjs',
  'build-flagship-operations-queue.mjs',
  'build-trip-index.mjs',
  'build-bundles.mjs',
  'generate-seo.mjs',
]) {
  const scriptUrl = new URL(`./${script}`, import.meta.url);
  const scriptPath = fileURLToPath(scriptUrl);

  const result = spawnSync(
    process.execPath,
    [scriptPath],
    { stdio: 'inherit' }
  );

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log('ONE WORLD ROUTE release build complete');
