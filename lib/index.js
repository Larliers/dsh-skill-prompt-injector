var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __knownSymbol = (name2, symbol) => (symbol = Symbol[name2]) ? symbol : Symbol.for("Symbol." + name2);
var __typeError = (msg) => {
  throw TypeError(msg);
};
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __decoratorStart = (base) => [, , , __create(base?.[__knownSymbol("metadata")] ?? null)];
var __decoratorStrings = ["class", "method", "getter", "setter", "accessor", "field", "value", "get", "set"];
var __expectFn = (fn) => fn !== void 0 && typeof fn !== "function" ? __typeError("Function expected") : fn;
var __decoratorContext = (kind, name2, done, metadata, fns) => ({ kind: __decoratorStrings[kind], name: name2, metadata, addInitializer: (fn) => done._ ? __typeError("Already initialized") : fns.push(__expectFn(fn || null)) });
var __decoratorMetadata = (array, target) => __defNormalProp(target, __knownSymbol("metadata"), array[3]);
var __runInitializers = (array, flags, self, value) => {
  for (var i = 0, fns = array[flags >> 1], n = fns && fns.length; i < n; i++) flags & 1 ? fns[i].call(self) : value = fns[i].call(self, value);
  return value;
};
var __decorateElement = (array, flags, name2, decorators, target, extra) => {
  var fn, it, done, ctx, access, k = flags & 7, s = !!(flags & 8), p = !!(flags & 16);
  var j = k > 3 ? array.length + 1 : k ? s ? 1 : 2 : 0, key = __decoratorStrings[k + 5];
  var initializers = k > 3 && (array[j - 1] = []), extraInitializers = array[j] || (array[j] = []);
  var desc = k && (!p && !s && (target = target.prototype), k < 5 && (k > 3 || !p) && __getOwnPropDesc(k < 4 ? target : { get [name2]() {
    return __privateGet(this, extra);
  }, set [name2](x) {
    return __privateSet(this, extra, x);
  } }, name2));
  k ? p && k < 4 && __name(extra, (k > 2 ? "set " : k > 1 ? "get " : "") + name2) : __name(target, name2);
  for (var i = decorators.length - 1; i >= 0; i--) {
    ctx = __decoratorContext(k, name2, done = {}, array[3], extraInitializers);
    if (k) {
      ctx.static = s, ctx.private = p, access = ctx.access = { has: p ? (x) => __privateIn(target, x) : (x) => name2 in x };
      if (k ^ 3) access.get = p ? (x) => (k ^ 1 ? __privateGet : __privateMethod)(x, target, k ^ 4 ? extra : desc.get) : (x) => x[name2];
      if (k > 2) access.set = p ? (x, y) => __privateSet(x, target, y, k ^ 4 ? extra : desc.set) : (x, y) => x[name2] = y;
    }
    it = (0, decorators[i])(k ? k < 4 ? p ? extra : desc[key] : k > 4 ? void 0 : { get: desc.get, set: desc.set } : target, ctx), done._ = 1;
    if (k ^ 4 || it === void 0) __expectFn(it) && (k > 4 ? initializers.unshift(it) : k ? p ? extra = it : desc[key] = it : target = it);
    else if (typeof it !== "object" || it === null) __typeError("Object expected");
    else __expectFn(fn = it.get) && (desc.get = fn), __expectFn(fn = it.set) && (desc.set = fn), __expectFn(fn = it.init) && initializers.unshift(fn);
  }
  return k || __decoratorMetadata(array, target), desc && __defProp(target, name2, desc), p ? k ^ 4 ? extra : desc : target;
};
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateIn = (member, obj) => Object(obj) !== obj ? __typeError('Cannot use the "in" operator on this value') : member.has(obj);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);

// src/index.ts
import { homedir } from "node:os";
import { join as join2, resolve } from "node:path";
import { z as z3 } from "zod";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";

// src/remote.ts
import { z as z2 } from "zod";
import { createTypertRemoteInfo } from "@deepseek-ai/dsh-typert-protocol/remote-info";

