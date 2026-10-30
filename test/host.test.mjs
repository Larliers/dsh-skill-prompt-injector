import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Context } from '@deepseek-ai/cordis';
import TypertRegistry from '@deepseek-ai/dsh-typert-registry';
import * as plugin from '../.cache/test/index.js';

test('无 config 的标准 Cordis 安装可以启动，Prompt 服务不依赖 Skill 服务', async () => {
  const ctx = new Context();
  const registry = await ctx.plugin(TypertRegistry);
  const fiber = await ctx.plugin(plugin);
  try {
    const service = ctx.get('skillDashboard');
    assert.ok(service, '默认安装必须提供宿主 Remote 服务');
    assert.deepEqual(await service.health(), { version: '0.1.0' });
    assert.ok(service.storage.directory.endsWith('data'));
    await assert.rejects(service.catalog({ sessionId: 'qa' }), /会话目录服务尚未就绪/);
  } finally { await fiber.dispose(); await registry.dispose(); }
});
