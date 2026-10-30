import { Context } from '@deepseek-ai/cordis';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type {} from '@deepseek-ai/dsh-api-session-controller';
import type {} from '@deepseek-ai/dsh-skill';
import type {} from '@deepseek-ai/dsh-working-directory';
import type {} from '@deepseek-ai/dsh-agent-preset-registry';
import type {} from '@deepseek-ai/dsh-session-query';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { TypertRegistry } from '@deepseek-ai/dsh-typert-registry';
import { PACKAGE, remoteInfo, sessionRequestSchema } from './remote.js';
import { JsonStorage } from './storage.js';
import type { Catalog, Change } from './model.js';

export const name = PACKAGE;
export const inject = ['typert'];
const defaultDataDirectory = resolve(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'skill-prompt-injector');
export const Config = z.object({ dataDirectory: z.string().default(defaultDataDirectory) }).default({ dataDirectory: defaultDataDirectory });
export type Config = z.infer<typeof Config>;
export class DashboardService extends TypertRemoteService {
  readonly storage: JsonStorage;
  constructor(ctx: Context, config: Config) { super(ctx, 'skillDashboard'); this.storage = new JsonStorage(resolve(config.dataDirectory)); }
  @Remote
  async health() { return { version: '0.1.1' }; }
  @Remote
  async read() { return this.storage.load(); }
  @Remote
  async change(request: Change) { return this.storage.change(request); }
  @Remote({ resources: { session: (request: { sessionId: SessionId }) => request.sessionId } })
  async catalog(request: { sessionId: SessionId }, signal?: AbortSignal): Promise<Catalog> {
    sessionRequestSchema.parse(request);
    const { sessionId } = request;
    const query = this.ctx.get('sessionQuery');
    const agents = this.ctx.get('agents');
    const workingDirectory = this.ctx.get('workingDirectory');
    if (!query) throw new Error('Harness 会话目录服务尚未就绪，请稍后刷新');
    const observation = await query.observeSession(sessionId);
    let cwd: string | undefined; let preset: string | undefined;
    try {
      cwd = observation.projections?.values.workingDirectory ?? observation.header.cwd ?? workingDirectory?.defaultDirectory;
      preset = observation.projections?.values.agentPreset ?? undefined;
    } finally { observation[Symbol.dispose](); }
    const live = agents?.get(sessionId);
    if (live && workingDirectory) cwd = await workingDirectory.ensure(live, signal);
    const presets = this.ctx.get('agentPresets');
    const registry = (live ? presets?.serviceFor(live, 'skills') : undefined) ?? this.ctx.get('skills');
    if (!registry) throw new Error('当前 Harness 组合未提供 Skill 注册表，请启用 Skill 功能后刷新');
    const lease = live ? undefined : await presets?.acquireScope(preset);
    try {
      signal?.throwIfAborted();
      const snapshot = await registry.snapshot({ cwd, scope: live ?? lease?.key, signal });
      signal?.throwIfAborted();
      return { complete: snapshot.complete, skills: snapshot.skills.filter(s => s.invocation.userInvocable).map(s => {
        const path = s.path?.replace(/\\/g, '/');
        const location = path ?? JSON.stringify([cwd, preset, s.resourceBase ?? null]);
        const id = JSON.stringify([s.name, s.provider, s.source, /^[A-Za-z]:\//.test(location) ? location.toLowerCase() : location]);
        return { id, name: s.name, description: s.description, provider: s.provider, source: s.source, origin: `${s.provider} · ${s.source}`, ...(path ? { path } : {}), ...(s.whenToUse ? { whenToUse: s.whenToUse } : {}) };
      }) };
    } finally { await lease?.[Symbol.asyncDispose](); }
  }
}
export function apply(ctx: Context, config?: Partial<Config>) {
  const resolved = Config.parse(config ?? {});
  (ctx.typert as TypertRegistry).register({ package: PACKAGE, face: 'host', schemas: [], invocations: remoteInfo.descriptors, model: { services: [], events: [], objects: [] } });
  ctx.plugin(DashboardService, resolved);
}