// src/model.ts
import { z } from "zod";
var title = z.string().trim().min(1, "\u6807\u9898\u4E0D\u80FD\u4E3A\u7A7A").max(120);
var tags = z.array(z.string().trim().min(1).max(80)).max(32);
var promptSchema = z.object({ id: z.string().min(1), title, body: z.string().min(1).max(65536).refine((v) => !!v.trim(), "\u6B63\u6587\u4E0D\u80FD\u4E3A\u7A7A").refine((v) => !v.includes("\uFFFC"), "\u6B63\u6587\u4E0D\u80FD\u5305\u542B\u7F16\u8F91\u5668\u5360\u4F4D\u7B26"), tags, favorite: z.boolean() }).strict();
var skillRefSchema = z.object({ kind: z.literal("skill"), id: z.string().min(1), name: z.string().min(1), origin: z.string() }).strict();
var promptRefSchema = z.object({ kind: z.literal("prompt"), id: z.string().min(1), title: z.string() }).strict();
var refSchema = z.discriminatedUnion("kind", [skillRefSchema, promptRefSchema]);
var refsSchema = z.array(refSchema).max(200).refine((items) => new Set(items.map(refKey)).size === items.length, "\u7EC4\u5408\u4E2D\u4E0D\u80FD\u5305\u542B\u91CD\u590D\u6761\u76EE");
var combinationSchema = z.object({ id: z.string().min(1), name: title, items: refsSchema.refine((v) => v.length > 0, "\u7EC4\u5408\u4E0D\u80FD\u4E3A\u7A7A"), updatedAt: z.string() }).strict();
var metaSchema = z.object({ id: z.string().min(1), name: z.string(), tags, favorite: z.boolean() }).strict();
var globalSkillFactSchema = z.object({ description: z.string(), path: z.string().optional() }).strict();
var globalSchema = z.object({ enabled: z.boolean(), items: refsSchema, skillFacts: z.record(z.string(), globalSkillFactSchema) }).strict();
var emptyGlobal = () => ({ enabled: true, items: [], skillFacts: {} });
var promptsFileSchema = z.object({ schemaVersion: z.literal(1), revision: z.number().int().nonnegative(), prompts: z.array(promptSchema) }).strict().refine((v) => new Set(v.prompts.map((p) => p.id)).size === v.prompts.length, "Prompt ID \u91CD\u590D");
var libraryFileSchema = z.object({ schemaVersion: z.literal(1), revision: z.number().int().nonnegative(), skillMeta: z.array(metaSchema), combinations: z.array(combinationSchema), global: globalSchema.default(emptyGlobal) }).strict().refine((v) => new Set(v.skillMeta.map((p) => p.id)).size === v.skillMeta.length, "Skill \u6807\u8BB0 ID \u91CD\u590D").refine((v) => new Set(v.combinations.map((p) => p.id)).size === v.combinations.length, "\u7EC4\u5408 ID \u91CD\u590D");
var stateSchema = z.object({ prompts: promptsFileSchema, library: libraryFileSchema });
var revision = z.number().int().nonnegative();
var changeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("prompt.save"), revision, prompt: promptSchema.omit({ id: true }).extend({ id: z.string().optional() }) }).strict(),
  z.object({ type: z.literal("prompt.delete"), revision, id: z.string() }).strict(),
  z.object({ type: z.literal("skill.meta"), revision, meta: metaSchema }).strict(),
  z.object({ type: z.literal("combination.save"), revision, combination: combinationSchema.omit({ id: true, updatedAt: true }).extend({ id: z.string().optional() }) }).strict(),
  z.object({ type: z.literal("combination.delete"), revision, id: z.string() }).strict(),
  z.object({ type: z.literal("global.save"), revision, global: globalSchema }).strict()
]);
var skillSchema = z.object({ id: z.string(), name: z.string(), description: z.string(), source: z.string(), provider: z.string(), origin: z.string(), path: z.string().optional(), whenToUse: z.string().optional() });
var catalogSchema = z.object({ skills: z.array(skillSchema), complete: z.boolean() });
var emptyPrompts = () => ({ schemaVersion: 1, revision: 0, prompts: [] });
var emptyLibrary = () => ({ schemaVersion: 1, revision: 0, skillMeta: [], combinations: [], global: emptyGlobal() });
function refKey(ref) {
  return `${ref.kind}:${ref.id}`;
}
function resolveGlobal(state) {
  const config = state.library.global;
  const entries = config.items.map((ref) => {
    if (ref.kind === "prompt") {
      const prompt = state.prompts.prompts.find((p) => p.id === ref.id);
      return { ref, label: prompt?.title ?? ref.title, ...prompt ? { body: prompt.body } : {}, missing: prompt ? null : "prompt" };
    }
    const fact = config.skillFacts[ref.id];
    return { ref, label: ref.name, ...fact?.description ? { description: fact.description } : {}, ...fact?.path ? { path: fact.path } : {}, missing: fact?.description ? null : "skill" };
  });
  const missing = entries.filter((e) => e.missing === "prompt").map((e) => e.ref);
  const skillLines = entries.filter((e) => e.ref.kind === "skill").map((e) => [`- ${e.label}${e.description ? `\uFF1A${e.description}` : ""}`, ...e.path ? [`  \u8DEF\u5F84\uFF1A${e.path}`] : []].join("\n"));
  const promptLines = entries.filter((e) => e.ref.kind === "prompt" && typeof e.body === "string").map((e) => [`- ${e.label}`, ...(e.body ?? "").split("\n").map((line) => `  ${line}`)].join("\n"));
  if (!config.enabled || !entries.length) return { entries, missing, text: "" };
  const blocks = [];
  if (skillLines.length) blocks.push(["### \u6280\u80FD", ...skillLines].join("\n"));
  if (promptLines.length) blocks.push(["### \u63D0\u793A\u8BCD", ...promptLines].join("\n"));
  if (!blocks.length) return { entries, missing, text: "" };
  return { entries, missing, text: ["## \u5168\u5C40\u6CE8\u5165\uFF08dsh-skill-prompt-injector\uFF09", "", "\u4EE5\u4E0B\u5185\u5BB9\u5728\u6BCF\u4E2A\u5BF9\u8BDD\u4E2D\u81EA\u52A8\u751F\u6548\u3002", "", blocks.join("\n\n")].join("\n") };
}
function renderGlobal(state) {
  return state ? resolveGlobal(state).text : "";
}

