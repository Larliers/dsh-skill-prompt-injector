import { test } from 'node:test';
import assert from 'node:assert/strict';
import { draftEnd, emptyLibrary, emptyPrompts, resolveItems, reorder, parseTags, textToAppend } from '../.cache/test/model.js';
import { createClientState } from '../.cache/test/client-state.js';

const a = { kind: 'skill', id: 'source-a/review', name: 'review', origin: 'source-a' };
const p = { kind: 'prompt', id: 'p', title: '旧名称' };
const skills = [{ ...a, description: '', source: 'user-dsh', provider: 'filesystem' }];
function state(body = '最新正文') { return { prompts: { ...emptyPrompts(), prompts: [{ id: 'p', title: '最新名称', body, tags: [], favorite: false }] }, library: emptyLibrary() }; }
test('多个 Skill 只用单换行分隔，不额外插入空白行', () => {
  const second = { ...a, id: 'source-a/grill-me', name: 'grill-me' };
  assert.equal(resolveItems([a, second], state(), [...skills, { ...skills[0], ...second }]).text, '/review\n/grill-me');
});
test('组合按调整后顺序使用最新正文，同名异源与已删除 Prompt 保留缺项', () => {
  assert.deepEqual(resolveItems(reorder([a, p], 0, 1), state(), skills), { text: '最新正文\n/review', missing: [] });
  const wrongSource = [{ ...skills[0], id: 'source-b/review' }];
  assert.deepEqual(resolveItems([a], state(), wrongSource).missing, [a]);
  assert.deepEqual(resolveItems([p], { ...state(), prompts: emptyPrompts() }, skills).missing, [p]);
});
test('连接已有草稿只补必要的换行，保留 Prompt 内部排版', () => {
  const content = resolveItems([a,p], state('第一段\n\n第二段'), skills).text;
  assert.equal('任务说明' + textToAppend('任务说明', content), '任务说明\n/review\n第一段\n\n第二段');
  assert.equal(textToAppend('', '/review'), '/review');
  assert.equal(textToAppend('任务说明\n', '/review'), '/review');
  assert.equal(textToAppend('任务说明\r\n', '/review'), '/review');
  assert.equal(textToAppend('任务说明', '\n正文'), '\n正文');
});
test('多个会话的选择与筛选隔离，共享库独立', () => {
  const client = createClientState(); const one = client.forSession('one'); const two = client.forSession('two');
  one.set({ ...one.getSnapshot(), items: [a, p], query: 'review' });
  assert.deepEqual(two.getSnapshot().items, []); assert.equal(two.getSnapshot().query, '');
  assert.deepEqual(client.forSession('one').getSnapshot().items, [a,p]);
  client.library.set(state()); assert.equal(client.library.getSnapshot().prompts.prompts[0].body, '最新正文');
  one.set({ ...one.getSnapshot(), items: [] }); assert.equal(client.library.getSnapshot().prompts.prompts.length, 1);
});
test('草稿末尾坐标保留 Unicode 与引用胶囊，锁定状态拒绝写入', () => {
  const draft = '😀 请检查 @long-filename.md 与 @session-reference';
  const occurrences = [{ length: '@long-filename.md'.length }, { length: '@session-reference'.length }];
  assert.equal(draftEnd({ draft, occurrences, phase: 'plain' }), '😀 请检查 \uFFFC 与 \uFFFC'.length);
  for (const phase of ['claimed','adjudicating','submitting']) assert.throws(() => draftEnd({ draft, occurrences, phase }), /当前处于/);
  assert.deepEqual(parseTags('开发，开发, QA；写作'), ['开发','QA','写作']);
});
