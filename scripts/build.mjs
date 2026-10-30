import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
await mkdir('lib', { recursive: true });
await build({ entryPoints: ['src/index.ts'], outdir: 'lib', bundle: true, platform: 'node', format: 'esm', target: 'node24', packages: 'external', sourcemap: true });
await build({ entryPoints: ['src/client.tsx'], outfile: 'lib/client.js', bundle: true, platform: 'browser', format: 'cjs', target: 'es2022', jsx: 'automatic', external: ['react', 'react/jsx-runtime', '@deepseek-ai/dsh-client-ui-primitives'],
  loader: { '.css': 'text' },
  banner: { js: 'window.__ModuleLoader__.load({id:"dsh-skill-prompt-injector",factory:(require)=>{var module={exports:{}};var exports=module.exports;' },
  footer: { js: 'return module.exports;}});' }
});