// src/remote.ts
var PACKAGE = "dsh-skill-prompt-injector";
var codec = (schema) => ({ mode: "strict", typeSymbol: `${PACKAGE}#value`, create: () => schema, jsonSchema: z2.toJSONSchema(schema) });
var sessionRequestSchema = z2.object({ sessionId: z2.string().min(1) }).strict();
function parameter(schema) {
  const value = codec(schema);
  return { name: "request", source: "json", codec: value, strictCodec: value };
}
var healthSchema = z2.object({ version: z2.string(), systemPrompt: z2.boolean() });
var remoteInfo = createTypertRemoteInfo({ package: PACKAGE, methods: {
  "skillDashboard/health": {
    service: "skillDashboard",
    invocation: { kind: "direct" },
    parameters: [],
    result: codec(healthSchema)
  },
  "skillDashboard/read": { service: "skillDashboard", invocation: { kind: "direct" }, parameters: [], result: codec(stateSchema) },
  "skillDashboard/change": { service: "skillDashboard", invocation: { kind: "direct" }, parameters: [parameter(changeSchema)], result: codec(stateSchema) },
  "skillDashboard/catalog": { service: "skillDashboard", invocation: { kind: "direct" }, parameters: [parameter(sessionRequestSchema)], cancellation: { parameter: "signal" }, result: codec(catalogSchema) }
} }, z2);

