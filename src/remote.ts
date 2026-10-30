import { z } from 'zod';
import { createTypertRemoteInfo } from '@deepseek-ai/dsh-typert-protocol/remote-info';
import { catalogSchema, changeSchema, stateSchema } from './model.js';

export const PACKAGE = 'dsh-skill-prompt-injector';
const codec = <T extends z.ZodType>(schema: T) => ({ mode: 'strict' as const, typeSymbol: `${PACKAGE}#value`, create: () => schema, jsonSchema: z.toJSONSchema(schema) });
export const sessionRequestSchema = z.object({ sessionId: z.string().min(1) }).strict();
function parameter<T extends z.ZodType>(schema: T) { const value = codec(schema); return { name: 'request', source: 'json' as const, codec: value, strictCodec: value }; }
export const remoteInfo = createTypertRemoteInfo({ package: PACKAGE, methods: {
  'skillDashboard/health': {
    service: 'skillDashboard', invocation: { kind: 'direct' }, parameters: [],
    result: codec(z.object({ version: z.string() })),
  },
  'skillDashboard/read': { service: 'skillDashboard', invocation: { kind: 'direct' }, parameters: [], result: codec(stateSchema) },
  'skillDashboard/change': { service: 'skillDashboard', invocation: { kind: 'direct' }, parameters: [parameter(changeSchema)], result: codec(stateSchema) },
  'skillDashboard/catalog': { service: 'skillDashboard', invocation: { kind: 'direct' }, parameters: [parameter(sessionRequestSchema)], cancellation: { parameter: 'signal' }, result: codec(catalogSchema) },
} }, z);

type Result<T> = { ok: true; value: T } | { ok: false; error: { message: string; code: string } };
export interface DashboardRemote {
  read(): Promise<Result<z.infer<typeof stateSchema>>>;
  change(request: z.infer<typeof changeSchema>): Promise<Result<z.infer<typeof stateSchema>>>;
  catalog(request: z.infer<typeof sessionRequestSchema>, signal?: AbortSignal): Promise<Result<z.infer<typeof catalogSchema>>>;
}
export function unwrap<T>(result: Result<T>): T { if (!result.ok) throw new Error(result.error.message); return result.value; }
