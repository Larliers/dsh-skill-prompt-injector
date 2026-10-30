import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, readdir, rm, rmdir } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import { JsonStorage } from '../.cache/test/storage.js';

const cache = resolve('.cache');
async function fixture(t) {
  await mkdir(cache, { recursive: true });
  const dir = await mkdtemp(join(cache, 'storage-test-'));
  t.after(async () => { const target = resolve(dir); assert.ok(target.startsWith(cache + sep)); await rm(target, { recursive: true, force: true }); });
  return { dir, store: new JsonStorage(dir) };
}
const prompt = { title: '检查边界', body: '保留原文\n\n逐项检查。  ', tags: ['开发'], favorite: false };
test('Prompt 保存、重启读取、备份与组合引用保持独立', async t => {
  const { dir, store } = await fixture(t);
  const empty = await store.load();
  const first = await store.change({ type: 'prompt.save', revision: empty.prompts.revision, prompt });
  assert.equal(first.prompts.prompts[0].body, prompt.body);
  const id = first.prompts.prompts[0].id;
  await store.change({ type: 'combination.save', revision: 0, combination: { name: '日常检查', items: [{ kind: 'prompt', id, title: prompt.title }] } });
  const restarted = await new JsonStorage(dir).load();
  assert.equal(restarted.library.combinations[0].items[0].id, id);
  const rawBefore = await readFile(join(dir, 'prompts.json'), 'utf8');
  await store.change({ type: 'prompt.save', revision: 1, prompt: { ...prompt, id, body: '最新正文' } });
  assert.equal(await readFile(join(dir, 'prompts.json.bak'), 'utf8'), rawBefore);
  assert.equal((await store.load()).library.combinations[0].items[0].id, id);
  assert.ok(!(await readFile(join(dir, 'library.json'), 'utf8')).includes('最新正文'));
});
test('并发过期写入拒绝且失败不阻塞后续保存', async t => {
  const { store } = await fixture(t); await store.load();
  const writes = await Promise.allSettled([
    store.change({ type: 'prompt.save', revision: 0, prompt }),
    store.change({ type: 'prompt.save', revision: 0, prompt: { ...prompt, title: '另一个窗口' } }),
  ]);
  assert.equal(writes.filter(r => r.status === 'fulfilled').length, 1);
  assert.match(writes.find(r => r.status === 'rejected').reason.message, /其他窗口/);
  const next = await store.change({ type: 'prompt.save', revision: 1, prompt: { ...prompt, title: '有效重试' } });
  assert.equal(next.prompts.prompts.length, 2);
});
test('损坏 JSON 不重置、不覆盖原文件或有效备份', async t => {
  const { dir, store } = await fixture(t); await store.load();
  await writeFile(join(dir, 'prompts.json'), '{ broken');
  await writeFile(join(dir, 'prompts.json.bak'), 'valid backup stays');
  await assert.rejects(store.load(), /原文件已保留/);
  await assert.rejects(store.change({ type: 'prompt.save', revision: 0, prompt }), /原文件已保留/);
  assert.equal(await readFile(join(dir, 'prompts.json'), 'utf8'), '{ broken');
  assert.equal(await readFile(join(dir, 'prompts.json.bak'), 'utf8'), 'valid backup stays');
});
test('备份写入失败时原数据完整，临时文件清理且可恢复', async t => {
  const { dir, store } = await fixture(t); await store.load();
  const before = await readFile(join(dir, 'prompts.json'), 'utf8');
  await mkdir(join(dir, 'prompts.json.bak'));
  await assert.rejects(store.change({ type: 'prompt.save', revision: 0, prompt }));
  assert.equal(await readFile(join(dir, 'prompts.json'), 'utf8'), before);
  assert.equal((await readdir(dir)).filter(n => n.endsWith('.tmp')).length, 0);
  await rmdir(join(dir, 'prompts.json.bak'));
  assert.equal((await store.change({ type: 'prompt.save', revision: 0, prompt })).prompts.revision, 1);
});
test('重复组合引用与空白正文被拒绝，不产生修改', async t => {
  const { store } = await fixture(t); const state = await store.load();
  const ref = { kind: 'prompt', id: 'p', title: 'p' };
  await assert.rejects(store.change({ type: 'combination.save', revision: 0, combination: { name: '重复', items: [ref, ref] } }));
  await assert.rejects(store.change({ type: 'prompt.save', revision: 0, prompt: { ...prompt, body: '   ' } }));
  assert.deepEqual(await store.load(), state);
});