// src/storage.ts
import { mkdir, open, readFile, rename, stat, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
var JsonStorage = class {
  constructor(directory) {
    this.directory = directory;
  }
  tail = Promise.resolve();
  serialize(work) {
    const next = this.tail.then(work);
    this.tail = next.catch(() => {
    });
    return next;
  }
  async read(name2, schema, initial) {
    const path = join(this.directory, name2);
    await mkdir(this.directory, { recursive: true });
    let raw;
    try {
      if ((await stat(path)).size > 4 * 1024 * 1024) throw new Error(`${name2} \u8D85\u8FC7 4 MiB\uFF0C\u8BF7\u68C0\u67E5\u6587\u4EF6`);
      raw = await readFile(path, "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const seed = JSON.stringify(initial(), null, 2) + "\n";
      try {
        const f = await open(path, "wx");
        try {
          await f.writeFile(seed, "utf8");
          await f.sync();
        } finally {
          await f.close();
        }
      } catch (error2) {
        if (error2.code !== "EEXIST") throw error2;
      }
      raw = await readFile(path, "utf8");
    }
    try {
      return { value: schema.parse(JSON.parse(raw.replace(/^\uFEFF/, ""))), raw };
    } catch {
      throw new Error(`${name2} \u65E0\u6CD5\u89E3\u6790\u6216\u683C\u5F0F\u4E0D\u7B26\u5408\u7248\u672C 1\uFF1B\u539F\u6587\u4EF6\u5DF2\u4FDD\u7559\uFF0C\u8BF7\u4FEE\u590D\u540E\u91CD\u65B0\u52A0\u8F7D\uFF08\u53EF\u53C2\u8003 .bak\uFF09`);
    }
  }
  async documents() {
    return { prompts: await this.read("prompts.json", promptsFileSchema, emptyPrompts), library: await this.read("library.json", libraryFileSchema, emptyLibrary) };
  }
  load() {
    return this.serialize(async () => {
      const docs = await this.documents();
      return { prompts: docs.prompts.value, library: docs.library.value };
    });
  }
  async replace(path, value) {
    const temp = `${path}.${randomUUID()}.tmp`;
    try {
      const f = await open(temp, "wx");
      try {
        await f.writeFile(value, "utf8");
        await f.sync();
      } finally {
        await f.close();
      }
      await rename(temp, path);
    } finally {
      await unlink(temp).catch((error) => {
        if (error.code !== "ENOENT") throw error;
      });
    }
  }
  change(input) {
    return this.serialize(async () => {
      const change = changeSchema.parse(input);
      const docs = await this.documents();
      const state = { prompts: docs.prompts.value, library: docs.library.value };
      const isPrompt = change.type.startsWith("prompt.");
      const file = isPrompt ? state.prompts : state.library;
      if (file.revision !== change.revision) throw new Error("\u6570\u636E\u5DF2\u5728\u5176\u4ED6\u7A97\u53E3\u66F4\u65B0\uFF0C\u8BF7\u91CD\u65B0\u52A0\u8F7D\u540E\u518D\u4FDD\u5B58\uFF1B\u5F53\u524D\u7F16\u8F91\u5185\u5BB9\u4ECD\u4FDD\u7559");
      if (change.type === "prompt.save") {
        const id = change.prompt.id ?? randomUUID();
        if (change.prompt.id && !state.prompts.prompts.some((p) => p.id === id)) throw new Error("\u8BE5 Prompt \u5DF2\u88AB\u5220\u9664\uFF0C\u8BF7\u4F5C\u4E3A\u65B0\u6761\u76EE\u4FDD\u5B58");
        state.prompts.prompts = [...state.prompts.prompts.filter((p) => p.id !== id), { ...change.prompt, id }];
      } else if (change.type === "prompt.delete") {
        state.prompts.prompts = state.prompts.prompts.filter((p) => p.id !== change.id);
      } else if (change.type === "skill.meta") {
        state.library.skillMeta = [...state.library.skillMeta.filter((p) => p.id !== change.meta.id), change.meta];
      } else if (change.type === "combination.save") {
        const id = change.combination.id ?? randomUUID();
        if (change.combination.id && !state.library.combinations.some((c) => c.id === id)) throw new Error("\u8BE5\u7EC4\u5408\u5DF2\u88AB\u5220\u9664\uFF0C\u8BF7\u4FDD\u5B58\u4E3A\u65B0\u7EC4\u5408");
        if (state.library.combinations.some((c) => c.id !== id && c.name.toLocaleLowerCase() === change.combination.name.toLocaleLowerCase())) throw new Error("\u7EC4\u5408\u540D\u79F0\u5DF2\u5B58\u5728\uFF0C\u8BF7\u6539\u540D\u6216\u9009\u62E9\u8986\u76D6\u4FDD\u5B58");
        state.library.combinations = [...state.library.combinations.filter((c) => c.id !== id), { ...change.combination, id, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }];
      } else if (change.type === "combination.delete") {
        state.library.combinations = state.library.combinations.filter((c) => c.id !== change.id);
      } else if (change.type === "global.save") {
        state.library.global = change.global;
      }
      file.revision++;
      const name2 = isPrompt ? "prompts.json" : "library.json";
      const original = isPrompt ? docs.prompts.raw : docs.library.raw;
      const path = join(this.directory, name2);
      const validated = isPrompt ? promptsFileSchema.parse(file) : libraryFileSchema.parse(file);
      if (await readFile(path, "utf8") !== original) throw new Error("\u4FDD\u5B58\u671F\u95F4\u6570\u636E\u6587\u4EF6\u53D1\u751F\u53D8\u5316\uFF0C\u8BF7\u91CD\u65B0\u52A0\u8F7D\u540E\u91CD\u8BD5");
      await this.replace(path + ".bak", original);
      await this.replace(path, JSON.stringify(validated, null, 2) + "\n");
      return state;
    });
  }
};

// src/index.ts
var name = PACKAGE;
var inject = ["typert"];
var defaultDataDirectory = resolve(process.env.DSH_HOME ?? join2(homedir(), ".dsh"), "skill-prompt-injector");
var Config = z3.object({ dataDirectory: z3.string().default(defaultDataDirectory) }).default({ dataDirectory: defaultDataDirectory });
var GlobalMirror = class {
  state = null;
  set(state) {
    this.state = state;
  }
  render() {
    try {
      return renderGlobal(this.state);
    } catch {
      return "";
    }
  }
};
var globalMirror = new GlobalMirror();
var GLOBAL_SECTION = { name: `${PACKAGE}:global`, order: 9600 };
var _catalog_dec, _change_dec, _read_dec, _health_dec, _a, _init;
var DashboardService = class extends (_a = TypertRemoteService, _health_dec = [Remote], _read_dec = [Remote], _change_dec = [Remote], _catalog_dec = [Remote({ resources: { session: (request) => request.sessionId } })], _a) {
  constructor(ctx, config) {
    super(ctx, "skillDashboard");
    __runInitializers(_init, 5, this);
    __publicField(this, "storage");
    this.storage = new JsonStorage(resolve(config.dataDirectory));
    void this.storage.load().then((state) => globalMirror.set(state)).catch(() => {
    });
  }
  async health() {
    return { version: "0.2.0", systemPrompt: this.ctx.get("systemPrompt") !== void 0 };
  }
  async read() {
    const state = await this.storage.load();
    globalMirror.set(state);
    return state;
  }
  async change(request) {
    const state = await this.storage.change(request);
    globalMirror.set(state);
    return state;
  }
  async catalog(request, signal) {
    sessionRequestSchema.parse(request);
    const { sessionId } = request;
    const query = this.ctx.get("sessionQuery");
    const agents = this.ctx.get("agents");
    const workingDirectory = this.ctx.get("workingDirectory");
    if (!query) throw new Error("Harness \u4F1A\u8BDD\u76EE\u5F55\u670D\u52A1\u5C1A\u672A\u5C31\u7EEA\uFF0C\u8BF7\u7A0D\u540E\u5237\u65B0");
    const observation = await query.observeSession(sessionId);
    let cwd;
    let preset;
    try {
      cwd = observation.projections?.values.workingDirectory ?? observation.header.cwd ?? workingDirectory?.defaultDirectory;
      preset = observation.projections?.values.agentPreset ?? void 0;
    } finally {
      observation[Symbol.dispose]();
    }
    const live = agents?.get(sessionId);
    if (live && workingDirectory) cwd = await workingDirectory.ensure(live, signal);
    const presets = this.ctx.get("agentPresets");
    const registry = (live ? presets?.serviceFor(live, "skills") : void 0) ?? this.ctx.get("skills");
    if (!registry) throw new Error("\u5F53\u524D Harness \u7EC4\u5408\u672A\u63D0\u4F9B Skill \u6CE8\u518C\u8868\uFF0C\u8BF7\u542F\u7528 Skill \u529F\u80FD\u540E\u5237\u65B0");
    const lease = live ? void 0 : await presets?.acquireScope(preset);
    try {
      signal?.throwIfAborted();
      const snapshot = await registry.snapshot({ cwd, scope: live ?? lease?.key, signal });
      signal?.throwIfAborted();
      return { complete: snapshot.complete, skills: snapshot.skills.filter((s) => s.invocation.userInvocable).map((s) => {
        const path = s.path?.replace(/\\/g, "/");
        const location = path ?? JSON.stringify([cwd, preset, s.resourceBase ?? null]);
        const id = JSON.stringify([s.name, s.provider, s.source, /^[A-Za-z]:\//.test(location) ? location.toLowerCase() : location]);
        return { id, name: s.name, description: s.description, provider: s.provider, source: s.source, origin: `${s.provider} \xB7 ${s.source}`, ...path ? { path } : {}, ...s.whenToUse ? { whenToUse: s.whenToUse } : {} };
      }) };
    } finally {
      await lease?.[Symbol.asyncDispose]();
    }
  }
};
_init = __decoratorStart(_a);
__decorateElement(_init, 1, "health", _health_dec, DashboardService);
__decorateElement(_init, 1, "read", _read_dec, DashboardService);
__decorateElement(_init, 1, "change", _change_dec, DashboardService);
__decorateElement(_init, 1, "catalog", _catalog_dec, DashboardService);
__decoratorMetadata(_init, DashboardService);
function apply(ctx, config) {
  const resolved = Config.parse(config ?? {});
  ctx.typert.register({ package: PACKAGE, face: "host", schemas: [], invocations: remoteInfo.descriptors, model: { services: [], events: [], objects: [] } });
  ctx.plugin(DashboardService, resolved);
  ctx.inject(["systemPrompt"], (scope) => {
    scope.effect(() => scope.systemPrompt.section({ ...GLOBAL_SECTION, interpolate: false, text: () => globalMirror.render() }));
  });
}
export {
  Config,
  DashboardService,
  GlobalMirror,
  apply,
  globalMirror,
  inject,
  name
};
//# sourceMappingURL=index.js.map
