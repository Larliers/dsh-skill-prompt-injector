import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
await build({ entryPoints: ['src/model.ts', 'src/storage.ts', 'src/client-state.ts', 'src/index.ts'], outdir: '.cache/test', bundle: true, format: 'esm', platform: 'node', packages: 'external', target: 'node22' });
const result = spawnSync(process.execPath, ['--test', 'test/storage.test.mjs', 'test/selection.test.mjs', 'test/host.test.mjs'], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
