import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import { Context } from '@deepseek-ai/cordis';
import TypertRegistry from '@deepseek-ai/dsh-typert-registry';
import SystemPrompt from '@deepseek-ai/dsh-system-prompt';
import * as plugin from '../.cache/test/index.js';

const cache = resolve('.cache');
const SECTION = 'dsh-skill-prompt-injector:global';

test('全局注入作为系统提示段进入组装结果，停用后消失', async t => {
  await mkdir(cache, { recursive: true });
  const dir = await mkdtemp(join(cache, 'prompt-test-'));
  t.after(async () => { const target = resolve(dir); assert.ok(target.startsWith(cache + sep)); await rm(target, { recursive: true, force: true }); });
  const ctx = new Context();
  const typert = await ctx.plugin(TypertRegistry);
  const prompt = await ctx.plugin(SystemPrompt);
  const fiber = await ctx.plugin(plugin, { dataDirectory: dir });
  try {
    const service = ctx.get('skillDashboard');
    assert.equal((await service.health()).systemPrompt, true, '宿主提供了系统提示服务时应报告可用');

    await service.change({ type: 'prompt.save', revision: 0, prompt: { title: '代码审查', body: '先看 diff 再动刀', tags: [], favorite: false } });
    const saved = await service.read();
    const id = saved.prompts.prompts[0].id;
    const items = [{ kind: 'prompt', id, title: '代码审查' }];
    await service.change({ type: 'global.save', revision: 0, global: { enabled: true, items, skillFacts: {} } });
    // 可选注入是异步挂载的，给一个拍子
    await new Promise(done => setTimeout(done, 50));

    const assembly = await ctx.systemPrompt.assemble();
    const section = assembly.sections.find(entry => entry.name === SECTION);
    assert.ok(section, '全局段应注册到系统提示');
    assert.match(section.text, /代码审查/);
    assert.match(section.text, /先看 diff 再动刀/);

    await service.change({ type: 'global.save', revision: 1, global: { enabled: false, items, skillFacts: {} } });
    const off = await ctx.systemPrompt.assemble();
    const offSection = off.sections.find(entry => entry.name === SECTION);
    assert.ok(!offSection || offSection.text === '', '停用后不再贡献文本');
  } finally { await fiber.dispose(); await prompt.dispose(); await typert.dispose(); }
});
