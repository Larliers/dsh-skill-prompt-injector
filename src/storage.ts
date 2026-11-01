import { mkdir, open, readFile, rename, stat, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { z } from 'zod';
import { changeSchema, emptyLibrary, emptyPrompts, libraryFileSchema, promptsFileSchema, type Change, type LibraryState } from './model.js';

export class JsonStorage {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(readonly directory: string) {}
  private serialize<T>(work: () => Promise<T>): Promise<T> {
    const next = this.tail.then(work); this.tail = next.catch(() => {}); return next;
  }
  private async read<T>(name: string, schema: z.ZodType<T>, initial: () => T): Promise<{ value: T; raw: string }> {
    const path = join(this.directory, name);
    await mkdir(this.directory, { recursive: true });
    let raw: string;
    try {
      if ((await stat(path)).size > 4 * 1024 * 1024) throw new Error(`${name} 超过 4 MiB，请检查文件`);
      raw = await readFile(path, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      const seed = JSON.stringify(initial(), null, 2) + '\n';
      try { const f = await open(path, 'wx'); try { await f.writeFile(seed, 'utf8'); await f.sync(); } finally { await f.close(); } }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
      raw = await readFile(path, 'utf8');
    }
    try { return { value: schema.parse(JSON.parse(raw.replace(/^\uFEFF/, ''))), raw }; }
    catch { throw new Error(`${name} 无法解析或格式不符合版本 1；原文件已保留，请修复后重新加载（可参考 .bak）`); }
  }
  private async documents() {
    return { prompts: await this.read('prompts.json', promptsFileSchema, emptyPrompts), library: await this.read('library.json', libraryFileSchema, emptyLibrary) };
  }
  load(): Promise<LibraryState> { return this.serialize(async () => { const docs = await this.documents(); return { prompts: docs.prompts.value, library: docs.library.value }; }); }
  private async replace(path: string, value: string) {
    const temp = `${path}.${randomUUID()}.tmp`;
    try {
      const f = await open(temp, 'wx');
      try { await f.writeFile(value, 'utf8'); await f.sync(); } finally { await f.close(); }
      await rename(temp, path);
    } finally { await unlink(temp).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
  }
  change(input: Change): Promise<LibraryState> {
    return this.serialize(async () => {
      const change = changeSchema.parse(input);
      const docs = await this.documents();
      const state: LibraryState = { prompts: docs.prompts.value, library: docs.library.value };
      const isPrompt = change.type.startsWith('prompt.');
      const file = isPrompt ? state.prompts : state.library;
      if (file.revision !== change.revision) throw new Error('数据已在其他窗口更新，请重新加载后再保存；当前编辑内容仍保留');
      if (change.type === 'prompt.save') {
        const id = change.prompt.id ?? randomUUID();
        if (change.prompt.id && !state.prompts.prompts.some(p => p.id === id)) throw new Error('该 Prompt 已被删除，请作为新条目保存');
        state.prompts.prompts = [...state.prompts.prompts.filter(p => p.id !== id), { ...change.prompt, id }];
      } else if (change.type === 'prompt.delete') {
        state.prompts.prompts = state.prompts.prompts.filter(p => p.id !== change.id);
      } else if (change.type === 'skill.meta') {
        state.library.skillMeta = [...state.library.skillMeta.filter(p => p.id !== change.meta.id), change.meta];
      } else if (change.type === 'combination.save') {
        const id = change.combination.id ?? randomUUID();
        if (change.combination.id && !state.library.combinations.some(c => c.id === id)) throw new Error('该组合已被删除，请保存为新组合');
        if (state.library.combinations.some(c => c.id !== id && c.name.toLocaleLowerCase() === change.combination.name.toLocaleLowerCase())) throw new Error('组合名称已存在，请改名或选择覆盖保存');
        state.library.combinations = [...state.library.combinations.filter(c => c.id !== id), { ...change.combination, id, updatedAt: new Date().toISOString() }];
      } else if (change.type === 'combination.delete') {
        state.library.combinations = state.library.combinations.filter(c => c.id !== change.id);
      } else if (change.type === 'global.save') {
        state.library.global = change.global;
      }
      file.revision++;
      const name = isPrompt ? 'prompts.json' : 'library.json';
      const original = isPrompt ? docs.prompts.raw : docs.library.raw;
      const path = join(this.directory, name);
      const validated = isPrompt ? promptsFileSchema.parse(file) : libraryFileSchema.parse(file);
      if (await readFile(path, 'utf8') !== original) throw new Error('保存期间数据文件发生变化，请重新加载后重试');
      await this.replace(path + '.bak', original);
      await this.replace(path, JSON.stringify(validated, null, 2) + '\n');
      return state;
    });
  }
}
