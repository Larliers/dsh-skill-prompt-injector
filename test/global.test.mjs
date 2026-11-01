import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import { JsonStorage } from '../.cache/test/storage.js';
import { missingRefs, renderGlobal, resolveGlobal } from '../.cache/test/model.js';

const cache = resolve('.cache');
function state({ enabled = true, items = [], skillFacts = {}, prompts = [] } = {}) {
  return {
    prompts: { schemaVersion: 1, revision: 0, prompts },
    library: { schemaVersion: 1, revision: 0, skillMeta: [], combinations: [], global: { enabled, items, skillFacts } },
  };
}
const skillRef = { kind: 'skill', id: 'skill:1', name: 'codebase-design', origin: 'filesystem · user-agents' };
const promptRef = { kind: 'prompt', id: 'p1', title: '代码审查' };

test('没有条目或已停用时渲染空串', () => {
  assert.equal(renderGlobal(null), '');
  assert.equal(renderGlobal(state()), '');
  assert.equal(renderGlobal(state({ enabled: false, items: [promptRef], prompts: [{ id: 'p1', title: '代码审查', body: '先看 diff', tags: [], favorite: false }] })), '');
});

test('Prompt 正文按行缩进，标题进入小标题', () => {
  const text = renderGlobal(state({ items: [promptRef], prompts: [{ id: 'p1', title: '代码审查', body: '先看 diff\n再动刀', tags: [], favorite: false }] }));
  assert.match(text, /## 全局注入/);
  assert.match(text, /### 提示词/);
  assert.match(text, /- 代码审查\n {2}先看 diff\n {2}再动刀/);
  assert.ok(!text.includes('### 技能'));
});

test('Skill 用快照渲染名称、描述与路径', () => {
  const text = renderGlobal(state({ items: [skillRef], skillFacts: { 'skill:1': { description: '深层模块词汇', path: 'C:/skills/codebase-design/SKILL.md' } } }));
  assert.match(text, /### 技能/);
  assert.match(text, /- codebase-design：深层模块词汇/);
  assert.match(text, / {2}路径：C:\/skills\/codebase-design\/SKILL\.md/);
});

test('Skill 没有快照时只写名称，且在视图里标记为缺快照', () => {
  const view = resolveGlobal(state({ items: [skillRef] }));
  assert.equal(view.entries[0].missing, 'skill');
  assert.match(view.text, /- codebase-design\n?$/);
});

test('Prompt 被删除时跳过正文，其余条目照常渲染', () => {
  const kept = { kind: 'prompt', id: 'p2', title: '保留' };
  const view = resolveGlobal(state({ items: [promptRef, kept], prompts: [{ id: 'p2', title: '保留', body: '还在', tags: [], favorite: false }] }));
  assert.deepEqual(view.missing.map(ref => ref.id), ['p1']);
  assert.ok(!view.text.includes('代码审查'));
  assert.match(view.text, /- 保留\n {2}还在/);
});

test('Skill 目录读取失败时，只有被删的 Prompt 算缺项', () => {
  const asked = [{ id: 'p1', title: '代码审查', body: '先看 diff', tags: [], favorite: false }];
  const alive = state({ prompts: asked });
  assert.deepEqual(missingRefs([skillRef, promptRef], alive, [], { catalogFailed: true }), []);
  // 正常状态下，Skill 不在当前会话目录里就算缺项
  assert.equal(missingRefs([skillRef, promptRef], alive, []).length, 1);
  // 目录失败也不会掩盖真的被删掉的 Prompt
  assert.deepEqual(missingRefs([skillRef, promptRef], state(), [], { catalogFailed: true }).map(ref => ref.id), ['p1']);
});

test('全局注入保存、重启读取与 revision 递增', async t => {  await mkdir(cache, { recursive: true });
  const dir = await mkdtemp(join(cache, 'global-test-'));
  t.after(async () => { const target = resolve(dir); assert.ok(target.startsWith(cache + sep)); await rm(target, { recursive: true, force: true }); });
  const store = new JsonStorage(dir);
  const empty = await store.load();
  assert.deepEqual(empty.library.global, { enabled: true, items: [], skillFacts: {} });
  const saved = await store.change({ type: 'global.save', revision: 0, global: { enabled: false, items: [promptRef], skillFacts: { 'skill:1': { description: '快照' } } } });
  assert.equal(saved.library.global.enabled, false);
  assert.equal(saved.library.revision, 1);
  const restarted = await new JsonStorage(dir).load();
  assert.equal(restarted.library.global.items[0].id, 'p1');
  assert.equal(restarted.library.global.skillFacts['skill:1'].description, '快照');
  assert.equal(restarted.library.global.enabled, false);
});

test('旧数据缺 global 字段时补默认值', async t => {
  await mkdir(cache, { recursive: true });
  const dir = await mkdtemp(join(cache, 'global-legacy-'));
  t.after(async () => { const target = resolve(dir); assert.ok(target.startsWith(cache + sep)); await rm(target, { recursive: true, force: true }); });
  await writeFile(join(dir, 'library.json'), JSON.stringify({ schemaVersion: 1, revision: 3, skillMeta: [], combinations: [] }), 'utf8');
  const loaded = await new JsonStorage(dir).load();
  assert.deepEqual(loaded.library.global, { enabled: true, items: [], skillFacts: {} });
  assert.equal(loaded.library.revision, 3);
});
