import { z } from 'zod';

const title = z.string().trim().min(1, '标题不能为空').max(120);
const tags = z.array(z.string().trim().min(1).max(80)).max(32);
export const promptSchema = z.object({ id: z.string().min(1), title, body: z.string().min(1).max(65536).refine(v => !!v.trim(), '正文不能为空').refine(v => !v.includes('\uFFFC'), '正文不能包含编辑器占位符'), tags, favorite: z.boolean() }).strict();
export const skillRefSchema = z.object({ kind: z.literal('skill'), id: z.string().min(1), name: z.string().min(1), origin: z.string() }).strict();
export const promptRefSchema = z.object({ kind: z.literal('prompt'), id: z.string().min(1), title: z.string() }).strict();
export const refSchema = z.discriminatedUnion('kind', [skillRefSchema, promptRefSchema]);
export const refsSchema = z.array(refSchema).max(200).refine(items => new Set(items.map(refKey)).size === items.length, '组合中不能包含重复条目');
export const combinationSchema = z.object({ id: z.string().min(1), name: title, items: refsSchema.refine(v => v.length > 0, '组合不能为空'), updatedAt: z.string() }).strict();
const metaSchema = z.object({ id: z.string().min(1), name: z.string(), tags, favorite: z.boolean() }).strict();
export const promptsFileSchema = z.object({ schemaVersion: z.literal(1), revision: z.number().int().nonnegative(), prompts: z.array(promptSchema) }).strict().refine(v => new Set(v.prompts.map(p => p.id)).size === v.prompts.length, 'Prompt ID 重复');
export const libraryFileSchema = z.object({ schemaVersion: z.literal(1), revision: z.number().int().nonnegative(), skillMeta: z.array(metaSchema), combinations: z.array(combinationSchema) }).strict()
  .refine(v => new Set(v.skillMeta.map(p => p.id)).size === v.skillMeta.length, 'Skill 标记 ID 重复')
  .refine(v => new Set(v.combinations.map(p => p.id)).size === v.combinations.length, '组合 ID 重复');
export const stateSchema = z.object({ prompts: promptsFileSchema, library: libraryFileSchema });
const revision = z.number().int().nonnegative();
export const changeSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('prompt.save'), revision, prompt: promptSchema.omit({ id: true }).extend({ id: z.string().optional() }) }).strict(),
  z.object({ type: z.literal('prompt.delete'), revision, id: z.string() }).strict(),
  z.object({ type: z.literal('skill.meta'), revision, meta: metaSchema }).strict(),
  z.object({ type: z.literal('combination.save'), revision, combination: combinationSchema.omit({ id: true, updatedAt: true }).extend({ id: z.string().optional() }) }).strict(),
  z.object({ type: z.literal('combination.delete'), revision, id: z.string() }).strict(),
]);
export const skillSchema = z.object({ id: z.string(), name: z.string(), description: z.string(), source: z.string(), provider: z.string(), origin: z.string(), path: z.string().optional(), whenToUse: z.string().optional() });
export const catalogSchema = z.object({ skills: z.array(skillSchema), complete: z.boolean() });
export type Prompt = z.infer<typeof promptSchema>;
export type ItemRef = z.infer<typeof refSchema>;
export type Combination = z.infer<typeof combinationSchema>;
export type PromptsFile = z.infer<typeof promptsFileSchema>;
export type LibraryFile = z.infer<typeof libraryFileSchema>;
export type LibraryState = z.infer<typeof stateSchema>;
export type Change = z.infer<typeof changeSchema>;
export type Skill = z.infer<typeof skillSchema>;
export type Catalog = z.infer<typeof catalogSchema>;
export const emptyPrompts = (): PromptsFile => ({ schemaVersion: 1, revision: 0, prompts: [] });
export const emptyLibrary = (): LibraryFile => ({ schemaVersion: 1, revision: 0, skillMeta: [], combinations: [] });
export function refKey(ref: Pick<ItemRef, 'kind' | 'id'>) { return `${ref.kind}:${ref.id}`; }
export function skillRef(skill: Skill): ItemRef { return { kind: 'skill', id: skill.id, name: skill.name, origin: skill.origin }; }
export function promptRef(prompt: Prompt): ItemRef { return { kind: 'prompt', id: prompt.id, title: prompt.title }; }
export function itemLabel(ref: ItemRef, state: LibraryState | null, skills: Skill[]) {
  return ref.kind === 'skill' ? (skills.find(s => s.id === ref.id)?.name ?? ref.name) : (state?.prompts.prompts.find(p => p.id === ref.id)?.title ?? ref.title);
}
export function textToAppend(existing: string, content: string) {
  if (!existing || !content || /[\r\n]$/.test(existing) || /^[\r\n]/.test(content)) return content;
  return '\n' + content;
}
export function resolveItems(items: ItemRef[], state: LibraryState, skills: Skill[]) {
  const missing: ItemRef[] = [];
  const parts = items.map(ref => {
    if (ref.kind === 'skill') { const skill = skills.find(s => s.id === ref.id); if (skill) return `/${skill.name}`; }
    else { const prompt = state.prompts.prompts.find(p => p.id === ref.id); if (prompt) return prompt.body; }
    missing.push(ref); return '';
  });
  return { text: parts.reduce((text, part) => text + textToAppend(text, part), ''), missing };
}
export function reorder<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || to < 0 || from >= items.length || to >= items.length || from === to) return items;
  const next = [...items]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next;
}
export function parseTags(value: string) { return [...new Set(value.split(/[,，;；\n]/).map(t => t.trim()).filter(Boolean))]; }
// Public InputState uses clipboard coordinates; each reference counts as one character in insertion coordinates.
export function draftEnd(state: { draft: string; occurrences: readonly { length: number }[]; phase: string }) {
  if (state.phase !== 'plain') throw new Error('输入框当前处于命令或提交状态，请结束该状态后再填入');
  return state.draft.length - state.occurrences.reduce((n, ref) => n + ref.length - 1, 0);
}
